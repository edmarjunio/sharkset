import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useModalFocus } from '../hooks/useModalFocus';
import { AthleteAvatar, AthleteProfileContent } from './AthleteProfileContent';
import type { AthleteProfile } from '../types';
export function AthleteProfileDialog() {
  const { selectedAthlete } = useApp();
  return selectedAthlete ? <PublicAthleteDialog athlete={selectedAthlete} /> : null;
}
function PublicAthleteDialog({ athlete }: { athlete: AthleteProfile }) {
  const { closeAthleteDialog, athletes } = useApp();
  const ref = useModalFocus(closeAthleteDialog);
  return <dialog ref={ref} aria-labelledby="public-athlete-title" className="athlete-dialog" onClick={event => { if (event.target === event.currentTarget) closeAthleteDialog(); }}><div className="athlete-sheet">
    <header className="athlete-sheet-header"><div className="flex items-center gap-3 min-w-0"><AthleteAvatar athlete={athlete} /><div className="min-w-0"><p className="athlete-eyebrow">Ficha esportiva · SHARKSET</p><h2 id="public-athlete-title" className="athlete-name">{athlete.name}</h2><p className="text-xs text-slate-300 mt-1">{athlete.arenaName || 'Atleta de areia'}</p></div></div><button className="athlete-icon-button" aria-label="Fechar ficha do atleta" onClick={closeAthleteDialog}><X size={20} /></button></header>
    <div className="athlete-sheet-scroll"><AthleteProfileContent athlete={athlete} ranking={athletes} /></div><footer className="athlete-sheet-footer"><span className="text-xs text-slate-400">Evolução por MMR · Categoria sem edição manual</span><button className="athlete-primary-button" onClick={closeAthleteDialog}>Fechar ficha</button></footer>
  </div></dialog>;
}
