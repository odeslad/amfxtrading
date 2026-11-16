#property copyright "HttpBridge"
#property version   "3.16"
#property strict

#import "kernel32.dll"
   int  CreateFileW(string name, int access, int share, int security, int creation, int flags, int htemplate);
   bool WriteFile(int handle, uchar &buf[], int toWrite, int &written[], int &ovlp[]);
   bool CloseHandle(int handle);
   int  CreateEventW(int security, int manualReset, int initialState, int name);
   int  WaitForSingleObject(int handle, uint ms);
   bool CancelIo(int handle);
   bool ResetEvent(int handle);
#import

#import "user32.dll"
   int  PostMessageW(int hWnd, int msg, int wParam, int lParam);
#import

input string BROKER_NAME   = "ftmo";
input string SYMBOLS       = "EURUSD,EURGBP,EURJPY,EURCAD,EURAUD,GBPUSD,GBPJPY,GBPCAD,GBPAUD,USDJPY,USDCAD,AUDUSD,AUDJPY,AUDCAD,CADJPY";
input int    RECENT_BARS   = 100;
input int    STATE_EVERY_S = 60;         // seconds between state updates (history, candles).
input int    POSITIONS_EVERY_S = 1;      // seconds between live position pushes over the pipe.
input int    ACCOUNT_EVERY_S = 1;        // seconds between live account pushes over the pipe.
input int    HISTORY_MAX    = 50;        // closed trades per history.json write (0 = no limit).
input bool   HISTORY_FULL_ON_START = true; // first history.json write after start exports every closed trade.
input int    HISTORY_MIN_GAP_S = 3;      // min seconds between history.json writes triggered by a history change.
input bool   CANDLES_LOAD   = true;      // make MT4 load the candle history of every symbol and timeframe after start.
input int    CANDLES_IDLE_S = 5;         // seconds a temporary chart waits for the first new bars before giving up.
input int    CANDLES_CHART_MAX_S = 120;  // max seconds a temporary chart stays open for one symbol and timeframe.
input int    CANDLES_STABLE_S = 12;      // seconds without new bars that end a load once bars started to arrive.

bool g_historyFullPending = HISTORY_FULL_ON_START;

// ── Candle history: load and full exports ────────────────────────────────────
// A pair is one symbol and one timeframe: index = symbol index * TF_COUNT + timeframe index.
#define TF_COUNT               5
#define ERR_HISTORY_UPDATING   4066
#define CANDLES_GROWTH_BARS    2         // more bars than one state cycle can add: MT4 obtained history.
#define DAY_S                  86400
#define D1_MAX_GAP_S           432000    // five days: longer than any weekend plus holiday.
#define WM_KEYDOWN             0x0100
#define WM_KEYUP               0x0101
#define VK_HOME                0x24

int    g_periods[TF_COUNT] = {PERIOD_M5, PERIOD_M15, PERIOD_H1, PERIOD_H4, PERIOD_D1};
int    g_pairCount       = 0;
int    g_seenBars[];                     // bars MT4 held at the last look, per pair.
bool   g_fullPending[];                  // full export queued, per pair.
int    g_loadPair        = -1;           // pair being loaded; g_pairCount once every pair is loaded.
int    g_loadPhase       = 0;            // 0 = not started, 1 = temporary chart open.
long   g_loadChart       = 0;
int    g_loadBarsStart   = 0;
int    g_loadLastBars    = 0;
bool   g_loadGrew        = false;        // bars arrived while the temporary chart was open.
ulong  g_loadStarted     = 0;
ulong  g_loadStableSince = 0;
ulong  lastCandleStep    = 0;

// ── Runtime config (config.json overrides inputs) ────────────────────────────
string g_brokerName  = "";
string g_symbolsRaw  = "";

// ── Pipe state ──────────────────────────────────────────────────────────────
string g_pipeName     = "";
int    g_pipe         = INVALID_HANDLE;
int    g_event        = INVALID_HANDLE;
int    g_ovlp[5];
int    g_timeouts     = 0;

// ── Timer state ──────────────────────────────────────────────────────────────
ulong  lastStateSend      = 0;
ulong  lastPositionsSend  = 0;
ulong  lastAccountSend    = 0;
int    g_lastPositionCount = -1;
int    g_lastHistoryTotal  = -1;
ulong  lastHistoryWrite    = 0;

