export const getSectorStyles = (id) => {
  const styles = {
    CRI: { shadow: 'shadow-neutral-500/60' },
    TRA: { shadow: 'shadow-emerald-500/60' },
    APU: { shadow: 'shadow-purple-500/60' },
    MLM: { shadow: 'shadow-orange-500/60' },
    COA: { shadow: 'shadow-pink-500/60' },
    IA: { shadow: 'shadow-slate-500/60' },
    BIN: { shadow: 'shadow-stone-500/60' },
    FIT: { shadow: 'shadow-red-500/60' },
    MAR: { shadow: 'shadow-yellow-500/60' },
    LID: { shadow: 'shadow-violet-500/60' },
  };

  return styles[id] || { shadow: 'shadow-slate-500/60' };
};

export const normalizePhone = (value = '') => String(value || '').replace(/\D/g, '');

export const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildLeadIdentity = (record = {}) => {
  const phone = normalizePhone(record.numero || record.telefono || record.phone || '');
  if (phone.length >= 8) return `phone:${phone}`;

  const email = normalizeEmail(record.correo || record.email || '');
  if (email) return `email:${email}`;

  const name = normalizeText(record.nombre || record.full_name || record.username || '');
  const sector = String(record.sector || '').trim().toUpperCase();
  const country = String(record.pais || record.country || '').trim().toUpperCase();

  if (name && sector) return `name:${name}|sector:${sector}`;
  if (name && country) return `name:${name}|country:${country}`;
  if (name) return `name:${name}`;

  return null;
};

export const calcularPuntajeLead = (record) => {
  let score = 0;
  if (record.categoria === 'A') score += 40;
  else if (record.categoria === 'B') score += 25;
  else if (record.categoria === 'C') score += 10;
  else if (record.categoria === 'D') score += 5;

  const origenIntencional = ['Formulario web', 'Landing page'];
  const origenIntermedio = ['Facebook Ads', 'Contacto directo'];
  if (origenIntencional.includes(record.origen)) score += 35;
  else if (origenIntermedio.includes(record.origen)) score += 20;
  else score += 10;

  if (record.pais && record.pais !== 'OT') score += 10;
  if (record.nota && record.nota.trim().length > 5) score += 15;

  return Math.min(score, 100);
};

export const getProbabilidadObj = (record) => {
  const score = calcularPuntajeLead(record);
  if (score >= 70) return { nivel: 'Alta', icon: '🔥', textClass: 'text-rose-600', bgClass: 'bg-rose-100', borderClass: 'border-rose-200' };
  if (score >= 40) return { nivel: 'Media', icon: '⚡', textClass: 'text-amber-600', bgClass: 'bg-amber-100', borderClass: 'border-amber-200' };
  return { nivel: 'Baja', icon: '❄️', textClass: 'text-slate-600', bgClass: 'bg-slate-100', borderClass: 'border-slate-200' };
};

export const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};
