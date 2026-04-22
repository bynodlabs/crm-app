import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  ChevronDown,
  Download,
  MessageSquareShare,
  RotateCcw,
  Share2,
  Users2,
  X,
} from 'lucide-react';
import { usePersistentState } from '../hooks/usePersistentState';
import { api } from '../lib/api';
import { STORAGE_KEYS } from '../lib/constants';
import { PIPELINE_STAGE_VALUES } from '../lib/lead-pipeline';

const BIGDATA_ORANGE = '#FF5A1F';
const WHATSAPP_GREEN = '#25D366';
const CAMPAIGN_PAGE_SIZE = 24;
const RECENT_COLD_WINDOW_DAYS = 14;

const buildCampaignHistoryKey = (workspaceId = 'guest') => `${STORAGE_KEYS.campaignHistory}:${workspaceId || 'guest'}`;
const createCampaignId = () => globalThis.crypto?.randomUUID?.() || `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function formatCampaignTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRecordLastActivity(record) {
  const historyDates = Array.isArray(record?.historial)
    ? record.historial.map((entry) => entry?.fecha).filter(Boolean)
    : [];

  const candidates = [
    record?.last_message_at,
    record?.lastMessageAt,
    record?.updatedAt,
    record?.fechaActualizacion,
    record?.fechaModificacion,
    record?.fechaIngreso,
    record?.fechaCreacion,
    ...historyDates,
  ];

  let latestDate = null;

  candidates.forEach((candidate) => {
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return;
    if (!latestDate || parsed > latestDate) {
      latestDate = parsed;
    }
  });

  return latestDate;
}

const SEGMENT_PRESETS = [
  { id: 'ALL', label: 'Todos', description: 'Vista general', matches: () => true },
  {
    id: 'HOT_LEADS',
    label: 'Hot Leads',
    description: 'Alta intención',
    matches: (contact) => String(contact.pipeline_stage || '').trim() === PIPELINE_STAGE_VALUES.HOT_LEAD,
  },
  {
    id: 'NEW_WAVE',
    label: 'New Wave',
    description: 'Nuevos y New Lead',
    matches: (contact) => [PIPELINE_STAGE_VALUES.NEW, PIPELINE_STAGE_VALUES.NEW_LEAD].includes(String(contact.pipeline_stage || '').trim()),
  },
  {
    id: 'RECENT_COLD',
    label: 'Recent Cold Leads',
    description: 'Fríos recientes',
    matches: (contact) => {
      const isCold = String(contact.pipeline_stage || '').trim() === PIPELINE_STAGE_VALUES.COLD_LEAD;
      if (!isCold) return false;
      const lastActivity = getRecordLastActivity(contact);
      if (!lastActivity) return false;
      return Date.now() - lastActivity.getTime() <= RECENT_COLD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    },
  },
  {
    id: 'PAYMENT_READY',
    label: 'Pago',
    description: 'Listos para cierre',
    matches: (contact) => String(contact.pipeline_stage || '').trim() === PIPELINE_STAGE_VALUES.PAYMENT,
  },
];

function buildCampaignLeadSnapshot(lead, extra = {}) {
  return {
    id: lead?.id || '',
    nombre: String(lead?.nombre || '').trim() || '',
    numero: String(lead?.numero || lead?.telefono || lead?.phone || '').trim(),
    sector: String(lead?.sector || '').trim(),
    empresa: String(lead?.empresa || lead?.compania || lead?.company || lead?.subsector || '').trim(),
    responsable: String(lead?.responsable || '').trim(),
    chatJid: String(lead?.chatJid || '').trim(),
    jid: String(lead?.jid || '').trim(),
    telefono: String(lead?.telefono || '').trim(),
    phone: String(lead?.phone || '').trim(),
    whatsapp: String(lead?.whatsapp || '').trim(),
    errorMessage: String(extra.errorMessage || '').trim(),
  };
}

function renderCampaignMessageForLead(lead, template) {
  const replacements = {
    nombre: String(lead?.nombre || '').trim() || 'cliente',
    empresa: String(lead?.empresa || lead?.compania || lead?.company || lead?.subsector || 'tu empresa'),
    sector: String(lead?.sector || 'tu sector'),
  };

  return String(template || '').replace(/\{\{(nombre|empresa|sector)\}\}/gi, (_, token) => replacements[token.toLowerCase()] || '');
}

function resolveCampaignContactTarget(lead) {
  const candidates = [
    lead?.chatJid,
    lead?.jid,
    lead?.numero,
    lead?.telefono,
    lead?.phone,
    lead?.whatsapp,
  ];

  return String(candidates.find((value) => String(value || '').trim()) || '').trim();
}

async function executeOutboundCampaignBatch({ leads = [], messageTemplate = '' } = {}) {
  const successes = [];
  const failures = [];

  for (const lead of leads) {
    const contactTarget = resolveCampaignContactTarget(lead);
    const formattedMessage = renderCampaignMessageForLead(lead, messageTemplate).trim();

    if (!contactTarget || !formattedMessage) {
      const errorMessage = !contactTarget ? 'Lead sin destino válido de WhatsApp.' : 'Plantilla vacía para este lead.';
      failures.push(buildCampaignLeadSnapshot(lead, { errorMessage }));
      console.error('[campaign] Skipping lead without valid outbound payload:', { leadId: lead?.id, errorMessage });
      continue;
    }

    try {
      await api.sendWhatsAppChatMessage(contactTarget, { text: formattedMessage });
      successes.push(buildCampaignLeadSnapshot(lead));
    } catch (error) {
      failures.push(buildCampaignLeadSnapshot(lead, { errorMessage: error?.message || 'No se pudo enviar el mensaje.' }));
      console.error('[campaign] Failed to send WhatsApp campaign message:', {
        leadId: lead?.id,
        leadName: lead?.nombre || '',
        target: contactTarget,
        error,
      });
    }
  }

  return {
    attemptedAt: new Date().toISOString(),
    successes,
    failures,
  };
}

function createCampaignHistoryEntry({ campaignName, messageTemplate, audienceSize, result }) {
  return {
    id: createCampaignId(),
    campaignName: String(campaignName || '').trim() || 'Campaña sin nombre',
    timestamp: result.attemptedAt || new Date().toISOString(),
    totalAudienceSize: Number(audienceSize) || 0,
    successfulSends: result.successes.length,
    failedSends: result.failures.length,
    failedLeads: result.failures,
    messageTemplate,
    retryCount: 0,
    lastRetriedAt: null,
  };
}

function applyRetryToCampaignEntry(entry, result) {
  return {
    ...entry,
    successfulSends: Number(entry.successfulSends || 0) + result.successes.length,
    failedSends: result.failures.length,
    failedLeads: result.failures,
    retryCount: Number(entry.retryCount || 0) + 1,
    lastRetriedAt: result.attemptedAt || new Date().toISOString(),
  };
}

function ToolCard({ title, description, icon, accent = 'orange', ctaLabel, onClick, isDarkMode = false, disabled = false }) {
  const accentMap = {
    orange: {
      glow: 'bg-[#FF5A1F]/18',
      dot: 'bg-[#FF5A1F]',
      button: 'from-[#FF5A1F] via-[#FF7A00] to-[#FFB36B]',
    },
    green: {
      glow: 'bg-emerald-400/18',
      dot: 'bg-emerald-400',
      button: 'from-emerald-500 via-emerald-400 to-lime-300',
    },
    violet: {
      glow: 'bg-violet-400/18',
      dot: 'bg-violet-400',
      button: 'from-violet-600 via-fuchsia-500 to-purple-400',
    },
  };
  const palette = accentMap[accent] || accentMap.orange;

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border p-6 backdrop-blur-3xl ${isDarkMode ? 'border-white/10 bg-white/5 text-white shadow-[0_22px_60px_-34px_rgba(0,0,0,0.7)]' : 'border-white/70 bg-white/72 text-slate-900 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.14)]'}`}>
      <div className={`absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl ${palette.glow}`}></div>
      <div className={`absolute left-0 top-0 h-full w-1.5 ${palette.dot}`}></div>

      <div className="relative flex h-full min-h-[15rem] flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-[1.2rem] border ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/80 bg-white/80'}`}>
            {icon}
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-white/6 text-slate-300' : 'bg-white/80 text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${palette.dot}`}></span>
            Tool
          </span>
        </div>

        <div className="mt-8">
          <h3 className="text-[1.4rem] font-black tracking-[-0.03em]">{title}</h3>
          <p className={`mt-3 text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{description}</p>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 py-3.5 text-sm font-black transition-all ${
            disabled
              ? isDarkMode
                ? 'cursor-not-allowed bg-white/6 text-slate-500'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
              : `bg-gradient-to-r ${palette.button} text-white shadow-[0_14px_30px_-18px_rgba(255,90,31,0.55)] hover:-translate-y-0.5`
          }`}
        >
          <span>{ctaLabel}</span>
          {!disabled ? <ArrowRight size={16} /> : null}
        </button>
      </div>
    </div>
  );
}

function CampaignTableRow({ contact, isSelected, onToggle, isDarkMode = false }) {
  const primary = contact.nombre || contact.numero || 'Sin nombre';

  return (
    <tr className={`${isDarkMode ? 'border-white/8 hover:bg-white/[0.03]' : 'border-slate-200/80 hover:bg-orange-50/40'} border-b transition-colors`}>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onToggle(contact.id)}
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
            isSelected
              ? 'border-[#FF5A1F] bg-[#FF5A1F] text-white'
              : isDarkMode
                ? 'border-white/15 bg-white/5 text-transparent'
                : 'border-slate-300 bg-white text-transparent'
          }`}
          aria-label={`Seleccionar ${primary}`}
        >
          <Check size={13} strokeWidth={3} />
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{primary}</p>
          <p className={`truncate text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{contact.correo || contact.email || contact.origen || 'Sin correo'}</p>
        </div>
      </td>
      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{contact.numero || 'Sin número'}</td>
      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{contact.sector || 'General'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-white/6 text-slate-300' : 'bg-orange-50 text-[#FF5A1F]'}`}>
          {contact.pipeline_stage || 'Sin etapa'}
        </span>
      </td>
      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{contact.responsable || 'Sin asignar'}</td>
    </tr>
  );
}

