import { readDb, writeDb } from '../db.js';
import { buildRecordIdentity, createRecordId, normalizePhone, nowIso } from '../utils.js';

const withHistory = (record, action) => ({
  ...record,
  historial: [{ fecha: nowIso(), accion: action }, ...(record.historial || [])],
});

const isLiquidatedStatus = (status) => status === 'Liquidado';
const isDiscardedStatus = (status) => status === 'Descartado';
const isArchivedStatus = (record) => (record.estadoProspeccion === 'Archivado' || record.isArchived) && !isDiscardedStatus(record.estadoProspeccion) && !isLiquidatedStatus(record.estadoProspeccion);
const countsAsProspecting = (status) => status !== 'Nuevo' && !isDiscardedStatus(status) && !isLiquidatedStatus(status);
const normalizePipelineStage = (stageValue = '', statusValue = '') => {
  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizedStage = normalize(stageValue);
  if (normalizedStage === 'new_lead' || normalizedStage === 'nuevo' || normalizedStage === 'nuevo lead') return 'new_lead';
  if (normalizedStage === 'hot_lead' || normalizedStage === 'prospeccion' || normalizedStage === 'en prospeccion') return 'hot_lead';
  if (normalizedStage === 'payment' || normalizedStage === 'pago') return 'payment';
  if (normalizedStage === 'customer' || normalizedStage === 'cliente') return 'customer';
  if (normalizedStage === 'closed_lost' || normalizedStage === 'lost' || normalizedStage === 'closed lost' || normalizedStage === 'cerrado') return 'closed_lost';

  const normalizedStatus = normalize(statusValue);
  if (normalizedStatus === 'nuevo') return 'new_lead';
  if (normalizedStatus === 'en prospeccion' || normalizedStatus === 'prospeccion') return 'hot_lead';
  return 'new_lead';
};
const createUniqueRecordId = (existingIds = []) => {
  const values = Array.isArray(existingIds) ? existingIds : Array.from(existingIds || []);
  const taken = new Set(values.map((value) => String(value || '').trim()).filter(Boolean));
  let candidate = createRecordId();

  while (taken.has(candidate)) {
    candidate = createRecordId();
  }

  return candidate;
};

