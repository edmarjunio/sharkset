import { DropdownUI } from './DropdownUI';
import React, { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { CourtScheduler } from './CourtScheduler';
import { CreateArenaModal } from './CreateArenaModal';
import { toast } from '../store/useToastStore';
import type { CouponDiscountType, CouponScope, Court, SportType, TenantConfig } from '../types';
import { ArenaLocationPicker, ArenaLocationValue } from './ArenaLocationPicker';
import { ArenaWhatsAppVerifier } from './ArenaWhatsAppVerifier';
import { ArenaWhiteLabelCustomizerModal } from './ArenaWhiteLabelCustomizerModal';
import {
  PlusCircle,
  Building2,
  Calendar,
  Users,
  Tag,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Percent,
  DollarSign,
  Plus,
  Flame,
  Clock,
  MapPin,
  Palette,
  LayoutDashboard,
  Check,
  Save,
  Layers,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Phone,
} from 'lucide-react';

type AdminTab =
  | 'visao_geral'
  | 'agenda'
  | 'dados_arena'
  | 'precos_pico'
  | 'quadras_estrutura'
  | 'gestores'
  | 'cupons'
  | 'visual_logo';

interface PeakIntervalItem {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  label?: string;
}

export const ArenaAdmin: React.FC = () => {
  const {
    tenant,
    availableTenants,
    setTenantId,
    setArenaSubTab,
    setActiveTab,
    addArenaManager,
    removeArenaManager,
    coupons,
    createCoupon,
    updateArena,
  } = useApp();

  const [access, setAccess] = useState<{ uid: string; ids: string[] } | null>(null);
  const [message, setMessage] = useState('Verificando acesso…');
  const [createArenaOpen, setCreateArenaOpen] = useState(false);
  const [whiteLabelModalOpen, setWhiteLabelModalOpen] = useState(false);

  // Active Topic
  const [activeTopic, setActiveTopic] = useState<AdminTab>('visao_geral');

  // Form State for "Dados & Localização"
  const [arenaName, setArenaName] = useState(tenant.name || '');
  const [locationValue, setLocationValue] = useState<ArenaLocationValue>({
    cep: tenant.cep || '',
    address: tenant.address || '',
    city: tenant.city || '',
    state: tenant.state || '',
    lat: tenant.lat,
    lng: tenant.lng,
  });

  const [whatsappValue, setWhatsappValue] = useState(tenant.whatsapp || '');
  const [showWhatsappVerifier, setShowWhatsappVerifier] = useState(false);
  const [isWhatsappVerified, setIsWhatsappVerified] = useState(true);

  const [openTime, setOpenTime] = useState(tenant.operatingHours?.open || '06:00');
  const [closeTime, setCloseTime] = useState(tenant.operatingHours?.close || '00:00');

  // Form State for "Preços & Pico"
  const [hourlyRate, setHourlyRate] = useState<number>(tenant.defaultHourlyRate || tenant.courts[0]?.hourlyRate || 80);
  const [hasPeakPricing, setHasPeakPricing] = useState<boolean>(tenant.hasPeakPricing ?? Boolean(tenant.courts[0]?.peakHourlyRate));
  const [peakIntervals, setPeakIntervals] = useState<PeakIntervalItem[]>(() => {
    if (tenant.peakIntervals && tenant.peakIntervals.length > 0) return tenant.peakIntervals;
    const firstCourt = tenant.courts[0];
    return [
      {
        id: 'peak-1',
        startTime: firstCourt?.peakStartTime || '18:00',
        endTime: firstCourt?.peakEndTime || '22:00',
        price: firstCourt?.peakHourlyRate || 110,
        label: 'Horário de Pico Noturno',
      },
    ];
  });

  // Sync state whenever tenant switches
  useEffect(() => {
    setArenaName(tenant.name || '');
    setLocationValue({
      cep: tenant.cep || '',
      address: tenant.address || '',
      city: tenant.city || '',
      state: tenant.state || '',
      lat: tenant.lat,
      lng: tenant.lng,
    });
    setWhatsappValue(tenant.whatsapp || '');
    setIsWhatsappVerified(true);
    setOpenTime(tenant.operatingHours?.open || '06:00');
    setCloseTime(tenant.operatingHours?.close || '00:00');
    setHourlyRate(tenant.defaultHourlyRate || tenant.courts[0]?.hourlyRate || 80);
    setHasPeakPricing(tenant.hasPeakPricing ?? Boolean(tenant.courts[0]?.peakHourlyRate));
    if (tenant.peakIntervals && tenant.peakIntervals.length > 0) {
      setPeakIntervals(tenant.peakIntervals);
    } else {
      const firstCourt = tenant.courts[0];
      setPeakIntervals([
        {
          id: 'peak-1',
          startTime: firstCourt?.peakStartTime || '18:00',
          endTime: firstCourt?.peakEndTime || '22:00',
          price: firstCourt?.peakHourlyRate || 110,
          label: 'Horário de Pico Noturno',
        },
      ]);
    }
  }, [tenant]);

  // Gestores tab state
  const [managerInput, setManagerInput] = useState('');
  const [managerLoading, setManagerLoading] = useState(false);

  // Cupons tab state
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<CouponDiscountType>('fixed');
  const [couponValue, setCouponValue] = useState<number>(10);
  const [couponScope, setCouponScope] = useState<CouponScope>('arena');
  const [couponMinBooking, setCouponMinBooking] = useState<number>(0);
  const [couponMaxUses, setCouponMaxUses] = useState<number>(100);
  const [couponLoading, setCouponLoading] = useState(false);

  // Save changes state
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  // Auth access check
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      setAccess(null);
      if (!user) {
        setMessage('Entre com a conta responsável pela arena.');
        return;
      }
      setMessage('Verificando suas arenas…');
      try {
        const userUid = user.uid;
        const userEmail = user.email?.toLowerCase();
        const idsSet = new Set<string>();

        const qOwner = query(collection(db, 'arenas'), where('ownerId', '==', userUid));
        const ownerDocs = await getDocsFromServer(qOwner);
        ownerDocs.docs.forEach((doc) => idsSet.add(doc.id));

        if (userEmail) {
          try {
            const qManagerEmail = query(
              collection(db, 'arenas'),
              where('managers', 'array-contains', userEmail)
            );
            const managerDocs = await getDocsFromServer(qManagerEmail);
            managerDocs.docs.forEach((doc) => idsSet.add(doc.id));
          } catch {
            // ignore
          }
        }

        try {
          const qManagerUid = query(
            collection(db, 'arenas'),
            where('managers', 'array-contains', userUid)
          );
          const uidDocs = await getDocsFromServer(qManagerUid);
          uidDocs.docs.forEach((doc) => idsSet.add(doc.id));
        } catch {
          // ignore
        }

        if (current !== generation) return;
        const finalIds = Array.from(idsSet);
        setAccess({ uid: user.uid, ids: finalIds });
        setMessage(
          finalIds.length === 0
            ? 'Nenhuma arena cadastrada para esta conta.'
            : 'Selecione uma arena para administrar.'
        );
      } catch {
        if (current === generation)
          setMessage('Não foi possível verificar seu acesso. Tente novamente mais tarde.');
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);

  const owned = availableTenants.filter((arena) => access?.ids.includes(arena.id));
  const authorized = Boolean(
    auth.currentUser &&
      access?.uid === auth.currentUser.uid &&
      tenant.id &&
      access.ids.includes(tenant.id)
  );

  const isArenaOwner = Boolean(
    auth.currentUser && (tenant.ownerId === auth.currentUser.uid || !tenant.ownerId)
  );

  // 1. Save Dados & Localização
  const handleSaveGeneralData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arenaName.trim() || !locationValue.address.trim()) {
      toast.error('Preencha o nome e o endereço da arena.');
      return;
    }

    if (!isWhatsappVerified && whatsappValue.replace(/\D/g, '') !== (tenant.whatsapp || '').replace(/\D/g, '')) {
      setShowWhatsappVerifier(true);
      toast.info('Valide o novo WhatsApp antes de salvar as alterações.');
      return;
    }

    setSavingGeneral(true);
    try {
      const updatedTenant: TenantConfig = {
        ...tenant,
        name: arenaName.trim(),
        city: locationValue.city.trim(),
        state: locationValue.state.trim().toUpperCase(),
        address: locationValue.address.trim(),
        cep: locationValue.cep,
        lat: locationValue.lat,
        lng: locationValue.lng,
        whatsapp: whatsappValue.replace(/\D/g, ''),
        whatsappVerified: true,
        operatingHours: {
          open: openTime,
          close: closeTime,
        },
        courts: tenant.courts.map((court) => ({
          ...court,
          openTime,
          closeTime,
        })),
      };

      await updateArena(updatedTenant);
      toast.success('Dados e horários da arena atualizados com sucesso!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar dados da arena.');
    } finally {
      setSavingGeneral(false);
    }
  };

  // 2. Save Preços & Pico
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPricing(true);
    try {
      const primaryPeak = peakIntervals[0];
      const updatedCourts: Court[] = tenant.courts.map((court) => ({
        ...court,
        hourlyRate,
        peakHourlyRate: hasPeakPricing && primaryPeak ? primaryPeak.price : hourlyRate,
        peakStartTime: hasPeakPricing && primaryPeak ? primaryPeak.startTime : '18:00',
        peakEndTime: hasPeakPricing && primaryPeak ? primaryPeak.endTime : '22:00',
      }));

      const updatedTenant: TenantConfig = {
        ...tenant,
        defaultHourlyRate: hourlyRate,
        hasPeakPricing,
        peakIntervals: hasPeakPricing ? peakIntervals : [],
        courts: updatedCourts,
      };

      await updateArena(updatedTenant);
      toast.success('Valores de hora e horários de pico salvos!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar valores.');
    } finally {
      setSavingPricing(false);
    }
  };

  // Peak intervals manipulation
  const handleAddPeakInterval = () => {
    const nextIdx = peakIntervals.length + 1;
    setPeakIntervals([
      ...peakIntervals,
      {
        id: `peak-${Date.now()}-${nextIdx}`,
        startTime: '18:00',
        endTime: '22:00',
        price: hourlyRate + 25,
        label: `Intervalo ${nextIdx}`,
      },
    ]);
  };

  const handleRemovePeakInterval = (id: string) => {
    setPeakIntervals(peakIntervals.filter((p) => p.id !== id));
  };

  const handleUpdatePeakInterval = (id: string, updates: Partial<PeakIntervalItem>) => {
    setPeakIntervals(
      peakIntervals.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  // Handle adding manager
  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerInput.trim() || !tenant.id) return;
    setManagerLoading(true);
    try {
      await addArenaManager(tenant.id, managerInput.trim());
      toast.success(`Gestor "${managerInput.trim()}" adicionado à assinatura da arena!`);
      setManagerInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar gestor.');
    } finally {
      setManagerLoading(false);
    }
  };

  // Handle removing manager
  const handleRemoveManager = async (manager: string) => {
    if (!tenant.id) return;
    try {
      await removeArenaManager(tenant.id, manager);
      toast.success(`Gestor "${manager}" removido da arena.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao remover gestor.');
    }
  };

  // Handle creating coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const created = await createCoupon({
        code: couponCode.trim(),
        discountType: couponType,
        discountValue: couponValue,
        scope: couponScope,
        arenaId: couponScope === 'arena' ? tenant.id : undefined,
        arenaName: couponScope === 'arena' ? tenant.name : undefined,
        minBookingValue: couponMinBooking > 0 ? couponMinBooking : undefined,
        maxUses: couponMaxUses > 0 ? couponMaxUses : undefined,
        active: true,
      });
      toast.success(`Cupom "${created.code}" criado com sucesso!`);
      setCouponCode('');
      setCouponValue(10);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar cupom.');
    } finally {
      setCouponLoading(false);
    }
  };

  const relevantCoupons = coupons.filter(
    (c) => c.scope === 'global' || c.arenaId === tenant.id
  );

  // Topics configuration
  const topics = [
    { id: 'visao_geral' as AdminTab, label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'agenda' as AdminTab, label: 'Agenda & Horários', icon: Calendar },
    { id: 'dados_arena' as AdminTab, label: 'Dados & Localização', icon: MapPin },
    { id: 'precos_pico' as AdminTab, label: 'Preços & Horário de Pico', icon: DollarSign },
    { id: 'quadras_estrutura' as AdminTab, label: `Quadras (${tenant.courts.length})`, icon: Layers },
    { id: 'gestores' as AdminTab, label: `Gestores (${tenant.managers?.length || 0})`, icon: Users },
    { id: 'cupons' as AdminTab, label: `Cupons (${relevantCoupons.length})`, icon: Tag },
    { id: 'visual_logo' as AdminTab, label: 'Logo & Paleta', icon: Palette },
  ];

  return (
    <section className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
            Painel do Gestor de Arena
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Administração da Arena
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateArenaOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-md active:scale-95"
          >
            <PlusCircle size={16} />
            <span>Cadastrar Nova Arena</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setArenaSubTab('agendamentos');
              setActiveTab('home');
            }}
            className="min-h-11 px-4 rounded-xl border border-cyan-500/40 text-slate-200 hover:text-white bg-[#052445]/80 hover:bg-[#083566] font-bold text-xs transition-all cursor-pointer"
          >
            Voltar à área dos atletas
          </button>
        </div>
      </div>

      {/* Arena Switcher */}
      {owned.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#031527] border border-cyan-800/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-900/50 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Arena Ativa</span>
              <p className="font-bold text-white text-base">{tenant.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-semibold">Alternar Arena:</span>
            <DropdownUI
              className="min-h-10 rounded-xl border border-cyan-800/80 px-3 py-1.5 text-white bg-[#05182C] text-xs font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
              value={authorized ? tenant.id : ''}
              onChange={(event) => {
                setTenantId(event.target.value);
              }}
            >
              <option value="" disabled>
                Selecione sua arena
              </option>
              {owned.map((arena) => (
                <option key={arena.id} value={arena.id}>
                  {arena.name} ({arena.city} - {arena.state})
                </option>
              ))}
            </DropdownUI>
          </div>
        </div>
      )}

      {/* Authorized Dashboard */}
      {authorized ? (
        <div className="space-y-6">
          {/* Topic Navigation in a single horizontal line (matching home page pills) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {topics.map((t) => {
              const Icon = t.icon;
              const isActive = activeTopic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopic(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-300/40 scale-[1.02]'
                      : 'bg-[#05182C] text-slate-300 hover:text-white hover:bg-[#072444] border border-cyan-900/60'
                  }`}
                >
                  <Icon size={15} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* TOPIC 1: VISÃO GERAL (RESUMO EXECUTIVO COM TUDO CONFIGURADO)               */}
          {/* ========================================================================= */}
          {activeTopic === 'visao_geral' && (
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#051e38] to-[#031326] border border-cyan-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                      Painel Executivo
                    </span>
                    <h2 className="text-xl font-black text-white">
                      Configurações Ativas da Arena
                    </h2>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black uppercase">
                    ✓ Sistema Operacional
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Visão consolidada de todas as regras, infraestrutura, localização e preços configurados.
                  Clique em qualquer item para editar com apenas 1 clique.
                </p>
              </div>

              {/* Grid of basic configured information cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Localização */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-cyan-900/50 text-cyan-300 flex items-center justify-center font-black">
                      <MapPin size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-mono text-cyan-400 font-bold">
                      {tenant.cep ? `CEP ${tenant.cep}` : 'Endereço'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{tenant.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {tenant.address}, {tenant.city} - {tenant.state}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('dados_arena')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Editar Endereço & Mapa</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 2. WhatsApp */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center font-black">
                      <Phone size={18} />
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Verificado
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">WhatsApp Oficial</h3>
                    <p className="text-xs font-mono text-emerald-400 mt-0.5 font-bold">
                      {tenant.whatsapp ? `+55 ${tenant.whatsapp}` : 'Não informado'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('dados_arena')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Alterar Número</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 3. Horários */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center font-black">
                      <Clock size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-amber-400">Expediente</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Funcionamento</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {tenant.operatingHours?.open || '06:00'} às {tenant.operatingHours?.close || '00:00'}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                      Slot 23h às 00h liberado
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('dados_arena')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Alterar Horários</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 4. Preços & Pico */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-indigo-950/60 text-indigo-400 flex items-center justify-center font-black">
                      <DollarSign size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-indigo-300">
                      {hasPeakPricing ? 'Pico Ativo' : 'Valor Fixo'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      R$ {hourlyRate || 80} / hora
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {hasPeakPricing
                        ? `${peakIntervals.length} intervalo(s) de pico configurado(s)`
                        : 'Preço único sem taxa de pico'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('precos_pico')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Configurar Preços</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 5. Quadras & Estrutura */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-cyan-950/60 text-cyan-400 flex items-center justify-center font-black">
                      <Layers size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-300">
                      {tenant.courts.length} Quadra(s)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Estrutura das Quadras</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tenant.courts[0]?.surface || 'Areia Quartzosa'} ·{' '}
                      {tenant.courts.some((c) => c.hasLighting) ? 'Iluminada' : 'Sem luz'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('quadras_estrutura')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Gerenciar Quadras</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 6. Gestores */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-950/60 text-purple-400 flex items-center justify-center font-black">
                      <Users size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-purple-300">
                      {tenant.managers?.length || 0} Gestor(es)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Equipe Autorizada</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dono: {tenant.ownerName || tenant.ownerId || 'Titular'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('gestores')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Adicionar Colaborador</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 7. Cupons */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-rose-950/60 text-rose-400 flex items-center justify-center font-black">
                      <Tag size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-rose-300">
                      {relevantCoupons.length} Cupom(ns)
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Promoções & Cupons</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Descontos em % e R$ para locações na arena
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTopic('cupons')}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Criar Cupom</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {/* 8. Logo & Paleta Whitelabel */}
                <div className="p-5 rounded-2xl bg-[#05182C] border border-cyan-800/60 flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center font-black">
                      <Palette size={18} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-amber-300">
                      {tenant.whiteLabelEnabled ? 'Ativo' : 'Padrão'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Identidade Visual</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tenant.logoUrl ? 'Logo oficial aplicada' : 'Usando paleta padrão SharkSet'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhiteLabelModalOpen(true)}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer pt-2 border-t border-cyan-900/60"
                  >
                    <span>Personalizar Logo</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 2: AGENDA & HORÁRIOS                                                */}
          {/* ========================================================================= */}
          {activeTopic === 'agenda' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Calendar className="text-cyan-400" />
                  Grade de Horários & Agendamentos
                </h3>
              </div>
              <CourtScheduler key={tenant.id} administration />
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 3: DADOS & LOCALIZAÇÃO (CEP / MAPA / WHATSAPP / EXPEDIENTE)          */}
          {/* ========================================================================= */}
          {activeTopic === 'dados_arena' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="pb-4 border-b border-cyan-900/60">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <MapPin className="text-cyan-400" />
                  Dados Cadastrais, Localização & Contato
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Atualize o endereço por CEP ou mapa interativo, valide o WhatsApp com segurança e defina o expediente de funcionamento.
                </p>
              </div>

              <form onSubmit={handleSaveGeneralData} className="space-y-5">
                {/* Nome Oficial */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1">
                    Nome Oficial da Arena
                  </label>
                  <input
                    type="text"
                    required
                    value={arenaName}
                    onChange={(e) => setArenaName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Localização com CEP, Endereço e Mapa */}
                <ArenaLocationPicker value={locationValue} onChange={setLocationValue} />

                {/* WhatsApp com Verificação */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-200">
                      WhatsApp de Contato Oficial da Arena
                    </label>
                    {isWhatsappVerified ? (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Número Ativo e Validado
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-400 font-bold">
                        Aguardando Confirmação
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={whatsappValue}
                        onChange={(e) => {
                          setWhatsappValue(e.target.value);
                          setIsWhatsappVerified(
                            e.target.value.replace(/\D/g, '') === (tenant.whatsapp || '').replace(/\D/g, '')
                          );
                        }}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWhatsappVerifier(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                    >
                      <ShieldCheck size={14} />
                      <span>{isWhatsappVerified ? 'Reverificar' : 'Validar Novo Número'}</span>
                    </button>
                  </div>
                </div>

                {/* Horários de Funcionamento */}
                <div className="p-4 rounded-2xl bg-[#031326] border border-cyan-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-400" />
                      Horário de Funcionamento (Abre de manhã até meia-noite)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Abre às</label>
                      <input
                        type="time"
                        required
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Fecha às</label>
                      <input
                        type="time"
                        required
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  {closeTime === '00:00' && (
                    <p className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                      <Check size={12} /> Horário 23:00 às 00:00 disponível na agenda!
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    disabled={savingGeneral}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2"
                  >
                    <Save size={15} />
                    <span>{savingGeneral ? 'Salvando…' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 4: PREÇOS & HORÁRIO DE PICO (COM MÚLTIPLOS INTERVALOS)               */}
          {/* ========================================================================= */}
          {activeTopic === 'precos_pico' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="pb-4 border-b border-cyan-900/60">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <DollarSign className="text-amber-400" />
                  Preço Base & Horários de Pico
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Defina o valor da hora normal e adicione um ou múltiplos intervalos de horário de pico com valor diferenciado.
                </p>
              </div>

              <form onSubmit={handleSavePricing} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Valor Normal da Hora (R$)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="number"
                        required
                        min={0}
                        step={5}
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Possui horário de pico com preço diferente?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHasPeakPricing(true)}
                        className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all border ${
                          hasPeakPricing
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                            : 'bg-[#05182C] text-slate-300 border-cyan-800/70 hover:text-white'
                        }`}
                      >
                        🔥 Sim, tem pico
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasPeakPricing(false)}
                        className={`py-2 rounded-xl text-xs font-black cursor-pointer transition-all border ${
                          !hasPeakPricing
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                            : 'bg-[#05182C] text-slate-300 border-cyan-800/70 hover:text-white'
                        }`}
                      >
                        Não, valor único
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multiple peak intervals */}
                {hasPeakPricing && (
                  <div className="space-y-3 p-4 rounded-2xl bg-[#031326] border border-cyan-800/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <Flame size={14} /> Intervalos de Horário de Pico:
                      </span>
                      <button
                        type="button"
                        onClick={handleAddPeakInterval}
                        className="px-3 py-1.5 rounded-xl bg-cyan-700/60 hover:bg-cyan-600 text-white text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1"
                      >
                        <Plus size={14} />
                        <span>Adicionar outro intervalo</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {peakIntervals.map((interval) => (
                        <div
                          key={interval.id}
                          className="p-3.5 rounded-xl bg-[#051a30] border border-amber-500/40 flex flex-wrap items-center gap-3 justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-300">Das</span>
                            <input
                              type="time"
                              required
                              value={interval.startTime}
                              onChange={(e) =>
                                handleUpdatePeakInterval(interval.id, { startTime: e.target.value })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                            />
                            <span className="text-xs font-bold text-slate-300">às</span>
                            <input
                              type="time"
                              required
                              value={interval.endTime}
                              onChange={(e) =>
                                handleUpdatePeakInterval(interval.id, { endTime: e.target.value })
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-[#030D1A] border border-cyan-700/60 text-white text-xs font-mono font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-300">Valor Pico:</span>
                            <div className="relative">
                              <DollarSign className="w-3.5 h-3.5 text-amber-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="number"
                                required
                                min={0}
                                step={5}
                                value={interval.price}
                                onChange={(e) =>
                                  handleUpdatePeakInterval(interval.id, { price: Number(e.target.value) })
                                }
                                className="w-24 pl-6 pr-2 py-1.5 rounded-lg bg-[#030D1A] border border-amber-500/50 text-amber-300 text-xs font-mono font-bold"
                              />
                            </div>

                            {peakIntervals.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePeakInterval(interval.id)}
                                title="Remover intervalo"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingPricing}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2"
                  >
                    <Save size={15} />
                    <span>{savingPricing ? 'Salvando…' : 'Salvar Preços'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 5: QUADRAS & ESTRUTURA                                              */}
          {/* ========================================================================= */}
          {activeTopic === 'quadras_estrutura' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Layers className="text-cyan-400" />
                    Quadras & Estrutura Física ({tenant.courts.length})
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Gerencie o nome das quadras, tipo de areia, iluminação e modalidades suportadas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenant.courts.map((court, idx) => (
                  <div
                    key={court.id}
                    className="p-4 rounded-2xl bg-[#031326] border border-cyan-800/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-cyan-700/40 text-cyan-300 font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-white text-sm">{court.name}</h4>
                      </div>
                      <span className="text-[11px] font-mono text-amber-300 font-bold">
                        R$ {court.hourlyRate}/h
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <p>• Areia: <strong>{court.surface}</strong></p>
                      <p>• Cobertura: <strong>{court.isCovered ? 'Coberta' : 'Aberta'}</strong></p>
                      <p>• Iluminação: <strong>{court.hasLighting ? 'Sim' : 'Não'}</strong></p>
                      <p>• Modalidades: <strong>{court.sports?.join(', ') || 'Futevôlei'}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 6: GESTORES DA ASSINATURA                                           */}
          {/* ========================================================================= */}
          {activeTopic === 'gestores' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="pb-4 border-b border-cyan-900/60">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ShieldCheck className="text-cyan-400" />
                  Gestores com Acesso à Arena
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  O titular da arena pode autorizar colaboradores para gerenciar grades de horários e valores.
                </p>
              </div>

              {/* Owner Info */}
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cyan-600/30 border border-cyan-400 flex items-center justify-center font-bold text-cyan-300 text-sm">
                    👑
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-300 block">
                      Dono Titular da Assinatura
                    </span>
                    <span className="font-bold text-white text-sm">
                      {tenant.ownerId || auth.currentUser?.uid || 'Administrador'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Acesso Total
                </span>
              </div>

              {/* Form to Add Manager */}
              {isArenaOwner && (
                <form onSubmit={handleAddManager} className="pt-2">
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    Adicionar Novo Gestor (E-mail ou UID do Usuário):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      value={managerInput}
                      onChange={(e) => setManagerInput(e.target.value)}
                      placeholder="Ex: gestor@arena.com ou uid_do_usuario"
                      className="flex-1 px-4 py-2.5 bg-slate-900 border border-cyan-700/70 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      disabled={managerLoading || !managerInput.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shrink-0 inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus size={16} />
                      <span>{managerLoading ? 'Adicionando…' : 'Adicionar Gestor'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Managers List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Gestores Autorizados ({tenant.managers?.length || 0})
                </h4>

                {!tenant.managers || tenant.managers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum gestor adicional adicionado ainda. Cadastre o e-mail de um colaborador acima.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tenant.managers.map((manager) => (
                      <div
                        key={manager}
                        className="p-3 rounded-xl bg-slate-900/80 border border-cyan-800/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-cyan-900/60 border border-cyan-700 flex items-center justify-center font-bold text-cyan-300 text-xs shrink-0">
                            👤
                          </div>
                          <div className="truncate">
                            <span className="font-bold text-white text-xs block truncate">
                              {manager}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Gestor Ativo
                            </span>
                          </div>
                        </div>

                        {isArenaOwner && (
                          <button
                            type="button"
                            onClick={() => handleRemoveManager(manager)}
                            title="Remover Gestor"
                            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/40 cursor-pointer transition-all shrink-0"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 7: CUPONS & PROMOÇÕES                                               */}
          {/* ========================================================================= */}
          {activeTopic === 'cupons' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="pb-4 border-b border-cyan-900/60">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Tag className="text-cyan-400" />
                  Criar Promoção / Cupom de Desconto
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Gere cupons promocionais para atrair novos atletas para sua arena.
                </p>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Código do Cupom *
                    </label>
                    <input
                      type="text"
                      required
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Ex: SHARK10, PRAIA20"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-700/70 text-xs font-mono font-bold text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Tipo de Desconto
                    </label>
                    <DropdownUI
                      value={couponType}
                      onChange={(e) => setCouponType(e.target.value as CouponDiscountType)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-700/70 text-xs text-white"
                    >
                      <option value="fixed">Desconto em Reais (R$)</option>
                      <option value="percent">Porcentagem (%)</option>
                    </DropdownUI>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1">
                      Valor ({couponType === 'percent' ? '%' : 'R$'}) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={couponType === 'percent' ? 100 : 500}
                      value={couponValue}
                      onChange={(e) => setCouponValue(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-700/70 text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md inline-flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>{couponLoading ? 'Criando…' : 'Cadastrar Cupom'}</span>
                  </button>
                </div>
              </form>

              {/* Existing Coupons List */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Cupons Ativos ({relevantCoupons.length})
                </h4>
                {relevantCoupons.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum cupom cadastrado para esta arena ainda.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {relevantCoupons.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-800/60 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-black text-amber-300 text-sm block">
                            {c.code}
                          </span>
                          <span className="text-[11px] text-slate-300">
                            {c.discountType === 'percent' ? `${c.discountValue}% OFF` : `R$ ${c.discountValue} OFF`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          Ativo
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TOPIC 8: LOGO & PALETA WHITELABEL                                         */}
          {/* ========================================================================= */}
          {activeTopic === 'visual_logo' && (
            <div className="p-6 rounded-3xl bg-[#05182C] border border-cyan-800/60 space-y-6">
              <div className="pb-4 border-b border-cyan-900/60">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Palette className="text-cyan-400" />
                  Personalização de Logo & Paleta de Cores (Whitelabel)
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Envie a logo da arena para gerar uma paleta de cores automática aplicada a toda a página.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#031326] border border-cyan-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {tenant.logoUrl ? (
                    <img
                      src={tenant.logoUrl}
                      alt={tenant.name}
                      className="w-16 h-16 rounded-2xl object-contain bg-white/5 border border-cyan-700/50 p-1"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-700/50 flex items-center justify-center text-cyan-300 text-xl font-black">
                      🏟️
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-black text-white">{tenant.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tenant.whiteLabelEnabled ? 'Paleta própria ativada' : 'Usando cores padrão SharkSet'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setWhiteLabelModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2"
                >
                  <Palette size={15} />
                  <span>Personalizar Logo & Cores</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-[#05182C] border border-cyan-800/60 text-center space-y-4 max-w-md mx-auto">
          <ShieldAlert size={36} className="text-amber-400 mx-auto" />
          <h3 className="text-lg font-black text-white">Acesso de Gestão</h3>
          <p className="text-xs text-slate-300">{message}</p>
          <button
            type="button"
            onClick={() => setCreateArenaOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs cursor-pointer shadow-md"
          >
            Cadastrar Nova Arena
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateArenaModal
        isOpen={createArenaOpen}
        onClose={() => setCreateArenaOpen(false)}
      />

      {whiteLabelModalOpen && (
        <ArenaWhiteLabelCustomizerModal
          onClose={() => setWhiteLabelModalOpen(false)}
        />
      )}

      <ArenaWhatsAppVerifier
        isOpen={showWhatsappVerifier}
        onClose={() => setShowWhatsappVerifier(false)}
        phoneToVerify={whatsappValue}
        currentExistingPhone={tenant.whatsapp}
        onVerified={(verified) => {
          setWhatsappValue(verified);
          setIsWhatsappVerified(true);
        }}
      />
    </section>
  );
};
