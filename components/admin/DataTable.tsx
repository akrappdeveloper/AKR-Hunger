import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  actions?: React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue = '',
  actions,
  emptyMessage = 'No records found.',
  onRowClick,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => {
              if (onSearch) onSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-blue-500/50"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {actions}
        </div>
      </div>

      {/* Table Area */}
      <div className="border border-border/50 rounded-lg bg-background/40 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-card/5 border-b border-border/50">
              <TableRow className="hover:bg-transparent border-border/50">
                {columns.map((col, idx) => (
                  <TableHead key={idx} className={`text-muted-foreground font-semibold ${col.className || ''}`}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={rowIndex} className="border-border/50">
                    {columns.map((_, colIndex) => (
                      <TableCell key={colIndex}>
                        <Skeleton className="h-6 w-full bg-card/5" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <TableRow 
                    key={rowIndex} 
                    className={`border-border/50 hover:bg-card/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (onRowClick) onRowClick(row);
                    }}
                  >
                    {columns.map((col, colIndex) => (
                      <TableCell key={colIndex} className={col.className || ''}>
                        {col.cell ? col.cell(row) : (col.accessorKey ? String((row as any)[col.accessorKey]) : '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing <span className="font-medium text-foreground">{startIndex + 1}</span> to <span className="font-medium text-foreground">{Math.min(startIndex + itemsPerPage, data.length)}</span> of <span className="font-medium text-foreground">{data.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border/50 bg-transparent hover:bg-card/10 hover:text-foreground text-muted-foreground"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-foreground px-2">{currentPage}</span>
              <span>/ {totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border/50 bg-transparent hover:bg-card/10 hover:text-foreground text-muted-foreground"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
