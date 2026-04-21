import { useMemo } from 'react';
import { api } from '../lib/api';
import { STORAGE_KEYS } from '../lib/constants';
import { getLocalISOTime } from '../lib/date';
import {
  getLegacyStageIdFromPipelineStage,
  getLegacyStatusFromPipelineStage,
  isColdPipelineStage,
  isLostPipelineStage,
  isPipelineStageInWorkspace,
  normalizePipelineStage,
  PIPELINE_STAGE_VALUES,
} from '../lib/lead-pipeline';
import { calcularPuntajeLead } from '../lib/lead-utils';
import { readStorage, writeStorage } from '../lib/storage';

const AGENT_COLORS = [
  'bg-slate-50 text-slate-600 border-slate-200',
  'bg-stone-50 text-stone-600 border-stone-200',
  'bg-[#FFF0EB] text-[#FF5A1F] border-orange-200',
  'bg-rose-50 text-rose-600 border-rose-200',
];

const applyPipelineStageToRecord = (record, nextPipelineStage) => {
  const pipelineStage = normalizePipelineStage(nextPipelineStage, record);

  return {
    ...record,
    pipeline_stage: pipelineStage,
    estadoProspeccion: getLegacyStatusFromPipelineStage(pipelineStage, record),
    stage: getLegacyStageIdFromPipelineStage(pipelineStage, record),
    inProspecting: isPipelineStageInWorkspace(pipelineStage, record),
    isArchived: isColdPipelineStage(pipelineStage, record),
  };
};

