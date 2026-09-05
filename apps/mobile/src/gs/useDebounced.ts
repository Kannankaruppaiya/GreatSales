import { useEffect, useState } from 'react';

/**
 * A value that settles before it is used.
 *
 * Every list screen now sends its search box to the API, so without this each
 * keystroke is a request. 300ms matches the web console's `useDebouncedValue`,
 * deliberately — two clients debouncing differently is two different amounts of
 * load on the same endpoint for the same gesture.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
