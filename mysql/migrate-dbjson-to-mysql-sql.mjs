import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_JSON_PATH = process.env.DB_JSON_PATH || path.resolve(__dirname, '../server/data/db.json');
const OUTPUT_SQL_PATH = process.env.OUTPUT_SQL_PATH || path.resolve(__dirname, './migration-data.sql');
const DATABASE_NAME = process.env.MYSQL_DATABASE || 'crm_new_2026';
const INSERT_BATCH_SIZE = Number.parseInt(process.env.INSERT_BATCH_SIZE || '500', 10);

const TABLES_IN_DELETE_ORDER = [
  'records_historial',
  'duplicateRecords_historial',
  'sharedLinks_sourceRecordIds',
  'sharedLinks_metrics',
  'sessions',
  'sharedLinks',
  'duplicateRecords',
  'records',
  'users',
  'adminProfile',
];

const sqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\u0000/g, '')}'`;
};

const buildInsert = (table, columns, rows) => {
  if (!rows.length) return '';
  const values = rows
    .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(', ')})`)
    .join(',\n');
  return `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES\n${values};\n`;
};

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const pad = (value) => String(value).padStart(2, '0');

const formatSqlDateTime = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

const normalizeDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const stringValue = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    return `${stringValue} 00:00:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(stringValue)) {
    return stringValue;
  }

  const normalizedIso = stringValue
    .replace('T', ' ')
    .replace(/Z$/, '')
    .replace(/\.\d{1,6}$/, '');

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalizedIso)) {
    return normalizedIso;
  }

  const parsed = new Date(stringValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatSqlDateTime(parsed);
  }

  return null;
};

