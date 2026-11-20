import { TYPE_LABEL } from './utils/position';
import { type FilterOptions } from './FiltersPanel';
import { DEFAULT_ORDER_FILTERS, hasActiveOrderFilters, type OrderFilterValues } from './utils/orderFilters';
import { ColorFilterField } from './ColorFilterField';
import styles from './FiltersPanel.module.css';

const ORDER_TYPES = [2, 3, 4, 5];

interface OrderFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  values: OrderFilterValues;
  options: FilterOptions;
  onChange: (values: OrderFilterValues) => void;
}

export function OrderFiltersPanel({ open, onClose, values, options, onChange }: OrderFiltersPanelProps) {
  const set = (key: keyof OrderFilterValues) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...values, [key]: e.target.value });

  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>Filters</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Broker</label>
            <select className={styles.input} value={values.broker} onChange={set('broker')}>
              <option value="">All Brokers</option>
              {options.brokers.map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Symbol</label>
            <select className={styles.input} value={values.symbol} onChange={set('symbol')}>
              <option value="">All Symbols</option>
              {options.symbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Type</label>
            <select className={styles.input} value={values.orderType} onChange={set('orderType')}>
              <option value="">All Types</option>
              {ORDER_TYPES.map(t => <option key={t} value={String(t)}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Direction</label>
            <select className={styles.input} value={values.side} onChange={set('side')}>
              <option value="">Buy and Sell</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>

          <ColorFilterField value={values.color} available={options.colors} onChange={color => onChange({ ...values, color })} labelClassName={styles.label} fieldClassName={styles.field} />

          {hasActiveOrderFilters(values) && (
            <button type="button" className={styles.resetBtn} onClick={() => onChange(DEFAULT_ORDER_FILTERS)}>
              Reset filters
            </button>
          )}
        </div>
      </div>
    </>
  );
}
