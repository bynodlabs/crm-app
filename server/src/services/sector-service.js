import { randomUUID } from 'node:crypto';
import { executeQuery, queryRows } from '../db.js';

const DEFAULT_SECTORS = [
  { code: 'CRI', name: 'Crypto', icon: '₿', color: 'from-neutral-700 to-neutral-900', sortOrder: 0 },
  { code: 'TRA', name: 'Trading', icon: '📈', color: 'from-emerald-400 to-emerald-600', sortOrder: 1 },
  { code: 'APU', name: 'Apuestas', icon: '🎲', color: 'from-purple-400 to-purple-600', sortOrder: 2 },
  { code: 'MLM', name: 'Multinivel', icon: '👥', color: 'from-orange-400 to-orange-600', sortOrder: 3 },
  { code: 'COA', name: 'Coaching', icon: '🧠', color: 'from-pink-400 to-pink-600', sortOrder: 4 },
  { code: 'IA', name: 'IA / SaaS', icon: '🤖', color: 'from-slate-600 to-slate-800', sortOrder: 5 },
  { code: 'BIN', name: 'Bienes Raíces', icon: '🏢', color: 'from-stone-400 to-stone-600', sortOrder: 6 },
  { code: 'FIT', name: 'Fitness', icon: '💪', color: 'from-red-400 to-red-600', sortOrder: 7 },
  { code: 'MAR', name: 'E-commerce', icon: '🛒', color: 'from-yellow-400 to-yellow-600', sortOrder: 8 },
  { code: 'LID', name: 'Liderazgo', icon: '⭐', color: 'from-violet-400 to-violet-600', sortOrder: 9 },
];

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const normalizeCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');

const normalizeName = (value = '') => String(value || '').trim();
const normalizeIcon = (value = '') => String(value || '').trim();
const normalizeColor = (value = '') => String(value || '').trim();

const buildSectorCode = (name = '') => {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return normalizeCode(normalized);
};

const mapSectorRow = (row) => ({
  id: row.id,
  workspaceId: row.workspaceId,
  code: row.code,
  name: row.name,
  icon: row.icon,
  color: row.color,
  sortOrder: Number(row.sortOrder) || 0,
  isActive: row.isActive === true || row.isActive === 1 || row.isActive === '1',
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const getExistingCodes = async (workspaceId) => {
  const rows = await queryRows('SELECT `code` FROM `sectors` WHERE `workspaceId` = ?', [workspaceId]);
  return new Set(rows.map((row) => normalizeCode(row.code)));
};

const getNextSortOrder = async (workspaceId) => {
  const rows = await queryRows(
    'SELECT COALESCE(MAX(`sortOrder`), -1) AS maxSortOrder FROM `sectors` WHERE `workspaceId` = ?',
    [workspaceId],
  );
  const maxSortOrder = Number(rows?.[0]?.maxSortOrder);
  return Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : 0;
};

const createUniqueSectorCode = async (workspaceId, name) => {
  const baseCode = buildSectorCode(name) || `SEC_${randomUUID().slice(0, 6).toUpperCase()}`;
  const existingCodes = await getExistingCodes(workspaceId);
  let candidate = baseCode;
  let index = 1;

  while (existingCodes.has(candidate)) {
    candidate = `${baseCode}_${index}`;
    index += 1;
  }

  return candidate;
};

export const sectorService = {
  async ensureDefaultSectors(workspaceId) {
    if (!workspaceId) return;

    const existingCodes = await getExistingCodes(workspaceId);
    const now = nowSql();

    for (const sector of DEFAULT_SECTORS) {
      if (existingCodes.has(sector.code)) continue;

      await executeQuery(
        'INSERT INTO `sectors` (`id`, `workspaceId`, `code`, `name`, `icon`, `color`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [randomUUID(), workspaceId, sector.code, sector.name, sector.icon, sector.color, sector.sortOrder, now, now],
      );
    }
  },

  async listSectors(workspaceId, { includeInactive = false } = {}) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    await this.ensureDefaultSectors(workspaceId);

    const rows = await queryRows(
      `SELECT \`id\`, \`workspaceId\`, \`code\`, \`name\`, \`icon\`, \`color\`, \`sortOrder\`, \`isActive\`, \`createdAt\`, \`updatedAt\`
       FROM \`sectors\`
       WHERE \`workspaceId\` = ? ${includeInactive ? '' : 'AND `isActive` = 1'}
       ORDER BY \`sortOrder\` ASC, \`createdAt\` ASC, \`name\` ASC`,
      [workspaceId],
    );

    return { status: 200, payload: { items: rows.map(mapSectorRow) } };
  },

  async createSector(payload = {}, workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    await this.ensureDefaultSectors(workspaceId);

    const name = normalizeName(payload.name || payload.nombre);
    if (!name) {
      return { status: 400, payload: { error: 'name es obligatorio.' } };
    }

    const code = normalizeCode(payload.code) || await createUniqueSectorCode(workspaceId, name);
    const icon = normalizeIcon(payload.icon) || '✨';
    const color = normalizeColor(payload.color) || 'from-sky-400 to-indigo-500';
    const sortOrder = Number.isFinite(Number(payload.sortOrder))
      ? Math.max(0, Number(payload.sortOrder))
      : await getNextSortOrder(workspaceId);
    const now = nowSql();
    const id = randomUUID();

    const existingRows = await queryRows(
      'SELECT `id` FROM `sectors` WHERE `workspaceId` = ? AND `code` = ? LIMIT 1',
      [workspaceId, code],
    );

    if (existingRows.length > 0) {
      return { status: 409, payload: { error: 'Ya existe un sector con ese código en este workspace.' } };
    }

    await executeQuery(
      'INSERT INTO `sectors` (`id`, `workspaceId`, `code`, `name`, `icon`, `color`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [id, workspaceId, code, name, icon, color, sortOrder, now, now],
    );

    const rows = await queryRows(
      'SELECT `id`, `workspaceId`, `code`, `name`, `icon`, `color`, `sortOrder`, `isActive`, `createdAt`, `updatedAt` FROM `sectors` WHERE `id` = ? LIMIT 1',
      [id],
    );

    return { status: 201, payload: { sector: mapSectorRow(rows[0]) } };
  },

  async deleteSector(sectorId, workspaceId) {
    if (!sectorId || !workspaceId) {
      return { status: 400, payload: { error: 'sectorId y workspaceId son obligatorios.' } };
    }

    const rows = await queryRows(
      'SELECT `id`, `code` FROM `sectors` WHERE `id` = ? AND `workspaceId` = ? LIMIT 1',
      [sectorId, workspaceId],
    );

    if (rows.length === 0) {
      return { status: 404, payload: { error: 'Sector no encontrado.' } };
    }

    await executeQuery(
      'UPDATE `sectors` SET `isActive` = 0, `updatedAt` = ? WHERE `id` = ? AND `workspaceId` = ?',
      [nowSql(), sectorId, workspaceId],
    );

    return { status: 200, payload: { ok: true, sectorId } };
  },
};
