export async function enterDocumentFullscreen() {
  if (document.fullscreenElement) return;
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); }
  catch { /* The fixed immersive surface remains available when native fullscreen is unavailable. */ }
}

export async function leaveDocumentFullscreen() {
  if (!document.fullscreenElement) return;
  try { await document.exitFullscreen(); } catch { /* Keep the normal page usable. */ }
}

let scrollLocks = 0;
let previousOverflow = '';
export function lockImmersiveScroll() {
  if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  let released = false;
  return () => { if (released) return; released = true; if (--scrollLocks === 0) document.body.style.overflow = previousOverflow; };
}
