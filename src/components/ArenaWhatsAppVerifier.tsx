import React, { useState } from 'react';
import { Phone, ShieldCheck, Check, Send, AlertTriangle, X, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from '../store/useToastStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  phoneToVerify: string;
  currentExistingPhone?: string; // If changing number, existing phone requires consent code first
  onVerified: (verifiedPhone: string) => void;
}

export const ArenaWhatsAppVerifier: React.FC<Props> = ({
  isOpen,
  onClose,
  phoneToVerify,
  currentExistingPhone,
  onVerified,
}) => {
  const isChangingNumber = Boolean(
    currentExistingPhone &&
    currentExistingPhone.replace(/\D/g, '') !== phoneToVerify.replace(/\D/g, '')
  );

  // Steps: 'consent_old' (if changing) -> 'verify_new'
  const [step, setStep] = useState<'consent_old' | 'verify_new'>(
    isChangingNumber ? 'consent_old' : 'verify_new'
  );

  // Codes
  const [oldPhoneCode, setOldPhoneCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [newPhoneCode, setNewPhoneCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  // User input
  const [inputCode, setInputCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const cleanOld = (currentExistingPhone || '').replace(/\D/g, '');
  const cleanNew = phoneToVerify.replace(/\D/g, '');

  const activeTargetPhone = step === 'consent_old' ? cleanOld : cleanNew;
  const activeExpectedCode = step === 'consent_old' ? oldPhoneCode : newPhoneCode;

  const handleSendWhatsAppLink = () => {
    const text = encodeURIComponent(
      `SHARKSET: Seu código de segurança para ${
        step === 'consent_old' ? 'autorizar a alteração' : 'verificação'
      } da sua Arena é: ${activeExpectedCode}. Validade de 10 minutos.`
    );
    const url = `https://wa.me/55${activeTargetPhone}?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('Link do WhatsApp aberto com a mensagem de segurança.');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeExpectedCode);
    toast.success(`Código ${activeExpectedCode} copiado!`);
  };

  const handleRegenerateCode = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    if (step === 'consent_old') {
      setOldPhoneCode(newCode);
    } else {
      setNewPhoneCode(newCode);
    }
    setInputCode('');
    setErrorMessage('');
    toast.success('Novo código de verificação gerado.');
  };

  const handleConfirmCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim() !== activeExpectedCode) {
      setErrorMessage('Código incorreto. Confira os 6 dígitos enviados.');
      return;
    }

    setErrorMessage('');

    if (step === 'consent_old') {
      toast.success('Consentimento do titular anterior aprovado com sucesso!');
      setStep('verify_new');
      setInputCode('');
    } else {
      toast.success('WhatsApp verificado e autenticado com sucesso!');
      onVerified(phoneToVerify);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="aquarium-glass bg-[#05182C] border border-cyan-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Phone size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Verificação de WhatsApp
              </h3>
              <p className="text-[11px] text-slate-300">
                {step === 'consent_old'
                  ? 'Passo 1/2: Consentimento do titular atual'
                  : isChangingNumber
                  ? 'Passo 2/2: Confirmação do novo número'
                  : 'Confirmação do WhatsApp oficial da Arena'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Banner */}
        {step === 'consent_old' ? (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
              <AlertTriangle size={16} />
              <span>Autorização de Troca de Titularidade</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              Para proteger a arena contra alterações indevidas, enviamos um código de consentimento
              para o WhatsApp cadastrado anteriormente:
              <strong className="text-amber-300 block mt-1 font-mono text-sm">
                ••• {cleanOld.slice(-4)}
              </strong>
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-black text-xs uppercase tracking-wider">
              <ShieldCheck size={16} />
              <span>Código de Validação</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              Confirme o código de 6 dígitos enviado para o WhatsApp da arena:
              <strong className="text-emerald-300 block mt-1 font-mono text-sm">
                +55 {cleanNew}
              </strong>
            </p>
          </div>
        )}

        {/* Action helper bar: Send / Copy / Quick Fill */}
        <div className="p-3.5 rounded-2xl bg-[#030D1A] border border-cyan-800/60 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Código de Segurança:</span>
            <span className="font-mono font-black text-base tracking-widest text-cyan-300 bg-cyan-950/60 px-3 py-0.5 rounded-lg border border-cyan-700/50">
              {activeExpectedCode}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-cyan-900/50">
            <button
              type="button"
              onClick={handleSendWhatsAppLink}
              className="flex-1 min-h-[38px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <Send size={13} />
              <span>Abrir WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copiar Código"
              className="min-h-[38px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Copy size={13} />
              <span>Copiar</span>
            </button>
            <button
              type="button"
              onClick={() => setInputCode(activeExpectedCode)}
              title="Preencher automaticamente para teste"
              className="min-h-[38px] px-3 rounded-xl bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1 border border-cyan-700/50"
            >
              <Check size={13} />
              <span>Autopreencher</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleConfirmCode} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              Digite o código de 6 dígitos:
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.replace(/\D/g, ''));
                setErrorMessage('');
              }}
              placeholder="000000"
              className="w-full text-center tracking-[0.4em] font-mono text-xl font-black py-3 rounded-2xl bg-[#030D1A] border-2 border-cyan-600 focus:border-cyan-400 focus:outline-none text-white placeholder-slate-600 shadow-inner"
            />
            {errorMessage && (
              <p className="text-xs text-rose-400 font-bold mt-1 text-center">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleRegenerateCode}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Reenviar novo código</span>
            </button>

            <button
              type="submit"
              disabled={inputCode.length !== 6}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Check size={15} />
              <span>{step === 'consent_old' ? 'Aprovar Consentimento' : 'Validar WhatsApp'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
