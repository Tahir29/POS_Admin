'use client';

// shadcn data-table (TanStack Table + shadcn Table/Card/Input/Select/Button).
//
// `columns` keeps the simple declarative shape every page already uses —
// { title, data, render?(value, 'display', row), responsivePriority?,
// href?(row) } — and is mapped onto TanStack columns here, so pages never
// touch TanStack itself. `href` turns that cell into a link when it returns one.
//
// Wide screens (xl+): a sortable table. Below that (phones, tablets, and
// laptops where the sidebar leaves too little room): each row is a Card listing
// every field, so nothing hides behind an expand toggle or side-scroll. The
// lowest-responsivePriority column is the card title, the next its subtitle.
//
// Everything renders as React text (never innerHTML), so customer-supplied
// values like names can't inject markup.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZES = [10, 25, 50, 100];

const display = (col, row) => {
  const value = row[col.data];
  const out = col.render ? col.render(value, 'display', row) : value;
  return out == null || out === '' ? '—' : out;
};

function Shown({ col, row }) {
  const text = display(col, row);
  const href = col.href?.(row);
  return href ? (
    // Card layout (below xl) is the touch layout — give links a finger-sized
    // 44px tap height there; the desktop table keeps them inline.
    <Link
      href={href}
      className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline xl:min-h-0"
    >
      {text}
    </Link>
  ) : (
    text
  );
}

// Raw-value sort with empty values always last, regardless of direction.
const compareRaw = (a, b) => {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
};

function SortIcon({ sorted }) {
  if (sorted === 'asc') return <ArrowUp />;
  if (sorted === 'desc') return <ArrowDown />;
  return <ArrowUpDown className="opacity-40" />;
}

/**
 * @param {{ data: object[], columns: object[] }} props
 */
export default function DataTable({ data, columns }) {
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const byPriority = useMemo(
    () => [...columns].sort((a, b) => (a.responsivePriority ?? 99) - (b.responsivePriority ?? 99)),
    [columns]
  );
  const [titleCol, subtitleCol, ...restCols] = byPriority;

  const tableColumns = useMemo(
    () =>
      columns.map((col) => ({
        id: col.data,
        accessorFn: (row) => row[col.data],
        header: col.title,
        cell: ({ row }) => <Shown col={col} row={row.original} />,
        sortingFn: (a, b, id) => compareRaw(a.getValue(id), b.getValue(id)),
        meta: { col },
      })),
    [columns]
  );

  // Known, harmless: TanStack's returned API can't be auto-memoized by the
  // React Compiler, which this project doesn't enable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    // Match what the user SEES (formatted dates/money), not raw ISO strings.
    getColumnCanGlobalFilter: () => true,
    globalFilterFn: (row, columnId, filter) => {
      const col = row.getAllCells().find((c) => c.column.id === columnId)?.column.columnDef.meta.col;
      return String(display(col, row.original)).toLowerCase().includes(String(filter).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const sortState = sorting[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search…"
            aria-label="Search records"
            className="pl-8"
          />
        </div>

        {/* Column headers do the sorting on wide screens; card layout gets this instead. */}
        <div className="flex gap-2 xl:hidden">
          <Select
            value={sortState?.id ?? 'none'}
            onValueChange={(id) => setSorting(id === 'none' ? [] : [{ id, desc: sortState?.desc ?? false }])}
          >
            <SelectTrigger className="flex-1" aria-label="Sort by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default order</SelectItem>
              {columns.map((col) => (
                <SelectItem key={col.data} value={col.data}>
                  Sort: {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={!sortState}
            onClick={() => setSorting([{ id: sortState.id, desc: !sortState.desc }])}
            aria-label={sortState?.desc ? 'Sort ascending' : 'Sort descending'}
          >
            <SortIcon sorted={sortState ? (sortState.desc ? 'desc' : 'asc') : false} />
          </Button>
        </div>
      </div>

      {/* Wide-screen table */}
      <Card className="hidden py-0 xl:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="px-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-1 h-auto min-h-8 py-1 text-left font-semibold whitespace-normal"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon sorted={header.column.getIsSorted()} />
                    </Button>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-3 whitespace-normal wrap-anywhere">{/* long store names and email-style login IDs wrap instead of forcing horizontal scroll */}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No matching records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Card layout */}
      <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
        {rows.length ? (
          rows.map((row) => (
            <Card key={row.id} size="sm">
              <CardHeader>
                <CardTitle><Shown col={titleCol} row={row.original} /></CardTitle>
                {subtitleCol && <CardDescription><Shown col={subtitleCol} row={row.original} /></CardDescription>}
              </CardHeader>
              {restCols.length > 0 && (
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {/* Empty fields are skipped on cards — a column of "—" is just noise on a phone. */}
                    {restCols.filter((col) => display(col, row.original) !== '—').map((col) => (
                      <div key={col.data} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{col.title}</dt>
                        <dd className="wrap-break-word"><Shown col={col} row={row.original} /></dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              )}
            </Card>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground sm:col-span-2">No matching records.</p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {filteredCount} record{filteredCount === 1 ? '' : 's'}
          {globalFilter && ` (filtered from ${data.length})`}
        </span>
        <div className="flex items-center gap-2">
          <Select value={String(pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="whitespace-nowrap">
            {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