export const recordService = {
  async listRecords(query = {}, workspaceId) {
    const db = await readDb();
    const scopedRecords = workspaceId ? db.records.filter((record) => record.workspaceId === workspaceId) : db.records;
    const search = String(query.search || '').trim().toLowerCase();
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || scopedRecords.length || 100, 1), 250);

    const filteredItems = scopedRecords.filter((record) => {
      const matchesSearch =
        !search ||
        String(record.nombre || '').toLowerCase().includes(search) ||
        String(record.id || '').toLowerCase().includes(search) ||
        String(record.numero || '').includes(search) ||
        String(record.correo || record.email || '').toLowerCase().includes(search) ||
        String(record.sector || '').toLowerCase().includes(search);

      const matchesPais = !query.pais || query.pais === 'ALL' || record.pais === query.pais;
      const matchesCategoria = !query.categoria || query.categoria === 'ALL' || record.categoria === query.categoria;
      const matchesEstado = !query.estado || query.estado === 'ALL' || (record.estadoProspeccion || 'Nuevo') === query.estado;
      const matchesStage = !query.stage || query.stage === 'ALL' || normalizePipelineStage(record.stage, record.estadoProspeccion) === query.stage;
      const matchesSector = !query.sector || query.sector === 'ALL' || record.sector === query.sector;
      const matchesOrigen = !query.origen || query.origen === 'ALL' || record.origen === query.origen;
      const matchesMensaje =
        !query.mensaje ||
        query.mensaje === 'ALL' ||
        (query.mensaje === 'ENVIADO' ? Boolean(record.mensajeEnviado) : !record.mensajeEnviado);
      const matchesResponsable =
        !query.responsable ||
        query.responsable === 'ALL' ||
        (record.responsable || 'Sin Asignar') === query.responsable;

      const isProspecting = countsAsProspecting(record.estadoProspeccion);
      const matchesEspacio =
        !query.espacio ||
        query.espacio === 'ALL' ||
        (query.espacio === 'IN' ? isProspecting : !isProspecting);

      const isLeadDiscarded = isDiscardedStatus(record.estadoProspeccion);
      const isLeadLiquidated = isLiquidatedStatus(record.estadoProspeccion);
      const isLeadArchived = isArchivedStatus(record);
      const matchesTab =
        !query.tab ||
        query.tab === 'ALL' ||
        (query.tab === 'nuevos'
          ? (!isLeadArchived && !isLeadDiscarded && !isLeadLiquidated)
          : query.tab === 'archivados'
            ? isLeadArchived
            : isLeadDiscarded);

      return (
        matchesSearch &&
        matchesPais &&
        matchesCategoria &&
        matchesEstado &&
        matchesStage &&
        matchesSector &&
        matchesOrigen &&
        matchesMensaje &&
        matchesResponsable &&
        matchesEspacio &&
        matchesTab
      );
    });

    const total = filteredItems.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const items = filteredItems.slice(start, end);

    return {
      items,
      total,
      page,
      limit,
      hasMore: end < total,
    };
  },

  async listDuplicateRecords(workspaceId) {
    const db = await readDb();
    return workspaceId ? db.duplicateRecords.filter((record) => record.workspaceId === workspaceId) : db.duplicateRecords;
  },

  async createRecord(input, workspaceId) {
    const db = await readDb();
    const existingRecordIds = db.records.map((record) => record.id);

    const record = {
      id: input.id && !existingRecordIds.includes(input.id) ? input.id : createUniqueRecordId(existingRecordIds),
      nombre: input.nombre || 'Sin nombre',
      numero: input.numero || '',
      email: input.email || input.correo || '',
      correo: input.correo || input.email || '',
      pais: input.pais || 'OT',
      sector: input.sector || 'General',
      subsector: input.subsector || '',
      origen: input.origen || '',
      categoria: input.categoria || '-',
      canal: input.canal || 'Manual',
      estadoProspeccion: input.estadoProspeccion || 'Nuevo',
      stage: normalizePipelineStage(input.stage, input.estadoProspeccion || 'Nuevo'),
      responsable: input.responsable || 'Sin Asignar',
      inProspecting: Boolean(input.inProspecting),
      isArchived: Boolean(input.isArchived),
      mensajeEnviado: Boolean(input.mensajeEnviado),
      fechaIngreso: input.fechaIngreso || nowIso().slice(0, 10),
      historial: input.historial || [],
      notes: input.notes || input.nota || '',
      nota: input.nota || input.notes || '',
      propietarioId: input.propietarioId || null,
      workspaceId: workspaceId || input.workspaceId || null,
    };

    db.records.unshift(record);
    await writeDb(db);

    return { status: 201, payload: { record } };
  },

  async bulkCreateRecords({ records = [] }, workspaceId) {
    if (!Array.isArray(records)) {
      return { status: 400, payload: { error: 'records debe ser un arreglo.' } };
    }

    const db = await readDb();
    const existingRecordIds = new Set([
      ...db.records.map((record) => record.id),
      ...db.duplicateRecords.map((record) => record.id),
    ]);
    const existingIdentities = new Set(
      db.records
        .filter((record) => !workspaceId || record.workspaceId === workspaceId)
        .map((record) => buildRecordIdentity(record))
        .filter(Boolean),
    );
    const batchSeen = new Set();
    const normalized = records.map((input) => ({
      ...input,
      id: input.id && !existingRecordIds.has(input.id) ? input.id : createUniqueRecordId(existingRecordIds),
      nombre: input.nombre || 'Sin nombre',
      numero: input.numero || '',
      email: input.email || input.correo || '',
      correo: input.correo || input.email || '',
      sector: input.sector || 'General',
      estadoProspeccion: input.estadoProspeccion || 'Nuevo',
      stage: normalizePipelineStage(input.stage, input.estadoProspeccion || 'Nuevo'),
      responsable: input.responsable || 'Sin Asignar',
      inProspecting: Boolean(input.inProspecting),
      isArchived: Boolean(input.isArchived),
      mensajeEnviado: Boolean(input.mensajeEnviado),
      fechaIngreso: input.fechaIngreso || nowIso().slice(0, 10),
      historial: input.historial || [],
      notes: input.notes || input.nota || '',
      nota: input.nota || input.notes || '',
      workspaceId: workspaceId || input.workspaceId || null,
    }));
    normalized.forEach((record) => existingRecordIds.add(record.id));

    const accepted = [];
    const duplicates = [];

    normalized.forEach((record) => {
      const identity = buildRecordIdentity(record);
      const phone = normalizePhone(record.numero);
      const isDuplicate =
        (identity && (existingIdentities.has(identity) || batchSeen.has(identity))) ||
        (phone.length > 7 && (existingIdentities.has(`phone:${phone}`) || batchSeen.has(`phone:${phone}`)));

      if (isDuplicate) {
        duplicates.push(record);
        return;
      }

      accepted.push(record);
      if (identity) {
        existingIdentities.add(identity);
        batchSeen.add(identity);
      }
    });

    if (accepted.length > 0) {
      db.records.unshift(...accepted);
    }

    if (duplicates.length > 0) {
      db.duplicateRecords.unshift(...duplicates);
    }

    await writeDb(db);

    return { status: 201, payload: { items: accepted, duplicates } };
  },

  async bulkStoreDuplicateRecords({ records = [] }, workspaceId) {
    if (!Array.isArray(records)) {
      return { status: 400, payload: { error: 'records debe ser un arreglo.' } };
    }

    const db = await readDb();
    const existingRecordIds = new Set([
      ...db.records.map((record) => record.id),
      ...db.duplicateRecords.map((record) => record.id),
    ]);
    const existingDuplicateIdentities = new Set(
      db.duplicateRecords
        .filter((record) => !workspaceId || record.workspaceId === workspaceId)
        .map((record) => buildRecordIdentity(record))
        .filter(Boolean),
    );
    const normalized = records.map((input) => ({
      ...input,
      id: input.id && !existingRecordIds.has(input.id) ? input.id : createUniqueRecordId(existingRecordIds),
      nombre: input.nombre || 'Sin nombre',
      numero: input.numero || '',
      email: input.email || input.correo || '',
      correo: input.correo || input.email || '',
      sector: input.sector || 'General',
      estadoProspeccion: input.estadoProspeccion || 'Nuevo',
      stage: normalizePipelineStage(input.stage, input.estadoProspeccion || 'Nuevo'),
      responsable: input.responsable || 'Sin Asignar',
      inProspecting: Boolean(input.inProspecting),
      isArchived: Boolean(input.isArchived),
      mensajeEnviado: Boolean(input.mensajeEnviado),
      fechaIngreso: input.fechaIngreso || nowIso().slice(0, 10),
      historial: input.historial || [],
      notes: input.notes || input.nota || '',
      nota: input.nota || input.notes || '',
      workspaceId: workspaceId || input.workspaceId || null,
    }));
    normalized.forEach((record) => existingRecordIds.add(record.id));

    const dedupedNormalized = normalized.filter((record) => {
      const identity = buildRecordIdentity(record);
      const phone = normalizePhone(record.numero);
      const fallbackPhoneKey = phone.length > 7 ? `phone:${phone}` : null;
      const isExistingDuplicate =
        (identity && existingDuplicateIdentities.has(identity)) ||
        (fallbackPhoneKey && existingDuplicateIdentities.has(fallbackPhoneKey));

      if (isExistingDuplicate) {
        return false;
      }

      if (identity) existingDuplicateIdentities.add(identity);
      if (fallbackPhoneKey) existingDuplicateIdentities.add(fallbackPhoneKey);
      return true;
    });

    db.duplicateRecords.unshift(...dedupedNormalized);
    await writeDb(db);

    return { status: 201, payload: { items: dedupedNormalized } };
  },

  async updateRecord(recordId, updates, workspaceId) {
    const db = await readDb();
    const record = db.records.find((candidate) => candidate.id === recordId && (!workspaceId || candidate.workspaceId === workspaceId));

    if (!record) {
      return { status: 404, payload: { error: 'Registro no encontrado.' } };
    }

    const normalizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'stage')) {
      normalizedUpdates.stage = normalizePipelineStage(normalizedUpdates.stage, normalizedUpdates.estadoProspeccion || record.estadoProspeccion);
    }

    Object.assign(record, normalizedUpdates);
    await writeDb(db);

    return { status: 200, payload: { record } };
  },

  async deleteRecords({ recordIds = [] } = {}, workspaceId) {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return { status: 400, payload: { error: 'recordIds debe ser un arreglo con al menos un id.' } };
    }

    const idsToDelete = new Set(recordIds);
    const db = await readDb();
    const beforeCount = db.records.length;

    db.records = db.records.filter((record) => {
      if (workspaceId && record.workspaceId !== workspaceId) {
        return true;
      }

      return !idsToDelete.has(record.id);
    });

    await writeDb(db);

    return {
      status: 200,
      payload: { removed: beforeCount - db.records.length },
    };
  },

  async bulkChangeStatus({ recordIds = [], newStatus }, workspaceId) {
    if (!Array.isArray(recordIds) || !newStatus) {
      return { status: 400, payload: { error: 'recordIds y newStatus son obligatorios.' } };
    }

    const db = await readDb();
    let affected = 0;

    db.records = db.records.map((record) => {
      if (!recordIds.includes(record.id) || (workspaceId && record.workspaceId !== workspaceId)) {
        return record;
      }

      affected += 1;
      return withHistory(
        {
          ...record,
          estadoProspeccion: newStatus,
          inProspecting: countsAsProspecting(newStatus),
          isArchived: newStatus === 'Archivado',
        },
        `Movido masivamente a: ${newStatus}`,
      );
    });

    await writeDb(db);

    return { status: 200, payload: { affected } };
  },

  async cleanDuplicates(workspaceId) {
    const db = await readDb();
    const seen = new Set();
    const kept = [];
    const duplicates = [];

    for (const record of db.records) {
      if (workspaceId && record.workspaceId !== workspaceId) {
        kept.push(record);
        continue;
      }

      const identity = buildRecordIdentity(record);
      if (identity) {
        if (seen.has(identity)) {
          duplicates.push(record);
        } else {
          seen.add(identity);
          kept.push(record);
        }
      } else {
        kept.push(record);
      }
    }

    db.records = kept;
    db.duplicateRecords.push(...duplicates);
    await writeDb(db);

    return {
      status: 200,
      payload: { cleaned: duplicates.length, duplicates },
    };
  },

  async deleteDuplicateRecords({ duplicateIds = [] } = {}, workspaceId) {
    if (!Array.isArray(duplicateIds)) {
      return { status: 400, payload: { error: 'duplicateIds debe ser un arreglo.' } };
    }

    const db = await readDb();
    const scopedDuplicates = workspaceId ? db.duplicateRecords.filter((record) => record.workspaceId === workspaceId) : db.duplicateRecords;
    const idsToDelete = duplicateIds.length > 0 ? new Set(duplicateIds) : new Set(scopedDuplicates.map((record) => record.id));
    const beforeCount = db.duplicateRecords.length;

    db.duplicateRecords = db.duplicateRecords.filter((record) => !idsToDelete.has(record.id) || (workspaceId && record.workspaceId !== workspaceId));
    await writeDb(db);

    return {
      status: 200,
      payload: { removed: beforeCount - db.duplicateRecords.length },
    };
  },

  async restoreDuplicateRecords({ duplicateIds = [] } = {}, workspaceId) {
    if (!Array.isArray(duplicateIds) || duplicateIds.length === 0) {
      return { status: 400, payload: { error: 'duplicateIds debe ser un arreglo con al menos un id.' } };
    }

    const db = await readDb();
    const idsToRestore = new Set(duplicateIds);
    const toRestore = db.duplicateRecords.filter((record) => idsToRestore.has(record.id) && (!workspaceId || record.workspaceId === workspaceId));

    if (toRestore.length === 0) {
      return { status: 404, payload: { error: 'No se encontraron duplicados para restaurar.' } };
    }

    db.records.unshift(...toRestore);
    db.duplicateRecords = db.duplicateRecords.filter((record) => !idsToRestore.has(record.id) || (workspaceId && record.workspaceId !== workspaceId));
    await writeDb(db);

    return {
      status: 200,
      payload: { restored: toRestore.length, items: toRestore },
    };
  },

  async shareRecordsToUser({ recordIds = [], targetUserId, teamMemberName } = {}, currentUser) {
    if (!currentUser || !Array.isArray(recordIds) || recordIds.length === 0 || !targetUserId) {
      return { status: 400, payload: { error: 'recordIds, targetUserId y sesión válida son obligatorios.' } };
    }

    const db = await readDb();
    const targetUser = db.users.find((candidate) => {
      if (candidate.id !== targetUserId) return false;
      if (currentUser.rol === 'admin') {
        return candidate.email !== 'admin@bigdata.com';
      }
      return candidate.referidoPor === currentUser.codigoPropio;
    });

    if (!targetUser) {
      return {
        status: 404,
        payload: {
          error: currentUser.rol === 'admin'
            ? 'Usuario destino no encontrado.'
            : 'Usuario destino no encontrado en tu equipo.',
        },
      };
    }

    const sourceRecords = db.records.filter(
      (record) => recordIds.includes(record.id) && record.workspaceId === currentUser.workspaceId,
    );
    const receivedBatchId = `batch-${currentUser.id}-${targetUserId}-${Date.now()}`;
    const receivedAt = nowIso();

    let sharedCount = 0;
    const deliveredSourceRecordIds = [];

    sourceRecords.forEach((sourceRecord) => {
      const alreadyShared = db.records.some(
        (candidate) =>
          candidate.workspaceId === targetUser.workspaceId &&
          candidate.sourceRecordId === sourceRecord.id,
      );

      if (alreadyShared) {
        return;
      }

      db.records.unshift({
        ...sourceRecord,
        id: createRecordId(),
        sourceRecordId: sourceRecord.id,
        receivedBatchId,
        receivedAt,
        sharedFromUserId: currentUser.id,
        sharedFromUserName: currentUser.nombre,
        workspaceId: targetUser.workspaceId,
        propietarioId: targetUser.id,
        responsable: targetUser.nombre,
        stage: 'new_lead',
        inProspecting: false,
        isArchived: false,
        estadoProspeccion: 'Nuevo',
        historial: [
          { fecha: nowIso(), accion: `Lead recibido desde equipo por ${currentUser.nombre}` },
          ...(sourceRecord.historial || []),
        ],
      });

      sharedCount += 1;
      deliveredSourceRecordIds.push(sourceRecord.id);
    });

    db.records = db.records.map((record) => {
      if (!deliveredSourceRecordIds.includes(record.id) || record.workspaceId !== currentUser.workspaceId) {
        return record;
      }

      return withHistory(
        {
          ...record,
          estadoProspeccion: 'Archivado',
          inProspecting: false,
          isArchived: true,
          isShared: true,
          sharedAt: nowIso(),
          sharedToUserId: targetUser.id,
          sharedToUserName: teamMemberName || targetUser.nombre,
        },
        `Compartido con miembro del equipo: ${teamMemberName || targetUser.nombre}`,
      );
    });

    await writeDb(db);

    return {
      status: 200,
      payload: {
        shared: sharedCount,
        sharedRecordIds: deliveredSourceRecordIds,
        targetUser: { id: targetUser.id, nombre: targetUser.nombre },
      },
    };
  },
};
