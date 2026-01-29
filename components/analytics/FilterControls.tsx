'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, Filter, X } from 'lucide-react';

export interface FilterOptions {
  dateRange: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate?: Date;
  endDate?: Date;
  status?: string;
  search?: string;
}

interface FilterControlsProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  showStatus?: boolean;
  statusOptions?: string[];
  showSearch?: boolean;
  onExport?: () => void;
}

export function FilterControls({
  filters,
  onFiltersChange,
  showStatus = false,
  statusOptions = [],
  showSearch = false,
  onExport,
}: FilterControlsProps) {
  const handleDateRangeChange = (range: 'today' | 'week' | 'month' | 'year' | 'custom') => {
    onFiltersChange({
      ...filters,
      dateRange: range,
    });
  };

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status: filters.status === status ? undefined : status,
    });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({
      ...filters,
      search,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      dateRange: 'month',
      search: '',
      status: undefined,
    });
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Filters</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs"
          >
            <X size={14} className="mr-1" />
            Clear
          </Button>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Date Range</label>
          <div className="flex gap-2 flex-wrap">
            {(['today', 'week', 'month', 'year'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={filters.dateRange === range ? 'default' : 'outline'}
                onClick={() => handleDateRangeChange(range)}
                className="text-xs"
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        {showStatus && statusOptions.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Status</label>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={filters.status === status ? 'default' : 'outline'}
                  onClick={() => handleStatusChange(status)}
                  className="text-xs capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        {showSearch && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Search</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
            />
          </div>
        )}

        {/* Export Button */}
        {onExport && (
          <Button
            onClick={onExport}
            className="w-full"
            size="sm"
          >
            <Calendar size={14} className="mr-2" />
            Export Report
          </Button>
        )}
      </div>
    </Card>
  );
}
