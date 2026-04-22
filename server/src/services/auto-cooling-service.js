import { queryRows, readDb, writeDb } from '../db.js';
import {
  getLegacyStageIdFromPipelineStage,
  getLegacyStatusFromPipelineStage,
  isColdPipelineStage,
  isPipelineStageInWorkspace,
  normalizePipelineStage,
  PIPELINE_STAGE_VALUES,
} from '../lead-pipeline.js';
import { nowIso } from '../utils.js';

const AUTO_COOLING_INTERVAL_MS = 1000 * 60 * 15;
const COOLING_WINDOW_MS = 1000 * 60 * 60 * 48;
const AUTO_COOLED_ACTION = `Lead movido automaticamente a ${PIPELINE_STAGE_VALUES.COLD_LEAD} por 48h sin interaccion.`;
const ELIGIBLE_STAGES = new Set([
  PIPELINE_STAGE_VALUES.NEW,
  PIPELINE_STAGE_VALUES.NEW_LEAD,
]);

let autoCoolingStarted = false;

const buildPipelineSnapshot = (value = '', record = {}) => {
  const pipelineStage = normalizePipelineStage(value, record);

  return {
    pipeline_stage: pipelineStage,
    estadoProspeccion: getLegacyStatusFromPipelineStage(pipelineStage, record),
    stage: getLegacyStageIdFromPipelineStage(pipelineStage, record),
    inProspecting: isPipelineStageInWorkspace(pipelineStage, record),
    isArchived: isColdPipelineStage(pipelineStage, record),
  };
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLatestDate = (values = []) => {
  let latest = null;

  values.forEach((value) => {
    const parsed = parseDate(value);
    if (!parsed) return;
    if (!latest || parsed > latest) {
      latest = parsed;
    }
  });

  return latest;
};

const getRecordLastActivity = (record, conversationActivityByLeadId = new Map()) => {
  const historyDates = Array.isArray(record?.historial)
    ? record.historial.map((entry) => entry?.fecha).filter(Boolean)
    : [];

  return getLatestDate([
    conversationActivityByLeadId.get(String(record?.id || '').trim()),
    record?.last_message_at,
    record?.lastMessageAt,
    record?.updatedAt,
    record?.updated_at,
    record?.fechaActualizacion,
    record?.fechaModificacion,
    record?.fechaIngreso,
    record?.fechaCreacion,
    ...historyDates,
  ]);
};

const loadConversationActivity = async (records = []) => {
  const leadIds = Array.from(
    new Set(
      records.map((record) => String(record?.id || '').trim()).filter(Boolean),
    ),
  );

  if (!leadIds.length) {
    return new Map();
  }

  const placeholders = leadIds.map(() => '?').join(', ');

  try {
    const rows = await queryRows(
      `SELECT \`leadId\`,
              MAX(
                GREATEST(
                  COALESCE(\`lastInboundAt\`, '1000-01-01 00:00:00'),
                  COALESCE(\`lastOutboundAt\`, '1000-01-01 00:00:00'),
                  COALESCE(\`lastMessageAt\`, '1000-01-01 00:00:00'),
                  COALESCE(\`updatedAt\`, '1000-01-01 00:00:00')
                )
              ) AS \`lastActivityAt\`
       FROM \`lead_conversations\`
       WHERE \`leadId\` IN (${placeholders})
       GROUP BY \`leadId\``,
      leadIds,
    );

    return new Map(
      rows
        .filter((row) => row?.leadId && row?.lastActivityAt)
        .map((row) => [String(row.leadId), String(row.lastActivityAt).replace(' ', 'T')]),
    );
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return new Map();
    }

    console.error('[auto-cooling] Failed to load conversation activity:', error);
    return new Map();
  }
};

const coolInactiveLeads = async () => {
  const db = await readDb();
  const now = Date.now();
  const candidateRecords = db.records.filter((record) =>
    ELIGIBLE_STAGES.has(normalizePipelineStage(record?.pipeline_stage, record)),
  );

  if (!candidateRecords.length) {
    return { scanned: 0, cooled: 0 };
  }

  const conversationActivityByLeadId = await loadConversationActivity(candidateRecords);
  let cooled = 0;

  db.records = db.records.map((record) => {
    const currentStage = normalizePipelineStage(record?.pipeline_stage, record);
    if (!ELIGIBLE_STAGES.has(currentStage)) {
      return record;
    }

    const lastActivity = getRecordLastActivity(record, conversationActivityByLeadId);
    if (!lastActivity) {
      return record;
    }

    if (now - lastActivity.getTime() < COOLING_WINDOW_MS) {
      return record;
    }

    cooled += 1;
    return {
      ...record,
      ...buildPipelineSnapshot(PIPELINE_STAGE_VALUES.COLD_LEAD, record),
      historial: [{ fecha: nowIso(), accion: AUTO_COOLED_ACTION }, ...(record.historial || [])],
    };
  });

  if (cooled > 0) {
    await writeDb(db);
  }

  return {
    scanned: candidateRecords.length,
    cooled,
  };
};

export const startAutoCoolingEngine = ({ intervalMs = AUTO_COOLING_INTERVAL_MS } = {}) => {
  if (autoCoolingStarted) {
    return null;
  }

  autoCoolingStarted = true;
  let isRunning = false;

  const runCycle = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const result = await coolInactiveLeads();
      if (result.cooled > 0) {
        console.log(`[auto-cooling] Archived ${result.cooled} inactive leads after scanning ${result.scanned}.`);
      }
    } catch (error) {
      console.error('[auto-cooling] Unhandled cycle error:', error);
    } finally {
      isRunning = false;
    }
  };

  setTimeout(() => {
    Promise.resolve(runCycle()).catch(() => {});
  }, 30_000);

  const timer = setInterval(() => {
    Promise.resolve(runCycle()).catch(() => {});
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  console.log(`[auto-cooling] Engine started. Interval: ${Math.round(intervalMs / 60000)} min.`);
  return timer;
};
