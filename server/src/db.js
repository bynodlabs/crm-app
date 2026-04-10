import mysql from 'mysql2/promise';
import { config } from './config.js';
import {
  createUniqueUserCode,
  createUniqueUserId,
  createUniqueWorkspaceId,
  createWorkspaceId,
  hashPassword,
  isPasswordHashed,
  normalizeEmail,
} from './utils.js';

const DEFAULT_DB = {
  adminProfile: {
    nombre: 'Admin Maestro',
    avatarUrl: '',
  },
  users: [],
  records: [],
  duplicateRecords: [],
  sharedLinks: [],
  sessions: [],
};

const normalizeLooseText = (value) => String(value || '').trim().toLowerCase();
const normalizeLeadNumber = (value) => String(value || '').replace(/\D+/g, '');
const hasInvalidHistoryDate = (record) =>
  (record.historial || []).some((entry) => String(entry?.fecha || '').includes('NaN-NaN-NaN'));

const isHeaderLeakRecord = (record) => {
  const nombre = normalizeLooseText(record.nombre);
  const correo = normalizeLooseText(record.correo || record.email);
  const nota = normalizeLooseText(record.nota || record.notes);

  return nombre === 'nombre' || correo === 'ciudad' || nota === 'fuente';
};

const shouldDropMalformedLead = (record) => {
  const phone = normalizeLeadNumber(record.numero || record.telefono || record.phone || record.whatsapp);
  return !phone && isHeaderLeakRecord(record);
};

const sanitizeLeadCollection = (items = [], { dedupeById = false } = {}) => {
  const seenIds = new Set();
  let didChange = false;
  const sanitized = [];

  for (const record of items || []) {
    if (!record || typeof record !== 'object') {
      didChange = true;
      continue;
    }

    if (shouldDropMalformedLead(record)) {
      didChange = true;
      continue;
    }

    const nextRecord = { ...record };

    if (hasInvalidHistoryDate(nextRecord)) {
      nextRecord.historial = (nextRecord.historial || []).filter(
        (entry) => !String(entry?.fecha || '').includes('NaN-NaN-NaN'),
      );
      didChange = true;
    }

    const normalizedId = String(nextRecord.id || '').trim();
    if (dedupeById && normalizedId) {
      if (seenIds.has(normalizedId)) {
        didChange = true;
        continue;
      }
      seenIds.add(normalizedId);
    }

    sanitized.push(nextRecord);
  }

  return { items: sanitized, didChange };
};

const pad = (value) => String(value).padStart(2, '0');

const formatSqlDateTime = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

const toSqlDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

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

const fromSqlDateOnly = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

const fromSqlDateTime = (value) => {
  if (!value) return '';
  const normalized = String(value).replace(' ', 'T').replace(/\.\d+$/, '');
  return normalized.includes('T') ? normalized : `${normalized}T00:00:00`;
};

const toBoolean = (value) => value === true || value === 1 || value === '1';

let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysqlHost,
      port: config.mysqlPort,
      user: config.mysqlUser,
      password: config.mysqlPassword,
      database: config.mysqlDatabase,
      waitForConnections: true,
      connectionLimit: config.mysqlConnectionLimit,
      namedPlaceholders: false,
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true,
    });
  }

  return pool;
};

