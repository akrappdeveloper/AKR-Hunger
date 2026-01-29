'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSearchSuggestions } from '@/lib/search';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search restaurants, cuisines...' }: SearchBarProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (value.length >= 2) {
                const results = await getSearchSuggestions(value);
                setSuggestions(results);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        fetchSuggestions();
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                onChange(suggestions[selectedIndex]);
                setShowSuggestions(false);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleClear = () => {
        onChange('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.focus();
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => value.length >= 2 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="pl-10 pr-10 h-12 text-base"
                />
                {value && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={handleClear}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`w-full text-left px-4 py-3 hover:bg-secondary transition-colors ${index === selectedIndex ? 'bg-secondary' : ''
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <span>{suggestion}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
