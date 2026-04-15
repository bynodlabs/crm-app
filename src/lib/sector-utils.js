import { SECTORES } from './constants';
import { translateSector } from './i18n';

const DEFAULT_SECTOR_IDS = new Set(SECTORES.map((sector) => sector.id));

export function getSectorByCode(sectors = [], code = '') {
  const safeCode = String(code || '').trim();
  if (!safeCode) return null;
  return sectors.find((sector) => sector.id === safeCode || sector.code === safeCode) || null;
}

export function getSectorLabel(language, code = '', sectors = []) {
  const sector = getSectorByCode(sectors, code);

  if (sector && DEFAULT_SECTOR_IDS.has(sector.id || sector.code)) {
    return translateSector(language, sector.id || sector.code);
  }

  if (sector?.name) return sector.name;
  if (sector?.nombre) return sector.nombre;

  return translateSector(language, code);
}

export function getSectorIcon(code = '', sectors = []) {
  return getSectorByCode(sectors, code)?.icon || '📌';
}

export function isCustomSector(code = '', sectors = []) {
  const sector = getSectorByCode(sectors, code);
  if (!sector) return false;
  return !DEFAULT_SECTOR_IDS.has(sector.id || sector.code);
}
