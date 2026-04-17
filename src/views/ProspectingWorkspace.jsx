import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, CheckCircle, Clock, Edit2, FileText, List, Lock, Mail, Phone, RefreshCw, Search, Target, Trash2, X, Zap } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import whatsappIconWhite from '../assets/whatsapp-icon-white.svg';
import { ESTADOS_PROSPECCION } from '../lib/constants';
import { getCountryMetaForRecord } from '../lib/country';
import { getLocalISODate, getLocalISOTime } from '../lib/date';
import { triggerFaviconPulse } from '../lib/favicon';
import { getSectorIcon, getSectorLabel } from '../lib/sector-utils';
import { LANG_LOCALES, translateStatus } from '../lib/i18n';
import { calcularPuntajeLead, getProbabilidadObj } from '../lib/lead-utils';
import { useSectors } from '../hooks/useSectors';

const DAILY_GOAL_TARGET = 15;
const DAILY_GOAL_EVENT_TAG = '[META DIARIA]';
const isLiquidatedLead = (record) => record.estadoProspeccion === 'Liquidado';
const isDiscardedLead = (record) => record.estadoProspeccion === 'Descartado';
const isArchivedLead = (record) => (record.estadoProspeccion === 'Archivado' || record.isArchived) && !isDiscardedLead(record) && !isLiquidatedLead(record);

function getCleanWhatsAppNumber(value) {
  return (value || '').replace(/\D/g, '');
}

function isDailyGoalHistoryEntry(entry) {
  const action = String(entry?.accion || '');
  return action.includes(DAILY_GOAL_EVENT_TAG);
}

function isLegacyRealContactEntry(entry) {
  const action = String(entry?.accion || '');
  return (
    action.includes('[CONTACTO REAL]') ||
    action.includes('WhatsApp abierto') ||
    action.includes('Marcado manual como mensaje enviado')
  );
}

function getLatestRealContactEntry(record) {
  const contactLogs = (record?.historial || []).filter(
    (entry) => isDailyGoalHistoryEntry(entry) || isLegacyRealContactEntry(entry),
  );

  if (contactLogs.length === 0) {
    return null;
  }

  return contactLogs[contactLogs.length - 1];
}

