import React, { useMemo, useState } from 'react';
import { AthleteProfile } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';
import { Lock, Mail, MessageCircle, Search, UserCheck } from 'lucide-react';

interface AthleteEmailSelectorProps {
  label: string;
  athletes: AthleteProfile[];
  selectedEmail: string;
  excludeEmail?: string;
  enrolledEmails?: Set<string>;
  onSelectAthlete: (athlete: AthleteProfile | null) => void;
}

const normalizeEmail = (email?: string) => (email || '').trim().toLowerCase();

export const AthleteEmailSelector: React.FC<AthleteEmailSelectorProps> = ({
  label,
  athletes,
  selectedEmail,
  excludeEmail,
  enrolledEmails,
  onSelectAthlete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSelectedEmail = normalizeEmail(selectedEmail);
  const normalizedExcludeEmail = normalizeEmail(excludeEmail);

  const eligibleAthletes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return athletes.filter((athlete) => {
      const email = normalizeEmail(athlete.email);
      if (!email || email === normalizedExcludeEmail) return false;
      return !query || email.includes(query) || athlete.name.toLowerCase().includes(query);
    });
  }, [athletes, normalizedExcludeEmail, searchTerm]);

  const selectedAthlete = eligibleAthletes.find(
    (athlete) => normalizeEmail(athlete.email) === normalizedSelectedEmail
  ) || athletes.find((athlete) => normalizeEmail(athlete.email) === normalizedSelectedEmail);

  return (
    <div className="space-y-2 rounded-xl border border-slate-700/80 bg-slate-900/90 p-3">
      <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-cyan-200">
        <UserCheck className="h-3.5 w-3.5" />
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar por e-mail ou nome"
          aria-label={`Buscar ${label} por e-mail ou nome`}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
        />
      </div>
      <select
        required
        value={normalizedSelectedEmail}
        onChange={(event) => {
          const email = normalizeEmail(event.target.value);
          onSelectAthlete(athletes.find((athlete) => normalizeEmail(athlete.email) === email) || null);
        }}
        aria-label={label}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
      >
        <option value="">Selecione: E-MAIL - NOME</option>
        {eligibleAthletes.map((athlete) => {
          const email = normalizeEmail(athlete.email);
          const alreadyEnrolled = enrolledEmails?.has(email);
          return (
            <option key={email} value={email} disabled={alreadyEnrolled}>
              {email} - {athlete.name} ({ATHLETE_LEVEL_LABELS[athlete.level]})
              {alreadyEnrolled ? ' · JÁ INSCRITO' : ''}
            </option>
          );
        })}
      </select>
      {selectedAthlete ? (
        <div className="grid grid-cols-1 gap-1 border-t border-slate-700 pt-2 text-[11px] text-slate-300 sm:grid-cols-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate" title={selectedAthlete.email}>
            <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            {selectedAthlete.email}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 truncate" title={selectedAthlete.phone || 'Sem WhatsApp'}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            {selectedAthlete.phone || 'Sem WhatsApp cadastrado'}
          </span>
          <span className="flex items-center gap-1.5 text-amber-200">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            {ATHLETE_LEVEL_LABELS[selectedAthlete.level]} · Categoria do perfil
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          Selecione um perfil do site com e-mail cadastrado. A categoria vem do perfil do atleta.
        </p>
      )}
    </div>
  );
};
