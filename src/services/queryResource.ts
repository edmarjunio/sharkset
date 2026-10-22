export interface QuerySnapshot<T> {
  data: T | undefined;
  updatedAt: number;
  loading: boolean;
  error: string;
}

/** A shared request and refresh clock per query; no private data is persisted. */
export function createQueryResource<T>(load: (signal: AbortSignal) => Promise<T>, options: {
  ttl: number; maxAge: number; now?: () => number; onIdle?: () => void;
}) {
  const now = options.now || Date.now;
  let state: QuerySnapshot<T> = { data: undefined, updatedAt: 0, loading: false, error: '' };
  const listeners = new Set<() => void>();
  let request: Promise<T | undefined> | undefined;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let generation = 0;
  let publication = 0;
  const emit = () => listeners.forEach(listener => listener());
  const freshData = () => state.data !== undefined && now() - state.updatedAt <= options.maxAge;
  const publish = (data: T) => {
    publication++;
    const same = state.data !== undefined && JSON.stringify(state.data) === JSON.stringify(data);
    state = { data: same ? state.data : data, updatedAt: now(), loading: false, error: '' };
    emit();
  };
  const refresh = (force = false): Promise<T | undefined> => {
    if (request) return request;
    if (!force && state.data !== undefined && now() - state.updatedAt < options.ttl) return Promise.resolve(state.data);
    const version = generation;
    const priorPublication = publication;
    const activeController = new AbortController();
    controller = activeController;
    state = { ...state, data: freshData() ? state.data : undefined, loading: true, error: '' };
    emit();
    request = Promise.resolve().then(() => load(activeController.signal)).then(data => {
      if (version === generation && priorPublication === publication) publish(data);
      return version === generation ? data : undefined;
    }).catch(error => {
      if (version === generation && priorPublication === publication) {
        state = { ...state, data: freshData() ? state.data : undefined, loading: false, error: error instanceof Error ? error.message : 'Falha ao atualizar os dados.' };
        emit();
      }
      return undefined;
    }).finally(() => { if (version === generation) request = undefined; });
    return request;
  };
  const onResume = () => { if (typeof document === 'undefined' || !document.hidden) void refresh(); };
  return {
    getSnapshot: () => state, refresh, publish,
    invalidate: () => {
      generation++; controller?.abort(); request = undefined;
      state = { ...state, updatedAt: 0, loading: false };
      if (listeners.size) void refresh(true); else emit();
    },
    clear: () => {
      generation++; controller?.abort(); request = undefined;
      state = { data: undefined, updatedAt: 0, loading: false, error: '' }; emit();
    },
    cancel: () => {
      generation++; controller?.abort(); request = undefined;
      state = { ...state, loading: false }; emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        timer = setInterval(onResume, options.ttl);
        if (typeof window !== 'undefined') {
          window.addEventListener('focus', onResume); window.addEventListener('online', onResume);
          document.addEventListener('visibilitychange', onResume);
        }
      }
      void refresh();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearInterval(timer);
          if (typeof window !== 'undefined') {
            window.removeEventListener('focus', onResume); window.removeEventListener('online', onResume);
            document.removeEventListener('visibilitychange', onResume);
          }
          options.onIdle?.();
        }
      };
    },
  };
}