// ── Symbol list ──────────────────────────────────────────────────────────────
string g_symbols[];
int    g_symbolCount = 0;

#define GENERIC_WRITE          0x40000000
#define OPEN_EXISTING          3
#define FILE_ATTRIB_NORM       0x80
#define FILE_FLAG_OVERLAPPED   0x40000000
#define WAIT_OBJECT_0          0
#define WAIT_TIMEOUT_CODE      0x102
#define PIPE_WRITE_TIMEOUT_MS  8

// ────────────────────────────────────────────────────────────────────────────
// Symbol list parsing
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Config loading (bridge/config.json overrides inputs; AccountCompany fallback)
// ────────────────────────────────────────────────────────────────────────────

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
         Print("[STATE] Config loaded from config.json | broker: ", g_brokerName,
               " | symbols from config: ", (StringLen(s) > 0));
         return;
      }
   }

   string company = AccountCompany();
   if (StringLen(company) > 0) g_brokerName = company;
   Print("[STATE] No config.json — broker fallback: ", g_brokerName, " | symbols from input");
}

void ParseSymbols() {
   string raw = g_symbolsRaw;
   g_symbolCount = 0;
   ArrayResize(g_symbols, 0);

   int start = 0;
   for (int i = 0; i <= StringLen(raw); i++) {
      if (i == StringLen(raw) || StringGetCharacter(raw, i) == ',') {
         string sym = StringSubstr(raw, start, i - start);
         StringTrimLeft(sym);
         StringTrimRight(sym);
         if (StringLen(sym) > 0) {
            ArrayResize(g_symbols, g_symbolCount + 1);
            g_symbols[g_symbolCount] = sym;
            g_symbolCount++;
         }
         start = i + 1;
      }
   }
}

// ────────────────────────────────────────────────────────────────────────────
// Pipe management
// ────────────────────────────────────────────────────────────────────────────

void PipeClose() {
   if (g_pipe != INVALID_HANDLE) {
      CancelIo(g_pipe);
      CloseHandle(g_pipe);
      g_pipe = INVALID_HANDLE;
      Print("[PIPE] Disconnected | broker: ", g_brokerName);
   }
}

bool PipeConnect() {
   PipeClose();
   int flags = FILE_ATTRIB_NORM | FILE_FLAG_OVERLAPPED;
   g_pipe = CreateFileW(g_pipeName, GENERIC_WRITE, 0, 0, OPEN_EXISTING, flags, 0);
   if (g_pipe != INVALID_HANDLE) {
      g_timeouts    = 0;
      Print("[PIPE] Connected | broker: ", g_brokerName);
   } else {
      Print("[PIPE] Connection failed | broker: ", g_brokerName, " | backend running?");
   }
   return g_pipe != INVALID_HANDLE;
}

