import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ArenaBrandPalette } from '../types';
import {
  ARENA_BRAND_PRESETS,
  extractPaletteFromLogoImage,
} from '../services/logoPaletteExtractor';
import {
  X,
  Upload,
  Palette,
  Sparkles,
  Check,
  Building2,
  Eye,
  RotateCcw,
} from 'lucide-react';

interface ArenaWhiteLabelCustomizerModalProps {
  onClose: () => void;
}

export const ArenaWhiteLabelCustomizerModal: React.FC<ArenaWhiteLabelCustomizerModalProps> = ({
  onClose,
}) => {
  const { tenant, updateArenaBranding } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [arenaName, setArenaName] = useState(tenant.name);
  const [arenaTagline, setArenaTagline] = useState(
    tenant.tagline || 'Site Oficial de Agendamentos, Aulas e Torneios'
  );
  const [logoUrl, setLogoUrl] = useState(
    tenant.logoUrl || ARENA_BRAND_PRESETS[0].logoUrl
  );
  const [palette, setPalette] = useState<ArenaBrandPalette>(
    tenant.brandPalette || ARENA_BRAND_PRESETS[0].palette
  );
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState<boolean>(
    tenant.whiteLabelEnabled ?? true
  );
  const [extracting, setExtracting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setLogoUrl(dataUrl);
        const extracted = await extractPaletteFromLogoImage(dataUrl);
        setPalette(extracted);
        setWhiteLabelEnabled(true);
      }
      setExtracting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrlLogo = async (url: string) => {
    setLogoUrl(url);
    if (!url.trim()) return;
    setExtracting(true);
    const extracted = await extractPaletteFromLogoImage(url);
    setPalette(extracted);
    setWhiteLabelEnabled(true);
    setExtracting(false);
  };

  const handleSelectPreset = (preset: (typeof ARENA_BRAND_PRESETS)[0]) => {
    setLogoUrl(preset.logoUrl);
    setPalette(preset.palette);
    setWhiteLabelEnabled(true);
  };

  const handleSaveWhiteLabel = (e: React.FormEvent) => {
    e.preventDefault();
    updateArenaBranding(tenant.id, {
      name: arenaName.trim() || tenant.name,
      tagline: arenaTagline.trim(),
      logoUrl,
      brandPalette: palette,
      whiteLabelEnabled,
    });
    onClose();
  };

  const handleResetToSharksetDefault = () => {
    updateArenaBranding(tenant.id, {
      whiteLabelEnabled: false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="aquarium-glass bg-white border border-slate-200 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto">
        {/* Header */}
        <div
          className="px-6 py-5 text-white flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${palette.headerBg}, ${palette.primary})`,
          }}
        >
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Logo da Arena"
              className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-1 border border-white/25 shadow-md"
            />
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Site Próprio da Arena · White-Label
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                Personalizar Logo & Paleta Automática da Arena
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveWhiteLabel} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Explanation Box */}
          <div className="aquarium-glass p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-black text-slate-900 uppercase">
                Como funciona o Modo Site da Arena (White-Label)
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ao enviar a logo da sua arena, o sistema extrai automaticamente a paleta de cores da imagem, destaca a <strong>Logo da Arena</strong> no topo e transforma a página como um site oficial da arena com o selo discreto <strong>"DESENVOLVIDO POR SHARKSET"</strong>.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={whiteLabelEnabled}
                onChange={(e) => setWhiteLabelEnabled(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
              <span className="text-xs font-black text-slate-900">Ativar Site da Arena</span>
            </label>
          </div>

          {/* Upload Arena Logo or Pick Instant Preset */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase text-slate-700">
                1. Enviar Logo da Arena (Extração Automática de Cores)
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aquarium-glass w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-orange-500 bg-slate-50 hover:bg-orange-50/40 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
              >
                <Upload className="w-6 h-6 text-orange-500" />
                <span className="text-xs font-black text-slate-900">
                  {extracting
                    ? 'Extraindo paleta de cores da logo...'
                    : 'Clique para enviar a Logo da Arena (PNG, JPG, SVG)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  As cores da página se ajustam automaticamente à logo enviada
                </span>
              </button>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">Ou cole a URL da logo:</span>
                <input
                  type="text"
                  value={logoUrl.startsWith('data:') ? '' : logoUrl}
                  onChange={(e) => handleApplyUrlLogo(e.target.value)}
                  placeholder="https://exemplo.com/logo-arena.png"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Instant Presets to Test */}
            <div className="space-y-2.5">
              <label className="block text-xs font-black uppercase text-slate-700">
                Ou teste com um modelo de Logo + Paleta de Arena:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {ARENA_BRAND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="aquarium-glass p-2.5 rounded-2xl border border-slate-200 hover:border-slate-900 bg-white text-left flex items-center gap-2.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <img
                      src={preset.logoUrl}
                      alt={preset.arenaSampleName}
                      className="w-10 h-10 rounded-xl shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {preset.palette.paletteName}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.palette.primary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.palette.secondary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10"
                          style={{ backgroundColor: preset.palette.headerBg }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Arena Name, Tagline & Fine-tune Extracted Colors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                Nome em Destaque no Site da Arena
              </label>
              <input
                type="text"
                value={arenaName}
                onChange={(e) => setArenaName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                Slogan / Subtítulo da Arena
              </label>
              <input
                type="text"
                value={arenaTagline}
                onChange={(e) => setArenaTagline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Live Preview of the Extracted Arena Palette */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-orange-500" />
                2. Paleta Extraída da Logo (Ajuste Fino Opcional)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <input
                  type="color"
                  value={palette.primary}
                  onChange={(e) => setPalette({ ...palette, primary: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <div>
                  <div className="text-[11px] font-black text-slate-800">Cor Principal</div>
                  <div className="text-[10px] font-mono text-slate-500">{palette.primary}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <input
                  type="color"
                  value={palette.secondary}
                  onChange={(e) => setPalette({ ...palette, secondary: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <div>
                  <div className="text-[11px] font-black text-slate-800">Cor Secundária</div>
                  <div className="text-[10px] font-mono text-slate-500">{palette.secondary}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <input
                  type="color"
                  value={palette.headerBg}
                  onChange={(e) => setPalette({ ...palette, headerBg: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <div>
                  <div className="text-[11px] font-black text-slate-800">Topo / Banner</div>
                  <div className="text-[10px] font-mono text-slate-500">{palette.headerBg}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <input
                  type="color"
                  value={palette.surfaceBg}
                  onChange={(e) => setPalette({ ...palette, surfaceBg: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <div>
                  <div className="text-[11px] font-black text-slate-800">Fundo da Página</div>
                  <div className="text-[10px] font-mono text-slate-500">{palette.surfaceBg}</div>
                </div>
              </div>
            </div>

            {/* Live Header Preview Bar */}
            <div
              className="rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 shadow-sm"
              style={{
                backgroundColor: palette.headerBg,
                borderColor: palette.primary,
                color: '#FFFFFF',
              }}
            >
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt={arenaName}
                  className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-1 border border-white/20"
                />
                <div>
                  <div className="text-base font-black tracking-tight">{arenaName}</div>
                  <div className="text-xs opacity-85">{arenaTagline}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-3.5 py-2 rounded-full text-xs font-black shadow-xs"
                  style={{ backgroundColor: palette.primary, color: '#FFFFFF' }}
                >
                  Agendar Horário
                </span>
                <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-black tracking-wider uppercase text-white/90 border border-white/15">
                  DESENVOLVIDO POR SHARKSET
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleResetToSharksetDefault}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Voltar ao Padrão SHARKSET
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                style={{ backgroundColor: palette.primary }}
              >
                <Check className="w-4 h-4" />
                Aplicar Logo e Paleta na Arena
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
