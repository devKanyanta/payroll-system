import { useState, useEffect } from 'react';

/**
 * Debounce a value by the specified delay (ms).
 * Useful for delaying API calls triggered by rapid input changes like search fields.
 *
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds before the value updates
 * @returns {*} The debounced value
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 400);
 * // use debouncedSearch in your query key instead of search
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
