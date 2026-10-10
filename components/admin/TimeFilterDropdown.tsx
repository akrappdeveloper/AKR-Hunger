import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, addDays, isSameDay } from 'date-fns';

export type DateRange = { from: Date; to: Date } | undefined;

export const PRESET_RANGES = [
  { label: 'Today', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Tomorrow', getValue: () => ({ from: addDays(new Date(), 1), to: addDays(new Date(), 1) }) },
  { label: 'Last 7 Days', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Last 15 Days', getValue: () => ({ from: subDays(new Date(), 15), to: new Date() }) },
  { label: 'Last 30 Days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Previous Month', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'This 6 Months', getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'Last 6 Months', getValue: () => ({ from: subMonths(new Date(), 12), to: subMonths(new Date(), 6) }) },
  { label: 'This Year', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  { label: 'Last Year', getValue: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }) },
  { label: 'Lifetime', getValue: () => ({ from: new Date(2020, 0, 1), to: new Date() }) },
];

interface TimeFilterDropdownProps {
  onRangeChange: (range: DateRange) => void;
  className?: string;
}

export function TimeFilterDropdown({ onRangeChange, className }: TimeFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<DateRange>({ from: subDays(new Date(), 7), to: new Date() });
  const [selectedLabel, setSelectedLabel] = useState('Last 7 Days');
  const [showCustom, setShowCustom] = useState(false);

  const handleSelectPreset = (label: string, getValue: () => DateRange) => {
    const range = getValue();
    setDate(range);
    setSelectedLabel(label);
    setShowCustom(false);
    setOpen(false);
    onRangeChange(range);
  };

  const handleCustomApply = () => {
    setSelectedLabel('Custom Range');
    setOpen(false);
    onRangeChange(date);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`w-[240px] justify-between text-left font-normal bg-card border-border/50 ${className}`}>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{selectedLabel}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-card border-border/50" align="end">
        {!showCustom ? (
          <div className="flex flex-col">
            <div className="p-2 max-h-[300px] overflow-y-auto">
              {PRESET_RANGES.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset.label, preset.getValue)}
                  className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-secondary/50 text-left transition-colors"
                >
                  <span className={selectedLabel === preset.label ? 'font-medium text-blue-500' : 'text-foreground'}>
                    {preset.label}
                  </span>
                  {selectedLabel === preset.label && <Check className="h-4 w-4 text-blue-500" />}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-border/50">
              <button
                onClick={() => setShowCustom(true)}
                className="w-full px-3 py-2 text-sm rounded-md hover:bg-secondary/50 text-left text-foreground transition-colors"
              >
                Custom Range...
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setShowCustom(false)} className="text-xs text-muted-foreground hover:text-foreground">
                &larr; Back to Presets
              </button>
              <span className="text-sm font-medium">Custom Range</span>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={{ from: date?.from, to: date?.to }}
              onSelect={(range) => setDate(range as DateRange)}
              numberOfMonths={1}
              className="rounded-md border-border/50 bg-card"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="bg-transparent border-border/50">
                Cancel
              </Button>
              <Button size="sm" onClick={handleCustomApply} className="bg-blue-600 hover:bg-blue-700 text-white">
                Apply Range
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
