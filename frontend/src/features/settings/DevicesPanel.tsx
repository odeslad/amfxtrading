import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { usePush } from '../../lib/usePush';
import { type PushDevice } from '../../lib/usePushDevices';
import { Badge, Button, EmptyState, FieldLabel, Hint, SidePanel } from '../../shared/ui';
import own from './DevicesPanel.module.css';

interface DevicesPanelProps {
  open: boolean;
  devices: PushDevice[];
  currentHash: string | null;
  thisDeviceSubscribed: boolean;
  onRemove: (id: number) => Promise<unknown>;
  onChanged: () => Promise<unknown>;
  onClose: () => void;
}

const p = (n: number) => String(n).padStart(2, '0');
const fmtDate = (iso: string): string => { const d = new Date(iso); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDateTime = (iso: string): string => { const d = new Date(iso); return `${fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function DevicesPanel({ open, devices, currentHash, thisDeviceSubscribed, onRemove, onChanged, onClose }: DevicesPanelProps) {
  const { status, busy, subscribe } = usePush();
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  const enable = async () => {
    const ok = await subscribe();
    if (ok) { addToast('Notifications enabled on this device', 'success'); await onChanged(); }
    else if (status !== 'denied') addToast('Could not enable notifications on this device', 'error');
  };

  const remove = async (id: number) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    setRemoving(true);
    try {
      await onRemove(id);
      addToast('Device removed', 'success');
      setConfirmId(null);
    } catch (err) {
      addToast(errorMessage(err, 'Failed to remove the device'), 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <SidePanel open={open} title="Devices" onClose={onClose}>
      <div className={own.body}>
        {!thisDeviceSubscribed && (
          <Hint tone="warning" boxed title="This device · notifications off">
            {status === 'unsupported'
              ? 'Push is not available here. On iPhone, install the app on the home screen first and open it from there.'
              : status === 'denied'
                ? 'Notifications are blocked for this site. Allow them in the browser settings, then enable.'
                : 'Enable once to receive pushes with the app closed.'}
          </Hint>
        )}
        {!thisDeviceSubscribed && status !== 'unsupported' && status !== 'denied' && (
          <Button variant="primary" size="lg" onClick={enable} disabled={busy}>
            {busy ? 'Enabling…' : 'Enable this device'}
          </Button>
        )}

        <div className={own.list}>
          <FieldLabel>Subscribed devices · {devices.length}</FieldLabel>
          {devices.length === 0 && <EmptyState>No device receives pushes yet.</EmptyState>}
          {devices.map(d => (
            <div key={d.id} className={own.row}>
              <span className={own.rowMain}>
                <span className={own.rowTitle}>
                  {d.label}
                  {d.endpointHash === currentHash && <Badge tone="green">This device</Badge>}
                </span>
                <span className={own.rowMeta}>since {fmtDate(d.createdAt)}{d.lastPushAt ? ` · last push ${fmtDateTime(d.lastPushAt)}` : ' · no push yet'}</span>
              </span>
              <Button
                variant={confirmId === d.id ? 'sell' : 'danger'}
                size="sm"
                onClick={() => remove(d.id)}
                onBlur={() => { if (confirmId === d.id && !removing) setConfirmId(null); }}
                disabled={removing}
              >
                {confirmId === d.id ? (removing ? 'Removing…' : 'Confirm') : 'Remove'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </SidePanel>
  );
}