const main = async () => {
  const db = JSON.parse(await fs.readFile(DB_JSON_PATH, 'utf8'));

  const users = (db.users || []).map((row) => ({
    id: row.id ?? null,
    nombre: row.nombre ?? '',
    email: row.email ?? '',
    password: row.password ?? '',
    codigoPropio: row.codigoPropio ?? '',
    referidoPor: row.referidoPor ?? null,
    fechaRegistro: normalizeDateTime(row.fechaRegistro),
    workspaceId: row.workspaceId ?? '',
    role: row.role ?? '',
    avatarUrl: row.avatarUrl ?? null,
  }));

  const normalizeRecord = (row) => ({
    id: row.id ?? null,
    nombre: row.nombre ?? '',
    pais: row.pais ?? '',
    numero: row.numero ?? '',
    correo: row.correo ?? '',
    sector: row.sector ?? '',
    subsector: row.subsector ?? '',
    origen: row.origen ?? '',
    fechaIngreso: normalizeDateTime(row.fechaIngreso),
    nota: row.nota ?? '',
    categoria: row.categoria ?? '',
    canal: row.canal ?? '',
    estadoProspeccion: row.estadoProspeccion ?? '',
    mensajeEnviado: Boolean(row.mensajeEnviado),
    responsable: row.responsable ?? '',
    propietarioId: row.propietarioId ?? '',
    workspaceId: row.workspaceId ?? '',
    inProspecting: Boolean(row.inProspecting),
    isArchived: Boolean(row.isArchived),
    email: row.email ?? '',
    notes: row.notes ?? '',
    isShared: Boolean(row.isShared),
    sharedAt: normalizeDateTime(row.sharedAt),
    sharedToUserId: row.sharedToUserId ?? null,
    sharedToUserName: row.sharedToUserName ?? null,
    receivedBatchId: row.receivedBatchId ?? null,
    receivedAt: normalizeDateTime(row.receivedAt),
    sharedFromUserId: row.sharedFromUserId ?? null,
    sharedFromUserName: row.sharedFromUserName ?? null,
    sourceRecordId: row.sourceRecordId ?? null,
  });

  const records = (db.records || []).map(normalizeRecord);
  const duplicateRecords = (db.duplicateRecords || []).map(normalizeRecord);

  const flattenHistorial = (rows) =>
    rows.flatMap((row) =>
      (Array.isArray(row.historial) ? row.historial : []).map((historialRow, index) => ({
        recordId: row.id ?? null,
        historial_index: index,
        fecha: normalizeDateTime(historialRow?.fecha),
        accion: historialRow?.accion ?? '',
      })),
    );

  const recordsHistorial = flattenHistorial(db.records || []);
  const duplicateRecordsHistorial = flattenHistorial(db.duplicateRecords || []);

  const sharedLinks = (db.sharedLinks || []).map((row) => ({
    id: row.id ?? null,
    hash: row.hash ?? '',
    date: normalizeDateTime(row.date),
    count: Number.isFinite(row.count) ? row.count : 0,
    teamMemberId: row.teamMemberId ?? '',
    teamMemberName: row.teamMemberName ?? '',
    teamMemberCode: row.teamMemberCode ?? '',
    workspaceId: row.workspaceId ?? '',
  }));

  const sharedLinksMetrics = (db.sharedLinks || []).map((row) => ({
    sharedLinkId: row.id ?? null,
    viewed: Number.isFinite(row?.metrics?.viewed) ? row.metrics.viewed : 0,
    worked: Number.isFinite(row?.metrics?.worked) ? row.metrics.worked : 0,
    contacted: Number.isFinite(row?.metrics?.contacted) ? row.metrics.contacted : 0,
  }));

  const sharedLinksSourceRecordIds = (db.sharedLinks || []).flatMap((row) =>
    (Array.isArray(row.sourceRecordIds) ? row.sourceRecordIds : []).map((sourceRecordId, index) => ({
      sharedLinkId: row.id ?? null,
      sourceRecordId: sourceRecordId ?? '',
      sourceRecordIds_index: index,
    })),
  );

  const sessions = (db.sessions || []).map((row) => ({
    token: row.token ?? null,
    userId: row.userId ?? '',
    role: row.role ?? '',
    createdAt: normalizeDateTime(row.createdAt),
    impersonatedBy: row.impersonatedBy ?? null,
  }));

  const adminProfileRows = db.adminProfile
    ? [
        {
          nombre: db.adminProfile.nombre ?? '',
          avatarUrl: db.adminProfile.avatarUrl ?? '',
        },
      ]
    : [];

  let sql = '';

  sql += `USE \`${DATABASE_NAME}\`;\n\n`;
  sql += 'SET NAMES utf8mb4;\n';
  sql += 'SET FOREIGN_KEY_CHECKS = 0;\n';
  sql += 'START TRANSACTION;\n\n';

  for (const table of TABLES_IN_DELETE_ORDER) {
    sql += `DELETE FROM \`${table}\`;\n`;
  }

  sql += '\n';

  const writeBatches = (table, columns, rows) => {
    for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
      sql += buildInsert(table, columns, batch);
    }
    if (rows.length) sql += '\n';
  };

  writeBatches('adminProfile', ['nombre', 'avatarUrl'], adminProfileRows);
  writeBatches('users', ['id', 'nombre', 'email', 'password', 'codigoPropio', 'referidoPor', 'fechaRegistro', 'workspaceId', 'role', 'avatarUrl'], users);
  writeBatches('records', ['id', 'nombre', 'pais', 'numero', 'correo', 'sector', 'subsector', 'origen', 'fechaIngreso', 'nota', 'categoria', 'canal', 'estadoProspeccion', 'mensajeEnviado', 'responsable', 'propietarioId', 'workspaceId', 'inProspecting', 'isArchived', 'email', 'notes', 'isShared', 'sharedAt', 'sharedToUserId', 'sharedToUserName', 'receivedBatchId', 'receivedAt', 'sharedFromUserId', 'sharedFromUserName', 'sourceRecordId'], records);
  writeBatches('records_historial', ['recordId', 'historial_index', 'fecha', 'accion'], recordsHistorial);
  writeBatches('duplicateRecords', ['id', 'nombre', 'pais', 'numero', 'correo', 'sector', 'subsector', 'origen', 'fechaIngreso', 'nota', 'categoria', 'canal', 'estadoProspeccion', 'mensajeEnviado', 'responsable', 'propietarioId', 'workspaceId', 'inProspecting', 'isArchived', 'email', 'notes', 'isShared', 'sharedAt', 'sharedToUserId', 'sharedToUserName', 'receivedBatchId', 'receivedAt', 'sharedFromUserId', 'sharedFromUserName', 'sourceRecordId'], duplicateRecords);
  writeBatches('duplicateRecords_historial', ['recordId', 'historial_index', 'fecha', 'accion'], duplicateRecordsHistorial);
  writeBatches('sharedLinks', ['id', 'hash', 'date', 'count', 'teamMemberId', 'teamMemberName', 'teamMemberCode', 'workspaceId'], sharedLinks);
  writeBatches('sharedLinks_metrics', ['sharedLinkId', 'viewed', 'worked', 'contacted'], sharedLinksMetrics);
  writeBatches('sharedLinks_sourceRecordIds', ['sharedLinkId', 'sourceRecordId', 'sourceRecordIds_index'], sharedLinksSourceRecordIds);
  writeBatches('sessions', ['token', 'userId', 'role', 'createdAt', 'impersonatedBy'], sessions);

  sql += 'COMMIT;\n';
  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';

  await fs.writeFile(OUTPUT_SQL_PATH, sql, 'utf8');

  console.log(`SQL de migración generado en: ${OUTPUT_SQL_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
