import { addToast } from './toast';

// Spec 062: the commands of one action on several brokers report back as one toast,
// "SL updated in 2 of 3 · FTMO — Invalid stops", instead of one toast per command.

export const BATCH_TIMEOUT_MS = 35_000;

interface BatchCommand {
  id: string;
  broker: string;
}

export interface CommandResultMessage {
  id: string;
  status: string;
  error?: string;
}

interface Failure {
  broker: string;
  reason: string;
}

interface Batch {
  label: string;
  pending: Map<string, string>;
  total: number;
  okCount: number;
  failures: Failure[];
  timer: ReturnType<typeof setTimeout>;
}

const batchOfCommand = new Map<string, Batch>();

const reasonOf = (msg: CommandResultMessage): string =>
  msg.error ?? (msg.status === 'timeout' ? 'No response from EA' : `EA error: ${msg.status}`);

export function summaryOf(label: string, total: number, okCount: number, failures: Failure[]): { message: string; ok: boolean } {
  const head = `${label} in ${okCount} of ${total}`;
  if (failures.length === 0) return { message: head, ok: true };
  return { message: `${head} · ${failures.map(f => `${f.broker} — ${f.reason}`).join(' · ')}`, ok: false };
}

function finish(batch: Batch): void {
  clearTimeout(batch.timer);
  for (const [id, broker] of batch.pending) {
    batch.failures.push({ broker, reason: 'No response from EA' });
    batchOfCommand.delete(id);
  }
  batch.pending.clear();
  const { message, ok } = summaryOf(batch.label, batch.total, batch.okCount, batch.failures);
  addToast(message, ok ? 'success' : 'error', ok ? 4000 : 8000);
}

// A single command keeps its own toast; two or more report together.
export function trackBatch(label: string, commands: BatchCommand[]): void {
  if (commands.length < 2) return;
  const batch: Batch = {
    label,
    pending: new Map(commands.map(c => [c.id, c.broker])),
    total: commands.length,
    okCount: 0,
    failures: [],
    timer: setTimeout(() => finish(batch), BATCH_TIMEOUT_MS),
  };
  commands.forEach(c => batchOfCommand.set(c.id, batch));
}

// True when the result belongs to a batch, so the caller shows no toast of its own.
export function takeBatchResult(msg: CommandResultMessage): boolean {
  const batch = batchOfCommand.get(msg.id);
  if (!batch) return false;
  batchOfCommand.delete(msg.id);
  const broker = batch.pending.get(msg.id) ?? '';
  batch.pending.delete(msg.id);
  if (msg.status === 'ok') batch.okCount += 1;
  else batch.failures.push({ broker, reason: reasonOf(msg) });
  if (batch.pending.size === 0) finish(batch);
  return true;
}
