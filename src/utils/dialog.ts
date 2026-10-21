import type { MouseEvent } from 'react';

export function closeOnBackdrop<T extends HTMLElement>(
  event: MouseEvent<T>,
  onClose: () => void
): void {
  if (event.target === event.currentTarget) onClose();
}
