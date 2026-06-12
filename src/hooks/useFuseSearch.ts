import { useMemo } from 'react';
import Fuse from 'fuse.js';

export function useFuseSearch<T>(
  data: T[],
  keys: string[],
  query: string
): T[] {
  const fuse = useMemo(() => {
    return new Fuse(data, {
      keys,
      threshold: 0.4,
      includeScore: false,
      minMatchCharLength: 2,
    });
  }, [data, keys]);

  return useMemo(() => {
    if (!query || query.trim().length === 0) {
      return data;
    }
    return fuse.search(query).map((result) => result.item);
  }, [fuse, data, query]);
}
