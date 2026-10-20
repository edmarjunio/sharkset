import React, { useState } from 'react';
import {
  X,
  LogOut,
  LogIn,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Trophy,
  CalendarCheck,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { auth, signInWithGooglePopup, signOutFirebase } from '../lib/firebase';
import { AthleteLevel } from '../types';
import { ATHLETE_LEVEL_LABELS } from '../services/rankingValidator';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, setUserProfile, setActiveTab, bookings } = useApp();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!isOpen) return null;

  const currentUser = auth.currentUser;
  const isLoggedIn = Boolean(currentUser);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await signInWithGooglePopup();
      onClose();
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOutFirebase();
      onClose();
    } catch (error) {
      console.error('Erro ao sair da conta:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLevelChange = (level: AthleteLevel) => {
    setUserProfile({ ...userProfile, level });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const activeBookingsCount = bookings.filter((b) => b.status === 'confirmed').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#071526] border border-cyan-500/30 shadow-2xl p-6 sm:p-7 text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-amber-400" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isLoggedIn ? (
          /* NOT LOGGED IN STATE */
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg">
              <User className="w-8 h-8" />
            </div>

            <div>
              <h2 id="user-profile-title" className="text-xl font-black text-white">
                Entrar no SHARK SET
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Faça login seguro com sua conta Google para gerenciar suas reservas, salvar seu ranking e participar de torneios.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-sm shadow-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingIn ? 'Autenticando...' : 'Entrar com Google'}</span>
            </button>
          </div>
        ) : (
          /* LOGGED IN USER PROFILE STATE */
          <div className="space-y-5">
            {/* User Header */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative shrink-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Usuário'}
                    className="w-16 h-16 rounded-full object-cover border-2 border-cyan-400 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 font-black text-xl">
                    {(currentUser.displayName || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[#071526] shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="user-profile-title" className="text-base sm:text-lg font-black text-white truncate">
                    {currentUser.displayName || userProfile.name || 'Atleta SHARK SET'}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
                <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Google Autenticado</span>
                </div>
              </div>
            </div>

            {/* Level / Category Selector */}
            <div className="bg-slate-900/60 rounded-2xl p-3.5 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Categoria de Jogo
                </span>
                {savedFeedback && (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Salvo!
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(['iniciante', 'serie_c', 'serie_b', 'serie_a', 'profissional'] as AthleteLevel[]).map(
                  (lvl) => {
                    const isSelected = userProfile.level === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => handleLevelChange(lvl)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-extrabold uppercase transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md font-black'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-white/5'
                        }`}
                      >
                        {ATHLETE_LEVEL_LABELS[lvl] || lvl}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('my_bookings');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-white border border-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold">Minhas Reservas & Estatísticas</div>
                    <div className="text-[10px] text-slate-400">
                      {activeBookingsCount} reserva(s) ativa(s)
                    </div>
                  </div>
                </div>
                <span className="text-xs text-cyan-400 font-bold">Abrir &rarr;</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-extrabold transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoggingOut ? 'Saindo...' : 'Sair da conta'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
