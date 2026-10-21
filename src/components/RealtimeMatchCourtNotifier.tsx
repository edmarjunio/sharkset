import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  auth,
  listenToPlayerNotifications,
  signInWithGooglePopup,
} from '../lib/firebase';
import { AccessLockedAction } from './AccessLockedAction';
import {
  Bell,
  Radio,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  Play,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ActiveMatchAlert {
  id: string;
  type: string;
  title: string;
  body: string;
  recipientName?: string;
  receivedAt: Date;
}

export const RealtimeMatchCourtNotifier: React.FC = () => {
  const { tenant, activeTournamentId, tournaments, setActiveTab } = useApp();

  const [activeAlert, setActiveAlert] = useState<ActiveMatchAlert | null>(null);
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isListenerActive, setIsListenerActive] = useState<boolean>(false);

  const activeTourn = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];

  // Synthesize gentle pleasant referee court call chime using Web Audio API
  const playAlertChime = (isUrgent: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isUrgent ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(isUrgent ? 880 : 587.33, ctx.currentTime); // A5 or D5
      osc.frequency.exponentialRampToValueAtTime(isUrgent ? 1174.66 : 880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // Audio autoplay policy or silent mode fallback
    }
  };

  // Attach Real-Time Firestore onSnapshot Listener
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsListenerActive(false);
        return;
      }

      setIsListenerActive(true);
      unsubscribe = listenToPlayerNotifications((notifications) => {
        setHistoryCount(notifications.length);

        // Find the latest match-related notification (match_starting or match_modified)
        const matchNotifs = notifications.filter(
          (n) => n.type === 'match_starting' || n.type === 'match_modified'
        );

        if (matchNotifs.length > 0) {
          const newest = matchNotifs[matchNotifs.length - 1];
          setActiveAlert({
            id: newest.id,
            type: newest.type,
            title: newest.title,
            body: newest.body,
            recipientName: newest.recipientName,
            receivedAt: new Date(),
          });
          playAlertChime(newest.type === 'match_starting');
        }
      });
    };

    setupListener();

    // Listen to Firebase Auth state changes so listener activates immediately upon login
    const authUnsub = auth.onAuthStateChanged(() => {
      if (unsubscribe) unsubscribe();
      setupListener();
    });

    return () => {
      if (unsubscribe) unsubscribe();
      authUnsub();
    };
  }, [soundEnabled]);

  return (
    <>
      {/* Floating Real-Time Match Alert Modal / Banner */}
      {activeAlert && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom duration-300">
          <div
            className={`rounded-2xl p-5 shadow-2xl border-2 text-white ${
              activeAlert.type === 'match_starting'
                ? 'bg-slate-950 border-rose-500 shadow-rose-950/50'
                : 'bg-slate-950 border-amber-400 shadow-amber-950/50'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                    activeAlert.type === 'match_starting'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {activeAlert.type === 'match_starting' ? (
                    <Radio className="w-5 h-5 animate-ping" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider block ${
                      activeAlert.type === 'match_starting' ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {activeAlert.type === 'match_starting'
                      ? '🚨 PARTIDA CHAMADA PRA QUADRA'
                      : '⚠️ QUADRA / HORÁRIO ALTERADO'}
                  </span>
                  <h4 className="font-black text-white text-sm sm:text-base leading-tight">
                    {activeAlert.title}
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveAlert(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
                title="Fechar alerta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <p className="mt-3 text-xs text-slate-200 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-3">
              {activeAlert.body}
            </p>

            {/* Footer Actions */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoundEnabled((prev) => !prev)}
                  className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                  title={soundEnabled ? 'Silenciar som' : 'Ativar som de chamada'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeAlert.receivedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAlert(null);
                    setActiveTab('tournaments');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-sm ${
                    activeAlert.type === 'match_starting'
                      ? 'bg-rose-500 hover:bg-rose-400 text-white'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  Ir para a Quadra
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Status Strip for Organizers & Players */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isListenerActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-[11px] text-slate-200 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              {isListenerActive ? (
                <>
                  <strong className="text-emerald-400">Ouvinte Firestore em Tempo Real Ativo:</strong> Alertas imediatos de chamada e alteração de quadra
                </>
              ) : (
                <AccessLockedAction
                  message="Faça login para receber alertas"
                  onClick={() => void signInWithGooglePopup().catch(() => {})}
                  className="rounded-lg"
                  previewClassName="items-center rounded-lg border border-amber-500/50 bg-slate-950/80 px-3 py-1.5 text-amber-100 inline-flex"
                >
                  <strong>Ativar alertas de quadra</strong>
                </AccessLockedAction>
              )}
            </span>
          </div>

        </div>
      </div>
    </>
  );
};
