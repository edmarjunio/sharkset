import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockImmersiveScroll } from '../services/fullscreen';

/** A stable portal host moves between inline and body without remounting its children. */
export function ImmersiveSurface({ active, children }: { active: boolean; children: ReactNode }) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [host] = useState(() => document.createElement('div'));
  useLayoutEffect(() => {
    const target = active ? document.body : placeholder.current;
    host.className = active ? 'immersive-surface immersive-surface-expanded' : 'immersive-surface';
    target?.appendChild(host);
    const release = active ? lockImmersiveScroll() : undefined;
    return () => { release?.(); host.remove(); };
  }, [active, host]);
  return <><div ref={placeholder} />{createPortal(children, host)}</>;
}
