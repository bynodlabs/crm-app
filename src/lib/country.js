import { PAISES, PREFIX_TO_ISO } from './constants';

const SORTED_PREFIXES = Object.entries(PREFIX_TO_ISO).sort(
  (a, b) => b[0].replace(/\D/g, '').length - a[0].replace(/\D/g, '').length,
);

export function hasExplicitInternationalPrefix(value) {
  const normalized = String(value || '').trim();
  return normalized.startsWith('+') || normalized.startsWith('00');
}

export function detectCountryCodeFromPhone(value, fallback = 'OT') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;

  const numeric = normalized.replace(/\D/g, '');
  for (const [prefix, iso] of SORTED_PREFIXES) {
    const cleanPrefix = prefix.replace(/\D/g, '');
    if (numeric.startsWith(cleanPrefix)) {
      return iso;
    }
  }

  return fallback;
}

export function normalizeRecordCountry(record) {
  if (!record || !record.numero) {
    return record;
  }

  const numeric = String(record.numero || '').replace(/\D/g, '');
  const detectedCountry = detectCountryCodeFromPhone(record.numero, record.pais || 'OT');
  const currentCountry = record.pais || 'OT';
  const shouldNormalize =
    hasExplicitInternationalPrefix(record.numero) ||
    (numeric.length >= 11 && (currentCountry === 'PE' || currentCountry === 'OT'));

  if (!shouldNormalize || detectedCountry === currentCountry || detectedCountry === 'OT') {
    return record;
  }

  return {
    ...record,
    pais: detectedCountry,
  };
}

export function getRecordCountryCode(record) {
  if (!record) return 'OT';
  return normalizeRecordCountry(record)?.pais || record.pais || 'OT';
}

export function getCountryMetaByCode(code) {
  const normalizedCode = String(code || 'OT').trim().toUpperCase();
  return PAISES.find((country) => country.code === normalizedCode) || { code: 'OT', nombre: 'Otro', flag: '🌐' };
}

export function getCountryMetaForRecord(record) {
  return getCountryMetaByCode(getRecordCountryCode(record));
}
