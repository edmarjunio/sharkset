/** Share one live source among consumers, isolated by query/tenant/auth key. */
export function createSharedSubscription<T>() {
  const entries = new Map<string, { listeners: Set<(value: T) => void>; errors: Set<(error: unknown) => void>; stop: () => void; value?: T }>();
  return (key: string, start: (next: (value: T) => void, error: (error: unknown) => void) => () => void,
    next: (value: T) => void, error: (error: unknown) => void = () => {}) => {
    let entry = entries.get(key);
    if (!entry) {
      entry = { listeners: new Set(), errors: new Set(), stop: () => {} }; entries.set(key, entry);
      const target = entry;
      target.listeners.add(next); target.errors.add(error);
      target.stop = start(value => { target.value = value; target.listeners.forEach(fn => fn(value)); }, failure => target.errors.forEach(fn => fn(failure)));
    } else {
      entry.listeners.add(next); entry.errors.add(error);
      if (entry.value !== undefined) next(entry.value);
    }
    const target = entry;
    return () => {
      target.listeners.delete(next); target.errors.delete(error);
      if (!target.listeners.size) { target.stop(); entries.delete(key); }
    };
  };
}
