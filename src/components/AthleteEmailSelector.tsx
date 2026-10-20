import React, { useMemo, useState } from 'react';
import { AthleteLevel, AthleteProfile, SportType } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../data/initialData';
import {
  CheckCircle2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';

interface AthleteEmailSelectorProps {
  label: string;
  athletes: AthleteProfile[];
  selectedEmail: string;
  excludeEmail?: string;
  enrolledEmails?: Set<string>;
  defaultSport?: SportType;
  defaultCity?: string;
  defaultState?: string;
  onSelectAthlete: (athlete: AthleteProfile | null) => void;
  onCreateSiteUser: (data: {
    email: string;
    name: string;
    phone: string;
    level: AthleteLevel;
  }) => AthleteProfile;
}

export const AthleteEmailSelector: React.FC<AthleteEmailSelectorProps> = ({
  label,
  athletes,
  selectedEmail,
  excludeEmail,
  enrolledEmails,
  onSelectAthlete,
  onCreateSiteUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newLevel, setNewLevel] = useState<AthleteLevel>('iniciante');
  const [inlineError, setInlineError] = useState<string | null>(null);

  const normalizedSelectedEmail = (selectedEmail || '').trim().toLowerCase();
  const normalizedExcludeEmail = (excludeEmail || '').trim().toLowerCase();

  const athletesWithEmail = useMemo(() => {
    return athletes.map((a, idx) => {
      const email = (a.email || '').trim().toLowerCase() || `atleta${idx + 1}@sharkset.com.br`;
      return { ...a, email };
    });
  }, [athletes]);

  const selectedAthlete = useMemo(() => {
    if (!normalizedSelectedEmail) return null;
    return (
      athletesWithEmail.find(
        (a) => (a.email || '').trim().toLowerCase() === normalizedSelectedEmail
      ) || null
    );
  }, [athletesWithEmail, normalizedSelectedEmail]);

  const filteredAthletes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return athletesWithEmail.filter((a) => {
      const email = (a.email || '').trim().toLowerCase();
      if (normalizedExcludeEmail && email === normalizedExcludeEmail) return false;
      if (!q) return true;
      return (
        email.includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.phone || '').includes(q)
      );
    });
  }, [athletesWithEmail, searchTerm, normalizedExcludeEmail]);

  const handleSelectByEmail = (emailValue: string) => {
    setInlineError(null);
    const norm = emailValue.trim().toLowerCase();
    if (!norm) {
      onSelectAthlete(null);
      return;
    }
    const found =
      athletesWithEmail.find((a) => (a.email || '').trim().toLowerCase() === norm) || null;
    onSelectAthlete(found);
  };

  const handleCreateUser = () => {
    setInlineError(null);
    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInlineError('Informe um e-mail válido para o usuário.');
      return;
    }
    if (!cleanName) {
      setInlineError('Informe o nome do atleta (será exibido na tabela).');
      return;
    }
    if (!cleanPhone) {
      setInlineError('Informe o WhatsApp do atleta para notificações.');
      return;
    }

    const duplicate = athletesWithEmail.some(
      (a) => (a.email || '').trim().toLowerCase() === cleanEmail
    );
    if (duplicate) {
      setInlineError('Este e-mail já está cadastrado no site. Selecione-o na lista.');
      return;
    }

    try {
      const created = onCreateSiteUser({
        email: cleanEmail,
        name: cleanName,
        phone: cleanPhone,
        level: newLevel,
      });
      onSelectAthlete(created);
      setNewEmail('');
      setNewName('');
      setNewPhone('');
      setNewLevel('iniciante');
      setShowNewUserForm(false);
    } catch (err: any) {
      setInlineError(err?.message || 'Erro ao cadastrar usuário.');
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            setInlineError(null);
            setShowNewUserForm((prev) => !prev);
          }}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
        >
          {showNewUserForm ? (
            <>
              <X className="w-3 h-3" /> Fechar Cadastro
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" /> + Novo Usuário (E-mail)
            </>
          )}
        </button>
      </div>

      {/* Quick Search + EMAIL - NOME Dropdown */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar usuário por EMAIL ou NOME..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Selecionar Usuário Cadastrado (Formato: EMAIL - NOME) *
          </label>
          <select
            value={normalizedSelectedEmail}
            onChange={(e) => handleSelectByEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
          >
            <option value="">-- Selecione: EMAIL - NOME --</option>
            {filteredAthletes.map((ath) => {
              const email = (ath.email || '').trim().toLowerCase();
              const isAlreadyEnrolled = enrolledEmails?.has(email);
              return (
                <option key={ath.id} value={email} disabled={isAlreadyEnrolled}>
                  {email} - {ath.name} ({ATHLETE_LEVEL_LABELS[ath.level]})
                  {isAlreadyEnrolled ? ' [JÁ INSCRITO]' : ''}
                </option>
              );
            })}
          </select>
          {filteredAthletes.length === 0 && (
            <p className="text-[11px] text-amber-300 mt-1.5">
              Nenhum usuário encontrado na lista. Clique em <strong>+ Novo Usuário (E-mail)</strong> acima para cadastrar.
            </p>
          )}
        </div>
      </div>

      {/* Inline New Site User Registration Box */}
      {showNewUserForm && (
        <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
              Cadastrar Usuário no Site (E-mail Único)
            </span>
          </div>

          {inlineError && (
            <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] font-bold text-rose-300">
              {inlineError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                E-mail Único *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Ex: atleta@email.com"
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Nome (Exibido na Tabela) *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Lucas Oliveira"
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                WhatsApp (Notificações) *
              </label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(64) 99999-9999"
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                Categoria do Atleta *
              </label>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as AthleteLevel)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="iniciante">Iniciante</option>
                <option value="serie_c">Série C</option>
                <option value="serie_b">Série B</option>
                <option value="serie_a">Série A</option>
                <option value="profissional">Profissional / Open</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateUser}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer transition-colors"
            >
              Salvar Usuário e Selecionar
            </button>
          </div>
        </div>
      )}

      {/* Captured Athlete Data Preview (Locked Category + Contact Info for WhatsApp/Notifications) */}
      {selectedAthlete && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Na Tabela: {selectedAthlete.name}</span>
            </div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-400/40 text-[11px] font-black text-amber-300"
              title="Categoria capturada automaticamente do cadastro do atleta (bloqueada para alteração)"
            >
              <Lock className="w-3 h-3 text-amber-400" />
              Categoria: {ATHLETE_LEVEL_LABELS[selectedAthlete.level]} (Bloqueada)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1 border-t border-emerald-500/20">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate font-mono">{selectedAthlete.email}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{selectedAthlete.phone || 'Sem WhatsApp'}</span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {selectedAthlete.city || 'Brasil'} · {selectedAthlete.points} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
