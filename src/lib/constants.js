export const SECTORES = [
  { id: 'CRI', nombre: 'Crypto', icon: '₿', color: 'from-neutral-700 to-neutral-900' },
  { id: 'TRA', nombre: 'Trading', icon: '📈', color: 'from-emerald-400 to-emerald-600' },
  { id: 'APU', nombre: 'Apuestas', icon: '🎲', color: 'from-purple-400 to-purple-600' },
  { id: 'MLM', nombre: 'Multinivel', icon: '👥', color: 'from-orange-400 to-orange-600' },
  { id: 'COA', nombre: 'Coaching', icon: '🧠', color: 'from-pink-400 to-pink-600' },
  { id: 'IA', nombre: 'IA / SaaS', icon: '🤖', color: 'from-slate-600 to-slate-800' },
  { id: 'BIN', nombre: 'Bienes Raíces', icon: '🏢', color: 'from-stone-400 to-stone-600' },
  { id: 'FIT', nombre: 'Fitness', icon: '💪', color: 'from-red-400 to-red-600' },
  { id: 'MAR', nombre: 'E-commerce', icon: '🛒', color: 'from-yellow-400 to-yellow-600' },
  { id: 'LID', nombre: 'Liderazgo', icon: '⭐', color: 'from-violet-400 to-violet-600' },
];

export const PAISES = [
  { code: 'PE', nombre: 'Perú', flag: '🇵🇪' }, { code: 'MX', nombre: 'México', flag: '🇲🇽' },
  { code: 'CO', nombre: 'Colombia', flag: '🇨🇴' }, { code: 'AR', nombre: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', nombre: 'Chile', flag: '🇨🇱' }, { code: 'ES', nombre: 'España', flag: '🇪🇸' },
  { code: 'US', nombre: 'Estados Unidos', flag: '🇺🇸' }, { code: 'VE', nombre: 'Venezuela', flag: '🇻🇪' },
  { code: 'EC', nombre: 'Ecuador', flag: '🇪🇨' }, { code: 'BO', nombre: 'Bolivia', flag: '🇧🇴' },
  { code: 'PY', nombre: 'Paraguay', flag: '🇵🇾' }, { code: 'UY', nombre: 'Uruguay', flag: '🇺🇾' },
  { code: 'BR', nombre: 'Brasil', flag: '🇧🇷' }, { code: 'PA', nombre: 'Panamá', flag: '🇵🇦' },
  { code: 'CR', nombre: 'Costa Rica', flag: '🇨🇷' }, { code: 'HN', nombre: 'Honduras', flag: '🇭🇳' },
  { code: 'SV', nombre: 'El Salvador', flag: '🇸🇻' }, { code: 'GT', nombre: 'Guatemala', flag: '🇬🇹' },
  { code: 'DO', nombre: 'R. Dominicana', flag: '🇩🇴' },
  { code: 'OT', nombre: 'Otro', flag: '🌐' },
];

export const ORIGENES = [
  'Canal de Telegram',
  'Grupo de WhatsApp',
  'Facebook Ads',
  'Landing page',
  'Formulario web',
  'Contacto directo',
  'Instagram Scraping',
];

export const ESTADOS_PROSPECCION = [
  { id: 'Nuevo', color: 'bg-[#FF5A1F]', bgLight: 'bg-[#FFF0EB]', text: 'text-[#FF5A1F]', border: 'border-orange-200' },
  { id: 'En prospección', color: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { id: 'Archivado', color: 'bg-slate-500', bgLight: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  { id: 'Descartado', color: 'bg-rose-500', bgLight: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { id: 'Liquidado', color: 'bg-slate-900', bgLight: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-300' },
];

export const PREFIX_TO_ISO = {
  '+51': 'PE',
  '+52': 'MX',
  '+57': 'CO',
  '+54': 'AR',
  '+56': 'CL',
  '+34': 'ES',
  '+1': 'US',
  '+58': 'VE',
  '+593': 'EC',
  '+591': 'BO',
  '+595': 'PY',
  '+598': 'UY',
  '+55': 'BR',
  '+507': 'PA',
  '+506': 'CR',
  '+504': 'HN',
  '+503': 'SV',
  '+502': 'GT',
  '+1809': 'DO',
  '+1829': 'DO',
  '+1849': 'DO',
};

export const INITIAL_USERS = [
  { id: 'ADMIN_CLEAN', nombre: 'Admin Maestro', email: 'admin@bigdata.com', password: 'bigdata@', codigoPropio: 'ANA-9X2', referidoPor: null, fechaRegistro: '2025-10-01', workspaceId: 'WS-U1', rol: 'admin' },
];

export const STORAGE_KEYS = {
  language: 'crm_lang',
  usersDb: 'crm_users_db',
  sessionToken: 'crm_session_token',
  currentUser: 'crm_current_user',
  sectors: 'crm_sectors',
  adminReturnData: 'crm_admin_return_data',
  profileOverrides: 'crm_profile_overrides',
  isDarkMode: 'crm_is_dark_mode',
  sidebarCollapsed: 'crm_sidebar_collapsed',
  activeTab: 'crm_active_tab',
  records: 'crm_records',
  globalSectorFilter: 'crm_global_sector_filter',
  duplicateRecords: 'crm_duplicate_records',
  sharedLinks: 'crm_shared_links',
  waTemplate: 'crm_wa_template',
};
