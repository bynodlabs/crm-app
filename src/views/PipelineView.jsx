import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import { getLocalISODate } from '../lib/date';
import { calcularPuntajeLead } from '../lib/lead-utils';
import {
  getPipelineStageMeta,
  normalizePipelineStage,
  PIPELINE_STAGE_VALUES,
} from '../lib/lead-pipeline';

const WHATSAPP_GREEN = '#25D366';
const BIGDATA_ORANGE = '#FF5A1F';
const ACTIVE_VIEW_STAGES = [
  PIPELINE_STAGE_VALUES.NEW_LEAD,
  PIPELINE_STAGE_VALUES.HOT_LEAD,
  PIPELINE_STAGE_VALUES.PAYMENT,
  PIPELINE_STAGE_VALUES.CUSTOMER,
];
const ARCHIVED_VIEW_STAGES = [
  PIPELINE_STAGE_VALUES.NEW,
  PIPELINE_STAGE_VALUES.COLD_LEAD,
  PIPELINE_STAGE_VALUES.LOST,
];
const STAGE_PROGRESS = {
  [PIPELINE_STAGE_VALUES.NEW]: 10,
  [PIPELINE_STAGE_VALUES.NEW_LEAD]: 28,
  [PIPELINE_STAGE_VALUES.HOT_LEAD]: 62,
  [PIPELINE_STAGE_VALUES.PAYMENT]: 88,
  [PIPELINE_STAGE_VALUES.CUSTOMER]: 100,
  [PIPELINE_STAGE_VALUES.COLD_LEAD]: 22,
  [PIPELINE_STAGE_VALUES.LOST]: 100,
};

