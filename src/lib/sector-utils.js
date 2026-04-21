import { SECTORES } from './constants';
import { translateSector } from './i18n';

export const GENERAL_SECTOR_ID = 'GENERAL';
export const GENERAL_SECTOR = {
  id: GENERAL_SECTOR_ID,
  code: GENERAL_SECTOR_ID,
  nombre: 'General',
  name: 'General',
  icon: '🗂️',
  color: 'from-slate-400 to-slate-600',
  isActive: false,
  sortOrder: 9999,
};
const GENERAL_SECTOR_LABELS = {
  es: 'General',
  en: 'General',
  pt: 'General',
  fr: 'General',
  de: 'General',
  it: 'Generale',
};

const DEFAULT_SECTOR_IDS = new Set(SECTORES.map((sector) => sector.id));
const DEFAULT_SECTOR_NAME_BY_ID = Object.fromEntries(SECTORES.map((sector) => [sector.id, String(sector.nombre || '').trim()]));
const normalizeSectorName = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const prettifySectorCode = (value = '') =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || 'General';

export function normalizeSectorCode(value = '') {
  const safeValue = String(value || '').trim();
  return safeValue || GENERAL_SECTOR_ID;
}

export function getSectorByCode(sectors = [], code = '') {
  const safeCode = normalizeSectorCode(code);
  if (safeCode === GENERAL_SECTOR_ID) return GENERAL_SECTOR;
  return sectors.find((sector) => sector.id === safeCode || sector.code === safeCode) || null;
}

export function getSectorLabel(language, code = '', sectors = []) {
  const safeCode = normalizeSectorCode(code);
  if (safeCode === GENERAL_SECTOR_ID) {
    return GENERAL_SECTOR_LABELS[language] || GENERAL_SECTOR.nombre;
  }

  const sector = getSectorByCode(sectors, code);
  const sectorCode = sector?.id || sector?.code || safeCode;
  const sectorName = String(sector?.name || sector?.nombre || '').trim();
  const defaultName = DEFAULT_SECTOR_NAME_BY_ID[sectorCode];

  if (sectorName) {
    if (!DEFAULT_SECTOR_IDS.has(sectorCode)) {
      return sectorName;
    }

    if (!defaultName || normalizeSectorName(sectorName) !== normalizeSectorName(defaultName)) {
      return sectorName;
    }

    return translateSector(language, sectorCode);
  }

  return translateSector(language, safeCode) || prettifySectorCode(safeCode);
}

export function getSectorIcon(code = '', sectors = []) {
  return getSectorByCode(sectors, code)?.icon || GENERAL_SECTOR.icon;
}

export function isCustomSector(code = '', sectors = []) {
  const sector = getSectorByCode(sectors, code);
  if (!sector) return false;
  return !DEFAULT_SECTOR_IDS.has(sector.id || sector.code);
}

export function buildVisibleSectors(sectors = [], records = []) {
  const sectorMap = new Map(
    sectors.map((sector) => [normalizeSectorCode(sector.id || sector.code), sector]),
  );
  const visibleSectorCodes = new Set(
    sectors
      .filter((sector) => sector.isActive !== false)
      .map((sector) => normalizeSectorCode(sector.id || sector.code)),
  );

  records.forEach((record) => {
    const sectorCode = normalizeSectorCode(record?.sector);
    const hasLeads = Number(record?._count || 1) > 0;
    if (hasLeads) {
      visibleSectorCodes.add(sectorCode);
    }
  });

  return Array.from(visibleSectorCodes)
    .map((sectorCode) => {
      const existingSector = sectorMap.get(sectorCode);
      if (existingSector) {
        return existingSector;
      }

      if (sectorCode === GENERAL_SECTOR_ID) {
        return GENERAL_SECTOR;
      }

      const defaultSector = SECTORES.find((sector) => sector.id === sectorCode);
      if (defaultSector) {
        return {
          ...defaultSector,
          code: defaultSector.id,
          entityId: defaultSector.id,
          isActive: false,
          sortOrder: 999,
        };
      }

      return {
        id: sectorCode,
        code: sectorCode,
        entityId: sectorCode,
        nombre: prettifySectorCode(sectorCode),
        name: prettifySectorCode(sectorCode),
        icon: '📌',
        color: 'from-slate-400 to-slate-600',
        isActive: false,
        sortOrder: 999,
      };
    })
    .sort((left, right) => {
      const leftSort = Number(left.sortOrder) || 0;
      const rightSort = Number(right.sortOrder) || 0;
      if (leftSort !== rightSort) {
        return leftSort - rightSort;
      }

      return String(left.nombre || left.name || '').localeCompare(
        String(right.nombre || right.name || ''),
        'es',
        { sensitivity: 'base' },
      );
    });
}
