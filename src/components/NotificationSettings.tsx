import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { defaultPreferences, loadNotificationPreferences, saveNotificationPreferences, enablePush, disableDevicePush, type NotificationPreferences } from '../services/pushNotifications';

export function NotificationSettings() {
  const { availableTenants } = useApp();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void loadNotificationPreferences().then(data => { if (active) { setPreferences(data); setLoaded(true); } })
      .catch(() => { if (active) setError('Não foi possível carregar suas preferências.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    setBusy(true); setError(''); setFeedback('');
    try {
      const phone = preferences.phone.replace(/\D/g, '');
      if (preferences.whatsappEnabled && !/^\d{10,15}$/.test(phone)) throw new Error('Informe o WhatsApp com código do país e DDD.');
      await saveNotificationPreferences({ ...preferences, phone });
      setFeedback('Preferências salvas.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const togglePush = async (enabled: boolean) => {
    setBusy(true); setError(''); setFeedback('');
    try {
      if (enabled) await enablePush(); else await disableDevicePush();
      const next = { ...preferences, pushEnabled: enabled };
      await saveNotificationPreferences(next); setPreferences(next); setFeedback('Notificações atualizadas.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível ativar os avisos.'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Notificações e arenas favoritas" className="rounded-2xl border border-cyan-500/30 p-4 space-y-3 text-white">
    <h3 className="font-bold">Notificações e arenas favoritas</h3>
    <p className="text-sm">Receba avisos de cancelamento, horários liberados e inscrições abertas.</p>
    <fieldset disabled={busy || !loaded} className="space-y-2">
      <legend>Arenas favoritas</legend>
      {availableTenants.map(arena => <label key={arena.id} className="block text-sm"><input type="checkbox" checked={preferences.favoriteArenaIds.includes(arena.id)} onChange={e => setPreferences(p => ({ ...p, favoriteArenaIds: e.target.checked ? [...p.favoriteArenaIds, arena.id] : p.favoriteArenaIds.filter(id => id !== arena.id) }))} /> {arena.name}</label>)}
      <label className="block text-sm"><input type="checkbox" checked={preferences.bookingCancelled} onChange={e => setPreferences(p => ({ ...p, bookingCancelled: e.target.checked }))} /> Cancelamentos e horários liberados</label>
      <label className="block text-sm"><input type="checkbox" checked={preferences.tournamentOpened} onChange={e => setPreferences(p => ({ ...p, tournamentOpened: e.target.checked }))} /> Novos torneios abertos</label>
      <button type="button" onClick={() => togglePush(true)} className="rounded-lg bg-cyan-800 p-2">Ativar/renovar push neste dispositivo</button>
      {preferences.pushEnabled && <button type="button" onClick={() => togglePush(false)} className="ml-2 rounded-lg bg-slate-700 p-2">Desativar push</button>}
      <label className="block text-sm">WhatsApp com país e DDD <input type="tel" value={preferences.phone} onChange={e => setPreferences(p => ({ ...p, phone: e.target.value }))} placeholder="5564999999999" className="block rounded-lg bg-slate-800 p-2" /></label>
      <label className="block text-sm"><input type="checkbox" checked={preferences.whatsappEnabled} onChange={e => setPreferences(p => ({ ...p, whatsappEnabled: e.target.checked }))} /> Autorizo receber estes avisos no meu WhatsApp.</label>
      <button type="button" onClick={save} className="rounded-lg bg-emerald-800 p-2">Salvar preferências</button>
    </fieldset>
    {busy && <p role="status">Salvando ou carregando preferências…</p>}
    {error && <p role="alert">{error}</p>}{feedback && <p role="status">{feedback}</p>}
  </section>;
}