bool PipeWrite(string data) {
   ulong now = GetTickCount();

   if (g_pipe == INVALID_HANDLE) {
      if (!PipeConnect()) return false;
   }

   uchar buf[];
   int   written[];
   ArrayResize(written, 1);
   StringToCharArray(data, buf, 0, StringLen(data));

   ArrayInitialize(g_ovlp, 0);
   g_ovlp[4] = g_event;
   ResetEvent(g_event);

   WriteFile(g_pipe, buf, ArraySize(buf), written, g_ovlp);

   uint result = (uint)WaitForSingleObject(g_event, PIPE_WRITE_TIMEOUT_MS);

   if (result == WAIT_OBJECT_0) {
      g_timeouts = 0;
      return true;
   }

   CancelIo(g_pipe);
   g_timeouts++;

   if (result == WAIT_TIMEOUT_CODE)
      Print("[PIPE] Write timeout #", g_timeouts, " | broker: ", g_brokerName);
   else
      Print("[PIPE] Wait failed | result=", result, " | broker: ", g_brokerName);

   if (g_timeouts >= 3) {
      Print("[PIPE] Dead after ", g_timeouts, " timeouts — reconnecting | broker: ", g_brokerName);
      PipeClose();
      g_timeouts = 0;
   }

   return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Init / Deinit
// ────────────────────────────────────────────────────────────────────────────

int OnInit() {
   LoadConfig();
   ParseSymbols();
   g_pipeName = "\\\\.\\pipe\\mt4tick_" + g_brokerName;
   g_event = CreateEventW(0, 1, 0, 0);
   EventSetMillisecondTimer(100);

   Print("[STATE] HttpBridgeState v3.16 | broker: ", g_brokerName,
         " | symbols: ", g_symbolsRaw,
         " | symbol count: ", g_symbolCount,
         " | state every: ", STATE_EVERY_S, "s",
         " | history max: ", HISTORY_MAX,
         " | full history on start: ", HISTORY_FULL_ON_START,
         " | load candle history: ", CANDLES_LOAD);

   // The candle history is exported in full from the timer, one pair per second, once MT4
   // has loaded it; with the load switched off every pair is queued as it stands.
   g_pairCount = g_symbolCount * TF_COUNT;
   ArrayResize(g_seenBars, g_pairCount);
   ArrayResize(g_fullPending, g_pairCount);
   for (int p = 0; p < g_pairCount; p++) {
      g_seenBars[p]    = 0;
      g_fullPending[p] = !CANDLES_LOAD;
   }
   g_loadPair  = CANDLES_LOAD ? 0 : g_pairCount;
   g_loadPhase = 0;
   g_loadChart = 0;

   Print("[STATE] Init complete | ready to stream ticks");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   if (g_loadChart > 0) { ChartClose(g_loadChart); g_loadChart = 0; }
   PipeClose();
   if (g_event != INVALID_HANDLE) { CloseHandle(g_event); g_event = INVALID_HANDLE; }
   Print("[STATE] Stopped | reason: ", reason);
}

// ────────────────────────────────────────────────────────────────────────────
// Timer — 100ms tick batch + periodic state
// ────────────────────────────────────────────────────────────────────────────

void OnTimer() {
   ulong now = GetTickCount();

   // ── Tick batch: all symbols every 100ms ──────────────────────────────────
   int    brokerOffset = (int)(TimeCurrent() - TimeGMT());
   string batch        = "[";

   for (int i = 0; i < g_symbolCount; i++) {
      string sym = g_symbols[i];
      if (i > 0) batch += ",";
      batch += "{";
      batch += "\"symbol\":\""   + sym                                                      + "\",";
      batch += "\"bid\":"        + DoubleToString(MarketInfo(sym, MODE_BID), 5)             + ",";
      batch += "\"ask\":"        + DoubleToString(MarketInfo(sym, MODE_ASK), 5)             + ",";
      batch += "\"time\":"       + IntegerToString(TimeGMT() * 1000)                       + ",";
      batch += "\"broker_offset\":" + IntegerToString(brokerOffset)                        + ",";
      batch += "\"m5_time\":"    + IntegerToString(iTime(sym, PERIOD_M5,  0) * 1000)       + ",";
      batch += "\"m5_open\":"    + DoubleToString(iOpen(sym,  PERIOD_M5,  0), 5)           + ",";
      batch += "\"m5_high\":"    + DoubleToString(iHigh(sym,  PERIOD_M5,  0), 5)           + ",";
      batch += "\"m5_low\":"     + DoubleToString(iLow(sym,   PERIOD_M5,  0), 5)           + ",";
      batch += "\"m15_time\":"   + IntegerToString(iTime(sym, PERIOD_M15, 0) * 1000)       + ",";
      batch += "\"m15_open\":"   + DoubleToString(iOpen(sym,  PERIOD_M15, 0), 5)           + ",";
      batch += "\"m15_high\":"   + DoubleToString(iHigh(sym,  PERIOD_M15, 0), 5)           + ",";
      batch += "\"m15_low\":"    + DoubleToString(iLow(sym,   PERIOD_M15, 0), 5)           + ",";
      batch += "\"h1_time\":"    + IntegerToString(iTime(sym, PERIOD_H1,  0) * 1000)       + ",";
      batch += "\"h1_open\":"    + DoubleToString(iOpen(sym,  PERIOD_H1,  0), 5)           + ",";
      batch += "\"h1_high\":"    + DoubleToString(iHigh(sym,  PERIOD_H1,  0), 5)           + ",";
      batch += "\"h1_low\":"     + DoubleToString(iLow(sym,   PERIOD_H1,  0), 5)           + ",";
      batch += "\"h4_time\":"    + IntegerToString(iTime(sym, PERIOD_H4,  0) * 1000)       + ",";
      batch += "\"h4_open\":"    + DoubleToString(iOpen(sym,  PERIOD_H4,  0), 5)           + ",";
      batch += "\"h4_high\":"    + DoubleToString(iHigh(sym,  PERIOD_H4,  0), 5)           + ",";
      batch += "\"h4_low\":"     + DoubleToString(iLow(sym,   PERIOD_H4,  0), 5)           + ",";
      batch += "\"d1_time\":"    + IntegerToString(iTime(sym, PERIOD_D1,  0) * 1000)       + ",";
      batch += "\"d1_open\":"    + DoubleToString(iOpen(sym,  PERIOD_D1,  0), 5)           + ",";
      batch += "\"d1_high\":"    + DoubleToString(iHigh(sym,  PERIOD_D1,  0), 5)           + ",";
      batch += "\"d1_low\":"     + DoubleToString(iLow(sym,   PERIOD_D1,  0), 5);
      batch += "}";
   }
   batch += "]\n";

   PipeWrite(batch);

   // ── Live positions over the pipe every POSITIONS_EVERY_S ─────────────────
   if (now - lastPositionsSend >= (ulong)(POSITIONS_EVERY_S * 1000)) {
      lastPositionsSend = now;
      PipeWrite("{\"type\":\"positions\",\"positions\":" + BuildPositionsJson(OrdersTotal()) + "}\n");
   }

   // ── Live account over the pipe every ACCOUNT_EVERY_S ─────────────────────
   if (now - lastAccountSend >= (ulong)(ACCOUNT_EVERY_S * 1000)) {
      lastAccountSend = now;
      PipeWrite("{\"type\":\"account\"," + BuildAccountJson() + "}\n");
   }

   // ── history.json as soon as the account history changes (a close, a deposit) ──
   if (g_lastHistoryTotal >= 0 && OrdersHistoryTotal() != g_lastHistoryTotal
       && now - lastHistoryWrite >= (ulong)(HISTORY_MIN_GAP_S * 1000)) {
      Print("[STATE] History changed | orders: ", OrdersHistoryTotal(), " | broker: ", g_brokerName);
      WriteHistory();
   }

   // ── State update: positions, account, history, candles every STATE_EVERY_S ──
   if (now - lastStateSend >= (ulong)(STATE_EVERY_S * 1000)) {
      lastStateSend = now;

      int posCount = OrdersTotal();
      WritePositions(posCount);
      WriteAccount();

      if (posCount != g_lastPositionCount) {
         Print("[STATE] Positions changed | open: ", posCount, " | broker: ", g_brokerName);
         g_lastPositionCount = posCount;
      }

      WriteHistory();
      WriteRecentCandles();
   }

   // ── Candle history: one full export and one load step per second ─────────
   if (now - lastCandleStep >= 1000) {
      lastCandleStep = now;
      ExportNextPendingPair();
      LoadCandleHistoryStep();
   }
}

// ────────────────────────────────────────────────────────────────────────────
// Candle history
// ────────────────────────────────────────────────────────────────────────────

string PairSymbol(int pair) { return g_symbols[pair / TF_COUNT]; }
int    PairPeriod(int pair) { return g_periods[pair % TF_COUNT]; }

// The last RECENT_BARS of every pair. A pair whose bar count grew by more than a cycle
// can add has received history from the broker: it is queued for a full export instead.
void WriteRecentCandles() {
   for (int p = 0; p < g_pairCount; p++) {
      string sym    = PairSymbol(p);
      int    period = PairPeriod(p);
      int    bars   = iBars(sym, period);
      bool   loaded = p < g_loadPair;

      if (loaded && g_seenBars[p] > 0 && bars > g_seenBars[p] + CANDLES_GROWTH_BARS) g_fullPending[p] = true;
      else WriteHistoricalCandles(sym, period, RECENT_BARS);
      g_seenBars[p] = bars;
   }
}

void ExportNextPendingPair() {
   for (int p = 0; p < g_pairCount; p++) {
      if (!g_fullPending[p]) continue;
      string sym    = PairSymbol(p);
      int    period = PairPeriod(p);
      int  continuous = ContinuousBars(sym, period);
      bool written    = WriteFullCandles(sym, period);
      g_fullPending[p] = false;
      g_seenBars[p]    = iBars(sym, period);
      Print("[CANDLES] Full export | ", sym, " ", PeriodToLabel(period),
            " | bars: ", continuous, " without holes of ", g_seenBars[p],
            written ? "" : " | NOT WRITTEN");
      return;
   }
}

// The terminal fetches an older block from the broker when the Home key takes a chart
// to its first bar; ChartNavigate alone moves the view without asking the server.
void ScrollChartToBeginning(long chart) {
   ChartNavigate(chart, CHART_BEGIN, 0);
   int window = (int)ChartGetInteger(chart, CHART_WINDOW_HANDLE);
   if (window == 0) return;
   PostMessageW(window, WM_KEYDOWN, VK_HOME, 0);
   PostMessageW(window, WM_KEYUP, VK_HOME, 0);
}

// MT4 keeps on disk only the history something asked for, and asking for a timeseries
// from an EA does not make it fetch more. Each pair is shown on a temporary chart taken
// to its beginning, one pair at a time, until no more bars arrive.
void LoadCandleHistoryStep() {
   if (g_loadPair < 0 || g_loadPair >= g_pairCount) return;

   string sym    = PairSymbol(g_loadPair);
   int    period = PairPeriod(g_loadPair);
   ulong  now    = GetTickCount();

   if (g_loadPhase == 0) {
      g_loadBarsStart   = iBars(sym, period);
      g_loadLastBars    = g_loadBarsStart;
      g_loadGrew        = false;
      g_loadStarted     = now;
      g_loadStableSince = now;
      g_loadChart       = ChartOpen(sym, period);
      if (g_loadChart <= 0) { FinishCandleLoad(g_loadBarsStart); return; }
      ChartSetInteger(g_loadChart, CHART_AUTOSCROLL, false);
      g_loadPhase = 1;
      return;
   }

   ResetLastError();
   ScrollChartToBeginning(g_loadChart);
   int bars = iBars(sym, period);
   iTime(sym, period, 0);
   bool updating = GetLastError() == ERR_HISTORY_UPDATING;

   if (bars != g_loadLastBars) {
      g_loadLastBars    = bars;
      g_loadGrew        = true;
      g_loadStableSince = now;
   }

   // A pair MT4 already holds brings nothing: it is left after a short wait. Once the
   // broker starts sending blocks the wait is longer, a block can take a few seconds.
   int   quietS  = g_loadGrew ? CANDLES_STABLE_S : CANDLES_IDLE_S;
   bool  stable  = !updating && now - g_loadStableSince >= (ulong)(quietS * 1000);
   bool  expired = now - g_loadStarted >= (ulong)(CANDLES_CHART_MAX_S * 1000);
   if (stable || expired) FinishCandleLoad(bars);
}

void FinishCandleLoad(int bars) {
   string sym    = PairSymbol(g_loadPair);
   int    period = PairPeriod(g_loadPair);
   if (g_loadChart > 0) { ChartClose(g_loadChart); g_loadChart = 0; }

   datetime first = 0;
   if (bars > 0) first = iTime(sym, period, bars - 1);
   Print("[CANDLES] Loaded ", g_loadPair + 1, "/", g_pairCount, " | ", sym, " ", PeriodToLabel(period),
         " | bars: ", g_loadBarsStart, " -> ", bars,
         " | first: ", TimeToString(first));

   g_fullPending[g_loadPair] = true;
   g_loadPair++;
   g_loadPhase = 0;
   if (g_loadPair >= g_pairCount) Print("[CANDLES] History load finished | broker: ", g_brokerName);
}

// ────────────────────────────────────────────────────────────────────────────
// State writers
// ────────────────────────────────────────────────────────────────────────────

string BuildAccountJson() {
   string j = "";
   j += "\"balance\":"    + DoubleToString(AccountBalance(), 2)    + ",";
   j += "\"equity\":"     + DoubleToString(AccountEquity(), 2)     + ",";
   j += "\"profit\":"     + DoubleToString(AccountProfit(), 2)     + ",";
   j += "\"margin\":"     + DoubleToString(AccountMargin(), 2)     + ",";
   j += "\"freeMargin\":" + DoubleToString(AccountFreeMargin(), 2) + ",";
   j += "\"leverage\":"   + IntegerToString(AccountLeverage())     + ",";
   j += "\"currency\":\"" + AccountCurrency()                      + "\",";
   j += "\"name\":\""     + AccountName()                         + "\",";
   j += "\"number\":"     + IntegerToString(AccountNumber());
   return j;
}

void WriteAccount() {
   WriteFile("account.json", "{" + BuildAccountJson() + "}");
}

void WritePositions(int total) {
   WriteFile("positions.json", BuildPositionsJson(total));
}

string BuildPositionsJson(int total) {
   string j = "[";
   int count = 0;
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (count > 0) j += ",";
      j += "{";
      j += "\"ticket\":"     + IntegerToString(OrderTicket())       + ",";
      j += "\"symbol\":\""   + OrderSymbol()                       + "\",";
      j += "\"type\":"       + IntegerToString(OrderType())         + ",";
      j += "\"lots\":"       + DoubleToString(OrderLots(), 2)       + ",";
      j += "\"openPrice\":"  + DoubleToString(OrderOpenPrice(), 5)  + ",";
      j += "\"sl\":"         + DoubleToString(OrderStopLoss(), 5)   + ",";
      j += "\"tp\":"         + DoubleToString(OrderTakeProfit(), 5) + ",";
      j += "\"profit\":"     + DoubleToString(OrderProfit(), 2)     + ",";
      j += "\"swap\":"       + DoubleToString(OrderSwap(), 2)       + ",";
      j += "\"commission\":" + DoubleToString(OrderCommission(), 2) + ",";
      j += "\"magic\":"      + IntegerToString(OrderMagicNumber())  + ",";
      j += "\"comment\":\""  + OrderComment()                      + "\",";
      j += "\"openTime\":\"" + TimeToString(OrderOpenTime())        + "\"";
      j += "}";
      count++;
   }
   j += "]";
   return j;
}

