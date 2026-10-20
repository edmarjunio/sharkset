import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  clearRecentSearches,
  getPopularArenaSuggestions,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from '../services/searchSuggestions';
import {
  Search,
  Clock,
  Flame,
  Star,
  MapPin,
  Trophy,
  Calendar,
  ArrowRight,
  X,
} from 'lucide-react';

interface TopBarSearchBoxProps {
  compact?: boolean;
}

export const TopBarSearchBox: React.FC<TopBarSearchBoxProps> = ({ compact = false }) => {
  const {
    tenant,
    availableTenants,
    setTenantId,
    tournaments,
    setActiveTournamentId,
    setActiveTab,
    setArenaSubTab,
    setCommandPaletteOpen,
  } = useApp();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const popularArenas = useMemo(
    () => getPopularArenaSuggestions(availableTenants, tenant),
    [availableTenants, tenant]
  );

  const quickMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      id: string;
      label: string;
      category: string;
      onSelect: () => void;
    }> = [];

    availableTenants.forEach((arena) => {
      if (
        arena.name.toLowerCase().includes(q) ||
        arena.city.toLowerCase().includes(q) ||
        arena.state.toLowerCase().includes(q)
      ) {
        results.push({
          id: `arena-${arena.id}`,
          label: `${arena.name} (${arena.city}/${arena.state})`,
          category: 'Arena',
          onSelect: () => {
            setRecentSearches(saveRecentSearch(arena.name));
            setTenantId(arena.id);
            setArenaSubTab('agenda');
            setActiveTab('scheduler');
          },
        });
      }
    });

    tournaments.forEach((trn) => {
      if (trn.name.toLowerCase().includes(q) || (trn.location || '').toLowerCase().includes(q)) {
        results.push({
          id: `trn-${trn.id}`,
          label: trn.name,
          category: 'Campeonato',
          onSelect: () => {
            setRecentSearches(saveRecentSearch(trn.name));
            setActiveTournamentId(trn.id);
            setActiveTab('tournaments');
          },
        });
      }
    });

    return results.slice(0, 5);
  }, [
    query,
    availableTenants,
    tournaments,
    setTenantId,
    setArenaSubTab,
    setActiveTab,
    setActiveTournamentId,
  ]);

  const handleSelectTerm = (term: string) => {
    setRecentSearches(saveRecentSearch(term));
    setQuery(term);
    const lower = term.toLowerCase();
    if (lower.includes('torneio') || lower.includes('série') || lower.includes('campeonato')) {
      setActiveTab('tournaments');
      setIsOpen(false);
    } else if (lower.includes('live') || lower.includes('transmissão')) {
      setActiveTab('live');
      setIsOpen(false);
    } else if (lower.includes('aula')) {
      setArenaSubTab('aulas');
      setActiveTab('scheduler');
      setIsOpen(false);
    } else if (lower.includes('quadra') || lower.includes('agenda')) {
      setArenaSubTab('agenda');
      setActiveTab('scheduler');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" data-testid={compact ? 'topbar-search-mobile' : 'topbar-search-desktop'}>
      <div
        className={`flex items-center gap-2 w-full ${
          compact ? 'px-3.5 py-1.5 rounded-xl' : 'px-4 py-2 rounded-2xl'
        } border border-cyan-500/35 bg-[#071526]/95 hover:bg-[#071526] text-cyan-200 shadow-inner transition-colors focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/25`}
      >
        <Search className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} shrink-0 text-cyan-400`} />
        <input
          type="text"
          value={query}
          onFocus={() => {
            setRecentSearches(getRecentSearches());
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 180);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            } else if (e.key === 'Enter' && query.trim()) {
              if (quickMatches[0]) {
                quickMatches[0].onSelect();
                setIsOpen(false);
              } else {
                handleSelectTerm(query.trim());
              }
            }
          }}
          placeholder="Buscar atletas, arenas populares ou torneios..."
          aria-label="Buscar atletas, arenas populares ou torneios"
          data-testid="topbar-search-input"
          className={`w-full bg-transparent text-white placeholder:text-slate-300 focus:outline-none ${
            compact ? 'text-xs' : 'text-xs sm:text-sm'
          }`}
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQuery('')}
            className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Limpar busca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setIsOpen(false);
            setCommandPaletteOpen(true);
          }}
          className="ml-auto px-2 py-0.5 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-[10px] font-mono font-bold text-cyan-200 shrink-0 cursor-pointer transition-colors"
          title="Abrir busca avançada (Ctrl+K)"
        >
          {compact ? '⌘K' : 'Ctrl + K'}
        </button>
      </div>

      {isOpen && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          data-testid="topbar-search-dropdown"
          className="absolute left-0 right-0 top-full mt-2 z-[95] rounded-2xl bg-[#061830] border border-cyan-500/40 shadow-[0_18px_45px_rgba(0,0,0,0.75)] p-3.5 space-y-3 text-white animate-in fade-in duration-150"
        >
          {/* Filtered Quick Matches when typing */}
          {query.trim().length > 0 && (
            <div className="space-y-1.5 pb-2 border-b border-[#145A9B]/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 block">
                Resultados Rápidos para "{query}"
              </span>
              {quickMatches.length === 0 ? (
                <div className="flex items-center justify-between text-xs text-slate-300 py-1.5 px-2 rounded-xl bg-[#030B17]">
                  <span>Pressione Enter para buscar "{query}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentSearches(saveRecentSearch(query.trim()));
                      setIsOpen(false);
                      setCommandPaletteOpen(true);
                    }}
                    className="text-[#12C7BB] font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    Busca Completa <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {quickMatches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onSelect();
                        setIsOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] flex items-center justify-between gap-2 text-left text-xs cursor-pointer transition-colors"
                    >
                      <span className="font-bold text-white truncate">{item.label}</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[10px] font-black uppercase shrink-0">
                        {item.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pesquisas Recentes */}
          {recentSearches.length > 0 && (
            <div className="space-y-1.5" data-testid="topbar-recent-searches">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#5BC3FA]" />
                  Pesquisas Recentes
                </span>
                <button
                  type="button"
                  onClick={() => setRecentSearches(clearRecentSearches())}
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-300 cursor-pointer"
                >
                  Limpar histórico
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] px-2.5 py-1 text-xs text-slate-200 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectTerm(term)}
                      className="font-semibold hover:text-[#12C7BB] cursor-pointer"
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentSearches(removeRecentSearch(term))}
                      className="text-slate-500 hover:text-white ml-0.5 cursor-pointer"
                      aria-label={`Remover ${term}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Arenas Populares */}
          <div className="space-y-1.5 pt-1 border-t border-[#145A9B]/60" data-testid="topbar-popular-arenas">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Arenas Populares & Navegação Rápida
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('arenas_directory');
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-[#12C7BB] hover:underline cursor-pointer"
              >
                Ver todas as arenas →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {popularArenas.slice(0, 3).map((arena) => (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => {
                    setRecentSearches(saveRecentSearch(arena.name));
                    setIsOpen(false);
                    if (arena.isCatalogArena) {
                      setTenantId(arena.id);
                      setArenaSubTab('agenda');
                      setActiveTab('scheduler');
                    } else {
                      setActiveTab('arenas_directory');
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] hover:border-[#12C7BB]/60 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[9px] font-black uppercase truncate">
                      {arena.badge}
                    </span>
                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5 shrink-0">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      {arena.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-white truncate group-hover:text-[#12C7BB]">
                    {arena.name}
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5 text-[#0987CE] shrink-0" />
                    {arena.city}/{arena.state} · {arena.courtsCount} quadras
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts Footer */}
          <div className="pt-2 border-t border-[#145A9B]/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tournaments');
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trophy className="w-3 h-3" />
                Campeonatos
              </button>
              <button
                type="button"
                onClick={() => {
                  setArenaSubTab('agenda');
                  setActiveTab('scheduler');
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Calendar className="w-3 h-3" />
                Horários Livres
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setCommandPaletteOpen(true);
              }}
              className="text-slate-400 hover:text-white font-semibold cursor-pointer"
            >
              Abrir Busca Global (⌘K) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
