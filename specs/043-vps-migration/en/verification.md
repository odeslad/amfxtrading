# 043 — VPS migration · Verification

## Task 1 — Base system of the new VPS

- **Mechanism:** manual — settings read back over SSH from `WIN-E5FGF0D8OH7` (`<new VPS IP>`) after applying them, compared with the same reading on the old VPS.
- **Outcome:** ✅ pass (2026-11-16)
- **Evidence:**

| Setting | Old VPS | New VPS after the task |
|---|---|---|
| Time zone | UTC | UTC (already) |
| Power plan | Balanced, sleep and hibernate "never" on AC | same (already) |
| Windows Update policy | `NoAutoRebootWithLoggedOnUsers=1` | `NoAutoRebootWithLoggedOnUsers=1`, `AUOptions=3` (download, ask before installing — the provider's default, kept) |
| Active hours | 0–23 | 0–23 |
| Defender path exclusions | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Work` | `C:\amfxtradingv2`, `C:\Program Files\PostgreSQL`, `C:\Users\Administrator\AppData\Roaming\MetaQuotes` |
| Defender process exclusions | `cloudflared.exe`, `node.exe`, `postgres.exe`, `terminal.exe` | same |
| Defender real-time protection | **disabled** | enabled |
| `C:\monitoring`, `C:\deploy` | exist | created |
| Page file | fixed 8192 MB | system-managed (1920 MB now) |

- **Deviations:**
  - Real-time protection is disabled on the old VPS; it was **left enabled** on the new one (not in the design, and it lowers the machine's protection). With the exclusions above it should not interfere; revisit only if task 6 shows a measurable cost.
  - The page file was left system-managed instead of the old fixed 8 GB: the new machine has twice the RAM. Revisit with the memory reading of task 6.
  - Incident while applying: the script recreated the Windows Update policy key and dropped the provider's `AUOptions=3`; it was restored in the same session and read back.
- **Est vs Actual:** 1 SP vs 0.5 SP — most settings already matched.
