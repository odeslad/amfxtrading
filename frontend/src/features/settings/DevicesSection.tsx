import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { addToast } from '../../lib/toast';
import { usePush } from '../../lib/usePush';
import { type PushDevice } from '../../lib/usePushDevices';
import { Badge, Button, Card, EmptyState, FieldLabel, Hint, Section, Table, type TableColumn } from '../../shared/ui';
import own from './DevicesSection.module.css';

interface DevicesProps {
  devices: PushDevice[];
  currentHash: string | null;
  thisDeviceSubscribed: boolean;
  onRemove: (id: number) => Promise<unknown>;
  onChanged: () => Promise<unknown>;
}

const p = (n: number) => String(n).padStart(2, '0');
const fmtDate = (iso: string): string => { const d = new Date(iso); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDateTime = (iso: string): string => { const d = new Date(iso); return `${fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`; };

function DevicesContent({ devices, currentHash, thisDeviceSubscribed, onRemove, onChanged }: DevicesProps) {
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

  const deviceTitle = (d: PushDevice) => (
    <span className={own.rowTitle}>
      {d.label}
      {d.endpointHash === currentHash && <Badge tone="green">This device</Badge>}
    </span>
  );
  const deviceMeta = (d: PushDevice): string =>
    `since ${fmtDate(d.createdAt)}${d.lastPushAt ? ` · last push ${fmtDateTime(d.lastPushAt)}` : ' · no push yet'}`;
  const removeButton = (d: PushDevice) => (
    <Button
      variant={confirmId === d.id ? 'sell' : 'danger'}
      size="sm"
      onClick={() => remove(d.id)}
      onBlur={() => { if (confirmId === d.id && !removing) setConfirmId(null); }}
      disabled={removing}
    >
      {confirmId === d.id ? (removing ? 'Removing…' : 'Confirm') : 'Remove'}
    </Button>
  );
  const columns: TableColumn<PushDevice>[] = [
    { key: 'device', label: 'Device', render: deviceTitle },
    { key: 'since', label: 'Since', mono: true, render: d => fmtDate(d.createdAt) },
    { key: 'push', label: 'Last push', mono: true, render: d => (d.lastPushAt ? fmtDateTime(d.lastPushAt) : '—'), width: '100%' },
  ];

  return (
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
          <div className={own.enable}>
            <Button variant="primary" onClick={enable} disabled={busy}>
              {busy ? 'Enabling…' : 'Enable this device'}
            </Button>
          </div>
        )}

        <div className={own.list}>
          <FieldLabel>Subscribed devices · {devices.length}</FieldLabel>
          {devices.length === 0 && <EmptyState>No device receives pushes yet.</EmptyState>}
          <Table
            caption="Subscribed devices"
            columns={columns}
            rows={devices}
            rowKey={d => String(d.id)}
            rowActions={removeButton}
            swipeCardActions
            renderCard={d => <Card title={deviceTitle(d)} meta={deviceMeta(d)}>{null}</Card>}
          />
        </div>
      </div>
  );
}

// Settings › Alerts & notifications › Devices: the devices that receive push notifications.
export function DevicesSection(props: DevicesProps) {
  return (
    <Section title="Devices" description="Devices that receive the push notifications.">
      <div className={own.inline}>
        <DevicesContent {...props} />
      </div>
    </Section>
  );
}