export function useCrmRecords({
  currentUser,
  usersDb,
  isViewOnly,
  records,
  duplicateRecords,
  setRecords,
  globalSectorFilter,
  sharedLinks,
  setSharedLinks,
  setDuplicateRecords,
  selectedRecord,
  setSelectedRecord,
}) {
  const myAgents = useMemo(() => {
    if (!currentUser) return [];

    const miembrosEquipoMismoWorkspace = usersDb.filter(
      (user) =>
        user.id !== currentUser.id &&
        user.workspaceId &&
        currentUser.workspaceId &&
        user.workspaceId === currentUser.workspaceId,
    );

    return [
      { id: 'UNASSIGNED', nombre: 'Sin Asignar', color: 'bg-slate-100 text-slate-500 border-slate-200' },
      { id: currentUser.id, nombre: currentUser.nombre, color: 'bg-[#FFF0EB] text-[#FF5A1F] border-orange-200', isMe: true },
      ...miembrosEquipoMismoWorkspace.map((agent, index) => ({
        id: agent.id,
        nombre: agent.nombre,
        color: AGENT_COLORS[index % AGENT_COLORS.length],
        isMe: false,
      })),
    ];
  }, [currentUser, usersDb]);

  const displayedRecords = useMemo(() => {
    const visibleRecords = records.filter((record) => !isLostPipelineStage(record.pipeline_stage, record));
    if (globalSectorFilter === 'ALL') return visibleRecords;
    return visibleRecords.filter((record) => record.sector === globalSectorFilter);
  }, [records, globalSectorFilter]);

  const handleUpdateRecord = (updatedRecord) => {
    if (isViewOnly) return;
    const canonicalRecord = applyPipelineStageToRecord(
      updatedRecord,
      updatedRecord?.pipeline_stage || updatedRecord?.stage || updatedRecord?.estadoProspeccion || PIPELINE_STAGE_VALUES.NEW,
    );

    setRecords((prev) => prev.map((record) => (record.id === canonicalRecord.id ? canonicalRecord : record)));
    if (selectedRecord?.id === canonicalRecord.id) {
      setSelectedRecord(canonicalRecord);
    }

    api.updateRecord(canonicalRecord.id, canonicalRecord).catch(() => {
      // Keep local fallback if backend is unavailable.
    });
  };

  const handleChangeStatus = (recordId, nextPipelineStage) => {
    if (isViewOnly) return;

    setRecords((prev) =>
      prev.map((record) => {
        const normalizedNextStage = normalizePipelineStage(nextPipelineStage, record);
        if (record.id !== recordId || normalizePipelineStage(record.pipeline_stage, record) === normalizedNextStage) {
          return record;
        }

        return applyPipelineStageToRecord(
          {
            ...record,
            historial: [{ fecha: getLocalISOTime(), accion: `Pipeline actualizado a: ${normalizedNextStage}` }, ...(record.historial || [])],
          },
          normalizedNextStage,
        );
      }),
    );

    api.updateRecord(recordId, {
      pipeline_stage: normalizePipelineStage(nextPipelineStage),
    }).catch(() => {
      // Keep local fallback if backend is unavailable.
    });
  };

  const handleArchiveWorkspaceLead = (recordId, isArchived) => {
    if (isViewOnly) return;

    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        const nextPipelineStage = isArchived
          ? PIPELINE_STAGE_VALUES.COLD_LEAD
          : PIPELINE_STAGE_VALUES.NEW_LEAD;

        return applyPipelineStageToRecord(
          {
            ...record,
            historial: [
              {
                fecha: getLocalISOTime(),
                accion: isArchived ? 'Lead movido a Cold Lead desde Workspace' : 'Lead restaurado a la mesa activa del Workspace',
              },
              ...(record.historial || []),
            ],
          },
          nextPipelineStage,
        );
      }),
    );

    api.updateRecord(recordId, {
      pipeline_stage: isArchived ? PIPELINE_STAGE_VALUES.COLD_LEAD : PIPELINE_STAGE_VALUES.NEW_LEAD,
    }).catch(() => {
      // Keep local fallback if backend is unavailable.
    });
  };

  const handleRemoveFromWorkspaceCompletely = (recordId) => {
    if (isViewOnly) return;

    setRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        return applyPipelineStageToRecord(
          {
            ...record,
            responsable: 'Sin Asignar',
            historial: [
              { fecha: getLocalISOTime(), accion: 'Lead devuelto al Directorio en etapa 🆕 New' },
              ...(record.historial || []),
            ],
          },
          PIPELINE_STAGE_VALUES.NEW,
        );
      }),
    );

    api.updateRecord(recordId, {
      responsable: 'Sin Asignar',
      pipeline_stage: PIPELINE_STAGE_VALUES.NEW,
    }).catch(() => {
      // Keep local fallback if backend is unavailable.
    });
  };

  const handleBulkChangeStatus = (recordIds, nextPipelineStage) => {
    if (isViewOnly) return;

    setRecords((prev) =>
      prev.map((record) => {
        const normalizedNextStage = normalizePipelineStage(nextPipelineStage, record);
        if (!recordIds.includes(record.id) || normalizePipelineStage(record.pipeline_stage, record) === normalizedNextStage) {
          return record;
        }

        return applyPipelineStageToRecord(
          {
            ...record,
            historial: [{ fecha: getLocalISOTime(), accion: `Pipeline actualizado masivamente a: ${normalizedNextStage}` }, ...(record.historial || [])],
          },
          normalizedNextStage,
        );
      }),
    );

    api.bulkChangeStatus({ recordIds, newStatus: normalizePipelineStage(nextPipelineStage) }).catch(() => {
      // Keep local fallback if backend is unavailable.
    });
  };

  const handlePermanentDeleteRecords = (recordIds = []) => {
    if (isViewOnly || !Array.isArray(recordIds) || recordIds.length === 0) {
      return { removed: 0 };
    }

    const idsToDelete = new Set(recordIds);

    setRecords((prev) => prev.filter((record) => !idsToDelete.has(record.id)));

    if (selectedRecord?.id && idsToDelete.has(selectedRecord.id)) {
      setSelectedRecord(null);
    }

    api.deleteRecords(recordIds).catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { removed: idsToDelete.size };
  };

  const handleCreateSharedLink = async (newLink, sharedRecordIds, teamMember) => {
    if (isViewOnly) return;

    const teamMemberId = teamMember?.id || null;
    const teamMemberName = teamMember?.nombre || teamMember?.name || '';
    const targetUser = teamMemberId ? usersDb.find((user) => user.id === teamMemberId) : null;
    const now = getLocalISOTime();
    const sourceRecords = records.filter((record) => sharedRecordIds.includes(record.id));
    let deliveredRecordIds = [...sharedRecordIds];
    let deliveredCount = deliveredRecordIds.length;

    if (teamMemberId) {
      try {
        const shareResult = await api.shareRecords({
          recordIds: sharedRecordIds,
          targetUserId: teamMemberId,
          teamMemberName,
        });
        deliveredRecordIds = Array.isArray(shareResult?.sharedRecordIds)
          ? shareResult.sharedRecordIds
          : deliveredRecordIds;
        deliveredCount = Number.isFinite(shareResult?.shared) ? Number(shareResult.shared) : deliveredRecordIds.length;
      } catch {
        // Keep local fallback if backend is unavailable.
      }
    }

    if (deliveredCount <= 0 || deliveredRecordIds.length === 0) {
      return { sharedCount: 0, sharedRecordIds: [] };
    }

    const linkToStore = {
      ...newLink,
      count: deliveredCount,
      teamMemberId,
      teamMemberName,
      teamMemberCode: teamMember?.codigoPropio || newLink?.teamMemberCode || null,
      sourceRecordIds: [...deliveredRecordIds],
    };

    setSharedLinks((prev) => [linkToStore, ...prev]);
    setRecords((prev) =>
      prev.map((record) => {
        if (!deliveredRecordIds.includes(record.id)) {
          return record;
        }

        return {
          ...applyPipelineStageToRecord(record, PIPELINE_STAGE_VALUES.COLD_LEAD),
          isShared: true,
          sharedAt: now,
          sharedToUserId: teamMemberId,
          sharedToUserName: teamMemberName,
          historial: [
            {
              fecha: now,
              accion: `Compartido con: ${teamMemberName}`,
            },
            ...(record.historial || []),
          ],
        };
      }),
    );

    if (targetUser?.workspaceId) {
      const deliveredSourceRecords = sourceRecords.filter((record) => deliveredRecordIds.includes(record.id));
      const targetStorageKey = `${STORAGE_KEYS.records}:${targetUser.workspaceId}`;
      const existingTargetRecords = readStorage(targetStorageKey, []);
      const existingSourceIds = new Set(existingTargetRecords.map((record) => record.sourceRecordId).filter(Boolean));
      const clonedRecords = deliveredSourceRecords
        .filter((record) => !existingSourceIds.has(record.id))
        .map((record) => ({
          ...record,
          id: `R-SHARED-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          sourceRecordId: record.id,
          receivedBatchId: newLink.id,
          receivedAt: newLink.date || now,
          sharedFromUserId: currentUser.id,
          sharedFromUserName: currentUser.nombre,
          propietarioId: targetUser.id,
          responsable: targetUser.nombre,
          workspaceId: targetUser.workspaceId,
          ...applyPipelineStageToRecord(record, PIPELINE_STAGE_VALUES.NEW),
          historial: [
            { fecha: now, accion: `Lead recibido desde equipo por ${currentUser.nombre}` },
            ...(record.historial || []),
          ],
        }));

      if (clonedRecords.length > 0) {
        writeStorage(targetStorageKey, [...clonedRecords, ...existingTargetRecords]);
      }
    }

    api.createSharedLink(linkToStore).catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { sharedCount: deliveredCount, sharedRecordIds: deliveredRecordIds };
  };

  const handleCleanDuplicates = () => {
    if (isViewOnly) return { cleaned: 0 };

    const seen = new Set();
    const kept = [];
    const duplicates = [];

    records.forEach((record) => {
      const cleanNum = record.numero ? record.numero.replace(/\D/g, '') : '';
      if (cleanNum && cleanNum.length > 5) {
        if (seen.has(cleanNum)) {
          duplicates.push(record);
        } else {
          seen.add(cleanNum);
          kept.push(record);
        }
      } else {
        kept.push(record);
      }
    });

    if (duplicates.length > 0) {
      setRecords(kept);
      setDuplicateRecords((prev) => [...prev, ...duplicates]);
    }

    api.cleanDuplicates().catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { cleaned: duplicates.length };
  };

  const handleDeleteDuplicates = (duplicateIds = []) => {
    if (isViewOnly) return { removed: 0 };

    const idsToDelete = duplicateIds.length > 0
      ? new Set(duplicateIds)
      : new Set((duplicateRecords || []).map((record) => record.id));

    setDuplicateRecords((prev) => {
      if (idsToDelete.size === 0) {
        return [];
      }

      return prev.filter((record) => !idsToDelete.has(record.id));
    });

    api.deleteDuplicates(duplicateIds).catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { removed: idsToDelete.size };
  };

  const handleRestoreDuplicates = (duplicateIds = []) => {
    if (isViewOnly || duplicateIds.length === 0) return { restored: 0 };

    const idsToRestore = new Set(duplicateIds);
    const recordsToRestore = (duplicateRecords || []).filter((record) => idsToRestore.has(record.id));

    setDuplicateRecords((prev) => {
      return prev.filter((record) => !idsToRestore.has(record.id));
    });

    if (recordsToRestore.length > 0) {
      setRecords((prev) => [...recordsToRestore, ...prev]);
    }

    api.restoreDuplicates(duplicateIds).catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { restored: recordsToRestore.length };
  };

  const handleAutoSelectLeads = (count = 15, silent = false) => {
    if (isViewOnly || !currentUser) {
      return { assigned: 0, reason: 'readonly' };
    }

    const availableLeads = displayedRecords.filter(
      (record) =>
        normalizePipelineStage(record.pipeline_stage, record) === PIPELINE_STAGE_VALUES.NEW &&
        (!record.responsable || record.responsable === 'Sin Asignar' || record.responsable.trim() === ''),
    );

    if (availableLeads.length === 0) {
      return { assigned: 0, reason: silent ? 'silent-empty' : 'empty' };
    }

    const scoredLeads = availableLeads
      .map((record) => ({
        ...record,
        sortScore: calcularPuntajeLead(record) + Math.random() * 30,
      }))
      .sort((a, b) => b.sortScore - a.sortScore);

    const selectedIds = scoredLeads.slice(0, count).map((record) => record.id);

    setRecords((prev) =>
      prev.map((record) => {
        if (!selectedIds.includes(record.id)) {
          return record;
        }

        return applyPipelineStageToRecord(
          {
            ...record,
            responsable: currentUser.nombre,
            propietarioId: currentUser.id,
            historial: [{ fecha: getLocalISOTime(), accion: 'Auto-asignado inteligentemente a 📤 New Lead' }, ...(record.historial || [])],
          },
          PIPELINE_STAGE_VALUES.NEW_LEAD,
        );
      }),
    );

    Promise.all(
      selectedIds.map((recordId) =>
        api.updateRecord(recordId, {
          pipeline_stage: PIPELINE_STAGE_VALUES.NEW_LEAD,
          responsable: currentUser.nombre,
          propietarioId: currentUser.id,
        }),
      ),
    ).catch(() => {
      // Keep local fallback if backend is unavailable.
    });

    return { assigned: selectedIds.length };
  };

  return {
    myAgents,
    displayedRecords,
    handleUpdateRecord,
    handleChangeStatus,
    handleArchiveWorkspaceLead,
    handleRemoveFromWorkspaceCompletely,
    handleBulkChangeStatus,
    handlePermanentDeleteRecords,
    handleCreateSharedLink,
    handleCleanDuplicates,
    handleDeleteDuplicates,
    handleRestoreDuplicates,
    handleAutoSelectLeads,
  };
}
