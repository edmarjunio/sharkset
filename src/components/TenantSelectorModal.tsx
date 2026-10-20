import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Check, MapPin } from 'lucide-react';

export const TenantSelectorModal: React.FC = () => {
  const { tenantModalOpen, setTenantModalOpen, tenant, setTenantId, availableTenants } = useApp();

  if (!tenantModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="aquarium-glass bg-[#071D3D] text-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-2 border-[#145A9B] animate-in fade-in zoom-in-95 duration-150 space-y-4 my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#071D3D]/95 backdrop-blur-md flex items-center justify-between pb-3 border-b border-[#145A9B]/60 -mt-1 pt-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0987CE]" />
            <h2 className="text-base font-extrabold text-white">
              Selecionar Unidade SHARK SET
            </h2>
          </div>
          <button
            onClick={() => setTenantModalOpen(false)}
            className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Escolha a arena na rede <strong>SHARK SET</strong> para visualizar quadras, aulas e campeonatos:
        </p>

        <div className="space-y-2.5">
          {availableTenants.map((t) => {
            const isCurrent = t.id === tenant.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTenantId(t.id);
                  setTenantModalOpen(false);
                }}
                className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isCurrent
                    ? 'border-[#12C7BB] bg-[#030B17] shadow-md ring-1 ring-[#12C7BB]/40'
                    : 'border-[#145A9B] bg-[#030B17]/60 hover:border-[#0987CE] hover:bg-[#030B17]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">{t.name}</span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-[#0987CE]" />
                    <span>{t.city}, {t.state}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-[#12C7BB]">{t.courts.length} Quadras</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t.tagline}
                  </div>
                </div>

                {isCurrent && (
                  <div className="w-6 h-6 rounded-full bg-[#12C7BB] text-slate-950 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setTenantModalOpen(false)}
            className="px-4 py-2 text-xs font-bold text-slate-200 bg-[#030B17] hover:bg-[#0B254E] border border-[#145A9B] rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
