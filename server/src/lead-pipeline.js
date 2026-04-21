export const PIPELINE_STAGE_VALUES = {
  NEW: '🆕 New',
  NEW_LEAD: '📤 New Lead',
  HOT_LEAD: '🔥 Hot Lead',
  PAYMENT: '💳 Pago',
  CUSTOMER: '⭐ Cliente',
  COLD_LEAD: '🧊 Cold Lead',
  LOST: '🚫 Lost',
};

const LEGACY_STAGE_TO_VALUE = {
  new_lead: PIPELINE_STAGE_VALUES.NEW_LEAD,
  hot_lead: PIPELINE_STAGE_VALUES.HOT_LEAD,
  payment: PIPELINE_STAGE_VALUES.PAYMENT,
  customer: PIPELINE_STAGE_VALUES.CUSTOMER,
  closed_lost: PIPELINE_STAGE_VALUES.LOST,
  lost: PIPELINE_STAGE_VALUES.LOST,
  cold_lead: PIPELINE_STAGE_VALUES.COLD_LEAD,
};

const LEGACY_STATUS_TO_VALUE = {
  nuevo: PIPELINE_STAGE_VALUES.NEW,
  'new lead': PIPELINE_STAGE_VALUES.NEW_LEAD,
  'en prospeccion': PIPELINE_STAGE_VALUES.HOT_LEAD,
  'en prospección': PIPELINE_STAGE_VALUES.HOT_LEAD,
  prospeccion: PIPELINE_STAGE_VALUES.HOT_LEAD,
  prospección: PIPELINE_STAGE_VALUES.HOT_LEAD,
  pago: PIPELINE_STAGE_VALUES.PAYMENT,
  cliente: PIPELINE_STAGE_VALUES.CUSTOMER,
  archivado: PIPELINE_STAGE_VALUES.COLD_LEAD,
  descartado: PIPELINE_STAGE_VALUES.LOST,
  liquidado: PIPELINE_STAGE_VALUES.LOST,
  perdido: PIPELINE_STAGE_VALUES.LOST,
  cerrado: PIPELINE_STAGE_VALUES.LOST,
  respondio: PIPELINE_STAGE_VALUES.HOT_LEAD,
  respondió: PIPELINE_STAGE_VALUES.HOT_LEAD,
};

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizePipelineStage = (stageValue = '', record = null) => {
  const explicitValue = String(stageValue || '').trim();
  if (Object.values(PIPELINE_STAGE_VALUES).includes(explicitValue)) {
    return explicitValue;
  }

  const normalizedExplicit = normalizeText(stageValue);
  const explicitMatch = Object.values(PIPELINE_STAGE_VALUES).find((value) => normalizeText(value) === normalizedExplicit);
  if (explicitMatch) {
    return explicitMatch;
  }

  if (LEGACY_STAGE_TO_VALUE[normalizedExplicit]) {
    return LEGACY_STAGE_TO_VALUE[normalizedExplicit];
  }

  if (LEGACY_STATUS_TO_VALUE[normalizedExplicit]) {
    return LEGACY_STATUS_TO_VALUE[normalizedExplicit];
  }

  const recordPipeline = String(record?.pipeline_stage || '').trim();
  if (Object.values(PIPELINE_STAGE_VALUES).includes(recordPipeline)) {
    return recordPipeline;
  }

  const recordLegacyStage = LEGACY_STAGE_TO_VALUE[normalizeText(record?.stage || '')];
  if (recordLegacyStage) {
    return recordLegacyStage;
  }

  const recordLegacyStatus = LEGACY_STATUS_TO_VALUE[normalizeText(record?.estadoProspeccion || '')];
  if (recordLegacyStatus) {
    return recordLegacyStatus;
  }

  return PIPELINE_STAGE_VALUES.NEW;
};

export const getLegacyStatusFromPipelineStage = (stageValue = '', record = null) => {
  const normalizedStage = normalizePipelineStage(stageValue, record);

  if (normalizedStage === PIPELINE_STAGE_VALUES.NEW) return 'Nuevo';
  if (normalizedStage === PIPELINE_STAGE_VALUES.COLD_LEAD) return 'Archivado';
  if (normalizedStage === PIPELINE_STAGE_VALUES.LOST) return 'Descartado';
  return 'En prospección';
};

export const getLegacyStageIdFromPipelineStage = (stageValue = '', record = null) => {
  const normalizedStage = normalizePipelineStage(stageValue, record);

  if (normalizedStage === PIPELINE_STAGE_VALUES.PAYMENT) return 'payment';
  if (normalizedStage === PIPELINE_STAGE_VALUES.CUSTOMER) return 'customer';
  if (normalizedStage === PIPELINE_STAGE_VALUES.HOT_LEAD) return 'hot_lead';
  if (normalizedStage === PIPELINE_STAGE_VALUES.LOST) return 'closed_lost';
  if (normalizedStage === PIPELINE_STAGE_VALUES.COLD_LEAD) return 'closed_lost';
  return 'new_lead';
};

export const isLostPipelineStage = (stageValue = '', record = null) =>
  normalizePipelineStage(stageValue, record) === PIPELINE_STAGE_VALUES.LOST;

export const isColdPipelineStage = (stageValue = '', record = null) =>
  normalizePipelineStage(stageValue, record) === PIPELINE_STAGE_VALUES.COLD_LEAD;

export const isPipelineStageInWorkspace = (stageValue = '', record = null) => {
  const normalizedStage = normalizePipelineStage(stageValue, record);
  return [
    PIPELINE_STAGE_VALUES.NEW_LEAD,
    PIPELINE_STAGE_VALUES.HOT_LEAD,
    PIPELINE_STAGE_VALUES.PAYMENT,
    PIPELINE_STAGE_VALUES.CUSTOMER,
  ].includes(normalizedStage);
};

export const isPipelineStageWorked = (stageValue = '', record = null) => {
  const normalizedStage = normalizePipelineStage(stageValue, record);
  return ![
    PIPELINE_STAGE_VALUES.NEW,
    PIPELINE_STAGE_VALUES.COLD_LEAD,
    PIPELINE_STAGE_VALUES.LOST,
  ].includes(normalizedStage);
};
