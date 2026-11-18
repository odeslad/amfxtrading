#property copyright "HttpBridge"
#property version   "2.23"
#property strict

// Spec 049: the Home key makes MT4 ask the broker for older bars (ChartNavigate alone does not).
#import "user32.dll"
   int PostMessageW(int hWnd, int msg, int wParam, int lParam);
#import

#define WM_KEYDOWN           0x0100
#define WM_KEYUP             0x0101
#define VK_HOME              0x24
#define ERR_HISTORY_UPDATING 4066

input string BROKER_NAME = "ftmo";
input string SYMBOLS     = "EURUSD,EURGBP,EURJPY,EURCAD,EURAUD,GBPUSD,GBPJPY,GBPCAD,GBPAUD,USDJPY,USDCAD,AUDUSD,AUDJPY,AUDCAD,CADJPY";
input int    SYNC_IDLE_S      = 5;    // seconds a temporary chart waits for the first new bars before giving up.
input int    SYNC_STABLE_S    = 12;   // seconds without new bars that end a load once bars started to arrive.
input int    SYNC_CHART_MAX_S = 120;  // max seconds a temporary chart stays open for one symbol and timeframe.
input int    SYNC_HANDOFF_MAX_S = 900; // max seconds to wait for the backend to take the files of a timeframe.

string g_brokerName = "";
string g_symbolsRaw = "";
string g_symbols[];
int    g_symbolCount = 0;

// Candle sync in progress (spec 049): one symbol × timeframe per timer tick.
string g_syncId         = "";
string g_syncTfLabels[];
int    g_syncTargets[];
int    g_syncTfCount    = 0;
int    g_syncTf         = 0;
int    g_syncSym        = 0;
int    g_syncPhase      = 0;     // 0 = next symbol, 1 = temporary chart open, 2 = waiting for the backend.
long   g_syncChart      = 0;
int    g_syncLastBars   = 0;
bool   g_syncGrew       = false;
ulong  g_syncStarted    = 0;
ulong  g_syncQuietSince = 0;

void LoadConfig() {
   g_brokerName = BROKER_NAME;
   g_symbolsRaw = SYMBOLS;
   if (FileIsExist("bridge\\config.json")) {
      int handle = FileOpen("bridge\\config.json", FILE_READ | FILE_TXT | FILE_ANSI);
      if (handle != INVALID_HANDLE) {
         string content = "";
         while (!FileIsEnding(handle)) content += FileReadString(handle);
         FileClose(handle);
         string b = ExtractField(content, "brokerName");
         string s = ExtractField(content, "symbols");
         if (StringLen(b) > 0) g_brokerName = b;
         if (StringLen(s) > 0) g_symbolsRaw = s;
         Print("[CMD] Config loaded from config.json | broker: ", g_brokerName);
         return;
      }
   }
   string company = AccountCompany();
   if (StringLen(company) > 0) g_brokerName = company;
   Print("[CMD] No config.json — broker fallback: ", g_brokerName);
}

void ParseSymbols() {
   g_symbolCount = 0;
   ArrayResize(g_symbols, 0);
   string parts[];
   int n = StringSplit(g_symbolsRaw, ',', parts);
   for (int i = 0; i < n; i++) {
      string sym = parts[i];
      StringTrimLeft(sym);
      StringTrimRight(sym);
      if (StringLen(sym) == 0) continue;
      ArrayResize(g_symbols, g_symbolCount + 1);
      g_symbols[g_symbolCount++] = sym;
   }
}

int OnInit() {
   LoadConfig();
   ParseSymbols();
   EventSetTimer(1);
   Print("[CMD] HttpBridgeCommands v2.23 | broker: ", g_brokerName, " | symbols: ", g_symbolCount,
         " | max bars in chart: ", TerminalInfoInteger(TERMINAL_MAXBARS),
         " | DLL imports: ", DllsAllowed() ? "allowed" : "OFF (candle sync unavailable)", " | ready");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   FileDelete("bridge\\pending.json");
   if (g_syncId != "") {
      if (g_syncChart > 0) { ChartClose(g_syncChart); g_syncChart = 0; }
      WriteSyncStatus("error", "", "", 0, "The EA stopped during the sync");
      g_syncId = "";
   }
   Print("[CMD] Stopped | reason: ", reason);
}

