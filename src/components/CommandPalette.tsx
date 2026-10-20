import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Calendar, Trophy, Users, BookmarkCheck, Building2, MapPin, GraduationCap, Settings } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveTab,
    setArenaSubTab,
    setTenantId,
    availableTenants,
  } = useApp();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  if (!commandPaletteOpen) return null;

  const handleExecute = (action: () => void) => {
    action();
    setCommandPaletteOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs p-4">
      <div className="aquarium-glass bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite um comando, arena, aula ou ranking..."
            className="w-full py-3.5 text-sm bg-transparent focus:outline-none text-slate-900 placeholder:text-slate-400"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                onClick={() => handleExecute(cmd.action)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                  isSelected ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{cmd.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 font-normal">{cmd.category}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Use Enter para abrir ou Esc para fechar</span>
          <span>Atalho Global ⌘K</span>
        </div>
      </div>
    </div>
  );
};