function CampaignBuilder({ contacts = [], isDarkMode = false, onBack, onBulkChangeStatus, onCampaignLogged }) {
  const [campaignName, setCampaignName] = useState('');
  const [segmentPreset, setSegmentPreset] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [messageTemplate, setMessageTemplate] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [campaignNotice, setCampaignNotice] = useState(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedContacts = useMemo(() => contacts.filter((contact) => selectedSet.has(contact.id)), [contacts, selectedSet]);
  const contactsWithPhone = useMemo(() => contacts.filter((contact) => String(contact.numero || '').trim()).length, [contacts]);
  const activeStages = useMemo(() => new Set(contacts.map((contact) => String(contact.pipeline_stage || '').trim()).filter(Boolean)).size, [contacts]);
  const sectorOptions = useMemo(() => Array.from(new Set(contacts.map((contact) => String(contact.sector || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [contacts]);
  const countryOptions = useMemo(() => Array.from(new Set(contacts.map((contact) => String(contact.pais || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [contacts]);
  const stageOptions = useMemo(() => Array.from(new Set(contacts.map((contact) => String(contact.pipeline_stage || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [contacts]);
  const assigneeOptions = useMemo(() => Array.from(new Set(contacts.map((contact) => String(contact.responsable || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')), [contacts]);

  const filteredContacts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const activePreset = SEGMENT_PRESETS.find((preset) => preset.id === segmentPreset) || SEGMENT_PRESETS[0];

    return contacts.filter((contact) => {
      const matchesPreset = activePreset.matches(contact);
      const matchesSearch =
        !normalizedSearch ||
        String(contact.nombre || '').toLowerCase().includes(normalizedSearch) ||
        String(contact.numero || '').toLowerCase().includes(normalizedSearch);
      const matchesSector = sectorFilter === 'ALL' || String(contact.sector || '').trim() === sectorFilter;
      const matchesCountry = countryFilter === 'ALL' || String(contact.pais || '').trim() === countryFilter;
      const matchesStage = stageFilter === 'ALL' || String(contact.pipeline_stage || '').trim() === stageFilter;
      const matchesAssignee = assigneeFilter === 'ALL' || String(contact.responsable || '').trim() === assigneeFilter;
      return matchesPreset && matchesSearch && matchesSector && matchesCountry && matchesStage && matchesAssignee;
    });
  }, [assigneeFilter, contacts, countryFilter, searchTerm, sectorFilter, segmentPreset, stageFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / CAMPAIGN_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [assigneeFilter, countryFilter, searchTerm, sectorFilter, segmentPreset, stageFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!campaignNotice) return undefined;
    const timer = setTimeout(() => setCampaignNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [campaignNotice]);

  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * CAMPAIGN_PAGE_SIZE;
    return filteredContacts.slice(startIndex, startIndex + CAMPAIGN_PAGE_SIZE);
  }, [currentPage, filteredContacts]);

  const visibleIds = useMemo(() => paginatedContacts.map((contact) => contact.id).filter(Boolean), [paginatedContacts]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((contactId) => selectedSet.has(contactId));
  const hasAudience = selectedContacts.length > 0;

  const toggleContact = (contactId) => {
    setSelectedIds((current) => (
      current.includes(contactId)
        ? current.filter((value) => value !== contactId)
        : [...current, contactId]
    ));
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      if (visibleIds.length === 0) return current;
      if (visibleIds.every((contactId) => current.includes(contactId))) {
        return current.filter((contactId) => !visibleIds.includes(contactId));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleLaunchCampaign = async () => {
    if (!hasAudience || isLaunching) return;

    const trimmedTemplate = messageTemplate.trim();
    if (!trimmedTemplate) {
      setCampaignNotice({ tone: 'warning', title: 'Mensaje pendiente', message: 'Escribe la plantilla antes de lanzar la campaña.' });
      return;
    }

    setIsLaunching(true);
    try {
      const result = await executeOutboundCampaignBatch({
        leads: selectedContacts,
        messageTemplate: trimmedTemplate,
      });

      const sentLeadIds = result.successes.map((lead) => lead.id).filter(Boolean);
      if (sentLeadIds.length > 0) {
        onBulkChangeStatus?.(sentLeadIds, PIPELINE_STAGE_VALUES.NEW_LEAD);
      }

      onCampaignLogged?.(createCampaignHistoryEntry({
        campaignName,
        messageTemplate: trimmedTemplate,
        audienceSize: selectedContacts.length,
        result,
      }));

      setSelectedIds([]);
      setCampaignNotice({
        tone: result.failures.length === 0 && sentLeadIds.length > 0 ? 'success' : 'warning',
        title: sentLeadIds.length > 0 ? 'Campaña ejecutada' : 'Campaña con errores',
        message:
          sentLeadIds.length > 0
            ? `Se enviaron ${sentLeadIds.length} mensajes${result.failures.length > 0 ? ` y ${result.failures.length} fallaron` : ''}. Los enviados fueron movidos a ${PIPELINE_STAGE_VALUES.NEW_LEAD}.`
            : 'No se pudo enviar la campaña a los leads seleccionados. Revisa la conexión de WhatsApp y los números de destino.',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`pointer-events-none fixed right-4 top-24 z-40 w-[calc(100vw-2rem)] max-w-[24rem] transition-all duration-300 ease-out sm:right-6 ${hasAudience ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
        <div className={`pointer-events-auto relative overflow-hidden rounded-[2rem] border p-5 backdrop-blur-3xl ${isDarkMode ? 'border-white/10 bg-[#0f1117]/84 text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]' : 'border-white/75 bg-[rgba(15,23,42,0.78)] text-white shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)]'}`}>
          <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-[#25D366]/16 blur-[70px]"></div>
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#FF5A1F]/18 blur-[80px]"></div>

          <div className="relative">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Audience Summary</p>
                <h3 className="mt-2 text-[1.2rem] font-black tracking-[-0.03em]">Audiencia: {selectedContacts.length} prospectos</h3>
              </div>
              <button type="button" onClick={() => setSelectedIds([])} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-slate-300 transition-all hover:bg-white/12 hover:text-white" aria-label="Cerrar panel de campaña">
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Plantilla de WhatsApp</p>
              <textarea
                value={messageTemplate}
                onChange={(event) => setMessageTemplate(event.target.value)}
                placeholder="Hola {{nombre}}, te contacto para darte seguimiento sobre {{empresa}} en el sector {{sector}}..."
                className="mt-3 min-h-[11rem] w-full resize-none rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-500 focus:border-[#25D366]/45"
              />
              <p className="mt-3 text-xs leading-6 text-slate-400">
                Variables disponibles: <span className="font-bold text-slate-200">{'{{nombre}}'}</span>, <span className="font-bold text-slate-200">{'{{empresa}}'}</span>, <span className="font-bold text-slate-200">{'{{sector}}'}</span>
              </p>
            </div>

            <div className="mb-5 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Preview</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                {selectedContacts.slice(0, 3).map((lead) => lead.nombre || lead.numero || 'Sin nombre').join(', ')}
                {selectedContacts.length > 3 ? ` +${selectedContacts.length - 3} más` : ''}
              </p>
            </div>

            <button
              type="button"
              disabled={!hasAudience || isLaunching}
              onClick={handleLaunchCampaign}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[#25D366] px-4 py-4 text-sm font-black text-white shadow-[0_18px_36px_-18px_rgba(37,211,102,0.95)] transition-all hover:-translate-y-0.5 hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{isLaunching ? 'Lanzando...' : 'Lanzar Campaña'}</span>
            </button>
          </div>
        </div>
      </div>

      {campaignNotice ? (
        <div className={`fixed right-4 top-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-[1.25rem] border px-4 py-3 backdrop-blur-2xl sm:right-6 ${
          campaignNotice.tone === 'success'
            ? 'border-emerald-400/25 bg-[rgba(8,18,12,0.82)] text-white shadow-[0_20px_45px_-24px_rgba(16,185,129,0.55)]'
            : 'border-amber-400/25 bg-[rgba(24,18,8,0.82)] text-white shadow-[0_20px_45px_-24px_rgba(245,158,11,0.55)]'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${campaignNotice.tone === 'success' ? 'bg-emerald-500/18 text-emerald-300' : 'bg-amber-500/18 text-amber-300'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-sm font-black">{campaignNotice.title}</p>
              <p className="mt-1 text-sm text-slate-300">{campaignNotice.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`relative overflow-hidden rounded-[2.3rem] border px-6 py-6 sm:px-8 ${isDarkMode ? 'border-white/10 bg-white/5 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.72)]' : 'border-white/75 bg-white/72 text-slate-900 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.12)]'} backdrop-blur-3xl`}>
        <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[#FF5A1F]/16 blur-[80px]"></div>
        <div className="absolute right-4 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-[90px]"></div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onBack} className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}>
              <ArrowLeft size={14} />
              Volver a herramientas
            </button>

            <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-white/75 bg-white/80 text-slate-500'}`}>
              <MessageSquareShare size={14} className="text-[#FF5A1F]" />
              Campañas de WhatsApp
            </div>

            <div className="max-w-3xl">
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Nombre de campaña"
                className={`w-full border-0 bg-transparent p-0 text-[2rem] font-black tracking-[-0.05em] outline-none placeholder:font-black placeholder:tracking-[-0.05em] sm:text-[2.6rem] ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-300'}`}
              />
              <p className={`mt-3 max-w-2xl text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Selecciona contactos reales del directorio para preparar la siguiente campaña. Aquí ya puedes ejecutar envíos reales y guardar el resultado para seguimiento.
              </p>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[28rem]">
            {[
              { label: 'Contactos', value: contacts.length },
              { label: 'Seleccionados', value: selectedContacts.length },
              { label: 'Con WhatsApp', value: contactsWithPhone },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.35rem] border px-4 py-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/80 bg-white/80'}`}>
                <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.04em]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-[2rem] border ${isDarkMode ? 'border-white/10 bg-white/5 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.68)]' : 'border-white/75 bg-white/72 text-slate-900 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.12)]'} backdrop-blur-3xl`}>
        <div className={`border-b px-5 py-4 ${isDarkMode ? 'border-white/8' : 'border-slate-200/80'}`}>
          <div className="flex flex-wrap gap-2">
            {SEGMENT_PRESETS.map((preset) => {
              const isActive = preset.id === segmentPreset;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSegmentPreset(preset.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF5A1F] via-[#FF7A00] to-[#FFB36B] text-white shadow-[0_12px_24px_-14px_rgba(255,90,31,0.6)]'
                      : isDarkMode
                        ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white'
                        : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'
                  }`}
                >
                  <span>{preset.label}</span>
                  <span className={`${isActive ? 'text-orange-100' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{preset.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`grid gap-3 border-b px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.8fr))] ${isDarkMode ? 'border-white/8' : 'border-slate-200/80'}`}>
          <label className="min-w-0">
            <span className={`mb-2 block text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Buscar</span>
            <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre o número" className={`w-full rounded-[1rem] border px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-[#FF5A1F]/45' : 'border-white/80 bg-white/85 text-slate-900 placeholder:text-slate-400 focus:border-[#FF5A1F]/45'}`} />
          </label>
          <label>
            <span className={`mb-2 block text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sector</span>
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)} className={`w-full rounded-[1rem] border px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:border-[#FF5A1F]/45' : 'border-white/80 bg-white/85 text-slate-900 focus:border-[#FF5A1F]/45'}`}>
              <option value="ALL">Todos</option>
              {sectorOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span className={`mb-2 block text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>País</span>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} className={`w-full rounded-[1rem] border px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:border-[#FF5A1F]/45' : 'border-white/80 bg-white/85 text-slate-900 focus:border-[#FF5A1F]/45'}`}>
              <option value="ALL">Todos</option>
              {countryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span className={`mb-2 block text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Etapa</span>
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className={`w-full rounded-[1rem] border px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:border-[#FF5A1F]/45' : 'border-white/80 bg-white/85 text-slate-900 focus:border-[#FF5A1F]/45'}`}>
              <option value="ALL">Todas</option>
              {stageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span className={`mb-2 block text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Responsable</span>
            <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} className={`w-full rounded-[1rem] border px-4 py-3 text-sm outline-none transition-all ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:border-[#FF5A1F]/45' : 'border-white/80 bg-white/85 text-slate-900 focus:border-[#FF5A1F]/45'}`}>
              <option value="ALL">Todos</option>
              {assigneeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <div className={`flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-white/8' : 'border-slate-200/80'}`}>
          <div>
            <h3 className="text-lg font-black tracking-[-0.03em]">Directorio para campaña</h3>
            <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Página {Math.min(currentPage, totalPages)} de {totalPages} · {filteredContacts.length} visibles de {contacts.length} contactos · {activeStages} etapas activas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={toggleAll} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${allVisibleSelected ? 'border-[#FF5A1F] bg-[#FF5A1F] text-white' : isDarkMode ? 'border-white/15 text-transparent' : 'border-slate-300 text-transparent'}`}>
                <Check size={12} strokeWidth={3} />
              </span>
              Seleccionar visibles
            </button>
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-white/6 text-slate-300' : 'bg-orange-50 text-[#FF5A1F]'}`}>
              BigData Orange
              <span className="h-2 w-2 rounded-full bg-[#FF5A1F]"></span>
            </div>
          </div>
        </div>

        <div className="max-h-[38rem] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {['Sel', 'Contacto', 'Número', 'Sector', 'Etapa', 'Responsable'].map((label) => (
                  <th key={label} className={`sticky top-0 z-10 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-[#111111]/95 backdrop-blur-xl' : 'bg-[rgba(255,255,255,0.92)] backdrop-blur-xl'}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedContacts.map((contact) => (
                <CampaignTableRow key={contact.id} contact={contact} isSelected={selectedSet.has(contact.id)} onToggle={toggleContact} isDarkMode={isDarkMode} />
              ))}
            </tbody>
          </table>
        </div>

        {filteredContacts.length > 0 ? (
          <div className={`flex flex-col gap-4 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${isDarkMode ? 'border-white/8' : 'border-slate-200/80'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Mostrando {((currentPage - 1) * CAMPAIGN_PAGE_SIZE) + 1}-{Math.min(currentPage * CAMPAIGN_PAGE_SIZE, filteredContacts.length)} de {filteredContacts.length} contactos filtrados
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}>Anterior</button>
              <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-white/6 text-slate-300' : 'bg-orange-50 text-[#FF5A1F]'}`}>{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}>Siguiente</button>
            </div>
          </div>
        ) : null}

        {contacts.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-bold">No hay contactos disponibles en este workspace.</p>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cuando existan leads en el directorio, aquí se podrán seleccionar para futuras campañas.</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-base font-bold">No hay contactos para este segmento.</p>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Ajusta la búsqueda o los filtros para ver otro grupo y seleccionar solo ese bloque.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CampaignHistoryView({ history = [], isDarkMode = false, onBack, onRetryFailed, retryingCampaignId = '', notice = null }) {
  const [expandedCampaignId, setExpandedCampaignId] = useState('');

  const handleExportCsv = () => {
    if (!history.length) return;

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Nombre', 'Fecha', 'Total', 'Éxitos', 'Fallidos'],
      ...history.map((entry) => [
        entry.campaignName,
        formatCampaignTimestamp(entry.timestamp),
        entry.totalAudienceSize,
        entry.successfulSends,
        entry.failedSends,
      ]),
    ];

    const csvContent = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `campaign-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="space-y-6">
      {notice ? (
        <div className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-2xl ${
          notice.tone === 'success'
            ? 'border-emerald-400/25 bg-[rgba(8,18,12,0.82)] text-white shadow-[0_20px_45px_-24px_rgba(16,185,129,0.55)]'
            : 'border-amber-400/25 bg-[rgba(24,18,8,0.82)] text-white shadow-[0_20px_45px_-24px_rgba(245,158,11,0.55)]'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${notice.tone === 'success' ? 'bg-emerald-500/18 text-emerald-300' : 'bg-amber-500/18 text-amber-300'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-sm font-black">{notice.title}</p>
              <p className="mt-1 text-sm text-slate-300">{notice.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`relative overflow-hidden rounded-[2.3rem] border px-6 py-6 sm:px-8 ${isDarkMode ? 'border-white/10 bg-white/5 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.72)]' : 'border-white/75 bg-white/72 text-slate-900 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.12)]'} backdrop-blur-3xl`}>
        <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-[#FF5A1F]/16 blur-[80px]"></div>
        <div className="absolute right-4 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-[90px]"></div>

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <button type="button" onClick={onBack} className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}>
              <ArrowLeft size={14} />
              Volver a herramientas
            </button>

            <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-white/75 bg-white/80 text-slate-500'}`}>
              <Clock3 size={14} className="text-[#FF5A1F]" />
              Historial de Campañas
            </div>

            <h2 className="max-w-3xl text-[2rem] font-black tracking-[-0.05em] sm:text-[2.5rem]">Seguimiento de ejecuciones, fallos y reintentos.</h2>
            <p className={`mt-3 max-w-2xl text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Revisa cada campaña lanzada, cuántos envíos salieron bien y vuelve a intentar solo los fallidos sin tocar el resto.</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-[28rem]">
            {[
              { label: 'Campañas', value: history.length },
              { label: 'Con fallidos', value: history.filter((entry) => entry.failedSends > 0).length },
              { label: 'Reintentos', value: history.reduce((sum, entry) => sum + Number(entry.retryCount || 0), 0) },
            ].map((item) => (
              <div key={item.label} className={`rounded-[1.35rem] border px-4 py-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/80 bg-white/80'}`}>
                <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.04em]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={history.length === 0}
            className={`inline-flex items-center gap-2 rounded-[1rem] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
              isDarkMode
                ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white'
                : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'
            }`}
          >
            <Download size={14} className="text-[#FF5A1F]" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className={`overflow-hidden rounded-[2rem] border ${isDarkMode ? 'border-white/10 bg-white/5 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.68)]' : 'border-white/75 bg-white/72 text-slate-900 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.12)]'} backdrop-blur-3xl`}>
        {history.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-lg font-black">Todavía no hay campañas ejecutadas.</p>
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cuando lances la primera campaña aparecerá aquí con su audiencia, resultados y fallidos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {['Campaña', 'Fecha', 'Audiencia', 'Éxitos', 'Fallidos', 'Acción'].map((label) => (
                    <th key={label} className={`px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-[#111111]/95' : 'bg-[rgba(255,255,255,0.92)]'} backdrop-blur-xl`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const isRetrying = retryingCampaignId === entry.id;
                  const isExpanded = expandedCampaignId === entry.id;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr className={`${isDarkMode ? 'border-white/8' : 'border-slate-200/80'} border-b align-top`}>
                        <td className="px-4 py-4">
                          <div className="min-w-[14rem]">
                            <button
                              type="button"
                              onClick={() => setExpandedCampaignId((current) => (current === entry.id ? '' : entry.id))}
                              className="group flex items-start gap-3 text-left"
                            >
                              <span className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-all ${isDarkMode ? 'bg-white/6 text-slate-300 group-hover:bg-white/10 group-hover:text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-orange-50 group-hover:text-[#FF5A1F]'}`}>
                                <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                              </span>
                              <div>
                                <p className="text-sm font-black">{entry.campaignName}</p>
                                <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  Reintentos: {entry.retryCount || 0}
                                  {entry.lastRetriedAt ? ` · último ${formatCampaignTimestamp(entry.lastRetriedAt)}` : ''}
                                </p>
                              </div>
                            </button>
                          </div>
                        </td>
                        <td className={`px-4 py-4 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatCampaignTimestamp(entry.timestamp)}</td>
                        <td className={`px-4 py-4 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{entry.totalAudienceSize}</td>
                        <td className="px-4 py-4"><span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">{entry.successfulSends}</span></td>
                        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${entry.failedSends > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>{entry.failedSends}</span></td>
                        <td className="px-4 py-4">
                          {entry.failedSends > 0 ? (
                            <button
                              type="button"
                              onClick={() => onRetryFailed(entry.id)}
                              disabled={isRetrying}
                              className="inline-flex items-center gap-2 rounded-[1rem] bg-[#25D366] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_32px_-18px_rgba(37,211,102,0.95)] transition-all hover:-translate-y-0.5 hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RotateCcw size={14} />
                              <span>{isRetrying ? 'Reintentando...' : 'Reintentar Fallidos'}</span>
                            </button>
                          ) : (
                            <span className={`inline-flex rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${isDarkMode ? 'bg-white/6 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Completada</span>
                          )}
                        </td>
                      </tr>
                      <tr className={`${isDarkMode ? 'border-white/8' : 'border-slate-200/80'} border-b`}>
                        <td colSpan={6} className="p-0">
                          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                            <div className="overflow-hidden">
                              <div className={`mx-4 mb-4 rounded-[1.25rem] border px-4 py-4 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200/80 bg-white/80'}`}>
                                {entry.failedLeads?.length > 0 ? (
                                  <>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                      <p className="text-sm font-black">Fallidos de la campaña</p>
                                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${isDarkMode ? 'bg-white/6 text-slate-300' : 'bg-orange-50 text-[#FF5A1F]'}`}>
                                        {entry.failedLeads.length} leads
                                      </span>
                                    </div>
                                    <div className="overflow-hidden rounded-[1rem] border border-white/10">
                                      <div className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'bg-white/6 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                                        <span>Lead</span>
                                        <span>WhatsApp / JID</span>
                                      </div>
                                      {entry.failedLeads.map((lead, index) => (
                                        <div
                                          key={`${entry.id}-failed-${lead.id || lead.numero || index}`}
                                          className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 px-4 py-3 text-sm ${index > 0 ? (isDarkMode ? 'border-t border-white/8' : 'border-t border-slate-200/70') : ''}`}
                                        >
                                          <div className="min-w-0">
                                            <p className="truncate font-bold">{lead.nombre || 'Sin nombre'}</p>
                                            <p className={`mt-1 truncate text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{lead.errorMessage || 'Sin detalle de error'}</p>
                                          </div>
                                          <p className={`truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{lead.numero || lead.chatJid || lead.jid || 'Sin destino'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Esta campaña no tiene leads fallidos pendientes.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function ToolsView({ isDarkMode = false, onOpenShareLeads, records = [], currentUser = null, onBulkChangeStatus }) {
  const [viewMode, setViewMode] = useState('grid');
  const [retryingCampaignId, setRetryingCampaignId] = useState('');
  const [historyNotice, setHistoryNotice] = useState(null);
  const [campaignHistory, setCampaignHistory] = usePersistentState(
    buildCampaignHistoryKey(currentUser?.workspaceId || 'guest'),
    [],
  );

  const campaignContacts = useMemo(() => {
    const scopedRecords = currentUser?.workspaceId
      ? records.filter((record) => record.workspaceId === currentUser.workspaceId)
      : records;

    return scopedRecords
      .filter((record) => !record?.isArchived)
      .map((record) => ({
        ...record,
        nombre: String(record?.nombre || '').trim() || '',
        numero: String(record?.numero || '').trim(),
      }))
      .sort((left, right) => {
        const leftName = String(left.nombre || left.numero || '').toLowerCase();
        const rightName = String(right.nombre || right.numero || '').toLowerCase();
        return leftName.localeCompare(rightName, 'es');
      });
  }, [currentUser?.workspaceId, records]);

  useEffect(() => {
    if (!historyNotice) return undefined;
    const timer = setTimeout(() => setHistoryNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [historyNotice]);

  const handleCampaignLogged = (entry) => {
    setCampaignHistory((current) => [entry, ...(current || [])]);
  };

  const handleRetryFailedCampaign = async (campaignId) => {
    const targetCampaign = (campaignHistory || []).find((entry) => entry.id === campaignId);
    if (!targetCampaign || !Array.isArray(targetCampaign.failedLeads) || targetCampaign.failedLeads.length === 0) {
      return;
    }

    setRetryingCampaignId(campaignId);
    try {
      const result = await executeOutboundCampaignBatch({
        leads: targetCampaign.failedLeads,
        messageTemplate: targetCampaign.messageTemplate || '',
      });

      const successfulIds = result.successes.map((lead) => lead.id).filter(Boolean);
      if (successfulIds.length > 0) {
        onBulkChangeStatus?.(successfulIds, PIPELINE_STAGE_VALUES.NEW_LEAD);
      }

      setCampaignHistory((current) =>
        (current || []).map((entry) => (
          entry.id === campaignId
            ? applyRetryToCampaignEntry(entry, result)
            : entry
        )),
      );

      setHistoryNotice({
        tone: result.failures.length === 0 && result.successes.length > 0 ? 'success' : 'warning',
        title: result.successes.length > 0 ? 'Reintento completado' : 'Reintento con errores',
        message:
          result.successes.length > 0
            ? `Se recuperaron ${result.successes.length} envíos${result.failures.length > 0 ? ` y ${result.failures.length} siguen fallando` : ''}.`
            : 'No se pudo recuperar ningún envío de esta campaña.',
      });
    } finally {
      setRetryingCampaignId('');
    }
  };

  return (
    <div className={`min-h-full overflow-y-auto px-5 py-6 sm:px-8 lg:px-10 ${isDarkMode ? 'bg-[#080808] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="mx-auto max-w-7xl">
        {viewMode === 'grid' ? (
          <>
            <div className="relative overflow-hidden rounded-[2.4rem] border px-6 py-7 sm:px-8 lg:px-10">
              <div className={`absolute inset-0 ${isDarkMode ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]' : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,252,0.68))]'} backdrop-blur-3xl`}></div>
              <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-[#FF7A00]/18 blur-[80px]"></div>
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-400/12 blur-[90px]"></div>

              <div className="relative">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-white/70 bg-white/75 text-slate-500'}`}>
                    <Users2 size={14} className="text-[#FF7A00]" />
                    <span>Herramientas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('history')}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${isDarkMode ? 'bg-white/6 text-slate-300 hover:bg-white/10 hover:text-white' : 'bg-white/85 text-slate-500 hover:bg-white hover:text-slate-700'}`}
                  >
                    <Clock3 size={14} className="text-[#FF5A1F]" />
                    Historial de Campañas
                  </button>
                </div>
                <h1 className="max-w-3xl text-[2.35rem] font-black leading-[1.02] tracking-[-0.05em] sm:text-[3rem]">Centro operativo para crecer, invitar y preparar campañas.</h1>
                <p className={`mt-4 max-w-2xl text-[15px] leading-8 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Mantuvimos la lógica actual del equipo y abrimos espacio para herramientas nuevas dentro de una misma vista más ordenada, premium y lista para ejecución real.
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
              <ToolCard
                title="Invitar a equipo"
                description="Mantén el acceso al módulo actual para vincular socios, compartir leads y seguir gestionando la estructura comercial desde Mi Equipo de Ventas."
                icon={<Share2 size={24} className="text-[#FF5A1F]" />}
                accent="orange"
                ctaLabel="Abrir equipo"
                onClick={onOpenShareLeads}
                isDarkMode={isDarkMode}
              />

              <ToolCard
                title="Campañas de WhatsApp"
                description="Prepara campañas sobre contactos reales del directorio con segmentación, ejecución y seguimiento de fallidos desde una sola vista."
                icon={<MessageSquareShare size={24} className="text-emerald-500" />}
                accent="green"
                ctaLabel="Crear Campaña"
                onClick={() => setViewMode('campaigns')}
                isDarkMode={isDarkMode}
              />

              <ToolCard
                title="Asistentes de IA y Bots"
                description="Espacio reservado para futuros asistentes, automatizaciones conversacionales y configuraciones avanzadas del equipo."
                icon={<Bot size={24} className="text-violet-500" />}
                accent="violet"
                ctaLabel="Configurar"
                disabled
                isDarkMode={isDarkMode}
              />
            </div>
          </>
        ) : viewMode === 'campaigns' ? (
          <CampaignBuilder
            contacts={campaignContacts}
            isDarkMode={isDarkMode}
            onBack={() => setViewMode('grid')}
            onBulkChangeStatus={onBulkChangeStatus}
            onCampaignLogged={handleCampaignLogged}
          />
        ) : (
          <CampaignHistoryView
            history={campaignHistory || []}
            isDarkMode={isDarkMode}
            onBack={() => setViewMode('grid')}
            onRetryFailed={handleRetryFailedCampaign}
            retryingCampaignId={retryingCampaignId}
            notice={historyNotice}
          />
        )}
      </div>
    </div>
  );
}