void WriteHistory() {
   string j = "[";
   int total = OrdersHistoryTotal(), count = 0;
   int limit = (g_historyFullPending || HISTORY_MAX <= 0) ? total : HISTORY_MAX;
   if (g_historyFullPending) {
      Print("[STATE] Full history export: ", total, " orders visible in Account History");
      g_historyFullPending = false;
   }
   for (int i = total - 1; i >= 0 && count < limit; i--) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      int type = OrderType();
      // Trades plus balance (6) and credit (7) operations: deposits, withdrawals,
      // adjustments. MQL4 has no named constants for those two types.
      if (type != OP_BUY && type != OP_SELL && type != 6 && type != 7) continue;
      if (count > 0) j += ",";
      j += "{";
      j += "\"ticket\":"      + IntegerToString(OrderTicket())        + ",";
      j += "\"symbol\":\""    + OrderSymbol()                        + "\",";
      j += "\"type\":"        + IntegerToString(OrderType())          + ",";
      j += "\"lots\":"        + DoubleToString(OrderLots(), 2)        + ",";
      j += "\"openPrice\":"   + DoubleToString(OrderOpenPrice(), 5)   + ",";
      j += "\"closePrice\":"  + DoubleToString(OrderClosePrice(), 5)  + ",";
      j += "\"sl\":"          + DoubleToString(OrderStopLoss(), 5)    + ",";
      j += "\"tp\":"          + DoubleToString(OrderTakeProfit(), 5)  + ",";
      j += "\"profit\":"      + DoubleToString(OrderProfit(), 2)      + ",";
      j += "\"swap\":"        + DoubleToString(OrderSwap(), 2)        + ",";
      j += "\"commission\":"  + DoubleToString(OrderCommission(), 2)  + ",";
      j += "\"magic\":"       + IntegerToString(OrderMagicNumber())   + ",";
      j += "\"comment\":\""   + OrderComment()                       + "\",";
      j += "\"openTime\":\""  + TimeToString(OrderOpenTime())         + "\",";
      j += "\"closeTime\":\"" + TimeToString(OrderCloseTime())        + "\"";
      j += "}";
      count++;
   }
   j += "]";
   WriteFile("history.json", j);
   g_lastHistoryTotal = total;
   lastHistoryWrite = GetTickCount();
}