// Orders first: a sync step never delays a command.
void OnTimer() {
   CheckCommands();
   SyncStep();
}

void CheckCommands() {
   if (!FileIsExist("bridge\\command.json")) return;
   int handle = FileOpen("bridge\\command.json", FILE_READ | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[CMD] ERROR: could not open command.json");
      return;
   }
   string content = "";
   while (!FileIsEnding(handle)) content += FileReadString(handle);
   FileClose(handle);
   FileDelete("bridge\\command.json");
   if (StringLen(content) > 0) ExecuteCommand(content);
}

void ExecuteCommand(string json) {
   string action = ExtractField(json, "action");
   string symbol = ExtractField(json, "symbol");
   double lots   = StringToDouble(ExtractField(json, "lots"));
   double sl     = StringToDouble(ExtractField(json, "sl"));
   double tp     = StringToDouble(ExtractField(json, "tp"));
   double price  = StringToDouble(ExtractField(json, "price"));
   string cmdId  = ExtractField(json, "id");
   int    magic  = (int)StringToInteger(ExtractField(json, "magic"));

   Print("[CMD] Received: action=", action,
         " symbol=", symbol,
         " lots=", DoubleToString(lots, 2),
         " sl=", DoubleToString(sl, 5),
         " tp=", DoubleToString(tp, 5),
         " id=", cmdId);

   WritePending(cmdId, action, symbol);

   string result = "";

   if (action == "buy" || action == "sell") {
      int    cmd      = (action == "buy") ? OP_BUY : OP_SELL;
      double mktPrice = (cmd == OP_BUY) ? MarketInfo(symbol, MODE_ASK) : MarketInfo(symbol, MODE_BID);
      int    ticket   = OrderSend(symbol, cmd, lots, mktPrice, 3, sl, tp, "HttpBridge", magic, 0, clrNONE);
      if (ticket < 0) {
         int err = GetLastError();
         Print("[CMD] ERROR: ", action, " failed | code=", err, " symbol=", symbol, " lots=", DoubleToString(lots, 2), " id=", cmdId);
         result = ResultError(err, cmdId);
      } else {
         Print("[CMD] OK: ", action, " executed | ticket=", ticket, " symbol=", symbol, " lots=", DoubleToString(lots, 2), " price=", DoubleToString(mktPrice, 5));
         result = ResultOk(ticket, cmdId);
      }
   }
   else if (action == "buylimit" || action == "selllimit" || action == "buystop" || action == "sellstop") {
      int cmd = OP_BUYLIMIT;
      if (action == "buylimit")  cmd = OP_BUYLIMIT;
      if (action == "selllimit") cmd = OP_SELLLIMIT;
      if (action == "buystop")   cmd = OP_BUYSTOP;
      if (action == "sellstop")  cmd = OP_SELLSTOP;
      int ticket = OrderSend(symbol, cmd, lots, price, 3, sl, tp, "HttpBridge", magic, 0, clrNONE);
      if (ticket < 0) {
         int err = GetLastError();
         Print("[CMD] ERROR: ", action, " failed | code=", err, " symbol=", symbol, " price=", DoubleToString(price, 5), " id=", cmdId);
         result = ResultError(err, cmdId);
      } else {
         Print("[CMD] OK: ", action, " placed | ticket=", ticket, " symbol=", symbol, " price=", DoubleToString(price, 5));
         result = ResultOk(ticket, cmdId);
      }
   }
   else if (action == "close") {
      int ticket = (int)StringToInteger(ExtractField(json, "ticket"));
      if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
         Print("[CMD] ERROR: close failed | ticket not found: ", ticket, " id=", cmdId);
         result = "{\"status\":\"error\",\"message\":\"ticket not found\",\"id\":\"" + cmdId + "\"}";
      } else if (OrderType() == OP_BUY || OrderType() == OP_SELL) {
         double closePrice = (OrderType() == OP_BUY) ? MarketInfo(OrderSymbol(), MODE_BID) : MarketInfo(OrderSymbol(), MODE_ASK);
         bool closed = false;
         for (int i = 0; i < 5 && !closed; i++) {
            closed = OrderClose(ticket, OrderLots(), closePrice, 3, clrNONE);
            if (!closed) {
               Print("[CMD] Close attempt ", i + 1, "/5 failed | ticket=", ticket, " error=", GetLastError());
               Sleep(500);
            }
         }
         if (closed) {
            Print("[CMD] OK: close executed | ticket=", ticket, " symbol=", OrderSymbol(), " price=", DoubleToString(closePrice, 5));
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: close failed after 5 attempts | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      } else {
         bool deleted = OrderDelete(ticket);
         if (deleted) {
            Print("[CMD] OK: pending order deleted | ticket=", ticket);
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: delete pending failed | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      }
   }
   else if (action == "modify") {
      int ticket = (int)StringToInteger(ExtractField(json, "ticket"));
      if (!OrderSelect(ticket, SELECT_BY_TICKET)) {
         Print("[CMD] ERROR: modify failed | ticket not found: ", ticket, " id=", cmdId);
         result = "{\"status\":\"error\",\"message\":\"ticket not found\",\"id\":\"" + cmdId + "\"}";
      } else {
         // A pending order moves to the received price; a market position keeps its open price.
         bool   isPending = (OrderType() >= OP_BUYLIMIT);
         double newPrice  = (isPending && price > 0) ? price : OrderOpenPrice();
         bool ok = OrderModify(ticket, newPrice, sl, tp, 0, clrNONE);
         if (ok) {
            Print("[CMD] OK: modify executed | ticket=", ticket, " price=", DoubleToString(newPrice, 5), " sl=", DoubleToString(sl, 5), " tp=", DoubleToString(tp, 5));
            result = ResultOk(-1, cmdId);
         } else {
            int err = GetLastError();
            Print("[CMD] ERROR: modify failed | ticket=", ticket, " code=", err);
            result = ResultError(err, cmdId);
         }
      }
   }
   else {
      Print("[CMD] ERROR: unknown action '", action, "' | id=", cmdId);
   }

   if (result != "") {
      WriteFile("result.json", result);
      FileDelete("bridge\\pending.json");
   }
}

void WritePending(string id, string action, string symbol) {
   if (FileIsExist("bridge\\pending.json"))
      Print("[CMD] WARN: pending.json already exists — EA may have crashed or restarted mid-execution | new action=", action, " id=", id);
   string j = "{\"status\":\"processing\""
            + ",\"id\":\"" + id + "\""
            + ",\"action\":\"" + action + "\""
            + ",\"symbol\":\"" + symbol + "\""
            + "}";
   WriteFile("pending.json", j);
}

string ResultOk(int ticket, string id) {
   string t = ticket > 0 ? ",\"ticket\":" + IntegerToString(ticket) : "";
   return "{\"status\":\"ok\"" + t + ",\"id\":\"" + id + "\"}";
}

string ResultError(int code, string id) {
   return "{\"status\":\"error\",\"code\":" + IntegerToString(code) + ",\"id\":\"" + id + "\"}";
}

void WriteFile(string filename, string content) {
   int handle = FileOpen("bridge\\" + filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[CMD] ERROR: could not write file: ", filename);
      return;
   }
   FileWriteString(handle, content);
   FileClose(handle);
}

string ExtractField(string json, string key) {
   int p = StringFind(json, "\"" + key + "\"");
   if (p < 0) return "";
   int colon = StringFind(json, ":", p);
   if (colon < 0) return "";
   p = colon + 1;

   while (p < StringLen(json)) {
      ushort c = StringGetCharacter(json, p);
      if (c == ' ' || c == '\t' || c == '\n' || c == '\r') p++;
      else break;
   }
   if (p >= StringLen(json)) return "";

   if (StringGetCharacter(json, p) == '"') {
      int start = p + 1;
      int end = StringFind(json, "\"", start);
      if (end < 0) return "";
      return StringSubstr(json, start, end - start);
   }

   int s = p;
   int e = StringFind(json, ",", s);
   if (e < 0) e = StringFind(json, "}", s);
   if (e < 0) e = StringLen(json);
   string v = StringSubstr(json, s, e - s);
   StringTrimLeft(v);
   StringTrimRight(v);
   return v;
}

// ────────────────────────────────────────────────────────────────────────────
// Candle sync (spec 049): Settings › Data asks for the latest N closed bars of every
// symbol in the marked timeframes. A symbol short of history is shown on a temporary
// chart taken to its beginning until the broker sends no more bars.
// ────────────────────────────────────────────────────────────────────────────

// A DLL call without permission stops the whole EA (orders included): check before calling.
bool DllsAllowed() {
   return TerminalInfoInteger(TERMINAL_DLLS_ALLOWED) != 0 && MQLInfoInteger(MQL_DLLS_ALLOWED) != 0;
}

int LabelToPeriod(string label) {
   if (label == "M5")  return PERIOD_M5;
   if (label == "M15") return PERIOD_M15;
   if (label == "H1")  return PERIOD_H1;
   if (label == "H4")  return PERIOD_H4;
   if (label == "D1")  return PERIOD_D1;
   return 0;
}

bool StartSync() {
   if (!FileIsExist("bridge\\sync-command.json")) return false;
   int handle = FileOpen("bridge\\sync-command.json", FILE_READ | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) return false;
   string json = "";
   while (!FileIsEnding(handle)) json += FileReadString(handle);
   FileClose(handle);
   FileDelete("bridge\\sync-command.json");

   g_syncId = ExtractField(json, "id");
   g_syncTfCount = 0;
   ArrayResize(g_syncTfLabels, 0);
   ArrayResize(g_syncTargets, 0);
   int p = StringFind(json, "\"tf\"");
   while (p >= 0) {
      string item  = StringSubstr(json, p, StringFind(json, "}", p) - p + 1);
      string label = ExtractField(item, "tf");
      int target   = (int)StringToInteger(ExtractField(item, "target"));
      if (LabelToPeriod(label) > 0 && target > 0) {
         ArrayResize(g_syncTfLabels, g_syncTfCount + 1);
         ArrayResize(g_syncTargets, g_syncTfCount + 1);
         g_syncTfLabels[g_syncTfCount] = label;
         g_syncTargets[g_syncTfCount]  = target;
         g_syncTfCount++;
      }
      p = StringFind(json, "\"tf\"", p + 4);
   }

   if (g_syncId == "" || g_syncTfCount == 0 || g_symbolCount == 0) {
      Print("[SYNC] Ignored an invalid sync command");
      if (g_syncId != "") WriteSyncStatus("error", "", "", 0, "Invalid sync command");
      g_syncId = "";
      return false;
   }

   FolderCreate("bridge\\sync");
   g_syncTf = 0;
   g_syncSym = 0;
   g_syncPhase = 0;
   Print("[SYNC] Start | id: ", g_syncId, " | timeframes: ", g_syncTfCount, " | symbols: ", g_symbolCount);
   return true;
}

void SyncStep() {
   if (g_syncId == "" && !StartSync()) return;

   string label  = g_syncTfLabels[g_syncTf];
   int    period = LabelToPeriod(label);
   int    target = g_syncTargets[g_syncTf];
   ulong  now    = GetTickCount();

   if (g_syncPhase == 2) {
      if (!SyncFilesLeft(label)) { NextTimeframe(); return; }
      if (now - g_syncStarted >= (ulong)SYNC_HANDOFF_MAX_S * 1000) FailSync("The backend did not take the " + label + " candles");
      return;
   }

   string sym = g_symbols[g_syncSym];

   if (g_syncPhase == 0) {
      WriteSyncStatus("running", label, sym, g_syncSym, "");
      int bars = iBars(sym, period);
      if (bars > target) { ExportSymbol(sym, period, label, target); return; }
      if (!DllsAllowed()) { FailSync("Allow DLL imports is off in this terminal"); return; }
      g_syncChart = ChartOpen(sym, period);
      if (g_syncChart <= 0) { FailSync("Could not open a " + sym + " " + label + " chart"); return; }
      ChartSetInteger(g_syncChart, CHART_AUTOSCROLL, false);
      g_syncLastBars   = bars;
      g_syncGrew       = false;
      g_syncStarted    = now;
      g_syncQuietSince = now;
      g_syncPhase      = 1;
      return;
   }

   ScrollChartToBeginning(g_syncChart);
   ResetLastError();
   int bars = iBars(sym, period);
   iTime(sym, period, 0);
   bool updating = GetLastError() == ERR_HISTORY_UPDATING;
   if (bars != g_syncLastBars) {
      g_syncLastBars   = bars;
      g_syncGrew       = true;
      g_syncQuietSince = now;
   }

   int  quietS  = g_syncGrew ? SYNC_STABLE_S : SYNC_IDLE_S;
   bool enough  = bars > target;
   bool stable  = !updating && now - g_syncQuietSince >= (ulong)quietS * 1000;
   bool expired = now - g_syncStarted >= (ulong)SYNC_CHART_MAX_S * 1000;
   if (enough || stable || expired) {
      ChartClose(g_syncChart);
      g_syncChart = 0;
      ExportSymbol(sym, period, label, target);
   }
}

void ScrollChartToBeginning(long chart) {
   ChartNavigate(chart, CHART_BEGIN, 0);
   int window = (int)ChartGetInteger(chart, CHART_WINDOW_HANDLE);
   if (window == 0) return;
   PostMessageW(window, WM_KEYDOWN, VK_HOME, 0);
   PostMessageW(window, WM_KEYUP, VK_HOME, 0);
}

// The newest `target` closed bars, oldest first; bar 0 is still forming.
void ExportSymbol(string sym, int period, string label, int target) {
   int bars  = iBars(sym, period);
   int limit = MathMin(bars - 1, target);
   int brokerOffset = (int)(TimeCurrent() - TimeGMT());
   string tmp  = "bridge\\sync\\" + sym + "_" + label + ".tmp";
   string file = "bridge\\sync\\" + sym + "_" + label + ".json";

   int handle = FileOpen(tmp, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) { FailSync("Could not write the " + sym + " " + label + " candles"); return; }
   FileWriteString(handle, "{\"brokerOffset\":" + IntegerToString(brokerOffset) + ",\"candles\":[");
   for (int i = limit; i >= 1; i--) {
      FileWriteString(handle, "{\"time\":"  + IntegerToString(iTime(sym, period, i)) +
                              ",\"open\":"  + DoubleToString(iOpen(sym,  period, i), 5) +
                              ",\"high\":"  + DoubleToString(iHigh(sym,  period, i), 5) +
                              ",\"low\":"   + DoubleToString(iLow(sym,   period, i), 5) +
                              ",\"close\":" + DoubleToString(iClose(sym, period, i), 5) + "}" +
                              (i > 1 ? "," : ""));
   }
   FileWriteString(handle, "]}");
   FileClose(handle);
   FileDelete(file);
   if (!FileMove(tmp, 0, file, FILE_REWRITE)) { FailSync("Could not write the " + sym + " " + label + " candles"); return; }
   Print("[SYNC] ", sym, " ", label, " | bars: ", limit, " of ", target);

   g_syncPhase = 0;
   g_syncSym++;
   if (g_syncSym < g_symbolCount) return;

   // Every symbol of the timeframe is written: the backend swaps it, then deletes the files.
   WriteSyncStatus("complete", label, "", g_symbolCount, "");
   g_syncPhase   = 2;
   g_syncStarted = GetTickCount();
}

bool SyncFilesLeft(string label) {
   string name;
   long search = FileFindFirst("bridge\\sync\\*_" + label + ".json", name);
   if (search == INVALID_HANDLE) return false;
   FileFindClose(search);
   return true;
}

void NextTimeframe() {
   g_syncTf++;
   g_syncSym   = 0;
   g_syncPhase = 0;
   if (g_syncTf < g_syncTfCount) return;
   WriteSyncStatus("finished", "", "", g_symbolCount, "");
   Print("[SYNC] Finished | id: ", g_syncId);
   g_syncId = "";
}

void FailSync(string message) {
   if (g_syncChart > 0) { ChartClose(g_syncChart); g_syncChart = 0; }
   WriteSyncStatus("error", "", "", 0, message);
   Print("[SYNC] ERROR: ", message, " | id: ", g_syncId);
   g_syncId = "";
}

void WriteSyncStatus(string state, string label, string sym, int done, string message) {
   string j = "{\"id\":\"" + g_syncId + "\",\"state\":\"" + state + "\"";
   if (label != "")   j += ",\"timeframe\":\"" + label + "\"";
   if (sym != "")     j += ",\"symbol\":\"" + sym + "\"";
   j += ",\"done\":" + IntegerToString(done) + ",\"total\":" + IntegerToString(g_symbolCount);
   if (message != "") j += ",\"message\":\"" + message + "\"";
   j += "}";
   WriteFile("sync-status.json", j);
}
