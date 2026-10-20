import React from 'react';

export interface NavIconProps {
  size?: number;
  className?: string;
  isActive?: boolean;
}

/**
 * 1. INÍCIO (Baseado em image_cfb475cc.png)
 * Ícone 3D de casa em badge circular com chaminé, janela 4-painéis e estrela brilhante.
 */
export function NavIconHome({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Círculo externo do badge */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeOpacity={isActive ? '0.4' : '0.35'}
      />
      <circle
        cx="12"
        cy="12"
        r="8.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity={isActive ? '0.7' : '0.6'}
      />

      {/* Chaminé no teto */}
      <path
        d="M14.5 8.2V6.5h1.8v2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Telhado com beiral arredondado */}
      <path
        d="M7 11.2L12 7l5 4.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Corpo da casa */}
      <path
        d="M8.5 10.8v6a.8.8 0 0 0 .8.8h5.4a.8.8 0 0 0 .8-.8v-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Janela central em cruz (4 vidros) */}
      <rect
        x="10.2"
        y="12"
        width="3.6"
        height="3.6"
        rx="0.8"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="currentColor"
        fillOpacity={isActive ? '0.25' : '0.15'}
      />
      <path
        d="M10.2 13.8h3.6M12 12v3.6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Estrela brilhante no céu */}
      <path
        d="M10 8.2l.3.6.6.3-.6.3-.3.6-.3-.6-.6-.3.6-.3z"
        fill="currentColor"
        opacity={isActive ? '0.9' : '0.75'}
      />
    </svg>
  );
}

/**
 * 2. TORNEIOS / CAMPEONATOS (Baseado em image_11f9aa63.png)
 * Troféu dourado com estrela central de 5 pontas, alças curvas e pedestal em degraus.
 */
