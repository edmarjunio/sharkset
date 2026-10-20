// SHARK SET i18n & Translation System
// Allows keys like 'tournaments'.tr or tr('tournaments') to translate between Portuguese (default) and English.

export type SupportedLocale = 'pt' | 'en';

let currentLocale: SupportedLocale =
  (typeof window !== 'undefined' && (localStorage.getItem('sharkset_locale') as SupportedLocale)) || 'pt';

const listeners: Array<(locale: SupportedLocale) => void> = [];

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem('sharkset_locale', locale);
  }
  listeners.forEach((listener) => listener(locale));
}

export function subscribeLocale(listener: (locale: SupportedLocale) => void): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export const TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  pt: {
    aquarium_pause: 'Pausar animação',
    aquarium_play: 'Ativar animação',
    // App & Identity
    app_subtitle: 'É O TUBA 🦈',
    app_motto: 'A quadra é sua.',
    app_tagline: 'Sua próxima partida começa aqui',
    tag_tuba: 'É O TUBARÃO!',

    // Navigation & Tabs
    home_live: 'Início & Ao Vivo',
    arenas_classes: 'Ver Arenas & Aulas',
    tournaments_bracket: 'Ver Torneios (Tabela)',
    ranking_board: 'Ranking Board',
    shark_academy: 'Comunidade & Ensino',
    doubles_registration: 'Inscrição Duplas',
    reserve_now: 'Agendar Agora',
    profile: 'Perfil',
    pricing_saas: 'R$ 19,90 Campeonato / Arena a partir de R$ 99,90 por mês',

    // Tournament & Bracket
    start_bracket: 'INICIAR TABELA',
    share_bracket: 'COMPARTILHAR CHAVE',
    head_to_head_history: 'HISTÓRICO H2H',
    enroll_participant: 'INSCREVER DUPLA / JOGADOR',
    export_pdf: 'EXPORTAR PDF',
    export_csv: 'EXPORTAR CSV',
    print: 'IMPRIMIR',
    rules_config: 'Regras & Config',
    new_tournament: 'CRIAR NOVO TORNEIO',
    pan_zoom_mode: 'Chaveamento Oficial (Pan & Zoom)',
    list_mode: 'Visualização em Lista',
    all_stages: 'Tabela Completa',
    standings: 'Classificação',
    winners_bracket: 'Chave dos Vencedores',
    losers_bracket: 'Chave de Repescagem / Perdedores (Buraco)',
    semis_and_final: 'Semis & Final',
    grand_final: 'GRANDE FINAL DO TORNEIO',
    super_final: 'SUPER FINAL (Se Necessário)',
    present_pairs: 'presentes',
    confirmed_pairs: 'confirmadas',
    open_slots: 'Vagas',

    // Referee & Live
    referee_console: 'Súmula do Árbitro',
    live_now: 'AO VIVO AGORA',
    live_match: 'AO VIVO',
    live_scoreboard: 'PLACAR AO VIVO EM TEMPO REAL',
    call_court: 'Chamar pra Quadra',
    service: 'Saque',
    timeout: 'Pedido de Tempo',
    court_swap: 'Troca de Quadra',

    // Podiums & Standings
    champion: 'Campeão',
    runner_up: 'Vice-Campeão',
    third_place: '3º Colocado',
    fourth_place: '4º Colocado',
    position: 'Pos',
    participant: 'Dupla / Atleta',
    situation: 'Situação',
    matches: 'Jogos',
    wins: 'Vitórias',
    losses: 'Derrotas',
    points: 'Pontos',
    point_diff: 'Saldo',
    win_rate: 'Aproveitamento',
    ranking_pts: 'Pts Ranking',

    // Common UI
    close: 'Fechar',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    copy_link: 'Copiar Link',
    copied: 'Copiado!',
    share_whatsapp: 'Compartilhar no WhatsApp',
    open_whatsapp: 'Abrir WhatsApp',
    search: 'Buscar...',
    filter: 'Filtrar',
    categories: 'Categorias',
    all: 'Todos',
    sync_firestore: 'Sincronizar com Firestore',
    connected_firestore: 'Conectado ao Cloud Firestore',
    free_peak_hours: 'Horários de Pico Livres Hoje',
    book_two_clicks: 'Reservar em 2 Cliques',
    partner_arenas: 'Arenas Parceiras',
    classes_open_spots: 'Aulas com Vagas Abertas',
    smart_alerts: 'Central de Alertas & Notificações',
    language: 'Idioma',
    portuguese: 'Português',
    english: 'Inglês',
    new_car: 'Carro novo',
  },
  en: {
    aquarium_pause: 'Pause animation',
    aquarium_play: 'Play animation',
    // App & Identity
    app_subtitle: 'ITS THE SHARK 🦈',
    app_motto: 'The court is yours.',
    app_tagline: 'Your next match starts here',
    tag_tuba: 'THE SHARK IS IN THE HOUSE!',

    // Navigation & Tabs
    home_live: 'Home & Live',
    arenas_classes: 'Arenas & Classes',
    tournaments_bracket: 'Tournaments (Bracket)',
    ranking_board: 'Ranking Board',
    shark_academy: 'Academy & Community',
    doubles_registration: 'Team Registration',
    reserve_now: 'Book Now',
    profile: 'Profile',
    pricing_saas: 'R$ 19.90 Tournament / Arena from R$ 99.90 per month',

    // Tournament & Bracket
    start_bracket: 'START BRACKET',
    share_bracket: 'SHARE BRACKET',
    head_to_head_history: 'H2H HISTORY',
    enroll_participant: 'REGISTER TEAM / PLAYER',
    export_pdf: 'EXPORT PDF',
    export_csv: 'EXPORT CSV',
    print: 'PRINT',
    rules_config: 'Rules & Settings',
    new_tournament: 'CREATE NEW TOURNAMENT',
    pan_zoom_mode: 'Official Bracket (Pan & Zoom)',
    list_mode: 'List View',
    all_stages: 'Full Bracket',
    standings: 'Standings',
    winners_bracket: 'Winners Bracket',
    losers_bracket: 'Losers Bracket (Elimination)',
    semis_and_final: 'Semis & Finals',
    grand_final: 'GRAND FINAL',
    super_final: 'SUPER FINAL (If needed)',
    present_pairs: 'present',
    confirmed_pairs: 'confirmed',
    open_slots: 'Slots',

    // Referee & Live
    referee_console: 'Referee Console',
    live_now: 'LIVE NOW',
    live_match: 'LIVE',
    live_scoreboard: 'REAL-TIME LIVE SCOREBOARD',
    call_court: 'Call to Court',
    service: 'Service',
    timeout: 'Timeout',
    court_swap: 'Court Swap',

    // Podiums & Standings
    champion: 'Champion',
    runner_up: 'Runner-Up',
    third_place: '3rd Place',
    fourth_place: '4th Place',
    position: 'Pos',
    participant: 'Team / Athlete',
    situation: 'Status',
    matches: 'Matches',
    wins: 'Wins',
    losses: 'Losses',
    points: 'Points',
    point_diff: 'Diff',
    win_rate: 'Win Rate',
    ranking_pts: 'Ranking Pts',

    // Common UI
    close: 'Close',
    confirm: 'Confirm',
    cancel: 'Cancel',
    copy_link: 'Copy Link',
    copied: 'Copied!',
    share_whatsapp: 'Share on WhatsApp',
    open_whatsapp: 'Open WhatsApp',
    search: 'Search...',
    filter: 'Filter',
    categories: 'Categories',
    all: 'All',
    sync_firestore: 'Sync with Firestore',
    connected_firestore: 'Connected to Cloud Firestore',
    free_peak_hours: 'Peak Hours Available Today',
    book_two_clicks: 'Book in 2 Clicks',
    partner_arenas: 'Partner Arenas',
    classes_open_spots: 'Classes with Open Spots',
    smart_alerts: 'Smart Alerts & Notifications',
    language: 'Language',
    portuguese: 'Portuguese',
    english: 'English',
    new_car: 'New car',
  },
};

/**
 * Translates a key according to the active locale.
 */
export function translateKey(key: string): string {
  const dict = TRANSLATIONS[currentLocale] || TRANSLATIONS.pt;
  if (dict[key]) {
    return dict[key];
  }
  // Fallback to PT if missing in EN
  if (TRANSLATIONS.pt[key]) {
    return TRANSLATIONS.pt[key];
  }
  // If not found, return human-readable key with underscores replaced
  return key.replace(/_/g, ' ');
}

export const tr = translateKey;
export const t = translateKey;

// Extend String prototype so 'new_car'.tr returns 'Carro novo'
declare global {
  interface String {
    tr: string;
  }
}

if (!Object.prototype.hasOwnProperty.call(String.prototype, 'tr')) {
  Object.defineProperty(String.prototype, 'tr', {
    get(this: string) {
      return translateKey(this);
    },
    configurable: true,
  });
}