string PeriodToLabel(int period) {
   if (period == PERIOD_M5)  return "M5";
   if (period == PERIOD_M15) return "M15";
   if (period == PERIOD_H1)  return "H1";
   if (period == PERIOD_H4)  return "H4";
   if (period == PERIOD_D1)  return "D1";
   return "M15";
}

void WriteHistoricalCandles(string sym, int period, int maxBars) {
   int limit = MathMin(iBars(sym, period) - 1, maxBars);
   WriteCandlesFile(sym, period, limit, "bridge\\candles_" + sym + "_" + PeriodToLabel(period) + ".json");
}

// The whole history without holes, in a file of its own: the backend stores it, drops
// what it holds from before its first bar and deletes the file. Written under a
// temporary name so a half-written file is never read.
bool WriteFullCandles(string sym, int period) {
   string name = "bridge\\fullcandles_" + sym + "_" + PeriodToLabel(period) + ".json";
   string temp = name + ".tmp";
   int    bars = ContinuousBars(sym, period);
   if (bars < 2) return false;
   bool   cutAtHole = bars < iBars(sym, period);
   if (!WriteCandlesFile(sym, period, bars - 1, temp, cutAtHole)) return false;
   return FileMove(temp, 0, name, FILE_REWRITE);
}

// D1 bars, counted from the newest, with no gap longer than a long weekend between them.
int ContinuousD1Bars(string sym) {
   int total = iBars(sym, PERIOD_D1);
   for (int i = 0; i < total - 1; i++) {
      if (iTime(sym, PERIOD_D1, i) - iTime(sym, PERIOD_D1, i + 1) > D1_MAX_GAP_S) return i + 1;
   }
   return total;
}

