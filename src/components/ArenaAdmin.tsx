import { DropdownUI } from './DropdownUI';
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { CourtScheduler } from './CourtScheduler';
import { UserProfileModal } from './UserProfileModal';
import { CreateArenaModal } from './CreateArenaModal';
import { AccessLockedAction } from './AccessLockedAction';
import { toast } from '../store/useToastStore';
import type { CouponDiscountType, CouponScope } from '../types';
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
  Globe,
  Plus,
} from 'lucide-react';

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
    toggleCouponStatus,
    userProfile,
    athletes,
  } = useApp();

  const [access, setAccess] = useState<{ uid: string; ids: string[] } | null>(null);
  const [message, setMessage] = useState('Verificando acesso…');
  const [loginOpen, setLoginOpen] = useState(false);
  const [createArenaOpen, setCreateArenaOpen] = useState(false);

  // Admin sub-tabs
  const [adminSection, setAdminSection] = useState<'agenda' | 'gestores' | 'cupons'>('agenda');

  // Managers tab state
  const [managerInput, setManagerInput] = useState('');
  const [managerLoading, setManagerLoading] = useState(false);

  // Coupons tab state
  const [couponCode, setCouponCode] = useState('');
  const [couponType, setCouponType] = useState<CouponDiscountType>('fixed');
  const [couponValue, setCouponValue] = useState<number>(10);
  const [couponScope, setCouponScope] = useState<CouponScope>('arena');
  const [couponMinBooking, setCouponMinBooking] = useState<number>(0);
  const [couponMaxUses, setCouponMaxUses] = useState<number>(100);
  const [couponLoading, setCouponLoading] = useState(false);

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

        // Query 1: Arenas owned by user
        const qOwner = query(collection(db, 'arenas'), where('ownerId', '==', userUid));
        const ownerDocs = await getDocsFromServer(qOwner);
        ownerDocs.docs.forEach((doc) => idsSet.add(doc.id));

        // Query 2: Arenas where user is manager by email
        if (userEmail) {
          try {
            const qManagerEmail = query(
              collection(db, 'arenas'),
              where('managers', 'array-contains', userEmail)
            );
            const managerDocs = await getDocsFromServer(qManagerEmail);
            managerDocs.docs.forEach((doc) => idsSet.add(doc.id));
          } catch {
            // Ignore if array-contains index not present
          }
        }

        // Query 3: Arenas where user is manager by UID
        try {
          const qManagerUid = query(
            collection(db, 'arenas'),
            where('managers', 'array-contains', userUid)
          );
          const uidDocs = await getDocsFromServer(qManagerUid);
          uidDocs.docs.forEach((doc) => idsSet.add(doc.id));
        } catch {
          // Ignore if array-contains index not present
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
  const isSiteAdmin = Boolean(
    athletes.find(
      (a) =>
        a.id === auth.currentUser?.uid ||
        (auth.currentUser?.email && a.email?.toLowerCase() === auth.currentUser.email.toLowerCase())
    )?.role === 'admin'
  );

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

  // Filter coupons related to this arena or global
  const relevantCoupons = coupons.filter(
    (c) => c.scope === 'global' || c.arenaId === tenant.id
  );

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
                setArenaSubTab('dono');
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

      {/* Authorized Dashboard with Tabs */}
      {authorized ? (
        <div className="space-y-6">
          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-cyan-900/60 pb-3">
            <button
              type="button"
              onClick={() => setAdminSection('agenda')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                adminSection === 'agenda'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                  : 'bg-[#05182C] text-slate-300 hover:text-white border border-cyan-900/60'
              }`}
            >
              <Calendar size={15} />
              <span>Agenda, Quadras & Horários</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSection('gestores')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                adminSection === 'gestores'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                  : 'bg-[#05182C] text-slate-300 hover:text-white border border-cyan-900/60'
              }`}
            >
              <Users size={15} />
              <span>Gestores da Assinatura ({tenant.managers?.length || 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminSection('cupons')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                adminSection === 'cupons'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                  : 'bg-[#05182C] text-slate-300 hover:text-white border border-cyan-900/60'
              }`}
            >
              <Tag size={15} />
              <span>Cupons & Promoções ({relevantCoupons.length})</span>
            </button>
          </div>

          {/* Section 1: Agenda & Courts Scheduler */}
          {adminSection === 'agenda' && <CourtScheduler key={tenant.id} administration />}

          {/* Section 2: Team / Arena Managers */}
          {adminSection === 'gestores' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#05182C]/90 border border-cyan-800/60 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-cyan-900/60">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="text-cyan-400 w-5 h-5" />
                      Gestores com Acesso à Arena
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      O dono da arena pode adicionar colaboradores à sua assinatura para gerenciar
                      grades de horários, valores e criar torneios oficiais vinculados à arena.
                    </p>
                  </div>
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
                <div className="pt-3 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Gestores Autorizados ({tenant.managers?.length || 0})
                  </h4>

                  {(!tenant.managers || tenant.managers.length === 0) ? (
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
            </div>
          )}

          {/* Section 3: Discount Coupons & Promotions */}
          {adminSection === 'cupons' && (
            <div className="space-y-6">
              {/* Create Coupon Box */}
              <div className="p-6 rounded-2xl bg-[#05182C]/90 border border-cyan-800/60 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-cyan-900/60">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Tag className="text-cyan-400 w-5 h-5" />
                      Criar Promoção / Cupom de Desconto
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Crie cupons com desconto fixo (ex: R$ 10 OFF) ou percentual (ex: 15% OFF) para reservas de quadra.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Código do Cupom:
                      </label>
                      <input
                        type="text"
                        required
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Ex: ARENA10 ou VERAO"
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white uppercase font-mono tracking-wider font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Tipo de Desconto:
                      </label>
                      <DropdownUI
                        value={couponType}
                        onChange={(e) => setCouponType(e.target.value as CouponDiscountType)}
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white font-semibold"
                      >
                        <option value="fixed">Valor Fixo em Reais (R$)</option>
                        <option value="percent">Porcentagem (%)</option>
                      </DropdownUI>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Valor do Desconto:
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          required
                          value={couponValue}
                          onChange={(e) => setCouponValue(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white font-mono font-bold"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 font-bold">
                          {couponType === 'fixed' ? 'R$' : '%'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Alcance / Escopo:
                      </label>
                      <DropdownUI
                        value={couponScope}
                        onChange={(e) => setCouponScope(e.target.value as CouponScope)}
                        disabled={!isSiteAdmin}
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white font-semibold disabled:opacity-70"
                      >
                        <option value="arena">Específico desta Arena ({tenant.name})</option>
                        {isSiteAdmin && (
                          <option value="global">Global (Todas as Arenas do SHARKSET)</option>
                        )}
                      </DropdownUI>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Valor Mínimo da Reserva (R$):
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={couponMinBooking}
                        onChange={(e) => setCouponMinBooking(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">
                        Limite de Utilizações:
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={couponMaxUses}
                        onChange={(e) => setCouponMaxUses(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-700/70 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-all shadow-md inline-flex items-center gap-1.5"
                    >
                      <Plus size={16} />
                      <span>{couponLoading ? 'Criando…' : 'Publicar Cupom de Desconto'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Coupons List */}
              <div className="p-6 rounded-2xl bg-[#05182C]/90 border border-cyan-800/60 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Cupons Ativos & Histórico ({relevantCoupons.length})</span>
                  <span className="text-xs text-slate-400 font-normal">
                    Validado automaticamente durante o agendamento
                  </span>
                </h4>

                {relevantCoupons.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
                    Nenhum cupom cadastrado ainda para esta arena. Crie uma promoção acima!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {relevantCoupons.map((coupon) => (
                      <div
                        key={coupon.id}
                        className={`p-4 rounded-xl border transition-all ${
                          coupon.active
                            ? 'bg-slate-900/90 border-cyan-700/60'
                            : 'bg-slate-950/60 border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-1 rounded-md bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono font-black text-sm tracking-wider">
                            {coupon.code}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              coupon.scope === 'global'
                                ? 'bg-indigo-950 border border-indigo-500/50 text-indigo-300'
                                : 'bg-teal-950 border border-teal-500/50 text-teal-300'
                            }`}
                          >
                            {coupon.scope === 'global' ? (
                              <>
                                <Globe size={11} /> Global
                              </>
                            ) : (
                              <>
                                <Building2 size={11} /> Arena
                              </>
                            )}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs">
                          <p className="text-emerald-400 font-extrabold text-base flex items-center gap-1">
                            {coupon.discountType === 'fixed' ? (
                              <>
                                <DollarSign size={16} /> R$ {coupon.discountValue.toFixed(2)} OFF
                              </>
                            ) : (
                              <>
                                <Percent size={16} /> {coupon.discountValue}% OFF
                              </>
                            )}
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            {coupon.arenaName ? `Válido em: ${coupon.arenaName}` : 'Válido em todas as arenas'}
                          </p>
                          <p className="text-slate-400 text-[11px]">
                            Utilizado: <strong className="text-white">{coupon.usedCount || 0}</strong>
                            {coupon.maxUses ? ` / ${coupon.maxUses}` : ''} vezes
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-800 flex justify-between items-center">
                          <span
                            className={`text-[11px] font-bold ${
                              coupon.active ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {coupon.active ? '● Ativo no Checkout' : '○ Pausado'}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await toggleCouponStatus(coupon.id);
                              toast.success(
                                coupon.active
                                  ? `Cupom ${coupon.code} pausado.`
                                  : `Cupom ${coupon.code} ativado!`
                              );
                            }}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                          >
                            {coupon.active ? 'Pausar' : 'Ativar'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-cyan-800/60 bg-[#05182C]/80 p-8 text-center text-white space-y-3">
          <p role="status" className="text-slate-300 font-bold">
            {message}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {!auth.currentUser ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full max-w-md mx-auto">
                <AccessLockedAction
                  message="Faça login para gerenciar"
                  onClick={() => setLoginOpen(true)}
                  className="w-full sm:w-auto rounded-xl"
                  previewClassName="w-full sm:w-auto min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 border border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                >
                  <Building2 size={16} />
                  <span>Cadastrar Minha Primeira Arena</span>
                </AccessLockedAction>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs shadow-lg shadow-white/10 border border-white/80 transition-all cursor-pointer inline-flex items-center justify-center gap-2.5 active:scale-[0.98] shrink-0"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Entrar com Google</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreateArenaOpen(true)}
                className="min-h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Building2 size={16} />
                <span>Cadastrar Minha Primeira Arena</span>
              </button>
            )}
          </div>
        </div>
      )}

      <UserProfileModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <CreateArenaModal isOpen={createArenaOpen} onClose={() => setCreateArenaOpen(false)} />
    </section>
  );
};
