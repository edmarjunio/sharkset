import React, { useState } from 'react';
import { LogIn, LogOut, Mail, ShieldCheck, X, CalendarCheck, Trophy, Shield, LockKeyhole, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { auth, getGoogleRedirectResult, signInWithGooglePopup, signInWithGoogleRedirect, signOutFirebase } from '../lib/firebase';
import { useModalFocus } from '../hooks/useModalFocus';
import { AthleteAvatar, AthleteProfileContent } from './AthleteProfileContent';
import { NotificationSettings } from './NotificationSettings';
import type { AthleteProfile } from '../types';

interface Props { isOpen: boolean; onClose: () => void }
export function UserProfileModal({ isOpen, onClose }: Props) {
  return isOpen ? <UserDialog onClose={onClose} /> : null;
}
function UserDialog({ onClose }: { onClose: () => void }) {
  const ref = useModalFocus(onClose);
  const { userProfile, profileStatus, profileError, accountAthlete, athletes, setActiveTab } = useApp();
  const user = auth.currentUser;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      setError(code === 'auth/popup-blocked' ? 'A janela foi bloqueada. Tente entrar por redirecionamento.' :
        code === 'auth/unauthorized-domain' ? 'Este domínio precisa estar autorizado no Firebase Authentication.' :
        error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.');
    } finally { setBusy(false); }
  };
  React.useEffect(() => { void getGoogleRedirectResult().catch(() => setError('Não foi possível concluir a entrada com Google.')); }, []);
  const navigate = (tab: 'my_bookings' | 'tournaments' | 'arena_admin' | 'home') => { setActiveTab(tab); onClose(); };
  const athlete: AthleteProfile | null = accountAthlete ? { ...accountAthlete, initialLevel: userProfile.initialLevel } : null;
  return <dialog ref={ref} aria-labelledby="user-profile-title" className="athlete-dialog" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="athlete-sheet">
      <header className="athlete-sheet-header">
        <div className="flex items-center gap-3 min-w-0"><div className="relative shrink-0"><AthleteAvatar athlete={athlete} photoUrl={user?.photoURL} />{user && <span className="athlete-online" aria-label="Conta conectada" />}</div>
          <div className="min-w-0"><p className="athlete-eyebrow">SHARKSET · Ficha do atleta</p><h2 id="user-profile-title" className="athlete-name">{user?.displayName || userProfile.name || 'Sua jornada começa aqui'}</h2>
            {user && <><p className="flex items-center gap-1.5 text-xs text-slate-300 break-all mt-1"><Mail size={12} className="shrink-0" />{user.email}</p><p className="athlete-account-badge"><ShieldCheck size={12} />Google autenticado</p></>}
          </div>
        </div><button className="athlete-icon-button" onClick={onClose} aria-label="Fechar ficha do usuário"><X size={20} /></button>
      </header>
      <div className="athlete-sheet-scroll">
        {!user ? <section className="athlete-login-panel"><ShieldCheck size={38} className="text-cyan-300" /><h3>Seu perfil, suas conquistas.</h3><p>Entre para acompanhar sua categoria, seu MMR e a trajetória nos campeonatos.</p><p className="athlete-lock-note"><LockKeyhole size={15} />A categoria inicial é escolhida uma vez. Depois, evolui pelos resultados.</p><button disabled={busy} className="athlete-primary-button" onClick={() => void run(signInWithGooglePopup)}><LogIn size={18} />Entrar com Google</button><button disabled={busy} className="athlete-text-button" onClick={() => void run(signInWithGoogleRedirect)}>Entrar por redirecionamento</button></section> : <>
          {profileStatus === 'loading' && <p className="athlete-empty" role="status">Verificando sua categoria e carregando a ficha…</p>}
          {profileError && <p className="athlete-error" role="alert">{profileError}</p>}
          {athlete ? <AthleteProfileContent athlete={athlete} ranking={athletes.some(item => item.id === athlete.id) ? athletes : [...athletes, athlete]} /> : profileStatus === 'ready' && <p className="athlete-empty">{userProfile.level ? 'Categoria preservada. A ficha detalhada ainda não foi sincronizada.' : 'Escolha sua categoria no cadastro para iniciar sua ficha oficial.'}</p>}
          <div className="athlete-shortcuts"><button onClick={() => navigate('my_bookings')}><CalendarCheck size={18} /><span>Minhas Reservas & Estatísticas</span></button><button onClick={() => navigate('tournaments')}><Trophy size={18} /><span>Tabela de Campeonatos</span></button></div>
          <details className="athlete-panel"><summary className="cursor-pointer font-bold text-sm">Avisos e arenas favoritas</summary><div className="mt-4"><NotificationSettings /></div></details>
        </>}
        {error && <p className="athlete-error" role="alert"><AlertCircle size={16} />{error}</p>}
      </div>
      <footer className="athlete-sheet-footer"><div className="athlete-mode-actions"><button onClick={() => navigate('home')}><Trophy size={16} />Modo Atleta</button><button onClick={() => navigate('arena_admin')}><Shield size={16} />Admin Arena</button></div>
        {user ? <button className="athlete-logout" disabled={busy} onClick={() => void run(async () => { await signOutFirebase(); onClose(); })}><LogOut size={16} />{busy ? 'Aguarde…' : 'Sair da conta'}</button> : <button className="athlete-primary-button" disabled={busy} onClick={() => void run(signInWithGooglePopup)}><LogIn size={16} />{busy ? 'Entrando…' : 'Entrar com Google'}</button>}
      </footer>
    </div>
  </dialog>;
}
