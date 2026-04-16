const PIPELINE_STAGES = [
  { id: 'new_lead', label: 'New Lead', icon: '🆕', shortLabel: 'New', classes: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'hot_lead', label: 'Hot Lead', icon: '🔥', shortLabel: 'Hot', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'payment', label: 'Pago', icon: '💳', shortLabel: 'Pago', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'customer', label: 'Cliente', icon: '⭐', shortLabel: 'Cliente', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'closed_lost', label: 'Lost', icon: '🚫', shortLabel: 'Lost', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const PIPELINE_STAGE_MAP = {
  new_lead: 'new_lead',
  nuevo: 'new_lead',
  'nuevo lead': 'new_lead',
  hot_lead: 'hot_lead',
  prospeccion: 'hot_lead',
  'en prospeccion': 'hot_lead',
  'en prospección': 'hot_lead',
  payment: 'payment',
  pago: 'payment',
  customer: 'customer',
  cliente: 'customer',
  closed_lost: 'closed_lost',
  lost: 'closed_lost',
  'closed lost': 'closed_lost',
  cerrado: 'closed_lost',
};

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function normalizeLeadStage(stageValue = '', record = null) {
  const explicitStage = PIPELINE_STAGE_MAP[normalizeText(stageValue)];
  if (explicitStage) return explicitStage;

  const statusValue = normalizeText(record?.estadoProspeccion || '');
  if (statusValue === 'nuevo') return 'new_lead';
  if (statusValue === 'en prospeccion' || statusValue === 'prospeccion') return 'hot_lead';

  return 'new_lead';
}

export function getPipelineStageMeta(stageValue = '', record = null) {
  const normalizedStage = normalizeLeadStage(stageValue, record);
  return PIPELINE_STAGES.find((stage) => stage.id === normalizedStage) || PIPELINE_STAGES[0];
}

export function getPipelineStageOptions() {
  return PIPELINE_STAGES;
}
