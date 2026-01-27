import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2, FileText } from 'lucide-react';
import { useSearchSuggestions } from '@/hooks/useSearch';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  initialValue?: string;
}

export function SearchInput({
  onSearch,
  placeholder = 'Search articles...',
  className,
  autoFocus = false,
  initialValue = '',
}: SearchInputProps) {
  const { query, setQuery, suggestions, isLoading, clearQuery } = useSearchSuggestions(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleSubmit = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    onSearch(finalQuery.trim());
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSubmit(suggestions[selectedIndex].title);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(value.length >= 2);
  };

  const handleClear = () => {
    clearQuery();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: { title: string }) => {
    setQuery(suggestion.title);
    handleSubmit(suggestion.title);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full h-10 pl-10 pr-10 rounded-lg',
            'bg-background/50 backdrop-blur-sm',
            'border border-border/50',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
            'transition-all duration-200'
          )}
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-full mt-2',
              'bg-white/95 backdrop-blur-xl',
              'border border-border/50 rounded-lg',
              'shadow-lg overflow-hidden'
            )}
          >
            <ul className="py-1 max-h-[300px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.title}-${index}`}>
                  <button
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full px-4 py-2 flex items-center gap-3 text-left',
                      'transition-colors duration-100',
                      selectedIndex === index
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{suggestion.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