const withTransaction = async (work) => {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const queryRows = async (sql, params = []) => {
  const [rows] = await getPool().query(sql, params);
  return rows;
};

const chunk = (items, size = 250) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const insertRows = async (connection, table, columns, rows) => {
  if (!rows.length) return;

  for (const batch of chunk(rows, 250)) {
    const placeholders = batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const values = batch.flatMap((row) => columns.map((column) => row[column] ?? null));
    await connection.query(
      `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES ${placeholders}`,
      values,
    );
  }
};

const maybeAssign = (target, key, value, predicate = value !== null && value !== undefined && value !== '') => {
  if (predicate) {
    target[key] = value;
  }
};

const mapRecordRow = (row) => {
  const record = {
    id: row.id ?? null,
    nombre: row.nombre ?? 'Sin nombre',
    pais: row.pais ?? 'OT',
    numero: row.numero ?? '',
    correo: row.correo ?? '',
    sector: row.sector ?? 'General',
    subsector: row.subsector ?? '',
    origen: row.origen ?? '',
    fechaIngreso: fromSqlDateOnly(row.fechaIngreso),
    nota: row.nota ?? '',
    categoria: row.categoria ?? '',
    canal: row.canal ?? '',
    estadoProspeccion: row.estadoProspeccion ?? 'Nuevo',
    mensajeEnviado: toBoolean(row.mensajeEnviado),
    responsable: row.responsable ?? 'Sin Asignar',
    propietarioId: row.propietarioId ?? null,
    workspaceId: row.workspaceId ?? null,
    inProspecting: toBoolean(row.inProspecting),
    isArchived: toBoolean(row.isArchived),
    email: row.email ?? '',
    notes: row.notes ?? '',
    historial: [],
  };

  maybeAssign(record, 'sourceRecordId', row.sourceRecordId);
  maybeAssign(record, 'isShared', true, toBoolean(row.isShared));
  maybeAssign(record, 'sharedAt', fromSqlDateTime(row.sharedAt), row.sharedAt);
  maybeAssign(record, 'sharedToUserId', row.sharedToUserId);
  maybeAssign(record, 'sharedToUserName', row.sharedToUserName);
  maybeAssign(record, 'receivedBatchId', row.receivedBatchId);
  maybeAssign(record, 'receivedAt', fromSqlDateTime(row.receivedAt), row.receivedAt);
  maybeAssign(record, 'sharedFromUserId', row.sharedFromUserId);
  maybeAssign(record, 'sharedFromUserName', row.sharedFromUserName);

  return record;
};

const mapSharedLinkRow = (row) => ({
  id: row.id ?? null,
  hash: row.hash ?? '',
  date: fromSqlDateTime(row.date),
  count: Number.isFinite(row.count) ? row.count : Number(row.count) || 0,
  teamMemberId: row.teamMemberId ?? null,
  teamMemberName: row.teamMemberName ?? 'ALL',
  teamMemberCode: row.teamMemberCode ?? null,
  sourceRecordIds: [],
  metrics: {
    viewed: 0,
    worked: 0,
    contacted: 0,
  },
  workspaceId: row.workspaceId ?? null,
});

const loadDbSnapshot = async () => {
  const [
    adminProfileRows,
    userRows,
    recordRows,
    recordHistoryRows,
    duplicateRecordRows,
    duplicateHistoryRows,
    sharedLinkRows,
    sharedLinkMetricsRows,
    sharedLinkSourceRows,
    sessionRows,
  ] = await Promise.all([
    queryRows('SELECT `nombre`, `avatarUrl` FROM `adminProfile` LIMIT 1'),
    queryRows('SELECT `id`, `nombre`, `email`, `password`, `codigoPropio`, `referidoPor`, `fechaRegistro`, `workspaceId`, `role`, `avatarUrl` FROM `users` ORDER BY `fechaRegistro` ASC, `id` ASC'),
    queryRows('SELECT `id`, `nombre`, `pais`, `numero`, `correo`, `sector`, `subsector`, `origen`, `fechaIngreso`, `nota`, `categoria`, `canal`, `estadoProspeccion`, `mensajeEnviado`, `responsable`, `propietarioId`, `workspaceId`, `inProspecting`, `isArchived`, `email`, `notes`, `isShared`, `sharedAt`, `sharedToUserId`, `sharedToUserName`, `receivedBatchId`, `receivedAt`, `sharedFromUserId`, `sharedFromUserName`, `sourceRecordId` FROM `records` ORDER BY `fechaIngreso` DESC, `id` DESC'),
    queryRows('SELECT `recordId`, `historial_index`, `fecha`, `accion` FROM `records_historial` ORDER BY `recordId` ASC, `historial_index` ASC'),
    queryRows('SELECT `id`, `nombre`, `pais`, `numero`, `correo`, `sector`, `subsector`, `origen`, `fechaIngreso`, `nota`, `categoria`, `canal`, `estadoProspeccion`, `mensajeEnviado`, `responsable`, `propietarioId`, `workspaceId`, `inProspecting`, `isArchived`, `email`, `notes`, `isShared`, `sharedAt`, `sharedToUserId`, `sharedToUserName`, `receivedBatchId`, `receivedAt`, `sharedFromUserId`, `sharedFromUserName`, `sourceRecordId` FROM `duplicateRecords` ORDER BY `fechaIngreso` DESC, `id` DESC'),
    queryRows('SELECT `recordId`, `historial_index`, `fecha`, `accion` FROM `duplicateRecords_historial` ORDER BY `recordId` ASC, `historial_index` ASC'),
    queryRows('SELECT `id`, `hash`, `date`, `count`, `teamMemberId`, `teamMemberName`, `teamMemberCode`, `workspaceId` FROM `sharedLinks` ORDER BY `date` DESC, `id` DESC'),
    queryRows('SELECT `sharedLinkId`, `viewed`, `worked`, `contacted` FROM `sharedLinks_metrics`'),
    queryRows('SELECT `sharedLinkId`, `sourceRecordId`, `sourceRecordIds_index` FROM `sharedLinks_sourceRecordIds` ORDER BY `sharedLinkId` ASC, `sourceRecordIds_index` ASC'),
    queryRows('SELECT `token`, `userId`, `role`, `createdAt`, `impersonatedBy` FROM `sessions` ORDER BY `createdAt` DESC, `token` DESC'),
  ]);

  const records = recordRows.map(mapRecordRow);
  const recordsById = new Map(records.map((record) => [record.id, record]));
  for (const row of recordHistoryRows) {
    const record = recordsById.get(row.recordId);
    if (!record) continue;
    record.historial.push({
      fecha: fromSqlDateTime(row.fecha),
      accion: row.accion ?? '',
    });
  }

  const duplicateRecords = duplicateRecordRows.map(mapRecordRow);
  const duplicateRecordsById = new Map(duplicateRecords.map((record) => [record.id, record]));
  for (const row of duplicateHistoryRows) {
    const record = duplicateRecordsById.get(row.recordId);
    if (!record) continue;
    record.historial.push({
      fecha: fromSqlDateTime(row.fecha),
      accion: row.accion ?? '',
    });
  }

  const sharedLinks = sharedLinkRows.map(mapSharedLinkRow);
  const sharedLinksById = new Map(sharedLinks.map((link) => [link.id, link]));

  for (const row of sharedLinkMetricsRows) {
    const link = sharedLinksById.get(row.sharedLinkId);
    if (!link) continue;
    link.metrics = {
      viewed: Number(row.viewed) || 0,
      worked: Number(row.worked) || 0,
      contacted: Number(row.contacted) || 0,
    };
  }

  for (const row of sharedLinkSourceRows) {
    const link = sharedLinksById.get(row.sharedLinkId);
    if (!link) continue;
    link.sourceRecordIds.push(row.sourceRecordId ?? '');
  }

  const sessions = sessionRows.map((row) => ({
    token: row.token ?? null,
    userId: row.userId ?? '',
    role: row.role ?? '',
    createdAt: fromSqlDateTime(row.createdAt),
    impersonatedBy: row.impersonatedBy ?? null,
  }));

  const users = userRows.map((row) => {
    const user = {
      id: row.id ?? null,
      nombre: row.nombre ?? '',
      email: row.email ?? '',
      password: row.password ?? '',
      codigoPropio: row.codigoPropio ?? '',
      referidoPor: row.referidoPor ?? null,
      fechaRegistro: fromSqlDateOnly(row.fechaRegistro),
      workspaceId: row.workspaceId ?? '',
      role: row.role ?? '',
    };
    maybeAssign(user, 'avatarUrl', row.avatarUrl);
    return user;
  });

  const adminProfile = adminProfileRows[0]
    ? {
        nombre: adminProfileRows[0].nombre ?? DEFAULT_DB.adminProfile.nombre,
        avatarUrl: adminProfileRows[0].avatarUrl ?? '',
      }
    : { ...DEFAULT_DB.adminProfile };

  return {
    adminProfile,
    users,
    records,
    duplicateRecords,
    sharedLinks,
    sessions,
  };
};

export async function readDb() {
  const db = await loadDbSnapshot();
  let didChange = false;

  const defaultWorkspaceId = db.users[0]?.workspaceId || createWorkspaceId('DEFAULT');
  const workspaceByUserId = new Map();
  const adminEmail = normalizeEmail(config.adminEmail);

  const sanitizedRecords = sanitizeLeadCollection(db.records || []);
  if (sanitizedRecords.didChange) {
    db.records = sanitizedRecords.items;
    didChange = true;
  }

  const sanitizedDuplicateRecords = sanitizeLeadCollection(db.duplicateRecords || [], { dedupeById: true });
  if (sanitizedDuplicateRecords.didChange) {
    db.duplicateRecords = sanitizedDuplicateRecords.items;
    didChange = true;
  }

  if (!db.adminProfile || typeof db.adminProfile !== 'object') {
    db.adminProfile = { ...DEFAULT_DB.adminProfile };
    didChange = true;
  } else {
    const normalizedAdminProfile = {
      nombre: String(db.adminProfile.nombre || DEFAULT_DB.adminProfile.nombre).trim() || DEFAULT_DB.adminProfile.nombre,
      avatarUrl: typeof db.adminProfile.avatarUrl === 'string' ? db.adminProfile.avatarUrl.trim() : '',
    };

    if (
      normalizedAdminProfile.nombre !== db.adminProfile.nombre ||
      normalizedAdminProfile.avatarUrl !== db.adminProfile.avatarUrl
    ) {
      db.adminProfile = normalizedAdminProfile;
      didChange = true;
    }
  }

  const originalUsersLength = (db.users || []).length;
  db.users = (db.users || []).filter((user) => normalizeEmail(user.email || '') !== adminEmail);
  if (db.users.length !== originalUsersLength) {
    didChange = true;
  }

  const seenEmails = new Set();
  const seenUserIds = new Set(['U1', 'ADMIN_CLEAN']);
  const seenWorkspaceIds = new Set(['WS-U1']);
  const seenUserCodes = new Set(['ANA-9X2']);
  const droppedUserIds = new Set();
  const previousIdByEmail = new Map();
  const previousWorkspaceByEmail = new Map();

  db.users = (db.users || []).reduce((acc, user) => {
    let nextUser = { ...user };
    const normalizedUserEmail = normalizeEmail(user.email || '');

    if (!normalizedUserEmail) {
      didChange = true;
      if (user.id) droppedUserIds.add(String(user.id));
      return acc;
    }

    if (user.email !== normalizedUserEmail) {
      nextUser.email = normalizedUserEmail;
      didChange = true;
    }

    if (nextUser.password && !isPasswordHashed(nextUser.password)) {
      nextUser.password = hashPassword(nextUser.password);
      didChange = true;
    }

    if (seenEmails.has(normalizedUserEmail)) {
      didChange = true;
      if (user.id) droppedUserIds.add(String(user.id));
      return acc;
    }

    const originalId = String(nextUser.id || '').trim();
    let userId = originalId;
    if (!userId || seenUserIds.has(userId)) {
      userId = createUniqueUserId([...seenUserIds]);
      didChange = true;
    }

    const originalWorkspaceId = String(nextUser.workspaceId || '').trim();
    let workspaceId = originalWorkspaceId;
    if (!workspaceId || seenWorkspaceIds.has(workspaceId)) {
      workspaceId = createUniqueWorkspaceId([...seenWorkspaceIds], userId);
      didChange = true;
    }

    const originalCode = String(nextUser.codigoPropio || '').trim().toUpperCase();
    let codigoPropio = originalCode;
    if (!codigoPropio || seenUserCodes.has(codigoPropio)) {
      codigoPropio = createUniqueUserCode(nextUser.nombre || 'USR', [...seenUserCodes]);
      didChange = true;
    }

    nextUser = {
      ...nextUser,
      id: userId,
      workspaceId,
      codigoPropio,
    };

    seenEmails.add(normalizedUserEmail);
    seenUserIds.add(userId);
    seenWorkspaceIds.add(workspaceId);
    seenUserCodes.add(codigoPropio);
    previousIdByEmail.set(normalizedUserEmail, originalId);
    previousWorkspaceByEmail.set(normalizedUserEmail, originalWorkspaceId);
    workspaceByUserId.set(userId, workspaceId);
    acc.push(nextUser);
    return acc;
  }, []);

  const remapUserId = (recordUserId) => {
    const normalizedRecordUserId = String(recordUserId || '').trim();
    if (!normalizedRecordUserId) return normalizedRecordUserId;
    if (droppedUserIds.has(normalizedRecordUserId)) return '';
    return normalizedRecordUserId;
  };

  const remapWorkspaceId = (recordWorkspaceId, ownerId) => {
    const normalizedWorkspaceId = String(recordWorkspaceId || '').trim();
    if (ownerId && workspaceByUserId.has(ownerId)) {
      return workspaceByUserId.get(ownerId);
    }
    if (normalizedWorkspaceId && seenWorkspaceIds.has(normalizedWorkspaceId)) {
      return normalizedWorkspaceId;
    }
    return defaultWorkspaceId;
  };

  db.records = (db.records || []).map((record) => {
    const propietarioId = remapUserId(record.propietarioId);
    const workspaceId = remapWorkspaceId(record.workspaceId, propietarioId);

    if (propietarioId !== record.propietarioId || workspaceId !== record.workspaceId) {
      didChange = true;
    }

    return {
      ...record,
      propietarioId,
      workspaceId,
    };
  });

  db.duplicateRecords = (db.duplicateRecords || []).map((record) => {
    const propietarioId = remapUserId(record.propietarioId);
    const workspaceId = remapWorkspaceId(record.workspaceId, propietarioId);

    if (propietarioId !== record.propietarioId || workspaceId !== record.workspaceId) {
      didChange = true;
    }

    return {
      ...record,
      propietarioId,
      workspaceId,
    };
  });

  db.sharedLinks = (db.sharedLinks || []).map((link) => {
    const propietarioId = remapUserId(link.ownerId || link.propietarioId);
    const workspaceId = remapWorkspaceId(link.workspaceId, propietarioId);
    if (workspaceId !== link.workspaceId) {
      didChange = true;
    }
    return { ...link, workspaceId };
  });

  db.sessions = (db.sessions || []).filter((session) => {
    if (session.userId === 'ADMIN_CLEAN') return true;
    if (!session.userId) return false;
    const keep = db.users.some((user) => user.id === session.userId);
    if (!keep) {
      didChange = true;
    }
    return keep;
  });

  if (didChange) {
    await writeDb(db);
  }

  return db;
}

export async function writeDb(nextDb) {
  const db = {
    adminProfile: {
      nombre: String(nextDb?.adminProfile?.nombre || DEFAULT_DB.adminProfile.nombre).trim() || DEFAULT_DB.adminProfile.nombre,
      avatarUrl: typeof nextDb?.adminProfile?.avatarUrl === 'string' ? nextDb.adminProfile.avatarUrl.trim() : '',
    },
    users: Array.isArray(nextDb?.users) ? nextDb.users : [],
    records: Array.isArray(nextDb?.records) ? nextDb.records : [],
    duplicateRecords: Array.isArray(nextDb?.duplicateRecords) ? nextDb.duplicateRecords : [],
    sharedLinks: Array.isArray(nextDb?.sharedLinks) ? nextDb.sharedLinks : [],
    sessions: Array.isArray(nextDb?.sessions) ? nextDb.sessions : [],
  };

  await withTransaction(async (connection) => {
    await connection.query('DELETE FROM `records_historial`');
    await connection.query('DELETE FROM `duplicateRecords_historial`');
    await connection.query('DELETE FROM `sharedLinks_sourceRecordIds`');
    await connection.query('DELETE FROM `sharedLinks_metrics`');
    await connection.query('DELETE FROM `sessions`');
    await connection.query('DELETE FROM `sharedLinks`');
    await connection.query('DELETE FROM `duplicateRecords`');
    await connection.query('DELETE FROM `records`');
    await connection.query('DELETE FROM `users`');
    await connection.query('DELETE FROM `adminProfile`');

    await insertRows(connection, 'adminProfile', ['nombre', 'avatarUrl'], [db.adminProfile]);

    await insertRows(
      connection,
      'users',
      ['id', 'nombre', 'email', 'password', 'codigoPropio', 'referidoPor', 'fechaRegistro', 'workspaceId', 'role', 'avatarUrl'],
      db.users.map((user) => ({
        id: user.id ?? null,
        nombre: user.nombre ?? '',
        email: user.email ?? '',
        password: user.password ?? '',
        codigoPropio: user.codigoPropio ?? '',
        referidoPor: user.referidoPor ?? null,
        fechaRegistro: toSqlDateTime(user.fechaRegistro),
        workspaceId: user.workspaceId ?? '',
        role: user.role ?? '',
        avatarUrl: user.avatarUrl ?? null,
      })),
    );

    await insertRows(
      connection,
      'records',
      ['id', 'nombre', 'pais', 'numero', 'correo', 'sector', 'subsector', 'origen', 'fechaIngreso', 'nota', 'categoria', 'canal', 'estadoProspeccion', 'mensajeEnviado', 'responsable', 'propietarioId', 'workspaceId', 'inProspecting', 'isArchived', 'email', 'notes', 'isShared', 'sharedAt', 'sharedToUserId', 'sharedToUserName', 'receivedBatchId', 'receivedAt', 'sharedFromUserId', 'sharedFromUserName', 'sourceRecordId'],
      db.records.map((record) => ({
        id: record.id ?? null,
        nombre: record.nombre ?? '',
        pais: record.pais ?? '',
        numero: record.numero ?? '',
        correo: record.correo ?? '',
        sector: record.sector ?? '',
        subsector: record.subsector ?? '',
        origen: record.origen ?? '',
        fechaIngreso: toSqlDateTime(record.fechaIngreso),
        nota: record.nota ?? '',
        categoria: record.categoria ?? '',
        canal: record.canal ?? '',
        estadoProspeccion: record.estadoProspeccion ?? '',
        mensajeEnviado: Boolean(record.mensajeEnviado),
        responsable: record.responsable ?? '',
        propietarioId: record.propietarioId ?? '',
        workspaceId: record.workspaceId ?? '',
        inProspecting: Boolean(record.inProspecting),
        isArchived: Boolean(record.isArchived),
        email: record.email ?? '',
        notes: record.notes ?? '',
        isShared: Boolean(record.isShared),
        sharedAt: toSqlDateTime(record.sharedAt),
        sharedToUserId: record.sharedToUserId ?? null,
        sharedToUserName: record.sharedToUserName ?? null,
        receivedBatchId: record.receivedBatchId ?? null,
        receivedAt: toSqlDateTime(record.receivedAt),
        sharedFromUserId: record.sharedFromUserId ?? null,
        sharedFromUserName: record.sharedFromUserName ?? null,
        sourceRecordId: record.sourceRecordId ?? null,
      })),
    );

    await insertRows(
      connection,
      'records_historial',
      ['recordId', 'historial_index', 'fecha', 'accion'],
      db.records.flatMap((record) =>
        (Array.isArray(record.historial) ? record.historial : []).map((entry, index) => ({
          recordId: record.id ?? null,
          historial_index: index,
          fecha: toSqlDateTime(entry?.fecha),
          accion: entry?.accion ?? '',
        })),
      ),
    );

    await insertRows(
      connection,
      'duplicateRecords',
      ['id', 'nombre', 'pais', 'numero', 'correo', 'sector', 'subsector', 'origen', 'fechaIngreso', 'nota', 'categoria', 'canal', 'estadoProspeccion', 'mensajeEnviado', 'responsable', 'propietarioId', 'workspaceId', 'inProspecting', 'isArchived', 'email', 'notes', 'isShared', 'sharedAt', 'sharedToUserId', 'sharedToUserName', 'receivedBatchId', 'receivedAt', 'sharedFromUserId', 'sharedFromUserName', 'sourceRecordId'],
      db.duplicateRecords.map((record) => ({
        id: record.id ?? null,
        nombre: record.nombre ?? '',
        pais: record.pais ?? '',
        numero: record.numero ?? '',
        correo: record.correo ?? '',
        sector: record.sector ?? '',
        subsector: record.subsector ?? '',
        origen: record.origen ?? '',
        fechaIngreso: toSqlDateTime(record.fechaIngreso),
        nota: record.nota ?? '',
        categoria: record.categoria ?? '',
        canal: record.canal ?? '',
        estadoProspeccion: record.estadoProspeccion ?? '',
        mensajeEnviado: Boolean(record.mensajeEnviado),
        responsable: record.responsable ?? '',
        propietarioId: record.propietarioId ?? '',
        workspaceId: record.workspaceId ?? '',
        inProspecting: Boolean(record.inProspecting),
        isArchived: Boolean(record.isArchived),
        email: record.email ?? '',
        notes: record.notes ?? '',
        isShared: Boolean(record.isShared),
        sharedAt: toSqlDateTime(record.sharedAt),
        sharedToUserId: record.sharedToUserId ?? null,
        sharedToUserName: record.sharedToUserName ?? null,
        receivedBatchId: record.receivedBatchId ?? null,
        receivedAt: toSqlDateTime(record.receivedAt),
        sharedFromUserId: record.sharedFromUserId ?? null,
        sharedFromUserName: record.sharedFromUserName ?? null,
        sourceRecordId: record.sourceRecordId ?? null,
      })),
    );

    await insertRows(
      connection,
      'duplicateRecords_historial',
      ['recordId', 'historial_index', 'fecha', 'accion'],
      db.duplicateRecords.flatMap((record) =>
        (Array.isArray(record.historial) ? record.historial : []).map((entry, index) => ({
          recordId: record.id ?? null,
          historial_index: index,
          fecha: toSqlDateTime(entry?.fecha),
          accion: entry?.accion ?? '',
        })),
      ),
    );

    await insertRows(
      connection,
      'sharedLinks',
      ['id', 'hash', 'date', 'count', 'teamMemberId', 'teamMemberName', 'teamMemberCode', 'workspaceId'],
      db.sharedLinks.map((link) => ({
        id: link.id ?? null,
        hash: link.hash ?? '',
        date: toSqlDateTime(link.date),
        count: Number.isFinite(link.count) ? link.count : Number(link.count) || 0,
        teamMemberId: link.teamMemberId ?? null,
        teamMemberName: link.teamMemberName ?? 'ALL',
        teamMemberCode: link.teamMemberCode ?? null,
        workspaceId: link.workspaceId ?? '',
      })),
    );

    await insertRows(
      connection,
      'sharedLinks_metrics',
      ['sharedLinkId', 'viewed', 'worked', 'contacted'],
      db.sharedLinks.map((link) => ({
        sharedLinkId: link.id ?? null,
        viewed: Number(link?.metrics?.viewed) || 0,
        worked: Number(link?.metrics?.worked) || 0,
        contacted: Number(link?.metrics?.contacted) || 0,
      })),
    );

    await insertRows(
      connection,
      'sharedLinks_sourceRecordIds',
      ['sharedLinkId', 'sourceRecordId', 'sourceRecordIds_index'],
      db.sharedLinks.flatMap((link) =>
        (Array.isArray(link.sourceRecordIds) ? link.sourceRecordIds : []).map((sourceRecordId, index) => ({
          sharedLinkId: link.id ?? null,
          sourceRecordId: sourceRecordId ?? '',
          sourceRecordIds_index: index,
        })),
      ),
    );

    await insertRows(
      connection,
      'sessions',
      ['token', 'userId', 'role', 'createdAt', 'impersonatedBy'],
      db.sessions.map((session) => ({
        token: session.token ?? null,
        userId: session.userId ?? '',
        role: session.role ?? '',
        createdAt: toSqlDateTime(session.createdAt),
        impersonatedBy: session.impersonatedBy ?? null,
      })),
    );
  });
}
