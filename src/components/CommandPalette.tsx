import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Trophy,
  Users,
  BookmarkCheck,
  Building2,
  MapPin,
  GraduationCap,
  Clock,
  Flame,
  Star,
  X,
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveTab,
    setArenaSubTab,
    setTenantId,
    availableTenants,
    tenant,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  const popularArenas = useMemo(
    () => getPopularArenaSuggestions(availableTenants, tenant),
    [availableTenants, tenant]
  );

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
    }
  }, [commandPaletteOpen]);

  const commands = useMemo(() => {
    return [
      {
        id: 'nav-arenas',
        label: 'Buscar Arenas por Localização & Raio de Alcance',
        category: 'Navegação',
        icon: MapPin,
        action: () => setActiveTab('arenas_directory'),
      },
      {
        id: 'nav-scheduler',
        label: 'Abrir Agenda por Quadra da Arena',
        category: 'Arena',
        icon: Calendar,
        action: () => {
          setArenaSubTab('agenda');
          setActiveTab('scheduler');
        },
      },
      {
        id: 'nav-classes',
        label: 'Consultar aulas e treinos',
        category: 'Arena',
        icon: GraduationCap,
        action: () => {
          setArenaSubTab('aulas');
          setActiveTab('scheduler');
        },
      },
      {
        id: 'nav-bracket',
        label: 'Abrir Tabela do Campeonato (Semi Direta / Semi com Chance)',
        category: 'Campeonatos',
        icon: Trophy,
        action: () => setActiveTab('tournaments'),
      },
      {
        id: 'nav-register',
        label: 'Inscrever Dupla & Ver Ranking de Atletas (Iniciante, C, B, A, Pro)',
        category: 'Campeonatos',
        icon: Users,
        action: () => setActiveTab('register_dupla'),
      },
      {
        id: 'nav-academy',
        label: 'Shark Academy & Comunidade Futevôlei (Marcação, Base, Areia + IA Vision)',
        category: 'Ensino & IA',
        icon: GraduationCap,
        action: () => setActiveTab('shark_academy'),
      },
      {
        id: 'nav-bookings',
        label: 'Tela do Cliente: Quadras que Mais Joga & Histórico',
        category: 'Cliente',
        icon: BookmarkCheck,
        action: () => setActiveTab('my_bookings'),
      },
      ...availableTenants.map((t) => ({
        id: `tenant-${t.id}`,
        label: `Entrar na Arena: ${t.name} (${t.city}-${t.state} · ${t.distanceKm} km)`,
        category: 'Arenas',
        icon: Building2,
        action: () => {
          setTenantId(t.id);
          setArenaSubTab('agenda');
          setActiveTab('scheduler');
        },
      })),
    ];
  }, [availableTenants, setActiveTab, setArenaSubTab, setTenantId]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  if (!commandPaletteOpen) return null;

  const handleExecute = (action: () => void, searchTerm?: string) => {
    if (searchTerm) {
      setRecentSearches(saveRecentSearch(searchTerm));
    } else if (query.trim()) {
      setRecentSearches(saveRecentSearch(query.trim()));
    }
    action();
    setCommandPaletteOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/60 backdrop-blur-xs p-4"
      onClick={() => setCommandPaletteOpen(false)}
      data-testid="command-palette-overlay"
    >
      <div
        className="aquarium-glass bg-[#071D3D] text-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#145A9B] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-[#145A9B]">
          <Search className="w-4 h-4 text-[#0987CE] mr-2.5 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCommandPaletteOpen(false);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev - 1 < 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
                );
              } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
                e.preventDefault();
                handleExecute(filteredCommands[selectedIndex].action);
              }
            }}
            placeholder="Buscar arenas populares, aulas, campeonatos ou comandos..."
            className="w-full py-3.5 text-sm bg-transparent focus:outline-none text-white placeholder:text-slate-400"
            data-testid="command-palette-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="px-2 py-0.5 mr-2 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-slate-300 cursor-pointer"
            >
              Limpar
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PESQUISAS RECENTES & ARENAS POPULARES DROPDOWN */}
        {!query.trim() && (
          <div
            className="px-4 py-3 bg-[#041428]/90 border-b border-[#145A9B]/60 space-y-3"
            data-testid="command-palette-suggestions"
          >
            {recentSearches.length > 0 && (
              <div className="space-y-1.5" data-testid="recent-searches-section">
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
                    Limpar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] px-2.5 py-1 text-xs text-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          setRecentSearches(saveRecentSearch(term));
                        }}
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

            <div className="space-y-1.5" data-testid="popular-arenas-section">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Arenas Populares
                </span>
                <button
                  type="button"
                  onClick={() => handleExecute(() => setActiveTab('arenas_directory'))}
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
                    onClick={() =>
                      handleExecute(() => {
                        if (arena.isCatalogArena) {
                          setTenantId(arena.id);
                          setArenaSubTab('agenda');
                          setActiveTab('scheduler');
                        } else {
                          setActiveTab('arenas_directory');
                        }
                      }, arena.name)
                    }
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
          </div>
        )}

        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filteredCommands.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                onClick={() => handleExecute(cmd.action, cmd.label)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#0B254E] text-white font-semibold'
                    : 'text-slate-300 hover:bg-[#030B17]/60'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 text-[#0987CE] shrink-0" />
                  <span className="truncate">{cmd.label}</span>
                </div>
                <span className="text-[10px] text-[#5BC3FA] shrink-0 font-semibold">
                  {cmd.category}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 bg-[#030B17] border-t border-[#145A9B] text-[11px] text-slate-400 flex items-center justify-between">
          <span>Use Enter para abrir ou Esc para fechar</span>
          <span className="text-[#12C7BB] font-bold">Atalho Global ⌘K</span>
        </div>
      </div>
    </div>
  );
};

