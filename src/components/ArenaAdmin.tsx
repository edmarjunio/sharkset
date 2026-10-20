import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { CourtScheduler } from './CourtScheduler';
import { UserProfileModal } from './UserProfileModal';
import { CreateArenaModal } from './CreateArenaModal';
import { PlusCircle, Building2 } from 'lucide-react';

export const ArenaAdmin: React.FC = () => {
  const { tenant, availableTenants, setTenantId, setArenaSubTab, setActiveTab } = useApp();
  const [access, setAccess] = useState<{ uid: string; ids: string[] } | null>(null);
  const [message, setMessage] = useState('Verificando acesso…');
  const [loginOpen, setLoginOpen] = useState(false);
  const [createArenaOpen, setCreateArenaOpen] = useState(false);
  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      const current = ++generation;
      setAccess(null);
      if (!user) { setMessage('Entre com a conta responsável pela arena.'); return; }
      setMessage('Verificando suas arenas…');
      try {
        const result = await getDocsFromServer(query(collection(db, 'arenas'), where('ownerId', '==', user.uid)));
        if (current !== generation) return;
        setAccess({ uid: user.uid, ids: result.docs.map(doc => doc.id) });
        setMessage(result.empty ? 'Nenhuma arena cadastrada para esta conta.' : 'Selecione uma arena para administrar.');
      } catch {
        if (current === generation) setMessage('Não foi possível verificar seu acesso. Tente novamente mais tarde.');
      }
    });
    return () => { generation++; unsubscribe(); };
  }, []);
  const owned = availableTenants.filter(arena => access?.ids.includes(arena.id));
  const authorized = Boolean(auth.currentUser && access?.uid === auth.currentUser.uid && tenant.id && access.ids.includes(tenant.id));
  return <section className="max-w-[1600px] mx-auto p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <p className="text-sm text-cyan-400 font-semibold">Espaço de gestão</p>
        <h1 className="text-2xl font-bold text-white">Administração da arena</h1>
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
          onClick={() => { setArenaSubTab('agendamentos'); setActiveTab('home'); }}
          className="min-h-11 px-4 rounded-xl border border-cyan-500/40 text-slate-200 hover:text-white bg-[#052445]/80 hover:bg-[#083566] font-bold text-xs transition-all cursor-pointer"
        >
          Voltar à área dos atletas
        </button>
      </div>
    </div>
    {owned.length > 0 && <label className="block mb-6 font-semibold text-slate-200">Arena<select className="block mt-2 min-h-11 rounded-xl border border-cyan-800/60 p-2 text-white bg-[#030D1A]" value={authorized ? tenant.id : ''} onChange={event => { setTenantId(event.target.value); setArenaSubTab('dono'); }}><option value="" disabled>Selecione sua arena</option>{owned.map(arena => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>}
    {authorized ? <CourtScheduler key={tenant.id} administration /> : <div className="rounded-2xl border border-cyan-800/60 bg-[#05182C]/80 p-8 text-center text-white space-y-3"><p role="status" className="text-slate-300 font-bold">{message}</p><div className="flex flex-wrap justify-center gap-3 pt-2">{!auth.currentUser ? <button type="button" onClick={() => setLoginOpen(true)} className="min-h-11 px-5 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs cursor-pointer">Entrar com Google</button> : <button type="button" onClick={() => setCreateArenaOpen(true)} className="min-h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer inline-flex items-center gap-1.5"><Building2 size={16} /><span>Cadastrar Minha Primeira Arena</span></button>}</div></div>}
    <UserProfileModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    <CreateArenaModal isOpen={createArenaOpen} onClose={() => setCreateArenaOpen(false)} />
  </section>;
};