// Bars, counted from the newest, that form a history without holes. A hole is a day
// that has a D1 bar and no bar in this timeframe: never a weekend or a holiday. MT4 can
// hold an old island of history the broker no longer connects to the recent bars.
int ContinuousBars(string sym, int period) {
   int d1Bars = ContinuousD1Bars(sym);
   if (period == PERIOD_D1) return d1Bars;

   int total = iBars(sym, period);
   if (total <= 0 || d1Bars <= 0) return 0;
   datetime oldest = iTime(sym, period, total - 1);

   for (int j = 0; j < d1Bars; j++) {
      datetime day = iTime(sym, PERIOD_D1, j);
      if (day + DAY_S <= oldest) return total;
      int shift = iBarShift(sym, period, day + DAY_S - 1, false);
      if (shift < 0 || iTime(sym, period, shift) < day) return MathMax(shift, 0);
   }

   // Bars older than the D1 history cannot be checked: they are left out.
   datetime d1Start = iTime(sym, PERIOD_D1, d1Bars - 1);
   if (oldest >= d1Start) return total;
   int before = iBarShift(sym, period, d1Start - 1, false);
   if (before >= 0 && iTime(sym, period, before) < d1Start) return before;
   return total;
}

// cutAtHole tells the backend that older bars exist behind a hole and were left out,
// so what it stores from before this file's first bar must go.
bool WriteCandlesFile(string sym, int period, int limit, string filename, bool cutAtHole = false) {
   int brokerOffset = (int)(TimeCurrent() - TimeGMT());

   int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[STATE] ERROR: could not write candles file: ", filename);
      return false;
   }

   FileWriteString(handle, "{\"brokerOffset\":" + IntegerToString(brokerOffset) +
                           (cutAtHole ? ",\"cutAtHole\":true" : "") + ",\"candles\":[");

   for (int i = limit; i >= 0; i--) {
      string entry = "{\"time\":"  + IntegerToString(iTime(sym, period, i))  +
                     ",\"open\":"  + DoubleToString(iOpen(sym,  period, i), 5) +
                     ",\"high\":"  + DoubleToString(iHigh(sym,  period, i), 5) +
                     ",\"low\":"   + DoubleToString(iLow(sym,   period, i), 5) +
                     ",\"close\":" + DoubleToString(iClose(sym, period, i), 5) + "}";
      if (i < limit) FileWriteString(handle, ",");
      FileWriteString(handle, entry);
   }

   FileWriteString(handle, "]}");
   FileClose(handle);
   return true;
}

void WriteFile(string filename, string content) {
   int handle = FileOpen("bridge\\" + filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if (handle == INVALID_HANDLE) {
      Print("[STATE] ERROR: could not write file: ", filename);
      return;
   }
   FileWriteString(handle, content);
   FileClose(handle);
}
