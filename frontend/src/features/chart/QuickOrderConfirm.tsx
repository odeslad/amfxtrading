import { useState } from 'react';
import { sendCommand } from '../../lib/commands';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import type { QuickOrderPlan } from '../../lib/quickOrders';
import { ConfirmPanel } from '../journal/ConfirmPanel';

interface QuickOrderConfirmProps {
  symbol: string;
  plan: QuickOrderPlan | null;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  buy: 'Quick buy', sell: 'Quick sell', buylimit: 'Quick buy limit', selllimit: 'Quick sell limit', buystop: 'Quick buy stop', sellstop: 'Quick sell stop',
};

function detailOf(plan: QuickOrderPlan): string {
  const sizes = plan.targets.map(t => `${t.broker.toUpperCase()} · ${t.lots} ${t.lotsMode === 'fixed' ? 'lots' : '% risk'}`);
  const preset = plan.presetName ? [`Mirror preset "${plan.presetName}"`] : [];
  const sl = plan.sl ? `SL ${plan.sl}${plan.slPips !== null ? ` · ${plan.slPips} p` : ''}` : 'No SL';
  const tp = plan.tp ? `TP ${plan.tp}${plan.tpLabel ? ` · ${plan.tpLabel}` : ''}` : 'No TP';
  return [...sizes, ...preset, sl, tp].join('\n');
}

// Spec 054: a quick order is a real order, so it is always confirmed; the result toast comes from AppLayout.
export function QuickOrderConfirm({ symbol, plan, onClose }: QuickOrderConfirmProps) {
  const [sending, setSending] = useState(false);

  const confirm = async () => {
    if (!plan) return;
    setSending(true);
    try {
      await Promise.all(plan.commands.map(sendCommand));
      onClose();
    } catch (err) {
      addToast(errorMessage(err, 'Failed to send the quick order'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <ConfirmPanel
      open={plan !== null}
      title={plan ? ACTION_LABEL[plan.action] ?? 'Quick order' : ''}
      description={plan ? `${symbol} @ ${plan.action === 'buy' || plan.action === 'sell' ? `market (~${plan.entry})` : plan.entry}` : ''}
      detail={plan ? detailOf(plan) : undefined}
      confirmLabel="Confirm"
      confirmingLabel="Sending..."
      confirming={sending}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
