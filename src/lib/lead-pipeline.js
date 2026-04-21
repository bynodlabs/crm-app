export const PIPELINE_STAGE_VALUES = {
  NEW: '🆕 New',
  NEW_LEAD: '📤 New Lead',
  HOT_LEAD: '🔥 Hot Lead',
  PAYMENT: '💳 Pago',
  CUSTOMER: '⭐ Cliente',
  COLD_LEAD: '🧊 Cold Lead',
  LOST: '🚫 Lost',
};

const PIPELINE_STAGES = [
  {
    id: 'new',
    value: PIPELINE_STAGE_VALUES.NEW,
    label: PIPELINE_STAGE_VALUES.NEW,
    icon: '🆕',
    shortLabel: 'New',
    classes: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  {
    id: 'new_lead',
    value: PIPELINE_STAGE_VALUES.NEW_LEAD,
    label: PIPELINE_STAGE_VALUES.NEW_LEAD,
    icon: '📤',
    shortLabel: 'New Lead',
    classes: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  {
    id: 'hot_lead',
    value: PIPELINE_STAGE_VALUES.HOT_LEAD,
    label: PIPELINE_STAGE_VALUES.HOT_LEAD,
    icon: '🔥',
    shortLabel: 'Hot',
    classes: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  {
    id: 'payment',
    value: PIPELINE_STAGE_VALUES.PAYMENT,
    label: PIPELINE_STAGE_VALUES.PAYMENT,
    icon: '💳',
    shortLabel: 'Pago',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    id: 'customer',
    value: PIPELINE_STAGE_VALUES.CUSTOMER,
    label: PIPELINE_STAGE_VALUES.CUSTOMER,
    icon: '⭐',
    shortLabel: 'Cliente',
    classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  {
    id: 'cold_lead',
    value: PIPELINE_STAGE_VALUES.COLD_LEAD,
    label: PIPELINE_STAGE_VALUES.COLD_LEAD,
    icon: '🧊',
    shortLabel: 'Cold',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    id: 'lost',
    value: PIPELINE_STAGE_VALUES.LOST,
    label: PIPELINE_STAGE_VALUES.LOST,
    icon: '🚫',
    shortLabel: 'Lost',
    classes: 'bg-rose-100 text-rose-700 border-rose-200',
  },
];

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
  cerrado: PIPELINE_STAGE_VALUES.LOST,
  perdido: PIPELINE_STAGE_VALUES.LOST,
  respondio: PIPELINE_STAGE_VALUES.HOT_LEAD,
  respondió: PIPELINE_STAGE_VALUES.HOT_LEAD,
};

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function normalizePipelineStage(stageValue = '', record = null) {
  const explicitValue = String(stageValue || '').trim();
  if (PIPELINE_STAGES.some((stage) => stage.value === explicitValue)) {
    return explicitValue;
  }

  const normalizedExplicit = normalizeText(stageValue);
  const directMeta = PIPELINE_STAGES.find((stage) => normalizeText(stage.value) === normalizedExplicit);
  if (directMeta) {
    return directMeta.value;
  }

  const legacyStage = LEGACY_STAGE_TO_VALUE[normalizedExplicit];
  if (legacyStage) {
    return legacyStage;
  }

  const legacyStatus = LEGACY_STATUS_TO_VALUE[normalizedExplicit];
  if (legacyStatus) {
    return legacyStatus;
  }

  const pipelineStage = String(record?.pipeline_stage || '').trim();
  if (PIPELINE_STAGES.some((stage) => stage.value === pipelineStage)) {
    return pipelineStage;
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
}

export function getPipelineStageMeta(stageValue = '', record = null) {
  const normalizedStage = normalizePipelineStage(stageValue, record);
  return PIPELINE_STAGES.find((stage) => stage.value === normalizedStage) || PIPELINE_STAGES[0];
}

export function getPipelineStageOptions() {
  return PIPELINE_STAGES;
}

export function isLostPipelineStage(stageValue = '', record = null) {
  return normalizePipelineStage(stageValue, record) === PIPELINE_STAGE_VALUES.LOST;
}

export function isColdPipelineStage(stageValue = '', record = null) {
  return normalizePipelineStage(stageValue, record) === PIPELINE_STAGE_VALUES.COLD_LEAD;
}

export function isNewPipelineStage(stageValue = '', record = null) {
  return normalizePipelineStage(stageValue, record) === PIPELINE_STAGE_VALUES.NEW;
}

export function isPipelineStageInWorkspace(stageValue = '', record = null) {
  const normalizedStage = normalizePipelineStage(stageValue, record);
  return [
    PIPELINE_STAGE_VALUES.NEW_LEAD,
    PIPELINE_STAGE_VALUES.HOT_LEAD,
    PIPELINE_STAGE_VALUES.PAYMENT,
    PIPELINE_STAGE_VALUES.CUSTOMER,
  ].includes(normalizedStage);
}

export function isPipelineStageWorked(stageValue = '', record = null) {
  const normalizedStage = normalizePipelineStage(stageValue, record);
  return ![
    PIPELINE_STAGE_VALUES.NEW,
    PIPELINE_STAGE_VALUES.COLD_LEAD,
    PIPELINE_STAGE_VALUES.LOST,
  ].includes(normalizedStage);
}

export function getLegacyStatusFromPipelineStage(stageValue = '', record = null) {
  const normalizedStage = normalizePipelineStage(stageValue, record);

  if (normalizedStage === PIPELINE_STAGE_VALUES.NEW) return 'Nuevo';
  if (normalizedStage === PIPELINE_STAGE_VALUES.COLD_LEAD) return 'Archivado';
  if (normalizedStage === PIPELINE_STAGE_VALUES.LOST) return 'Descartado';
  return 'En prospección';
}

export function getLegacyStageIdFromPipelineStage(stageValue = '', record = null) {
  const normalizedStage = normalizePipelineStage(stageValue, record);

  if (normalizedStage === PIPELINE_STAGE_VALUES.PAYMENT) return 'payment';
  if (normalizedStage === PIPELINE_STAGE_VALUES.CUSTOMER) return 'customer';
  if (normalizedStage === PIPELINE_STAGE_VALUES.HOT_LEAD) return 'hot_lead';
  if (normalizedStage === PIPELINE_STAGE_VALUES.LOST) return 'closed_lost';
  if (normalizedStage === PIPELINE_STAGE_VALUES.COLD_LEAD) return 'closed_lost';
  return 'new_lead';
}
