import { ReactNode, useState, useMemo, useCallback, CSSProperties } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T, index: number) => ReactNode
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  getRowId: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  emptyMessage?: string
  emptyIcon?: ReactNode
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  onRowClick?: (row: T) => void
  style?: CSSProperties
}

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ opacity: active ? 1 : 0.3, flexShrink: 0 }}
    >
      {dir === 'asc' || !active
        ? <path d="M12 19V5M5 12l7-7 7 7" />
        : <path d="M12 5v14M19 12l-7 7-7-7" />
      }
    </svg>
  )
}

function SkeletonRow({ columns, selectable }: { columns: Column<unknown>[]; selectable: boolean }) {
  return (
    <tr>
      {selectable && (
        <td style={tdStyle}>
          <span className="shule-skeleton" style={{ display: 'block', width: 14, height: 14, borderRadius: 3 }} />
        </td>
      )}
      {columns.map((col, i) => (
        <td key={i} style={tdStyle}>
          <span
            className="shule-skeleton"
            style={{ display: 'block', height: 13, width: col.width ?? '80%', borderRadius: 4 }}
          />
        </td>
      ))}
    </tr>
  )
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--txt3)',
  padding: '0.55rem 0.85rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface2)',
  fontFamily: 'var(--font2)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}

const tdStyle: CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderBottom: '1px solid var(--border)',
  color: 'var(--txt2)',
  verticalAlign: 'middle',
  fontSize: 12.5,
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowId,
  loading = false,
  skeletonRows = 6,
  emptyMessage = 'No records found.',
  emptyIcon,
  selectable = false,
  selectedIds,
  onSelectionChange,
  onRowClick,
  style,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = useCallback((key: string) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else setSortDir('asc')
      return key
    })
  }, [])

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const allIds = useMemo(() => new Set(data.map(getRowId)), [data, getRowId])
  const isAllSelected = selectable && selectedIds
    ? selectedIds.size > 0 && allIds.size > 0 && [...allIds].every(id => selectedIds.has(id))
    : false
  const isIndeterminate = selectable && selectedIds
    ? selectedIds.size > 0 && !isAllSelected
    : false

  function toggleAll() {
    if (!onSelectionChange) return
    onSelectionChange(isAllSelected ? new Set() : new Set(allIds))
  }

  function toggleRow(id: string) {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  return (
    <div style={{ overflowX: 'auto', ...style }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr>
            {selectable && (
              <th style={{ ...thStyle, width: 40 }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={el => { if (el) el.indeterminate = isIndeterminate }}
                  onChange={toggleAll}
                  style={{ accentColor: 'var(--brand)', cursor: 'pointer' }}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  ...thStyle,
                  width: col.width,
                  textAlign: col.align ?? 'left',
                  cursor: col.sortable ? 'pointer' : 'default',
                }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.header}
                  {col.sortable && (
                    <SortIcon active={sortKey === col.key} dir={sortKey === col.key ? sortDir : 'asc'} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} columns={columns as Column<unknown>[]} selectable={selectable} />
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                style={{
                  ...tdStyle,
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--txt3)',
                  borderBottom: 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  {emptyIcon ?? (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((row, idx) => {
              const id = getRowId(row)
              const isSelected = selectedIds?.has(id) ?? false

              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: isSelected ? 'var(--brand-light)' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected)
                      (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface2)'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected)
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                  }}
                >
                  {selectable && (
                    <td style={tdStyle} onClick={e => { e.stopPropagation(); toggleRow(id) }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        style={{ accentColor: 'var(--brand)', cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      style={{
                        ...tdStyle,
                        textAlign: col.align ?? 'left',
                        color: isSelected ? 'var(--txt)' : 'var(--txt2)',
                      }}
                    >
                      {col.render ? col.render(row, idx) : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
