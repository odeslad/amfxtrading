import fs from 'fs';
import path from 'path';

export const SYNC_COMMAND_FILE = 'sync-command.json';
export const SYNC_STATUS_FILE = 'sync-status.json';
export const SYNC_DIR = 'sync';

export interface SyncCommand {
  id: string;
  timeframes: { tf: string; target: number }[];
}

// Temp file + rename, so the EA never reads a half-written command.
export function writeSyncCommand(bridgePath: string, command: SyncCommand): void {
  const tmp = path.join(bridgePath, 'sync-command.tmp');
  fs.writeFileSync(tmp, JSON.stringify(command));
  fs.renameSync(tmp, path.join(bridgePath, SYNC_COMMAND_FILE));
}

// True when the command was still waiting for the EA and has been removed.
export function withdrawSyncCommand(bridgePath: string): boolean {
  try {
    fs.unlinkSync(path.join(bridgePath, SYNC_COMMAND_FILE));
    return true;
  } catch {
    return false;
  }
}
