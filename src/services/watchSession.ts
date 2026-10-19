export interface WatchSession { view: 'video' | 'table'; tournamentId: string }
export type WatchAction = { type: 'table' } | { type: 'video' } | { type: 'select'; tournamentId: string };
export function watchSessionReducer(state: WatchSession, action: WatchAction): WatchSession {
  if (action.type === 'select') return { ...state, tournamentId: action.tournamentId };
  return { ...state, view: action.type };
}