function formatRelativeTime(dateValue) {
  if (!dateValue) return 'Sin actividad';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'Sin actividad';

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} d`;

  return parsed.toLocaleDateString('es-MX', {
    month: 'short',
    day: 'numeric',
  });
}

function getRecordLastActivity(record) {
  const historyDates = Array.isArray(record?.historial)
    ? record.historial
        .map((entry) => entry?.fecha)
        .filter(Boolean)
    : [];

  const candidates = [
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

function getCardTheme(stageValue, isDarkMode) {
  if (stageValue === PIPELINE_STAGE_VALUES.HOT_LEAD) {
    return {
      cardClass: 'bg-[linear-gradient(145deg,#ff7a72,#ff5a1f)] text-white border-transparent shadow-[0_18px_40px_rgba(255,90,31,0.28)]',
      progressTrackClass: 'bg-black/15',
      progressFillClass: 'bg-white',
      mutedClass: 'text-white/80',
      iconButtonClass: 'text-white/80 hover:bg-white/15',
      dividerClass: 'border-white/20',
      bubbleClass: 'bg-white/16 text-white',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.PAYMENT) {
    return {
      cardClass: 'bg-[linear-gradient(145deg,#b88cff,#8758ff)] text-white border-transparent shadow-[0_18px_40px_rgba(136,88,255,0.28)]',
      progressTrackClass: 'bg-black/15',
      progressFillClass: 'bg-white',
      mutedClass: 'text-white/80',
      iconButtonClass: 'text-white/80 hover:bg-white/15',
      dividerClass: 'border-white/20',
      bubbleClass: 'bg-white/16 text-white',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.CUSTOMER) {
    return {
      cardClass: 'bg-[linear-gradient(145deg,#6ce0e2,#25D366)] text-[#072313] border-transparent shadow-[0_18px_40px_rgba(37,211,102,0.22)]',
      progressTrackClass: 'bg-black/10',
      progressFillClass: 'bg-[#0b1f16]',
      mutedClass: 'text-[#0b1f16]/75',
      iconButtonClass: 'text-[#0b1f16]/75 hover:bg-black/10',
      dividerClass: 'border-[#0b1f16]/12',
      bubbleClass: 'bg-black/10 text-[#0b1f16]',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.LOST) {
    return {
      cardClass: isDarkMode
        ? 'bg-[linear-gradient(145deg,rgba(74,20,20,0.92),rgba(54,10,18,0.96))] text-white border border-rose-400/15 shadow-[0_16px_34px_rgba(127,29,29,0.22)]'
        : 'bg-[linear-gradient(145deg,#fff1f2,#ffe4e6)] text-slate-900 border border-rose-100 shadow-[0_14px_32px_rgba(225,29,72,0.08)]',
      progressTrackClass: isDarkMode ? 'bg-black/20' : 'bg-rose-100',
      progressFillClass: isDarkMode ? 'bg-rose-300' : 'bg-rose-500',
      mutedClass: isDarkMode ? 'text-rose-100/78' : 'text-rose-700',
      iconButtonClass: isDarkMode ? 'text-rose-100/80 hover:bg-white/10' : 'text-rose-400 hover:bg-white/70',
      dividerClass: isDarkMode ? 'border-white/10' : 'border-rose-100',
      bubbleClass: isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-rose-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.COLD_LEAD) {
    return {
      cardClass: isDarkMode
        ? 'bg-[linear-gradient(145deg,rgba(27,31,40,0.92),rgba(15,18,24,0.96))] text-white border border-white/8 shadow-[0_16px_34px_rgba(2,6,23,0.4)]'
        : 'bg-[linear-gradient(145deg,#f8fafc,#eef2f7)] text-slate-900 border border-slate-200 shadow-[0_14px_28px_rgba(15,23,42,0.06)]',
      progressTrackClass: isDarkMode ? 'bg-black/20' : 'bg-slate-200',
      progressFillClass: isDarkMode ? 'bg-slate-300' : 'bg-slate-500',
      mutedClass: isDarkMode ? 'text-slate-300' : 'text-slate-500',
      iconButtonClass: isDarkMode ? 'text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:bg-white',
      dividerClass: isDarkMode ? 'border-white/10' : 'border-slate-200',
      bubbleClass: isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.NEW) {
    return {
      cardClass: isDarkMode
        ? 'bg-[linear-gradient(145deg,rgba(14,17,24,0.92),rgba(25,28,36,0.94))] text-white border border-white/10 shadow-[0_16px_34px_rgba(15,23,42,0.32)]'
        : 'bg-white/92 text-slate-800 border border-white/60 shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur-sm',
      progressTrackClass: isDarkMode ? 'bg-black/20' : 'bg-slate-100',
      progressFillClass: isDarkMode ? 'bg-sky-300' : 'bg-sky-500',
      mutedClass: isDarkMode ? 'text-slate-300' : 'text-slate-500',
      iconButtonClass: isDarkMode ? 'text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:bg-slate-100',
      dividerClass: isDarkMode ? 'border-white/10' : 'border-slate-100',
      bubbleClass: isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-700',
    };
  }

  return {
    cardClass: isDarkMode
      ? 'bg-[linear-gradient(145deg,rgba(14,17,24,0.95),rgba(24,28,36,0.94))] text-white border border-white/10 shadow-[0_16px_34px_rgba(15,23,42,0.35)]'
      : 'bg-white/92 text-slate-800 border border-white/60 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm',
    progressTrackClass: isDarkMode ? 'bg-black/20' : 'bg-slate-100',
    progressFillClass: isDarkMode ? 'bg-[#FF7A00]' : 'bg-[#FF5A1F]',
    mutedClass: isDarkMode ? 'text-slate-300' : 'text-slate-500',
    iconButtonClass: isDarkMode ? 'text-slate-300 hover:bg-white/8' : 'text-slate-400 hover:bg-slate-100',
    dividerClass: isDarkMode ? 'border-white/10' : 'border-slate-100',
    bubbleClass: isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-700',
  };
}

function getStageAccent(stageValue, isDarkMode) {
  if (stageValue === PIPELINE_STAGE_VALUES.HOT_LEAD) {
    return {
      glowClass: 'from-[#ff8a72]/35 via-[#ff5a1f]/15 to-transparent',
      dotClass: 'bg-[#FF5A1F]',
      badgeClass: isDarkMode
        ? 'border-orange-400/20 bg-orange-500/12 text-orange-200'
        : 'border-orange-200 bg-orange-50 text-[#FF5A1F]',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.PAYMENT) {
    return {
      glowClass: 'from-[#b88cff]/35 via-[#8758ff]/15 to-transparent',
      dotClass: 'bg-[#a970ff]',
      badgeClass: isDarkMode
        ? 'border-purple-400/20 bg-purple-500/12 text-purple-200'
        : 'border-purple-200 bg-purple-50 text-purple-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.CUSTOMER) {
    return {
      glowClass: 'from-[#6ce0e2]/30 via-[#25D366]/14 to-transparent',
      dotClass: 'bg-[#25D366]',
      badgeClass: isDarkMode
        ? 'border-emerald-400/20 bg-emerald-500/12 text-emerald-200'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.LOST) {
    return {
      glowClass: 'from-rose-400/28 via-rose-500/10 to-transparent',
      dotClass: 'bg-rose-400',
      badgeClass: isDarkMode
        ? 'border-rose-400/20 bg-rose-500/12 text-rose-200'
        : 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.COLD_LEAD) {
    return {
      glowClass: 'from-slate-400/25 via-slate-500/10 to-transparent',
      dotClass: 'bg-slate-400',
      badgeClass: isDarkMode
        ? 'border-slate-400/20 bg-slate-500/10 text-slate-200'
        : 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.NEW) {
    return {
      glowClass: 'from-sky-300/28 via-sky-400/10 to-transparent',
      dotClass: 'bg-sky-400',
      badgeClass: isDarkMode
        ? 'border-sky-400/20 bg-sky-500/10 text-sky-200'
        : 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }

  return {
    glowClass: 'from-orange-300/28 via-orange-400/10 to-transparent',
    dotClass: 'bg-[#FF7A00]',
    badgeClass: isDarkMode
      ? 'border-orange-400/20 bg-orange-500/10 text-orange-200'
      : 'border-orange-200 bg-orange-50 text-[#FF5A1F]',
  };
}

function getUrgentTaskMeta(stageValue) {
  if (stageValue === PIPELINE_STAGE_VALUES.HOT_LEAD) {
    return {
      title: 'Cierre pendiente',
      cardClass: 'bg-[linear-gradient(145deg,#ff8a7a,#ff6a4d)] text-gray-900 shadow-[0_10px_30px_rgba(255,138,122,0.22)]',
      badgeClass: 'bg-gray-900 text-white',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.PAYMENT) {
    return {
      title: 'Pago por confirmar',
      cardClass: 'bg-[linear-gradient(145deg,#b88cff,#9a66ff)] text-gray-900 shadow-[0_10px_30px_rgba(184,140,255,0.22)]',
      badgeClass: 'bg-gray-900 text-white',
    };
  }

  if (stageValue === PIPELINE_STAGE_VALUES.COLD_LEAD) {
    return {
      title: 'Reactivar lead',
      cardClass: 'bg-[linear-gradient(145deg,#6ce0e2,#8ae7c5)] text-gray-900 shadow-[0_10px_30px_rgba(108,224,226,0.22)]',
      badgeClass: 'bg-gray-900 text-white',
    };
  }

  return {
    title: 'Primer contacto',
    cardClass: 'bg-[linear-gradient(145deg,#ffd89c,#ffb86b)] text-gray-900 shadow-[0_10px_30px_rgba(255,184,107,0.2)]',
    badgeClass: 'bg-gray-900 text-white',
  };
}

function getChartBarLabel(index, last7Days) {
  if (index === 0) return last7Days[0];
  if (index === 3) return last7Days[3];
  if (index === 6) return last7Days[6];
  return '';
}

function getOwnerStack(record, usersById, usersByName) {
  const stack = [];
  const seenIds = new Set();

  const ownerById = record?.propietarioId ? usersById.get(record.propietarioId) : null;
  const ownerByName = record?.responsable ? usersByName.get(record.responsable.trim().toLowerCase()) : null;

  [ownerById, ownerByName]
    .filter(Boolean)
    .forEach((user) => {
      const identity = String(user.id || user.email || user.nombre || '');
      if (!identity || seenIds.has(identity)) return;
      seenIds.add(identity);
      stack.push(user);
    });

  return stack.slice(0, 3);
}

function buildPipelineCard(record, usersById, usersByName, isDarkMode) {
  const normalizedStage = normalizePipelineStage(record.pipeline_stage, record);
  const score = calcularPuntajeLead(record);
  const progress = Math.max(
    STAGE_PROGRESS[normalizedStage] || 0,
    normalizedStage === PIPELINE_STAGE_VALUES.CUSTOMER ? 100 : Math.min(100, Math.round(score * 0.7)),
  );
  const lastActivityDate = getRecordLastActivity(record);
  const historyCount = Array.isArray(record.historial) ? record.historial.length : 0;

  return {
    ...record,
    normalizedStage,
    stageMeta: getPipelineStageMeta(normalizedStage, record),
    progress,
    score,
    timeLabel: formatRelativeTime(lastActivityDate),
    lastActivityDate,
    historyCount,
    ownerStack: getOwnerStack(record, usersById, usersByName),
    subtitle: record.sector || record.origen || record.categoria || 'Sin clasificar',
    footerLabel: record.nombre || 'Sin nombre',
    theme: getCardTheme(normalizedStage, isDarkMode),
  };
}

function PipelineLeadCard({
  card,
  isDarkMode,
  isViewOnly,
  isDragging,
  onDragStart,
  onDragEnd,
  onSelect,
}) {
  const isBrightCard = [PIPELINE_STAGE_VALUES.CUSTOMER].includes(card.normalizedStage);
  const accent = getStageAccent(card.normalizedStage, isDarkMode);

  return (
    <article
      draggable={!isViewOnly}
      onDragStart={() => onDragStart(card.id)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect?.(card)}
      className={`pipeline-lead-card ${card.theme.cardClass} ${isDragging ? 'scale-[0.98] opacity-60' : 'opacity-100'} group relative cursor-pointer overflow-hidden rounded-[1.65rem] border p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_45px_-28px_rgba(15,23,42,0.4)]`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${accent.glowClass} opacity-90`}></div>
      <div className="pointer-events-none absolute inset-[1px] rounded-[1.5rem] border border-white/8 opacity-60"></div>
      {card.normalizedStage !== PIPELINE_STAGE_VALUES.NEW && card.normalizedStage !== PIPELINE_STAGE_VALUES.COLD_LEAD ? (
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/14 blur-2xl"></div>
      ) : null}

      <div className="relative z-10">
        <div className="flex min-h-[4.25rem] items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3">
            {card.ownerStack.length === 0 ? (
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold shadow-[0_8px_20px_-16px_rgba(15,23,42,0.45)] ${card.theme.bubbleClass}`}>
                NA
              </div>
            ) : (
              <>
                {card.ownerStack.slice(0, 2).map((user) => (
                  <div key={user.id || user.email || user.nombre} className="shrink-0 rounded-full ring-2 ring-black/5">
                    <AvatarInitials
                      name={user.nombre}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                      isDarkMode={isDarkMode}
                    />
                  </div>
                ))}
                {card.ownerStack.length > 2 ? (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${card.theme.bubbleClass}`}>
                    +{card.ownerStack.length - 2}
                  </div>
                ) : null}
              </>
            )}

            <div className={`truncate text-[0.95rem] font-bold leading-tight ${isBrightCard ? 'text-[#081b12]' : 'text-white'}`}>
              {card.footerLabel}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function PipelineColumn({
  stageValue,
  cards,
  isDarkMode,
  isViewOnly,
  isDropTarget,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragStart,
  onDragEnd,
  draggedRecordId,
  onSelectRecord,
}) {
  const meta = getPipelineStageMeta(stageValue);
  const accent = getStageAccent(stageValue, isDarkMode);

  return (
    <section className="pipeline-column flex h-full w-[232px] flex-col xl:w-[244px]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_18px_rgba(255,122,26,0.38)] ${accent.dotClass}`}></span>
          <h3 className={`text-[13px] font-bold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-100' : 'text-slate-700/85'}`}>
            {meta.label}
          </h3>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${accent.badgeClass}`}>
          {cards.length}
        </span>
      </div>

      <div
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        className={`pipeline-column-body pipeline-column-scroll relative flex min-h-[12.5rem] flex-1 flex-col gap-2.5 overflow-y-auto rounded-[1.8rem] border p-2.5 transition-all duration-200 ${
          isDropTarget
            ? isDarkMode
              ? 'border-orange-400/40 bg-orange-500/10 shadow-[0_0_0_1px_rgba(255,122,26,0.25),0_18px_45px_-30px_rgba(255,122,26,0.55)]'
              : 'border-orange-200 bg-orange-50/70 shadow-[0_18px_45px_-34px_rgba(255,90,31,0.28)]'
            : isDarkMode
              ? 'border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] backdrop-blur-2xl'
              : 'border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.16))] backdrop-blur-2xl'
        }`}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-[1.8rem] bg-gradient-to-r ${accent.glowClass} opacity-65`}></div>
        <div className="pointer-events-none absolute inset-[1px] rounded-[1.7rem] border border-white/8 opacity-60"></div>
        {cards.map((card) => (
          <PipelineLeadCard
            key={card.id}
            card={card}
            isDarkMode={isDarkMode}
            isViewOnly={isViewOnly}
            isDragging={draggedRecordId === card.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onSelect={onSelectRecord}
          />
        ))}

        {cards.length === 0 ? (
          <div className={`flex flex-1 items-center justify-center rounded-[1.35rem] border border-dashed px-4 py-8 text-center text-[13px] font-medium ${
            isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}>
            Suelta aqui un lead o espera nuevos movimientos.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PipelineView({
  records = [],
  usersDb = [],
  currentUser = null,
  onChangeStatus,
  onSelectRecord,
  isViewOnly = false,
  isDarkMode = false,
}) {
  const [view, setView] = useState('Active');
  const [draggedRecordId, setDraggedRecordId] = useState('');
  const [dragOverStage, setDragOverStage] = useState('');
  const boardRef = useRef(null);
  const boardPointerRef = useRef({
    isPointerDown: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const usersById = useMemo(
    () => new Map(usersDb.map((user) => [user.id, user])),
    [usersDb],
  );
  const usersByName = useMemo(
    () =>
      new Map(
        usersDb
          .filter((user) => user?.nombre)
          .map((user) => [String(user.nombre).trim().toLowerCase(), user]),
      ),
    [usersDb],
  );

  const pipelineCards = useMemo(
    () =>
      records
        .map((record) => buildPipelineCard(record, usersById, usersByName, isDarkMode))
        .sort((a, b) => {
          const aTime = a.lastActivityDate ? a.lastActivityDate.getTime() : 0;
          const bTime = b.lastActivityDate ? b.lastActivityDate.getTime() : 0;
          return b.score - a.score || bTime - aTime;
        }),
    [isDarkMode, records, usersById, usersByName],
  );

  const currentStages = view === 'Active' ? ACTIVE_VIEW_STAGES : ARCHIVED_VIEW_STAGES;
  const stageColumns = useMemo(
    () =>
      currentStages.map((stageValue) => ({
        stageValue,
        cards: pipelineCards.filter((card) => card.normalizedStage === stageValue),
      })),
    [currentStages, pipelineCards],
  );

  const totalViewCards = stageColumns.reduce((sum, column) => sum + column.cards.length, 0);
  const activeCount = pipelineCards.filter((card) => ACTIVE_VIEW_STAGES.includes(card.normalizedStage)).length;
  const archivedCount = pipelineCards.filter((card) => ARCHIVED_VIEW_STAGES.includes(card.normalizedStage)).length;
  const customerCount = pipelineCards.filter((card) => card.normalizedStage === PIPELINE_STAGE_VALUES.CUSTOMER).length;
  const workedCount = pipelineCards.filter((card) =>
    [PIPELINE_STAGE_VALUES.HOT_LEAD, PIPELINE_STAGE_VALUES.PAYMENT, PIPELINE_STAGE_VALUES.CUSTOMER].includes(card.normalizedStage),
  ).length;
  const conversionRate = Math.round((customerCount / Math.max(workedCount, 1)) * 100);
  const newBucketCount = pipelineCards.filter((card) =>
    [PIPELINE_STAGE_VALUES.NEW, PIPELINE_STAGE_VALUES.NEW_LEAD].includes(card.normalizedStage),
  ).length;
  const workedBucketCount = workedCount;
  const archivedBucketCount = pipelineCards.filter((card) =>
    [PIPELINE_STAGE_VALUES.COLD_LEAD, PIPELINE_STAGE_VALUES.LOST].includes(card.normalizedStage),
  ).length;
  const totalBucketBase = Math.max(newBucketCount + workedBucketCount + archivedBucketCount, 1);
  const newBucketPct = Math.round((newBucketCount / totalBucketBase) * 100);
  const workedBucketPct = Math.round((workedBucketCount / totalBucketBase) * 100);
  const archivedBucketPct = Math.max(0, 100 - newBucketPct - workedBucketPct);

  const urgentTasks = useMemo(() => {
    const now = Date.now();

    return pipelineCards
      .filter((card) =>
        [
          PIPELINE_STAGE_VALUES.NEW,
          PIPELINE_STAGE_VALUES.NEW_LEAD,
          PIPELINE_STAGE_VALUES.HOT_LEAD,
          PIPELINE_STAGE_VALUES.PAYMENT,
          PIPELINE_STAGE_VALUES.COLD_LEAD,
        ].includes(card.normalizedStage),
      )
      .map((card) => {
        const lastActivityMs = card.lastActivityDate ? card.lastActivityDate.getTime() : 0;
        const elapsedHours = lastActivityMs ? Math.max(1, Math.floor((now - lastActivityMs) / 3600000)) : 72;
        const stageWeight = ({
          [PIPELINE_STAGE_VALUES.PAYMENT]: 80,
          [PIPELINE_STAGE_VALUES.HOT_LEAD]: 65,
          [PIPELINE_STAGE_VALUES.NEW_LEAD]: 52,
          [PIPELINE_STAGE_VALUES.NEW]: 40,
          [PIPELINE_STAGE_VALUES.COLD_LEAD]: 35,
        })[card.normalizedStage] || 20;

        return {
          ...card,
          urgencyScore: stageWeight + elapsedHours + Math.round(card.score * 0.35),
          elapsedHours,
          urgentMeta: getUrgentTaskMeta(card.normalizedStage),
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
      .slice(0, 3);
  }, [pipelineCards]);

  const last7Days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return getLocalISODate(date);
      }),
    [],
  );

  const activityData = useMemo(() => {
    const labels = last7Days.map((dateStr) => {
      const parsed = new Date(`${dateStr}T12:00:00`);
      return parsed.toLocaleDateString('es-MX', { weekday: 'short' });
    });
    const counts = last7Days.map((dateStr) =>
      records.filter((record) => String(record.fechaIngreso || '').slice(0, 10) === dateStr).length,
    );
    const max = Math.max(...counts, 1);

    return counts.map((count, index) => ({
      label: labels[index],
      value: count,
      height: Math.max(18, Math.round((count / max) * 100)),
      date: last7Days[index],
    }));
  }, [last7Days, records]);

  const nextActionLead = urgentTasks[0] || null;
  const hotCount = pipelineCards.filter((card) => card.normalizedStage === PIPELINE_STAGE_VALUES.HOT_LEAD).length;
  const paymentCount = pipelineCards.filter((card) => card.normalizedStage === PIPELINE_STAGE_VALUES.PAYMENT).length;
  const averageScore = pipelineCards.length > 0
    ? Math.round(pipelineCards.reduce((sum, card) => sum + card.score, 0) / pipelineCards.length)
    : 0;

  const handleDragStart = (recordId) => {
    if (isViewOnly) return;
    setDraggedRecordId(recordId);
  };

  const resetDragState = () => {
    setDraggedRecordId('');
    setDragOverStage('');
  };

  const handleDropOnStage = (stageValue) => {
    if (isViewOnly || !draggedRecordId) {
      resetDragState();
      return;
    }

    const record = pipelineCards.find((card) => card.id === draggedRecordId);
    if (!record) {
      resetDragState();
      return;
    }

    const currentStage = normalizePipelineStage(record.pipeline_stage, record);
    if (currentStage !== stageValue) {
      onChangeStatus?.(draggedRecordId, stageValue);
    }

    resetDragState();
  };

  const handleBoardPointerDown = (event) => {
    if (!boardRef.current) return;
    if (event.target.closest('[draggable="true"]')) return;

    boardPointerRef.current = {
      isPointerDown: true,
      startX: event.clientX,
      startScrollLeft: boardRef.current.scrollLeft,
    };

    boardRef.current.classList.add('pipeline-board-dragging');
  };

  const handleBoardPointerMove = (event) => {
    if (!boardRef.current || !boardPointerRef.current.isPointerDown) return;

    const deltaX = event.clientX - boardPointerRef.current.startX;
    boardRef.current.scrollLeft = boardPointerRef.current.startScrollLeft - deltaX;
  };

  const handleBoardPointerUp = () => {
    if (!boardRef.current) return;
    boardPointerRef.current.isPointerDown = false;
    boardRef.current.classList.remove('pipeline-board-dragging');
  };

  return (
    <div className={`pipeline-shell h-full min-h-0 overflow-y-auto ${isDarkMode ? 'bg-[#07090d]' : 'bg-[#edf2f7]'}`}>
      <div className="relative isolate min-h-full overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
        <div className={`pointer-events-none absolute left-[-6rem] top-[-8rem] h-[24rem] w-[24rem] rounded-full blur-[110px] ${isDarkMode ? 'bg-[#ff7a1a]/20' : 'bg-orange-200/70'}`}></div>
        <div className={`pointer-events-none absolute bottom-[-8rem] right-[5%] h-[28rem] w-[28rem] rounded-full blur-[130px] ${isDarkMode ? 'bg-[#25D366]/12' : 'bg-emerald-200/70'}`}></div>
        <div className={`pointer-events-none absolute left-[35%] top-[18%] h-[22rem] w-[22rem] rounded-full blur-[110px] ${isDarkMode ? 'bg-[#b88cff]/18' : 'bg-purple-200/60'}`}></div>
        <div className={`pointer-events-none absolute right-[12%] top-[8%] h-[12rem] w-[12rem] rounded-full blur-[90px] ${isDarkMode ? 'bg-cyan-400/10' : 'bg-cyan-100/70'}`}></div>

        <div className="pipeline-stack relative z-10 flex min-h-full flex-col gap-4">
          <div className="pipeline-top-grid grid min-h-[33rem] gap-4 xl:grid-cols-[minmax(0,1fr)_18.75rem]">
            <main
              className={`pipeline-main relative flex min-h-[26.5rem] flex-col overflow-hidden rounded-[1.8rem] border ${
                isDarkMode
                  ? 'border-white/8 bg-[linear-gradient(180deg,rgba(17,18,24,0.9),rgba(8,9,13,0.98))] text-white shadow-[0_40px_90px_-45px_rgba(0,0,0,0.85)]'
                  : 'border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(255,255,255,0.22))] text-slate-900 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.2)]'
              }`}
            >
              <div className={`absolute inset-0 backdrop-blur-[34px] ${isDarkMode ? 'bg-[#0d1017]/58' : 'bg-white/24'}`}></div>
              <div className={`pointer-events-none absolute inset-[1px] rounded-[1.75rem] border ${isDarkMode ? 'border-white/6' : 'border-white/60'}`}></div>

              <header className={`pipeline-header relative z-20 flex flex-col gap-3 border-b px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between ${
                isDarkMode ? 'border-white/8 bg-white/[0.03]' : 'border-white/40 bg-white/18'
              }`}>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-orange-200' : 'border-white/70 bg-white/70 text-[#FF5A1F]'
                    }`}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BIGDATA_ORANGE }}></span>
                      BigData Pipeline
                    </div>
                    <h1 className={`pipeline-title flex items-center gap-2 text-[clamp(2.05rem,2.6vw,3rem)] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {view === 'Active' ? 'Pipeline Activo' : 'Pipeline Archivado'}
                      <span
                        className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(37,211,102,0.8)]"
                        style={{ backgroundColor: WHATSAPP_GREEN }}
                      ></span>
                    </h1>
                    <p className={`pipeline-subtitle mt-1 text-[13px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {totalViewCards} leads en esta vista. {activeCount} activos y {archivedCount} archivados.
                    </p>
                  </div>

                </div>

                <div className={`inline-flex rounded-full border p-1 shadow-inner ${
                  isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-white/50 bg-slate-900/5'
                }`}>
                  {['Active', 'Archived'].map((value) => {
                    const isSelected = view === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setView(value)}
                        className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all sm:px-5 ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'bg-white text-slate-900 shadow-sm'
                            : isDarkMode
                              ? 'text-slate-400 hover:text-white'
                              : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </header>

              <div
                ref={boardRef}
                onPointerDown={handleBoardPointerDown}
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                onPointerLeave={handleBoardPointerUp}
                onPointerCancel={handleBoardPointerUp}
                className="pipeline-board relative z-20 flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 sm:px-5 sm:py-4 custom-scrollbar"
              >
                <div className="flex h-full min-w-max gap-3">
                  {stageColumns.map((column) => (
                    <PipelineColumn
                      key={column.stageValue}
                      stageValue={column.stageValue}
                      cards={column.cards}
                      isDarkMode={isDarkMode}
                      isViewOnly={isViewOnly}
                      isDropTarget={dragOverStage === column.stageValue}
                      draggedRecordId={draggedRecordId}
                      onDragStart={handleDragStart}
                      onDragEnd={resetDragState}
                      onDragOver={(event) => {
                        if (isViewOnly) return;
                        event.preventDefault();
                        setDragOverStage(column.stageValue);
                      }}
                      onDragLeave={() => {
                        if (dragOverStage === column.stageValue) {
                          setDragOverStage('');
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropOnStage(column.stageValue);
                      }}
                      onSelectRecord={onSelectRecord}
                    />
                  ))}
                </div>
              </div>
            </main>

            <aside className={`pipeline-sidebar flex flex-col rounded-[1.8rem] border p-4 sm:p-4 ${
              isDarkMode
                ? 'border-white/8 bg-[linear-gradient(180deg,rgba(13,15,22,0.98),rgba(8,9,12,0.98))] text-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.85)]'
                : 'border-slate-200/70 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(9,12,18,0.98))] text-white shadow-[0_28px_70px_-44px_rgba(15,23,42,0.4)]'
            }`}>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="pipeline-urgent-title text-[1.45rem] font-bold tracking-tight">Urgent Follow-ups</h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Equipo: <span className="font-bold text-slate-300">{currentUser?.workspaceId || 'BigData'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10"
                >
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                </button>
              </div>

              <div className="space-y-4">
                {urgentTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectRecord?.(task)}
                    className={`${task.urgentMeta.cardClass} pipeline-urgent-card group relative w-full overflow-hidden rounded-[1.4rem] p-3.5 text-left transition-transform hover:scale-[1.02]`}
                  >
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl"></div>

                    <div className="relative z-10">
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 opacity-70" />
                            <span className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
                              {task.timeLabel}
                            </span>
                          </div>
                          <h3 className="text-[1.55rem] font-bold leading-tight">{task.urgentMeta.title}</h3>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-900/15 transition-colors group-hover:bg-black/10">
                          <ArrowUpRight className="h-5 w-5" />
                        </span>
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <div className="flex items-center -space-x-2">
                          {task.ownerStack.slice(0, 2).map((user) => (
                            <div key={user.id || user.email || user.nombre} className="rounded-full ring-2 ring-black/5">
                              <AvatarInitials
                                name={user.nombre}
                                avatarUrl={user.avatarUrl}
                                size="sm"
                                isDarkMode={false}
                              />
                            </div>
                          ))}
                        </div>
                        <div className={`${task.urgentMeta.badgeClass} rounded-full px-4 py-2 text-xs font-bold`}>
                          {task.nombre || 'Sin nombre'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {urgentTasks.length === 0 ? (
                  <div className="rounded-[1.6rem] border border-dashed border-white/10 px-4 py-10 text-center text-sm font-medium text-slate-500">
                    No hay seguimientos urgentes en este momento.
                  </div>
                ) : null}
              </div>
            </aside>
          </div>

          <footer className="pipeline-footer grid gap-3 xl:grid-cols-[0.9fr_0.9fr_1.12fr_0.78fr]">
            <section className={`pipeline-footer-card relative overflow-hidden rounded-[1.7rem] border p-4 ${
              isDarkMode
                ? 'border-white/8 bg-[#12141c] text-white'
                : 'border-white/50 bg-[rgba(17,24,39,0.96)] text-white'
            }`}>
              <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-green-500/5 blur-3xl"></div>
              <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top,rgba(37,211,102,0.12),transparent_42%)]"></div>
              <h3 className="mb-3 text-sm font-bold tracking-[0.14em] text-slate-400">Task Statistics</h3>
              <div className="relative flex flex-1 flex-col items-center justify-center">
                <svg viewBox="0 0 100 50" className="w-full max-w-[172px]">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#2a2a32" strokeWidth="12" strokeLinecap="round" />
                  <path
                    d="M 10 50 A 40 40 0 0 1 65 15"
                    fill="none"
                    stroke={WHATSAPP_GREEN}
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_10px_rgba(37,211,102,0.75)]"
                    style={{ strokeDasharray: 126, strokeDashoffset: 126 - (Math.min(conversionRate, 100) / 100) * 126 }}
                  />
                </svg>
                <div className="absolute bottom-0 text-center">
                  <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold text-white">
                    <TrendingUp className="h-3 w-3 text-green-400" />
                    Conversion real
                  </p>
                  <p className="text-[1.95rem] font-bold tracking-tighter text-white">{conversionRate}%</p>
                </div>
              </div>
            </section>

            <section className={`pipeline-footer-card relative overflow-hidden rounded-[1.7rem] border p-4 ${
              isDarkMode
                ? 'border-white/8 bg-[#12141c] text-white'
                : 'border-white/50 bg-[rgba(17,24,39,0.96)] text-white'
            }`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(184,140,255,0.12),transparent_36%)]"></div>
              <div className="relative z-10 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-[0.14em] text-slate-400">Pipeline Mix</h3>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400">
                  Real Time <TrendingUp className="h-3 w-3" />
                </span>
              </div>
              <div className="relative mt-4 flex min-h-[9rem] flex-1 items-center justify-center">
                <div className="absolute -ml-10 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#fef08a] text-gray-900 shadow-[0_0_30px_rgba(254,240,138,0.14)]">
                  <span className="text-[1.7rem] font-black tracking-tighter">{newBucketPct}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">New</span>
                </div>
                <div className="absolute -mt-7 ml-16 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-[#fef08a]/30 bg-[#2a2a32]">
                  <span className="text-[15px] font-bold text-[#fef08a]">{workedBucketPct}%</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Worked</span>
                </div>
                <div className="absolute ml-8 mt-14 flex h-10 w-10 flex-col items-center justify-center rounded-full border border-gray-700 bg-[#121215]">
                  <span className="text-[12px] font-bold text-gray-300">{archivedBucketPct}%</span>
                </div>
              </div>
            </section>

            <section className={`pipeline-footer-card relative overflow-hidden rounded-[1.7rem] border p-4 ${
              isDarkMode
                ? 'border-white/8 bg-[#12141c] text-white'
                : 'border-white/50 bg-[rgba(17,24,39,0.96)] text-white'
            }`}>
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.08),transparent_38%)]"></div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[1.05rem] font-bold">Your Activity</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">Ultimos 7 dias: {records.length} leads visibles</p>
                </div>
                <span className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-400">
                  {last7Days[0]} - {last7Days[last7Days.length - 1]}
                </span>
              </div>
              <div className="flex h-[7.5rem] items-end justify-between gap-2 px-1">
                {activityData.map((item, index) => (
                  <div key={`${item.date}-${item.label}`} className="group relative flex h-full w-8 items-end justify-center">
                    <div
                      className={`w-full rounded-md transition-all duration-500 ${
                        index === activityData.length - 1
                          ? 'relative bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_20px_rgba(255,90,31,0.35)]'
                          : 'bg-[#2a2a32] group-hover:bg-[#34343d]'
                      }`}
                      style={{ height: `${item.height}%` }}
                    >
                      {index === activityData.length - 1 ? (
                        <div className="absolute inset-0 opacity-50 mix-blend-overlay [background-image:radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.28)_1px,transparent_0)] [background-size:18px_18px]"></div>
                      ) : null}
                    </div>
                    {index === activityData.length - 1 ? (
                      <div className="pointer-events-none absolute -top-12 rounded-xl bg-white px-3 py-2 text-center font-bold text-gray-900 shadow-xl">
                        <span className="mb-0.5 block text-[10px] uppercase tracking-[0.14em] text-gray-500">Leads</span>
                        {item.value}
                        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white"></div>
                      </div>
                    ) : null}
                    <span className="absolute -bottom-5 whitespace-nowrap text-[10px] font-bold text-gray-600">
                      {getChartBarLabel(index, last7Days)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => nextActionLead && onSelectRecord?.(nextActionLead)}
              className="pipeline-footer-card group relative flex flex-col justify-between overflow-hidden rounded-[1.7rem] bg-[#6ce0e2] p-4 text-left text-gray-900 shadow-[0_10px_40px_rgba(108,224,226,0.14)] transition-transform hover:scale-[1.02]"
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-2xl"></div>
              <div className="absolute inset-[1px] rounded-[1.62rem] border border-white/20"></div>

              <div className="relative z-10">
                <div className="mb-2 flex items-center gap-2 text-gray-800">
                  <Clock className="h-4 w-4 opacity-70" />
                  <span className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">
                    {nextActionLead ? nextActionLead.timeLabel : 'Sin pendientes'}
                  </span>
                </div>
                <h3 className="mb-3 text-[1.55rem] font-black tracking-tight">
                  {nextActionLead ? nextActionLead.nombre : 'Quick Action'}
                </h3>

                <div className="mb-3 flex items-center justify-between border-b border-gray-900/10 pb-3 text-sm font-bold">
                  <span className="opacity-70">Stage actual:</span>
                  <span>{nextActionLead?.stageMeta?.shortLabel || 'Sin lead'}</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/40 px-3 py-1.5 text-xs font-bold">
                  <Users className="h-4 w-4" />
                  {nextActionLead ? `Owner: ${nextActionLead.responsable || 'Sin asignar'}` : 'Sin asignar'}
                </div>
                <span className="text-xs font-bold opacity-70">
                  Notify: {nextActionLead?.mensajeEnviado ? '✅' : '💬'}
                </span>
              </div>
            </button>
          </footer>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar {
              height: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(255,255,255,0.04);
              border-radius: 999px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(255,122,26,0.32);
              border-radius: 999px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(255,122,26,0.48);
            }
            .pipeline-board {
              cursor: grab;
              user-select: none;
              touch-action: pan-x;
            }
            .pipeline-board.pipeline-board-dragging {
              cursor: grabbing;
            }
            .pipeline-column-body {
              max-height: calc((6.1rem * 7) + (0.625rem * 6) + 1.25rem);
            }
            .pipeline-lead-card {
              min-height: 6.1rem;
            }
            .pipeline-column-scroll::-webkit-scrollbar {
              width: 8px;
            }
            .pipeline-column-scroll::-webkit-scrollbar-track {
              background: rgba(148,163,184,0.08);
              border-radius: 999px;
            }
            .pipeline-column-scroll::-webkit-scrollbar-thumb {
              background: rgba(255,122,26,0.34);
              border-radius: 999px;
            }
            .pipeline-column-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(255,122,26,0.5);
            }
            .pipeline-column-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(255,122,26,0.34) rgba(148,163,184,0.08);
            }
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .hide-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            @media (min-width: 1280px) and (max-height: 920px) {
              .pipeline-top-grid {
                min-height: 30rem;
                grid-template-columns: minmax(0, 1fr) 17.5rem;
              }
              .pipeline-main {
                min-height: 24rem;
              }
              .pipeline-header {
                padding-top: 0.85rem;
                padding-bottom: 0.85rem;
              }
              .pipeline-title {
                font-size: clamp(1.85rem, 2.25vw, 2.55rem);
              }
              .pipeline-subtitle {
                font-size: 12px;
              }
              .pipeline-hero-stats {
                gap: 0.5rem;
              }
              .pipeline-hero-stat {
                min-width: 6.5rem;
              }
              .pipeline-board {
                padding-top: 0.85rem;
                padding-bottom: 0.85rem;
              }
              .pipeline-column {
                width: 214px !important;
              }
              .pipeline-column-body {
                min-height: 11.5rem;
              }
              .pipeline-sidebar {
                padding: 0.9rem;
              }
              .pipeline-urgent-title {
                font-size: 1.3rem;
              }
              .pipeline-urgent-card {
                padding: 0.85rem;
              }
              .pipeline-footer {
                gap: 0.75rem;
              }
              .pipeline-footer-card {
                padding: 0.85rem;
              }
            }
            @media (min-width: 1280px) and (max-height: 840px) {
              .pipeline-stack {
                gap: 0.75rem;
              }
              .pipeline-top-grid {
                min-height: 27rem;
                gap: 0.75rem;
                grid-template-columns: minmax(0, 1fr) 16.5rem;
              }
              .pipeline-main {
                min-height: 22rem;
              }
              .pipeline-title {
                font-size: clamp(1.65rem, 2vw, 2.2rem);
              }
              .pipeline-column {
                width: 198px !important;
              }
              .pipeline-column-body {
                min-height: 10.5rem;
                padding: 0.6rem;
              }
              .pipeline-footer {
                gap: 0.6rem;
              }
            }
          `,
        }}
      />
    </div>
  );
}