export function NavIconTrophy({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Borda superior da taça */}
      <path
        d="M6.5 4.8h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Corpo da taça de campeão */}
      <path
        d="M7 5.2v3.8c0 3.2 2.2 5.5 5 5.5s5-2.3 5-5.5V5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.2' : '0.12'}
      />

      {/* Alça esquerda */}
      <path
        d="M7 6.5H4.8a1.6 1.6 0 0 0-1.6 1.6v1.2a3 3 0 0 0 3 3H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Alça direita */}
      <path
        d="M17 6.5h2.2a1.6 1.6 0 0 1 1.6 1.6v1.2a3 3 0 0 1-3 3H17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Estrela de 5 pontas estampada na taça */}
      <polygon
        points="12,7.2 12.8,8.8 14.5,9 13.2,10.2 13.6,11.8 12,10.9 10.4,11.8 10.8,10.2 9.5,9 11.2,8.8"
        fill="currentColor"
      />

      {/* Haste e base com pedestal */}
      <path
        d="M12 14.5v3M9.8 17.5h4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7.5 20.2h9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8.8 17.5l-1 2.7M15.2 17.5l1 2.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 3. ARENAS / QUADRAS (Baseado em image_d3547e01.png)
 * Rede de beach tennis / vôlei com postes, malha quadriculada e bola sobre a rede.
 */
export function NavIconNet({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Postes laterais fincados na areia */}
      <path
        d="M4 6.8v13.2M2.8 20h2.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 6.8v13.2M18.8 20h2.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Faixas superior e inferior da rede */}
      <path
        d="M4 8.8c4 1 12 1 16 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M4 15.5c4 1 12 1 16 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      {/* Linha horizontal intermediária da malha */}
      <path
        d="M4 12.2c4 1 12 1 16 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity={isActive ? '0.7' : '0.55'}
      />

      {/* Linhas verticais da malha quadriculada */}
      <path
        d="M7.5 9.3v5.8M10.5 9.6v5.8M13.5 9.6v5.8M16.5 9.3v5.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeOpacity={isActive ? '0.7' : '0.55'}
      />

      {/* Bola de vôlei / beach tennis no alto direito */}
      <circle
        cx="16.5"
        cy="4.6"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="currentColor"
        fillOpacity={isActive ? '0.35' : '0.2'}
      />
      <path
        d="M15.2 3.6c.9.5 1.5 1.3 1.7 2.2M15.5 5.8c.8-.3 1.8-.1 2.2.4"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 4. RANKINGS / ATLETAS (Baseado em image_4d366291.png)
 * Pódio com 3 degraus de premiação (1º, 2º e 3º lugares) e troféu no topo central.
 */
export function NavIconPodium({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Linha base do pódio */}
      <path
        d="M2.5 20.2h19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Degrau 2 (Esquerda) */}
      <path
        d="M4 20.2v-6h4.5v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.15' : '0.08'}
      />

      {/* Degrau 1 (Centro - Mais alto) */}
      <path
        d="M8.5 20.2V10.2h7v10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.25' : '0.15'}
      />

      {/* Degrau 3 (Direita) */}
      <path
        d="M15.5 20.2v-4.8h4.5v4.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.15' : '0.08'}
      />

      {/* Troféu em cima do 1º lugar */}
      <path
        d="M10.8 4.6h2.4v2.5a1.2 1.2 0 0 1-2.4 0V4.6z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="currentColor"
        strokeLinejoin="round"
      />
      {/* Alças do mini troféu */}
      <path
        d="M10.8 5.2H9.8a.7.7 0 0 0-.7.7v.3a1 1 0 0 0 1 1h.7M13.2 5.2h1a.7.7 0 0 1 .7.7v.3a1 1 0 0 1-1 1h-.7"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Base do troféu */}
      <path
        d="M12 7.1v1.6M11 8.8h2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 5. RESERVAS / AGENDAMENTOS (Baseado em image_58acd358.png)
 * Tela de navegador web com botão e mão com dedo indicador clicando.
 */
export function NavIconBooking({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Janela do navegador */}
      <rect
        x="3"
        y="3.5"
        width="18"
        height="12.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      {/* Barra de título com pontinhos */}
      <path d="M3 7.2h18" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.5" cy="5.4" r="0.75" fill="currentColor" />
      <circle cx="7.8" cy="5.4" r="0.75" fill="currentColor" />
      <circle cx="10.1" cy="5.4" r="0.75" fill="currentColor" />

      {/* Conteúdo / Card na esquerda */}
      <rect
        x="5.2"
        y="9.2"
        width="5"
        height="4"
        rx="0.6"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="currentColor"
        fillOpacity={isActive ? '0.2' : '0.1'}
      />

      {/* Botão de ação na direita */}
      <rect
        x="12.5"
        y="9.2"
        width="6.5"
        height="3"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />

      {/* Mão com indicador estendido clicando no botão */}
      <path
        d="M14.5 10.5v4.2a1 1 0 0 0 .5.8l1.8 1.4a2 2 0 0 1 .8 1.6v2h-4.8a2.8 2.8 0 0 1-2-.8l-1.5-1.5a1.1 1.1 0 0 1 1.6-1.6l1.2.9V10.5a1.1 1.1 0 0 1 2.4 0z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.3' : '0.18'}
      />
    </svg>
  );
}

/**
 * 6. INSCRIÇÕES / COMUNIDADE / ADMIN (Baseado em image_272e1aae.png)
 * Pessoa lendo documento aberto / regulamento / livro de inscrições com as duas mãos.
 */
export function NavIconReader({ size = 16, className = '', isActive = false }: NavIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      aria-hidden="true"
    >
      {/* Cabeça do leitor/atleta */}
      <circle
        cx="12"
        cy="5.2"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity={isActive ? '0.35' : '0.2'}
      />

      {/* Páginas do livro / manual / ficha aberta */}
      <path
        d="M12 11.2c-2.4-1.2-5.5-.8-7.5.3v7.8c2-.9 5-1.3 7.5-.1 2.5-1.2 5.5-.8 7.5.1v-7.8c-2-1.1-5.1-1.5-7.5-.3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity={isActive ? '0.2' : '0.1'}
      />

      {/* Lombada central do livro */}
      <path
        d="M12 11.2v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Mãos segurando as laterais do documento */}
      <path
        d="M4.2 14.5a1.4 1.4 0 0 0 0 2.8M19.8 14.5a1.4 1.4 0 0 1 0 2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
