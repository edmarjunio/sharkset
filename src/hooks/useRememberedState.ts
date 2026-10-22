import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

// Public view preferences only. Drafts, profiles and permissions must not use this store.
const views = new Map<string, { value: unknown; at: number }>();
export function useRememberedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const read = () => {
    const saved = views.get(key);
    return saved && Date.now() - saved.at < 30 * 60_000 ? saved.value as T : initial;
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => { setValue(read()); }, [key]);
  const update: Dispatch<SetStateAction<T>> = useCallback(next => {
    setValue(previous => {
      const result = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      views.delete(key); views.set(key, { value: result, at: Date.now() });
      if (views.size > 80) views.delete(views.keys().next().value!);
      return result;
    });
  }, [key]);
  return [value, update];
}
