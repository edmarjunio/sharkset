import React, { useEffect, useState } from 'react';
import { listenToForegroundPush } from '../services/pushNotifications';

export function PushNotificationToast() {
  const [message, setMessage] = useState<{ title: string; body: string; link: string } | null>(null);
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    void listenToForegroundPush(data => { if (!disposed) setMessage(data); }).then(stop => {
      if (disposed) stop(); else unsubscribe = stop;
    }).catch(() => {});
    return () => { disposed = true; unsubscribe(); };
  }, []);
  return message ? <aside role="status" className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-2xl border border-cyan-500 bg-slate-950 p-4 text-white shadow-xl">
    <strong>{message.title}</strong><p>{message.body}</p><a href={message.link} className="text-cyan-300 underline">Ver detalhes e agendar</a>
    <button className="ml-4" onClick={() => setMessage(null)} aria-label="Dispensar notificação">Fechar</button>
  </aside> : null;
}
