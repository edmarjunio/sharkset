import React, { forwardRef, type SelectHTMLAttributes } from 'react';

type DropdownUIProps = SelectHTMLAttributes<HTMLSelectElement>;
const CHEVRON_IMAGE = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23cbd5e1%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E")';

export const DropdownUI = forwardRef<HTMLSelectElement, DropdownUIProps>(
  ({ children, className = '', style, ...selectProps }, ref) => (
    <select
      {...selectProps}
      ref={ref}
      className={`dropdown-ui appearance-none ${className}`.trim()}
      style={{
        ...style,
        paddingRight: '2.5rem',
        backgroundImage: CHEVRON_IMAGE,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1rem 1rem',
      }}
    >
      {children}
    </select>
  )
);

DropdownUI.displayName = 'DropdownUI';