export function ProspectingWorkspace({ records, onUpdateRecord, onChangeStatus, onAutoSelect, onArchiveRecord, waTemplate, setWaTemplate, t, currentUser, language = 'es', isViewOnly, isDarkMode = false }) {
  const { sectors } = useSectors();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('active');
  const [showCustomMsg, setShowCustomMsg] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState(null);
  const [notesDraftState, setNotesDraftState] = useState({ leadId: null, value: '' });
  const [workspaceNotice, setWorkspaceNotice] = useState(null);
  const locale = LANG_LOCALES[language] || LANG_LOCALES.en;

  useEffect(() => {
    if (!workspaceNotice) return undefined;

    const timer = window.setTimeout(() => {
      setWorkspaceNotice(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [workspaceNotice]);

  const ownerId = currentUser?.id;
  const ownerName = currentUser?.nombre;
  const normalizedSearch = searchTerm.toLowerCase();

  const activeRecords = useMemo(() => {
    return records
      .filter(r => (r.propietarioId === ownerId || r.responsable === ownerName) && r.inProspecting && !isArchivedLead(r) && !isLiquidatedLead(r) &&
        (r.nombre.toLowerCase().includes(normalizedSearch) ||
         (r.numero && r.numero.includes(searchTerm)) ||
         (r.correo && r.correo.toLowerCase().includes(normalizedSearch)))
      )
      .sort((a, b) => calcularPuntajeLead(b) - calcularPuntajeLead(a))
      .slice(0, 15);
  }, [normalizedSearch, ownerId, ownerName, records, searchTerm]);

  const archivedRecords = useMemo(() => {
    return records
      .filter(r => (r.propietarioId === ownerId || r.responsable === ownerName) && isArchivedLead(r) &&
        (r.nombre.toLowerCase().includes(normalizedSearch) ||
         (r.numero && r.numero.includes(searchTerm)) ||
         (r.correo && r.correo.toLowerCase().includes(normalizedSearch)))
      )
      .sort((a, b) => calcularPuntajeLead(b) - calcularPuntajeLead(a));
  }, [normalizedSearch, ownerId, ownerName, records, searchTerm]);

  const currentList = workspaceTab === 'active' ? activeRecords : archivedRecords;
  const resolvedActiveLeadId = currentList.some((record) => record.id === activeLeadId)
    ? activeLeadId
    : (currentList[0]?.id || null);
  const totalArchivedCount = useMemo(
    () => records.filter((r) => (r.propietarioId === ownerId || r.responsable === ownerName) && isArchivedLead(r)).length,
    [ownerId, ownerName, records],
  );

  const leadsWorked = useMemo(() => {
    const today = getLocalISODate();
    return records.filter(r => {
      if (r.propietarioId !== ownerId && r.responsable !== ownerName) return false;
      if (!r.mensajeEnviado) return false;
      const latestContactEntry = getLatestRealContactEntry(r);
      if (!latestContactEntry) return false;
      return getLocalISODate(new Date(latestContactEntry.fecha)) === today;
    }).length;
  }, [ownerId, ownerName, records]);

  const progressPct = Math.min((leadsWorked / DAILY_GOAL_TARGET) * 100, 100);

  const activeLead = useMemo(() => {
    if (resolvedActiveLeadId) {
      const found = currentList.find(r => r.id === resolvedActiveLeadId);
      if (found) return found;
    }
    return currentList.length > 0 ? currentList[0] : null;
  }, [currentList, resolvedActiveLeadId]);

  const notesDraft = notesDraftState.leadId === activeLead?.id ? notesDraftState.value : (activeLead?.nota || '');

  const handleFillWorkspace = () => {
    if (isViewOnly) return;
    const actualActiveCount = records.filter((r) => (r.propietarioId === ownerId || r.responsable === ownerName) && r.inProspecting && !isArchivedLead(r) && !isLiquidatedLead(r)).length;
    const needed = Math.max(0, 15 - actualActiveCount);
    if (needed > 0) {
      setWorkspaceNotice(null);
      const result = onAutoSelect(needed, true);
      if (result?.reason === 'silent-empty' || result?.reason === 'empty') {
        setWorkspaceModal({
          title: t('ws_modal_no_leads_title'),
          message: t('app_no_new_leads'),
          accent: 'orange',
        });
      }
    } else {
      setWorkspaceNotice({
        message: t('ws_notice_full_table'),
        anchor: 'header',
      });
    }
  };

  const handleQuickWhatsApp = (record) => {
    if (isViewOnly) return;
    const cleanNum = getCleanWhatsAppNumber(record.numero);
    if (!cleanNum) {
      setWorkspaceNotice({
        message: t('ws_notice_invalid_phone'),
        anchor: 'whatsapp',
      });
      return;
    }
    setWorkspaceNotice(null);

    const isGenericName = !record.nombre || ['usuario wa', 'sin nombre', 'usuario ig'].includes(record.nombre.toLowerCase());
    const safeNombre = isGenericName ? '' : record.nombre.split(' ')[0];
    const sectorName = getSectorLabel(language, record.sector, sectors);

    let finalMsg = waTemplate.replace(/\(sector\)/gi, sectorName);
    if (safeNombre) {
      finalMsg = finalMsg.replace(/\(nombre\)/gi, safeNombre);
    } else {
      finalMsg = finalMsg.replace(/ \(\s*nombre\s*\)/gi, '').replace(/\(\s*nombre\s*\)/gi, '');
    }

    finalMsg = finalMsg.replace(/ ,/g, ',').replace(/  +/g, ' ').trim();
    if (finalMsg.startsWith(',')) finalMsg = finalMsg.substring(1).trim();

    window.open(
      `https://wa.me/${cleanNum}?text=${encodeURIComponent(finalMsg)}`,
      '_blank',
      'noopener,noreferrer',
    );
    triggerFaviconPulse(3000);

    const currentIndex = currentList.findIndex((candidate) => candidate.id === record.id);
    const nextLead = currentList[currentIndex + 1] || currentList[currentIndex - 1] || null;
    const countsTowardDailyGoal = workspaceTab === 'active' && !isArchivedLead(record) && !isLiquidatedLead(record);
    const contactAction = countsTowardDailyGoal
      ? `💬 [CONTACTO REAL]${DAILY_GOAL_EVENT_TAG} Enlace de WhatsApp abierto y lead archivado automáticamente`
      : '💬 [CONTACTO ARCHIVADO] Enlace de WhatsApp abierto desde Archivados';

    onUpdateRecord({
      ...record,
      mensajeEnviado: true,
      estadoProspeccion: 'Archivado',
      isArchived: true,
      inProspecting: true,
      historial: [{ fecha: getLocalISOTime(), accion: contactAction }, ...(record.historial || [])]
    });
    setShowCustomMsg(false);
    setActiveLeadId(nextLead?.id || null);
  };

  const handleArchiveLead = (record) => {
    onArchiveRecord(record.id, true);
    setShowCustomMsg(false);
    const currentIndex = activeRecords.findIndex(r => r.id === record.id);
    if (currentIndex >= 0 && activeRecords.length > 1) {
      const nextLead = activeRecords[currentIndex + 1] || activeRecords[currentIndex - 1];
      setActiveLeadId(nextLead.id);
    } else {
      setActiveLeadId(null);
    }
  };

  const handleRestoreLead = (record) => {
    onArchiveRecord(record.id, false);
    setShowCustomMsg(false);
    const currentIndex = archivedRecords.findIndex(r => r.id === record.id);
    if (currentIndex >= 0 && archivedRecords.length > 1) {
      const nextLead = archivedRecords[currentIndex + 1] || archivedRecords[currentIndex - 1];
      setActiveLeadId(nextLead.id);
    } else {
      setActiveLeadId(null);
    }
  };

  const handleDiscardLead = (record) => {
    const currentIndex = activeRecords.findIndex((candidate) => candidate.id === record.id);
    const nextLead = activeRecords[currentIndex + 1] || activeRecords[currentIndex - 1] || null;
    onUpdateRecord({
      ...record,
      estadoProspeccion: 'Descartado',
      inProspecting: false,
      isArchived: false,
      historial: [{ fecha: getLocalISOTime(), accion: 'Lead marcado como Descartado/Inválido' }, ...(record.historial || [])]
    });
    setShowCustomMsg(false);
    setActiveLeadId(nextLead?.id || null);
  };

  const handleSaveNotes = () => {
    if (!activeLead || isViewOnly) return;
    if ((activeLead.nota || '') === notesDraft) return;

    onUpdateRecord({
      ...activeLead,
      nota: notesDraft,
      historial: [{ fecha: getLocalISOTime(), accion: 'Notas del lead actualizadas desde Workspace' }, ...(activeLead.historial || [])],
    });
    setNotesDraftState({ leadId: activeLead.id, value: notesDraft });
  };

  if (currentList.length === 0 && !searchTerm) {
    if (workspaceTab === 'active') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-12 text-center h-full relative">
          <div className="absolute top-6 left-6 flex bg-slate-200 p-1.5 rounded-xl border border-slate-300">
            <button type="button" onClick={() => setWorkspaceTab('active')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workspaceTab === 'active' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-[#FF5A1F]'}`}>{t('ws_tab_active')} ({activeRecords.length})</button>
            <button type="button" onClick={() => setWorkspaceTab('archived')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workspaceTab === 'archived' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-[#FF5A1F]'}`}>{t('ws_tab_archived')} ({totalArchivedCount})</button>
          </div>
          <div className="w-24 h-24 bg-white border-4 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Target size={40} className="text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-700 mb-2">{t('ws_empty_title')}</h3>
          <p className="text-slate-500 max-w-md mb-8">{t('ws_empty_desc')}</p>
          <button type="button" onClick={handleFillWorkspace} className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] text-white font-bold shadow-[0_8px_20px_-6px_rgba(255,90,31,0.5)] hover:brightness-110 active:brightness-90 transition-all flex items-center gap-2">
            <Zap size={20} className="fill-current" /> {t('ws_fill_table')}
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-12 text-center h-full relative">
        <div className="absolute top-6 left-6 flex bg-slate-200 p-1.5 rounded-xl border border-slate-300">
          <button type="button" onClick={() => setWorkspaceTab('active')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workspaceTab === 'active' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-[#FF5A1F]'}`}>{t('ws_tab_active')} ({activeRecords.length})</button>
          <button type="button" onClick={() => setWorkspaceTab('archived')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${workspaceTab === 'archived' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-[#FF5A1F]'}`}>{t('ws_tab_archived')} ({totalArchivedCount})</button>
        </div>
        <div className="w-24 h-24 bg-white border-4 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Archive size={40} className="text-slate-300" />
        </div>
        <h3 className="text-2xl font-bold text-slate-700 mb-2">{t('ws_no_archived_title')}</h3>
        <p className="text-slate-500 max-w-md">{t('ws_no_archived_desc')}</p>
      </div>
    );
  }

  const paisData = activeLead ? getCountryMetaForRecord(activeLead) : null;
  const sectorData = activeLead ? {
    nombre: getSectorLabel(language, activeLead.sector, sectors),
    icon: getSectorIcon(activeLead.sector, sectors),
    id: activeLead.sector,
  } : null;
  const prob = activeLead ? getProbabilidadObj(activeLead) : null;

  return (
    <div className="flex min-h-full flex-col overflow-y-auto overflow-x-hidden bg-white lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
      {workspaceModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-md" onClick={() => setWorkspaceModal(null)}></div>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-orange-100 bg-white p-6 text-slate-900 shadow-2xl animate-in zoom-in-95"
          >
            <div className="pointer-events-none absolute -top-14 right-0 h-36 w-36 rounded-full bg-[#FF5A1F]/15 blur-3xl"></div>
            <div className="pointer-events-none absolute -bottom-16 left-0 h-36 w-36 rounded-full bg-[#FFB36B]/20 blur-3xl"></div>

            <div className="relative">
              <div className="mb-4 inline-flex rounded-full bg-orange-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#FF5A1F]">
                BigData Workspace
              </div>
              <h4 className="mb-3 text-2xl font-black text-slate-900">{workspaceModal.title}</h4>
              <p className="mb-2 text-sm leading-relaxed text-slate-600">{workspaceModal.message}</p>
              <p className="mb-6 text-xs font-medium text-slate-400">{t('ws_modal_no_leads_hint')}</p>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setWorkspaceModal(null)}
                  className="rounded-xl bg-gradient-to-r from-[#FF3C00] to-[#FF7A00] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-14px_rgba(255,90,31,0.55)] transition-all hover:brightness-110"
                >
                  {t('ws_close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col border-b border-slate-200 bg-slate-50/50 lg:min-h-0 lg:h-full lg:max-w-[380px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <List className="text-[#FF5A1F]" /> {t('ws_tray_title')}
            </h2>
            <button type="button" onClick={handleFillWorkspace} className="p-2 bg-orange-50 text-[#FF5A1F] rounded-lg hover:bg-orange-100 transition-colors shadow-sm border border-orange-100" title={t('ws_fill_table')}>
              <Zap size={16} className="fill-current" />
            </button>
          </div>

          <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Target size={12} className="text-[#FF5A1F]" /> {t('ws_daily_goal')}
              </span>
              <span className="text-xs font-black text-[#FF5A1F]">{leadsWorked} / {DAILY_GOAL_TARGET}</span>
            </div>
            <div className="w-full bg-orange-200/50 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-400 to-[#FF5A1F] h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
            <button type="button" onClick={() => setWorkspaceTab('active')} className={`flex-1 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${workspaceTab === 'active' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('ws_tab_active')} ({activeRecords.length})</button>
            <button type="button" onClick={() => setWorkspaceTab('archived')} className={`flex-1 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${workspaceTab === 'archived' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('ws_tab_archived')} ({totalArchivedCount})</button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={workspaceTab === 'active' ? t('ws_search_active') : t('ws_search_archived')} className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent rounded-lg text-sm outline-none focus:bg-white focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 transition-all" />
          </div>

          {workspaceNotice?.anchor === 'header' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 shadow-sm">
              {workspaceNotice.message}
            </div>
          )}
        </div>

        <div className="relative max-h-[34vh] overflow-y-auto overscroll-contain p-3 no-scrollbar space-y-2 [webkit-overflow-scrolling:touch] sm:max-h-[38vh] lg:max-h-none lg:flex-1">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FF5A1F] rounded-full blur-[80px] opacity-15 pointer-events-none"></div>
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

          {currentList.map(record => {
            const isSelected = activeLeadId === record.id || (activeLead && activeLead.id === record.id);
            const rProb = getProbabilidadObj(record);
            const rEstado = ESTADOS_PROSPECCION.find(e => e.id === record.estadoProspeccion) || ESTADOS_PROSPECCION[0];
            const recordCountry = getCountryMetaForRecord(record);

            return (
              <div key={record.id} onClick={() => setActiveLeadId(record.id)} className={`relative cursor-pointer rounded-xl border p-3 transition-all ${isSelected ? 'z-20 scale-[1.02] border-[#FF5A1F] bg-white shadow-[0_10px_25px_-5px_rgba(255,90,31,0.25)]' : 'glass-panel z-10 border-slate-200 hover:border-orange-300 hover:shadow-sm'} ${record.isArchived && !isSelected ? 'opacity-70' : ''}`}>
                <div className="flex justify-between items-start mb-1.5">
                  <h4 className={`font-bold text-sm truncate pr-2 flex items-center gap-2 ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>
                    <span className="truncate">{record.nombre}</span>
                    <span className="text-xs leading-none" title={recordCountry.nombre}>{recordCountry.flag}</span>
                  </h4>
                  <span className="text-sm leading-none shrink-0" title={`Probabilidad ${rProb.nivel}`}>{rProb.icon}</span>
                </div>
                <div className={`flex items-center gap-2 mb-2 text-xs font-medium truncate ${isSelected ? 'text-slate-600' : 'text-slate-500'}`}>
                  {record.numero ? <span className="flex items-center gap-1"><Phone size={10} className={isSelected ? 'text-[#FF5A1F]' : 'text-slate-400'} /> {record.numero}</span> :
                    record.correo ? <span className="flex items-center gap-1"><Mail size={10} className={isSelected ? 'text-[#FF5A1F]' : 'text-slate-400'} /> {record.correo}</span> : t('ws_no_contact')}
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${rEstado.bgLight} ${rEstado.text}`}>{translateStatus(language, rEstado.id)}</span>
                  <div className="flex gap-1">
                    {record.isArchived && <Archive size={14} className="text-amber-500" title={t('ws_archived_lead')} />}
                    {record.mensajeEnviado && <CheckCircle size={14} className="text-green-500" title={t('ws_message_sent')} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeLead && (
        <div className="flex flex-col overflow-visible bg-white animate-in fade-in duration-300 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain no-scrollbar [webkit-overflow-scrolling:touch]">
          <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white p-3 sm:p-4 lg:sticky lg:top-0 lg:gap-4 lg:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarInitials name={activeLead.nombre} size="lg" isDarkMode={isDarkMode} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-black leading-tight text-slate-800 sm:text-2xl">{activeLead.nombre}</h2>
                  <span className="text-2xl leading-none" title={paisData.nombre}>{paisData.flag}</span>
                  {activeLead.isArchived && <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ml-2">{t('ws_badge_archived')}</span>}
                </div>
                <p className="text-sm text-slate-500 font-mono mt-0.5">{activeLead.id}</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
              {activeLead.isArchived ? (
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRestoreLead(activeLead); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-[#FF5A1F] shadow-sm transition-colors hover:bg-orange-100 sm:w-auto" title={t('ws_tooltip_restore')}>
                  <RefreshCw size={16} /> {t('ws_restore_lead')}
                </button>
              ) : (
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchiveLead(activeLead); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-600 shadow-sm transition-colors hover:bg-amber-100 sm:w-auto" title={t('ws_tooltip_archive')}>
                  <Archive size={16} /> {t('ws_archive_lead')}
                </button>
              )}

              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDiscardLead(activeLead); }} className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500" title={t('ws_tooltip_discard')}>
                <Trash2 size={18} />
              </button>

              <div className="relative hidden w-full flex-col items-stretch lg:ml-2 lg:flex lg:w-auto lg:items-end">
                <div className="flex w-full items-center sm:w-auto">
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(!showCustomMsg); }} className={`h-[46px] w-[46px] rounded-l-xl border-y border-l transition-all flex items-center justify-center shrink-0 ${showCustomMsg ? 'bg-green-100 border-green-300 text-green-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`} title={t('ws_tooltip_customize')}>
                    <Edit2 size={16} />
                  </button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickWhatsApp(activeLead); }} className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-r-xl border-y border-r border-green-500 bg-green-500 px-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all hover:bg-green-600 sm:flex-none sm:px-5">
                    <img src={whatsappIconWhite} alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> {t('ws_start_conversation')}
                  </button>
                </div>

                {workspaceNotice?.anchor === 'whatsapp' && (
                  <div className="mt-3 w-full rounded-2xl border border-white/40 bg-white/55 px-4 py-3 text-xs font-bold leading-relaxed text-slate-700 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:absolute sm:top-full sm:right-0 sm:w-[min(20rem,calc(100vw-2rem))]">
                    <div className="hidden absolute -top-2 right-8 h-4 w-4 rotate-45 rounded-[4px] border-l border-t border-white/40 bg-white/55 backdrop-blur-xl sm:block"></div>
                    {workspaceNotice.message}
                  </div>
                )}

                {showCustomMsg && (
                  <div className="z-50 mt-3 w-full rounded-xl p-4 shadow-2xl glass-panel animate-in slide-in-from-top-2 sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:w-[min(20rem,calc(100vw-2rem))]">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 block">{t('ws_wa_template_title')}</label>
                    <div className="flex flex-wrap gap-2 mb-3 items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('ws_insert')}</span>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate(prev => prev + '(nombre)'); }} className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-[#FF5A1F] shadow-sm transition-colors hover:bg-orange-100">(nombre)</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate(prev => prev + '(sector)'); }} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100">(sector)</button>
                    </div>

                    <textarea value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} className="w-full text-sm p-3 bg-slate-50/30 border border-slate-200/50 rounded-lg focus:ring-2 focus:ring-green-500/50 outline-none resize-none h-28 text-slate-800" placeholder={t('ws_write_custom_msg')} />

                    <div className="flex justify-end gap-2 mt-3">
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100/50 rounded-lg transition-colors">{t('ws_close')}</button>
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors bg-green-500/90 backdrop-blur-md hover:bg-green-600">{t('ws_save_template')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-3 pb-44 sm:p-5 md:p-7 lg:pb-8 xl:flex-row xl:gap-8">
            <div className="w-full xl:w-1/3 space-y-6">
              <div onClick={() => setShowAIModal(true)} className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 shadow-[0_8px_30px_-10px_rgba(79,70,229,0.3)] border border-indigo-500/30 cursor-pointer group hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col items-start gap-4">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500 rounded-full blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>

                <div className="flex items-center gap-2 relative z-10">
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-inner">
                    <Zap size={10} className="text-amber-400 fill-amber-400" /> {t('ws_coming_soon')}
                  </span>
                </div>

                <h3 className="text-lg font-black text-white leading-snug relative z-10">
                  {t('ws_ai_title_1')}<span className="font-light">{t('ws_ai_title_2')}</span>{t('ws_ai_title_3')}<span className="font-light">{t('ws_ai_title_4')}</span>{t('ws_ai_title_5')}
                </h3>

                <div className="relative z-10 mt-1">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-md border border-indigo-500">
                    {t('ws_discover_how')} <ArrowRight size={14} />
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">{t('ws_lead_info')}</h4>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1"><Mail size={10} /> {t('ws_email')}</p>
                  <p className="font-medium text-sm text-slate-700 break-all">{activeLead.correo || t('ws_no_registered')}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('ws_category')}</p>
                    <span className="inline-block px-2 py-1 bg-slate-100 rounded text-xs font-bold text-[#FF5A1F]">{t('ws_class')} {activeLead.categoria}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('ws_score')}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${prob.bgClass} ${prob.textClass}`}>{prob.icon} {prob.nivel}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('ws_sector')}</p>
                    <p className="font-medium text-sm text-slate-700 truncate">{sectorData.icon} {sectorData.nombre}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('ws_origin')}</p>
                    <p className="font-medium text-sm text-slate-700 truncate" title={activeLead.origen}>{activeLead.origen}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">{t('ws_lead_status')}</p>
                  <select
                    value={activeLead.estadoProspeccion || 'Nuevo'}
                    disabled={isViewOnly}
                    onChange={(e) => onChangeStatus(activeLead.id, e.target.value)}
                    className={`w-full bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] transition-all appearance-none ${isViewOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {ESTADOS_PROSPECCION.filter((status) => status.id !== 'Descartado' && status.id !== 'Liquidado').map((status) => (
                      <option key={status.id} value={status.id}>{translateStatus(language, status.id)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-2/3 flex flex-col gap-6">
              <div className="bg-yellow-50/50 rounded-2xl p-4 sm:p-5 border border-yellow-200/50 shadow-sm flex flex-col">
                <label className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText size={14} /> {t('ws_additional_notes')}
                </label>
                <textarea value={notesDraft} readOnly={isViewOnly} onChange={(e) => setNotesDraftState({ leadId: activeLead.id, value: e.target.value })} className={`w-full flex-1 min-h-[120px] px-4 py-3 bg-white border border-yellow-200/60 rounded-xl focus:bg-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all text-sm placeholder:text-slate-300 resize-y shadow-inner text-slate-700 ${isViewOnly ? 'opacity-70 cursor-not-allowed' : ''}`} placeholder={t('ws_notes_placeholder')} />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveNotes(); }}
                    disabled={isViewOnly || notesDraft === (activeLead.nota || '')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isViewOnly || notesDraft === (activeLead.nota || '') ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm'}`}
                  >
                    {t('ws_save_notes')}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Clock size={14} /> {t('ws_activity_history')}
                </h4>
                <div className="space-y-0 pl-2 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                  {(activeLead.historial || []).map((h, i) => (
                    <div key={i} className="flex gap-4 text-sm relative">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] mt-1.5 relative z-10 border-2 border-white ring-2 ring-orange-50"></div>
                        {i !== (activeLead.historial || []).length - 1 && <div className="w-0.5 h-full bg-slate-100 my-1 absolute top-2.5 bottom-[-16px]"></div>}
                      </div>
                      <div className="pb-5">
                        <p className="font-bold text-slate-700 leading-tight">{h.accion}</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {new Date(h.fecha).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!activeLead.historial || activeLead.historial.length === 0) && (
                    <p className="text-xs text-slate-400 italic">{t('ws_no_activity')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] lg:hidden">
            <div className="rounded-[1.5rem] border border-white/70 bg-white/95 p-3 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl">
              {showCustomMsg && (
                <div className="mb-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-inner">
                  <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-800">{t('ws_wa_template_title')}</label>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('ws_insert')}</span>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate(prev => prev + '(nombre)'); }} className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-[#FF5A1F] shadow-sm transition-colors hover:bg-orange-100">(nombre)</button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate(prev => prev + '(sector)'); }} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100">(sector)</button>
                  </div>

                  <textarea value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} className="h-28 w-full resize-none rounded-lg border border-slate-200/70 bg-slate-50/50 p-3 text-sm text-slate-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/40" placeholder={t('ws_write_custom_msg')} />

                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100">{t('ws_close')}</button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="rounded-lg bg-green-500/90 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-green-600">{t('ws_save_template')}</button>
                  </div>
                </div>
              )}

              {workspaceNotice?.anchor === 'whatsapp' && (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-700 shadow-sm">
                  {workspaceNotice.message}
                </div>
              )}

              <div className="flex items-center">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(!showCustomMsg); }} className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-l-xl border-y border-l transition-all ${showCustomMsg ? 'border-green-300 bg-green-100 text-green-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`} title={t('ws_tooltip_customize')}>
                  <Edit2 size={18} />
                </button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickWhatsApp(activeLead); }} className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-r-xl border-y border-r border-green-500 bg-green-500 px-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all hover:bg-green-600">
                  <img src={whatsappIconWhite} alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> {t('ws_start_conversation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAIModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAIModal(false)}></div>
          <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] p-8 shadow-2xl max-w-sm w-full animate-in zoom-in-95 border border-indigo-500/30 overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500 rounded-full blur-[60px] opacity-20"></div>

            <button type="button" onClick={() => setShowAIModal(false)} className="absolute top-4 right-4 p-2 text-indigo-300 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10">
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-5 relative z-10 border border-indigo-400/30 shadow-inner">
              <Zap size={32} className="text-amber-400 fill-amber-400" />
            </div>

            <h3 className="text-2xl font-black text-white mb-4 relative z-10 leading-tight">BigData AI</h3>
            <p className="text-indigo-200 font-medium leading-relaxed mb-2 relative z-10 text-sm">{t('ws_ai_built_for')}</p>
            <p className="text-white font-bold text-lg mb-8 relative z-10">{t('ws_ai_focus_zoom')}</p>

            <div className="relative z-10 w-full bg-black/20 rounded-2xl p-4 border border-white/5 mb-6">
              <span className="block text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1">{t('ws_ai_launch')}</span>
              <span className="block text-base font-black text-white tracking-wide">
                {t('ws_ai_private_beta')} — <span className="font-light">Abril 2026</span>
              </span>
            </div>

            <div className="relative z-10 w-full py-3.5 rounded-xl bg-indigo-600/50 text-indigo-200 font-bold border border-indigo-500/30 flex items-center justify-center gap-2 cursor-default select-none">
              <Lock size={16} /> {t('ws_ai_early_access')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
