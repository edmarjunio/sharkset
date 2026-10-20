import React, { useState } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { AthleteLevel } from '../types';
import { ATHLETE_TIERS } from '../services/rankingValidator';
import { useModalFocus } from '../hooks/useModalFocus';
interface Props { isOpen: boolean; playerName: string; onComplete: (level: AthleteLevel) => Promise<void> }
export function AthleteOnboardingModal(props: Props) { return props.isOpen ? <CategoryDialog {...props} /> : null; }
function CategoryDialog({ playerName, onComplete }: Props) {
  const ref = useModalFocus(() => {});
  const [selected, setSelected] = useState<AthleteLevel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setError('');
    try { await onComplete(selected); }
    catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível confirmar. Reconecte e tente novamente.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={ref} aria-labelledby="onboarding-title" className="athlete-dialog"><form className="athlete-sheet" onSubmit={submit}>
    <header className="athlete-sheet-header"><div><p className="athlete-eyebrow">Bem-vindo ao SHARKSET, {playerName || 'atleta'}</p><h2 className="athlete-name" id="onboarding-title">Escolha sua categoria inicial</h2><p className="text-sm text-slate-300 mt-2">Esta escolha é permanente. Depois, sua categoria evolui exclusivamente por MMR e consistência dos resultados.</p></div><ShieldCheck size={30} className="shrink-0 text-cyan-300" /></header>
    <div className="athlete-sheet-scroll"><fieldset disabled={busy} className="space-y-3"><legend className="sr-only">Categorias de jogo</legend>{ATHLETE_TIERS.map(tier => <label key={tier.level} className={`athlete-category-option ${selected === tier.level ? 'is-selected' : ''}`}><input type="radio" name="initial-category" value={tier.level} checked={selected === tier.level} onChange={() => setSelected(tier.level)} /><div><strong>{tier.label}</strong><p>{tier.description}</p></div><span className="shrink-0 tabular-nums font-black text-cyan-200">{tier.minPoints}+ MMR</span></label>)}</fieldset><p className="athlete-lock-note"><LockKeyhole size={15} />Fixada no cadastro · Não será possível trocar manualmente</p>{error && <p className="athlete-error" role="alert">{error}</p>}</div>
    <footer className="athlete-sheet-footer"><span className="text-xs text-slate-300">Confirmação vinculada à sua conta</span><button type="submit" className="athlete-primary-button" disabled={!selected || busy}>{busy ? 'Confirmando…' : 'Confirmar categoria'}</button></footer>
  </form></dialog>;
}
