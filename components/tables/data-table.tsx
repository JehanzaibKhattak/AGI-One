"use client";
import { can, collectionArea } from "@/lib/access";
import { getMember } from "@/lib/services/repository";
import type { Collection } from "@/types";
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
} from "lucide-react";
import { Badge, Empty, Menu, MenuItem } from "@/components/common/ui";
import { type DisplayRow, cellLabel } from "@/lib/constants/modules";
import { exportCSV, initials } from "@/lib/utils";
export function DataTable({
  rows,
  columns,
  onOpen,
  filters = [],
  name = "records",
  onBulk,
}: {
  rows: DisplayRow[];
  columns: [string, string][];
  onOpen?: (id: string) => void;
  filters?: string[];
  name?: string;
  onBulk?: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const [selection, setSelection] = useState({});
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        Object.entries(filterValues).every(
          ([key, v]) => !v || String(r[key]) === v,
        ),
      ),
    [rows, filterValues],
  );
  const defs = useMemo<ColumnDef<DisplayRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            aria-label="Select all rows on this page"
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            aria-label={`Select ${row.original.name}`}
            type="checkbox"
            checked={row.getIsSelected()}
            onClick={(e) => e.stopPropagation()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      },
      ...columns.map(([key, label]) => ({
        accessorKey: key,
        header: label,
        cell: ({
          row,
          getValue,
        }: {
          row: { original: DisplayRow };
          getValue: () => unknown;
        }) => {
          const value = getValue();
          if (["status", "priority", "slaStatus", "renewal"].includes(key))
            return <Badge>{String(value || "—")}</Badge>;
          if (key === "name" && !onOpen)
            return <span className="font-medium">{String(value)}</span>;
          if (key === "name")
            return (
              <button
                className="record-link"
                onClick={() => onOpen?.(row.original.id)}
              >
                {name === "organizations" && (
                  <span className="avatar company-avatar">
                    {initials(String(value))}
                  </span>
                )}
                <span>
                  {String(value)}
                  {name === "organizations" && (
                    <small>{row.original.code}</small>
                  )}
                </span>
              </button>
            );
          return (
            <span
              className={
                ["balance", "total", "value", "amount", "stockValue"].includes(
                  key,
                )
                  ? "tabular font-medium"
                  : ""
              }
            >
              {cellLabel(key, value)}
            </span>
          );
        },
      })),
    ],
    [columns, name, onOpen],
  );
  // TanStack v8 owns mutable table internals; keep this component outside compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns: defs,
    state: {
      globalFilter: search,
      sorting,
      columnVisibility: visibility,
      rowSelection: selection,
    },
    onGlobalFilterChange: setSearch,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
    getRowId: (r) => r.id,
  });
  const selected = table.getSelectedRowModel().rows.map((r) => r.original.id);
  return (
    <div className="table-panel">
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={16} />
          <input
            aria-label={`Search ${name}`}
            placeholder={`Search ${name.replace(/([A-Z])/g, " $1").toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          {selected.length > 0 && (
            <>
              <span className="muted">{selected.length} selected</span>
              {onBulk && (
                <button
                  className="btn"
                  onClick={() => {
                    onBulk(selected);
                    setSelection({});
                  }}
                >
                  Update selected
                </button>
              )}
            </>
          )}{" "}
          {filters.length > 0 && (
            <button
              className={showFilters ? "btn active" : "btn"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={15} /> Filters{" "}
              {Object.values(filterValues).filter(Boolean).length || ""}
            </button>
          )}
          <Menu
            label={
              <>
                <SlidersHorizontal size={15} />
                <span className="hide-small">Columns</span>
              </>
            }
          >
            {table
              .getAllLeafColumns()
              .filter((c) => c.id !== "select")
              .map((c) => (
                <MenuItem key={c.id} onClick={() => c.toggleVisibility()}>
                  {c.getIsVisible() ? "✓" : "○"}{" "}
                  {columns.find(([key]) => key === c.id)?.[1]}
                </MenuItem>
              ))}
          </Menu>
          <button
            className="btn"
            disabled={
              Object.hasOwn(collectionArea, name) &&
              !can(getMember(), collectionArea[name as Collection], "export")
            }
            onClick={() =>
              exportCSV(
                name,
                selected.length
                  ? table.getSelectedRowModel().rows.map((r) => r.original)
                  : table.getFilteredRowModel().rows.map((r) => r.original),
              )
            }
          >
            <Download size={15} />
            <span className="hide-small">Export</span>
          </button>
        </div>
      </div>
      {showFilters && (
        <div className="filter-bar">
          {filters.map((key) => (
            <label key={key}>
              {columns.find(([k]) => k === key)?.[1] || key}
              <select
                value={filterValues[key] || ""}
                onChange={(e) =>
                  setFilterValues({ ...filterValues, [key]: e.target.value })
                }
              >
                <option value="">All</option>
                {[...new Set(rows.map((r) => String(r[key] || "")))]
                  .filter(Boolean)
                  .sort()
                  .map((v) => (
                    <option key={v}>{v}</option>
                  ))}
              </select>
            </label>
          ))}
          <button
            className="text-btn"
            onClick={() => {
              setFilterValues({});
              setSearch("");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id}>
                    {h.column.getCanSort() ? (
                      <button
                        className="sort-header"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <ArrowUpDown size={12} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
                {onOpen && (
                  <th>
                    <span className="sr-only">Open record</span>
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} data-selected={row.getIsSelected()}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                {onOpen && (
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Open ${row.original.name}`}
                      onClick={() => onOpen(row.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!table.getRowModel().rows.length && <Empty />}
      <div className="table-footer">
        <span>
          {table.getFilteredRowModel().rows.length
            ? table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
              1
            : 0}
          –
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length,
          )}{" "}
          of {table.getFilteredRowModel().rows.length} records
        </span>
        <div className="pagination">
          <label>
            Rows{" "}
            <select
              aria-label="Rows per page"
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
            >
              {[8, 15, 25, 50].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {table.getState().pagination.pageIndex + 1} /{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
