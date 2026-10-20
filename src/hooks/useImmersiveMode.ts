import { useCallback, useEffect, useRef, useState } from 'react';
import { enterDocumentFullscreen, leaveDocumentFullscreen } from '../services/fullscreen';

export function useImmersiveMode() {
  const [active, setActive] = useState(false);
  const current = useRef(false);
  const setFullscreen = useCallback((value: boolean | ((previous: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(current.current) : value;
    current.current = next;
    setActive(next);
    if (next) void enterDocumentFullscreen(); else void leaveDocumentFullscreen();
  }, []);
  useEffect(() => {
    const change = () => {
      if (!document.fullscreenElement && current.current) { current.current = false; setActive(false); }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !current.current || event.defaultPrevented) return;
      event.preventDefault(); setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', change);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      window.removeEventListener('keydown', key);
      if (current.current) void leaveDocumentFullscreen();
    };
  }, [setFullscreen]);
  return { active, setFullscreen };
}
