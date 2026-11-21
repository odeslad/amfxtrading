import type { ReactNode } from 'react';
import styles from './Table.module.css';

export type ColumnAlign = 'left' | 'right' | 'center';
export type SortDirection = 'asc' | 'desc';
export type RowTone = 'selected' | 'error' | 'marked' | 'muted';

export interface TableColumn<Row> {
  key: string;
  label: ReactNode;
  render: (row: Row) => ReactNode;
  align?: ColumnAlign;
  mono?: boolean;
  sortable?: boolean;
  width?: string;
}

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  sort?: TableSort;
  onSort?: (key: string) => void;
  rowActions?: (row: Row) => ReactNode;
  rowTone?: (row: Row) => RowTone | undefined;
  renderCard?: (row: Row) => ReactNode;
  empty?: ReactNode;
  caption?: string;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  rowActions,
  rowTone,
  renderCard,
  empty,
  caption,
}: TableProps<Row>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      <div className={`${styles.wrapper} ${renderCard ? styles.hideOnMobile : ''}`}>
        <table className={styles.table}>
          {caption && <caption className={styles.caption}>{caption}</caption>}
          <thead>
            <tr>
              {columns.map((column) => (
                <HeaderCell key={column.key} column={column} sort={sort} onSort={onSort} />
              ))}
              {rowActions && <th className={styles.actionsHead} aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = rowTone?.(row);
              return (
                <tr key={rowKey(row)} className={tone ? styles[tone] : undefined}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[styles[column.align ?? 'left'], column.mono ? styles.mono : ''].filter(Boolean).join(' ')}
                      style={column.width ? { width: column.width } : undefined}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className={styles.actionsCell}>
                      <div className={styles.actions}>{rowActions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {renderCard && (
        <div className={styles.cards}>
          {rows.map((row) => (
            <div key={rowKey(row)}>{renderCard(row)}</div>
          ))}
        </div>
      )}
    </>
  );
}

interface HeaderCellProps<Row> {
  column: TableColumn<Row>;
  sort?: TableSort;
  onSort?: (key: string) => void;
}

function HeaderCell<Row>({ column, sort, onSort }: HeaderCellProps<Row>) {
  const align = styles[column.align ?? 'left'];
  if (!column.sortable || !onSort) {
    return (
      <th scope="col" className={align}>
        {column.label}
      </th>
    );
  }
  const active = sort?.key === column.key;
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th scope="col" className={align} aria-sort={ariaSort}>
      <button
        type="button"
        className={`${styles.sortButton} ${active ? styles.sortActive : ''}`}
        onClick={() => onSort(column.key)}
      >
        {column.label}
        <span className={styles.sortArrow} aria-hidden="true">
          {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
