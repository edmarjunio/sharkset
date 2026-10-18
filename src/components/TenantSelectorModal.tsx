import React from 'react';
import { useApp } from '../context/AppContext';
import { Building2, Check, MapPin } from 'lucide-react';

export const TenantSelectorModal: React.FC = () => {
  const { tenantModalOpen, setTenantModalOpen, tenant, setTenantId, availableTenants } = useApp();

  if (!tenantModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-900" />
            <h2 className="text-base font-extrabold text-slate-900">
              Selecionar Unidade SHARK SET
            </h2>
          </div>
          <button
            onClick={() => setTenantModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-600">
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
                className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isCurrent
                    ? 'border-slate-950 bg-amber-50/60 shadow-xs ring-1 ring-slate-950'
                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{t.name}</span>
                    {t.id === 'conflora' && (
                      <span className="text-[10px] font-extrabold text-slate-950 bg-amber-400 px-2 py-0.5 rounded">
                        Matriz Oficial
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{t.city}, {t.state}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-bold text-slate-800">{t.courts.length} Quadras</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t.tagline}
                  </div>
                </div>

                {isCurrent && (
                  <div className="w-6 h-6 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setTenantModalOpen(false)}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
