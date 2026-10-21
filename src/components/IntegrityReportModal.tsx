import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ShieldAlert, CheckCircle, X, Send } from 'lucide-react';
import type { ReportReason, ReportTargetType, IntegrityReport } from '../types';
import { useSharkStore } from '../store/useSharkStore';
import { closeOnBackdrop } from '../utils/dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetName: string;
  onReportSubmitted?: (report: IntegrityReport) => void;
}

const REPORT_REASONS: { id: ReportReason; label: string; desc: string }[] = [
  {
    id: 'match_fixing',
    label: 'Entrega de Jogo Combinada (Conluio)',
    desc: 'Jogadores perdendo de propósito para que o amigo ganhe pontos e suba no ranking.',
  },
  {
    id: 'fake_score',
    label: 'Placar Simulado / Falso',
    desc: 'Resultado inventado ou não disputado na quadra.',
  },
  {
    id: 'collusion_farming',
    label: 'Farming Repetitivo de XP',
    desc: 'Vários jogos seguidos combinados contra a mesma pessoa apenas para inflar pontos.',
  },
  {
    id: 'sandbagging',
    label: 'Atleta Jogando Abaixo do Nível',
    desc: 'Jogador avançado se inscrevendo como iniciante para vencer fácil.',
  },
  {
    id: 'inappropriate_conduct',
    label: 'Conduta Antiesportiva',
    desc: 'Agressões, ofensas ou desrespeito às regras da arena.',
  },
  {
    id: 'other',
    label: 'Outra Irregularidade',
    desc: 'Qualquer outra atitude suspeita que comprometa a integridade do ranking.',
  },
];

export const IntegrityReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  onReportSubmitted,
}) => {
  const [reason, setReason] = useState<ReportReason>('match_fixing');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const newReport: IntegrityReport = {
      id: 'rep_' + Date.now(),
      targetType,
      targetId,
      targetName,
      reason,
      description: description.trim(),
      reporterName: reporterName.trim() || 'Atleta Anônimo',
      reporterPhone: reporterPhone.trim(),
      evidenceUrl: evidenceUrl.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Salvar localmente no storage de integridade
    const existing = JSON.parse(localStorage.getItem('sharkset_integrity_reports') || '[]');
    localStorage.setItem('sharkset_integrity_reports', JSON.stringify([newReport, ...existing]));

    // Disparar notificação interna para a administração do Sharkset
    useSharkStore.getState().pushSmartNotification({
      id: 'notif_rep_' + Date.now(),
      type: 'tuition_due_today',
      title: `🚨 Nova Denúncia de Integridade: ${targetName}`,
      body: `Motivo: ${REPORT_REASONS.find(r => r.id === reason)?.label}. Descrição: ${description.slice(0, 80)}...`,
      badgeLabel: 'DENÚNCIA',
      createdAt: new Date().toISOString(),
      read: false,
      pushDelivered: true,
    });

    onReportSubmitted?.(newReport);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2500);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={(event) => closeOnBackdrop(event, onClose)}
    >
      <div className="relative w-full max-w-lg bg-[#041529] border border-red-500/50 rounded-3xl p-5 sm:p-6 text-white shadow-2xl my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-black text-white">Denúncia Enviada com Sucesso</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Nossa equipe de auditoria e comitê técnico do SHARKSET irá analisar o histórico e as gravações da partida. Casos comprovados acarretam perda de pontos e banimento do ranking.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="sticky top-0 z-10 bg-[#041529]/95 backdrop-blur-md flex items-center gap-3 border-b border-red-500/20 pb-3 -mt-1 pt-1">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-600/60 flex items-center justify-center text-red-400 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  Denunciar {targetType === 'athlete' ? 'Atleta Suspeito' : 'Partida Irregular'}
                </h3>
                <p className="text-xs text-slate-400">
                  Alvo: <strong className="text-amber-300">{targetName}</strong>
                </p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                O Sharkset mantém tolerância zero com conluio de pontos, simulação de jogos ou farming de amigos. Toda denúncia é investigada.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Motivo da Denúncia *</label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-colors ${
                      reason === r.id
                        ? 'border-red-500 bg-red-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="report_reason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="text-red-500 focus:ring-red-400"
                      />
                      <span className="text-xs font-black text-white">{r.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 pl-5">{r.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Descreva o Ocorrido (Detalhes, Horário, Arenas ou Indícios) *
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: O atleta jogou com um amigo e no final entregou 5 saques seguidos de propósito para fazer o amigo subir de nível..."
                className="w-full text-xs p-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Seu Nome (Opcional/Anônimo)</label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Seu WhatsApp (Opcional)</label>
                <input
                  type="text"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="(64) 99999-0000"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase shadow-lg shadow-red-600/30 active:translate-y-0.5 transition-all"
              >
                <Send size={14} />
                <span>Enviar Denúncia</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
};
