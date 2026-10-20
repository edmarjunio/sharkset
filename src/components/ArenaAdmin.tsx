import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocsFromServer, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { CourtScheduler } from './CourtScheduler';
import { UserProfileModal } from './UserProfileModal';

export const ArenaAdmin: React.FC = () => {
  const { tenant, availableTenants, setTenantId, setArenaSubTab, setActiveTab } = useApp();
  const [access, setAccess] = useState<{ uid: string; ids: string[] } | null>(null);
  const [message, setMessage] = useState('Verificando acesso…');
  const [loginOpen, setLoginOpen] = useState(false);
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
      <div><p className="text-sm text-cyan-600 font-semibold">Espaço de gestão</p><h1 className="text-2xl font-bold">Administração da arena</h1></div>
      <button type="button" onClick={() => { setArenaSubTab('agendamentos'); setActiveTab('home'); }} className="min-h-11 px-4 rounded-xl border border-slate-400">Voltar à área dos atletas</button>
    </div>
    {owned.length > 0 && <label className="block mb-6 font-semibold">Arena<select className="block mt-2 min-h-11 rounded-xl border p-2 text-slate-900 bg-white" value={authorized ? tenant.id : ''} onChange={event => { setTenantId(event.target.value); setArenaSubTab('dono'); }}><option value="" disabled>Selecione sua arena</option>{owned.map(arena => <option key={arena.id} value={arena.id}>{arena.name}</option>)}</select></label>}
    {authorized ? <CourtScheduler key={tenant.id} administration /> : <div className="rounded-2xl border border-slate-300 p-8 text-center"><p role="status">{message}</p>{!auth.currentUser && <button type="button" onClick={() => setLoginOpen(true)} className="mt-4 min-h-11 px-5 rounded-xl bg-cyan-700 text-white">Entrar com Google</button>}</div>}
    <UserProfileModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
  </section>;
};
