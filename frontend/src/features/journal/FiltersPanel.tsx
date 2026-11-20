import { type DateRange, DATE_RANGE_OPTIONS, clampToToday } from './utils/dateRange';
import { IsoDateField } from '../../shared/ui/DateField';
import { ColorFilterField } from './ColorFilterField';
import styles from './FiltersPanel.module.css';

export interface FilterValues {
  broker: string;
  // Spec 055: the account name, only in Accounts.
  name?: string;
  symbol: string;
  type: string;
  color: string;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

export interface FilterOptions {
  brokers: string[];
  symbols: string[];
  colors: string[];
}

interface FiltersPanelProps {
  open: boolean;
  onClose: () => void;
  values: FilterValues;
  options: FilterOptions;
  onChange: (values: FilterValues) => void;
  showDateFilter?: boolean;
  // Spec 055: the fields to show; Accounts uses only broker and colour.
  fields?: FilterField[];
}

export type FilterField = 'broker' | 'name' | 'symbol' | 'type' | 'color';
const ALL_FIELDS: FilterField[] = ['broker', 'symbol', 'type', 'color'];

export function FiltersPanel({ open, onClose, values, options, onChange, showDateFilter, fields = ALL_FIELDS }: FiltersPanelProps) {
  const show = (field: FilterField) => fields.includes(field);
  const set = (key: keyof FilterValues) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...values, [key]: e.target.value });

  const hasActiveFilters = !!(values.broker || values.name || values.symbol || values.type || values.color || values.dateRange);

  const reset = () =>
    onChange({ broker: '', name: '', symbol: '', type: '', color: '', dateRange: '', dateFrom: '', dateTo: '' });

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

          {show('name') && (
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input type="text" className={`${styles.input} ${styles.textInput}`} value={values.name ?? ''} onChange={set('name')} placeholder="Account name" aria-label="Account name" />
            </div>
          )}

          {show('symbol') && (
            <div className={styles.field}>
              <label className={styles.label}>Symbol</label>
              <select className={styles.input} value={values.symbol} onChange={set('symbol')}>
                <option value="">All Symbols</option>
                {options.symbols.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {show('type') && (
            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <select className={styles.input} value={values.type} onChange={set('type')}>
                <option value="">All Types</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
          )}

          {show('color') && (
            <ColorFilterField value={values.color} available={options.colors} onChange={color => onChange({ ...values, color })} labelClassName={styles.label} fieldClassName={styles.field} />
          )}

          {showDateFilter && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <select className={styles.input} value={values.dateRange} onChange={set('dateRange')}>
                  {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {values.dateRange === 'custom' && (
                <div className={styles.row}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="journal-date-from">From</label>
                    <IsoDateField id="journal-date-from" className={`${styles.input} ${styles.dateInput}`} value={values.dateFrom} onChange={iso => onChange({ ...values, dateFrom: iso })} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="journal-date-to">To</label>
                    <IsoDateField id="journal-date-to" className={`${styles.input} ${styles.dateInput}`} value={values.dateTo} onChange={iso => onChange({ ...values, dateTo: clampToToday(iso) })} />
                  </div>
                </div>
              )}
            </>
          )}

          {hasActiveFilters && (
            <button type="button" className={styles.resetBtn} onClick={reset}>
              Reset filters
            </button>
          )}
        </div>
      </div>
    </>
  );
}
