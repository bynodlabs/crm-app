import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowRight, Bot, Check, CheckCircle, ChevronDown, Clock, Copy, Download, Edit2, FileText, Headphones, ImageIcon, List, Lock, Mail, MessageCircle, Mic, MoreVertical, Phone, Pin, Plus, RefreshCw, Reply, Search, Smile, Star, Store, Target, Trash2, UserRound, X, Zap } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import chatWallpaperDark from '../assets/chat-wallpaper-dark.svg';
import chatWallpaperLight from '../assets/chat-wallpaper-light.svg';
import whatsappIconWhite from '../assets/whatsapp-icon-white.svg';
import { api } from '../lib/api';
import { getCountryMetaForRecord } from '../lib/country';
import { getLocalISODate, getLocalISOTime } from '../lib/date';
import { triggerFaviconPulse } from '../lib/favicon';
import {
  getLegacyStageIdFromPipelineStage,
  getLegacyStatusFromPipelineStage,
  getPipelineStageMeta,
  getPipelineStageOptions,
  isColdPipelineStage,
  isLostPipelineStage,
  isPipelineStageInWorkspace,
  normalizePipelineStage,
  PIPELINE_STAGE_VALUES,
} from '../lib/lead-pipeline';
import { getSectorIcon, getSectorLabel } from '../lib/sector-utils';
import { getWhatsAppInboxCache, setWhatsAppInboxCache } from '../lib/whatsapp-cache';
import { getWhatsAppCatalog, getWhatsAppQuickReplies, saveWhatsAppCatalog, saveWhatsAppQuickReplies } from '../lib/whatsapp-tools';
import { LANG_LOCALES } from '../lib/i18n';
import { calcularPuntajeLead, getProbabilidadObj } from '../lib/lead-utils';
import { useSectors } from '../hooks/useSectors';

const DAILY_GOAL_EVENT_TAG = '[META DIARIA]';
const GENERIC_INBOX_NAMES = new Set(['usuario wa', 'sin nombre', 'usuario ig', 'lead', 'prospecto']);
const BIGDATA_ORANGE = '#ff7a1a';
const WHATSAPP_GREEN = '#25d366';
const isLostLead = (record) => isLostPipelineStage(record?.pipeline_stage, record);
const isArchivedLead = (record) => isColdPipelineStage(record?.pipeline_stage, record) || Boolean(record?.isArchived);

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

function DonRafaelReactionIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 243.92 246.44" aria-hidden="true" className={className} fill="currentColor">
      <path d="M178.75,178.96c-22.03,22.32-42.4,32.96-74.11,31.84-36.65-1.29-67.93-25.19-67.81-64.93l.14-42.56c.11-35.82,27.91-63.73,63.65-63.67l42.63.08c41.94.08,65.8,33.41,65.31,71.93-.36,28.58-9.86,47.09-29.8,67.3ZM81.71,136.29c20.74-.8,37.86-.23,52.61-3.27l52.04-10.73c10.32-13.17,2.64-48.04-16.35-57.8-18.39-9.45-39.7-7.75-60.85-8.19-24.23-.51-49.89,10.1-53.47,37.19-2.55,19.3-3,44.1.25,63.51,5.1,30.48,36.97,40.7,65.27,34.23l.22-26.39c-20.75-1.89-35.27-8.5-39.72-28.54ZM186.06,145.28c-14.14-6.18-31.35-4.71-40.67,5.29-6.99,7.49-7.22,24.46-4.46,38.45,15.65-14.16,27.43-25.56,45.13-43.74Z" />
      <path d="M92.4,84.19c4.8-.73,13.86,8.78,13.12,13.33s-8.14,12.49-12.74,12.83-11.13-6.19-13.08-10.36c-1.95-4.16,6.71-14.88,12.71-15.79Z" />
      <path d="M152.24,84.17c4.65-.67,13.74,8.8,12.99,13.34s-8.15,12.5-12.75,12.83c-4.6.33-11.12-6.2-13.1-10.35s6.48-14.9,12.86-15.82Z" />
    </svg>
  );
}

function getCleanWhatsAppNumber(value) {
  return (value || '').replace(/\D/g, '');
}

function formatInboxPhoneLabel(value = '') {
  const digits = getCleanWhatsAppNumber(value);
  if (!digits) return '';

  const localDigits = digits.length > 10 ? digits.slice(-10) : digits;
  if (localDigits.length === 10) {
    return `${localDigits.slice(0, 2)} ${localDigits.slice(2, 6)} ${localDigits.slice(6)}`;
  }
  if (localDigits.length === 9) {
    return `${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)} ${localDigits.slice(6)}`;
  }
  if (localDigits.length === 8) {
    return `${localDigits.slice(0, 4)} ${localDigits.slice(4)}`;
  }

  return localDigits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
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

function isUnknownInboxLead(record) {
  const rawName = String(record?.nombre || '').trim().toLowerCase();
  return !rawName || GENERIC_INBOX_NAMES.has(rawName);
}

function hasUsefulInboxName(value = '') {
  const rawName = String(value || '').trim().toLowerCase();
  return Boolean(rawName) && !GENERIC_INBOX_NAMES.has(rawName);
}

function getPreferredInboxName({ leadName = '', chatName = '', phoneNumber = '', email = '', fallbackText = '' } = {}) {
  if (hasUsefulInboxName(leadName)) return String(leadName).trim();
  if (hasUsefulInboxName(chatName)) return String(chatName).trim();

  const phoneLabel = formatInboxPhoneLabel(phoneNumber);
  if (phoneLabel) return phoneLabel;

  return String(email || fallbackText || '').trim();
}

function getLatestInboxActivity(record) {
  const history = Array.isArray(record?.historial) ? record.historial : [];
  if (history.length === 0) return null;

  return history
    .slice()
    .sort((left, right) => new Date(right?.fecha || 0).getTime() - new Date(left?.fecha || 0).getTime())[0];
}

function getInboxSnippet(record, t) {
  if (record?.__lastMessageText) return record.__lastMessageText;

  const latestContact = getLatestRealContactEntry(record);
  const latestHistory = getLatestInboxActivity(record);
  const note = String(record?.nota || '').trim();

  if (note) return note;
  if (latestContact?.accion) return latestContact.accion.replace(DAILY_GOAL_EVENT_TAG, '').trim();
  if (latestHistory?.accion) return latestHistory.accion;
  if (record?.origen) return record.origen;

  return t('ws_chat_no_messages');
}

function getInboxTimestamp(record, locale) {
  if (record?.__lastMessageTimestamp) {
    try {
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(record.__lastMessageTimestamp));
    } catch {
      return '';
    }
  }

  const latestHistory = getLatestInboxActivity(record);
  const baseDate = latestHistory?.fecha || record?.fechaIngreso;
  if (!baseDate) return '';

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(baseDate));
  } catch {
    return '';
  }
}

function isAutomatedInboxSnippet(record) {
  if (record?.__lastMessageText) {
    const lastMessageText = String(record.__lastMessageText || '').toLowerCase();
    if (/automat|system|sistema|bot|plantilla|template|ia/.test(lastMessageText)) {
      return true;
    }
  }

  const latestHistory = getLatestInboxActivity(record);
  const action = String(latestHistory?.accion || '').toLowerCase();
  const note = String(record?.nota || '').toLowerCase();
  const sourceText = `${action} ${note}`;

  return /automat|system|sistema|bot|plantilla|template|ia|importado|extraído|extraido|\[meta diaria\]/.test(sourceText);
}

function LeadDetailsModal({
  activeLead,
  paisData,
  prob,
  sectorData,
  locale,
  t,
  isDarkMode,
  isViewOnly,
  language,
  onChangeStatus,
  onClose,
  onOpenAI,
  onRestoreLead,
  onArchiveLead,
  onDiscardLead,
  onQuickWhatsApp,
  waTemplate,
  setWaTemplate,
  showCustomMsg,
  setShowCustomMsg,
  workspaceNotice,
  notesDraft,
  setNotesDraftState,
  onSaveNotes,
}) {
  if (!activeLead) return null;
  const pipelineOptions = getPipelineStageOptions().filter((option) => option.value !== PIPELINE_STAGE_VALUES.LOST);
  const activeStageValue = normalizePipelineStage(activeLead.pipeline_stage, activeLead);

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-md" onClick={onClose}></div>

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarInitials name={activeLead.nombre} size="lg" avatarUrl={activeLead.__avatarUrl || ''} isDarkMode={isDarkMode} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-black leading-tight text-slate-800 sm:text-2xl">{activeLead.nombre}</h2>
                  <span className="text-2xl leading-none" title={paisData?.nombre}>{paisData?.flag}</span>
                  {activeLead.isArchived && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">{t('ws_badge_archived')}</span>}
                </div>
                <p className="mt-0.5 text-sm font-mono text-slate-500">{activeLead.id}</p>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2.5 sm:w-auto sm:gap-3">
              {activeLead.isArchived ? (
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRestoreLead(activeLead); }} className="flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-[#FF5A1F] shadow-sm transition-colors hover:bg-orange-100" title={t('ws_tooltip_restore')}>
                  <RefreshCw size={16} /> {t('ws_restore_lead')}
                </button>
              ) : (
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchiveLead(activeLead); }} className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-600 shadow-sm transition-colors hover:bg-amber-100" title={t('ws_tooltip_archive')}>
                  <Archive size={16} /> {t('ws_archive_lead')}
                </button>
              )}

              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDiscardLead(activeLead); }} className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-500" title={t('ws_tooltip_discard')}>
                <Trash2 size={18} />
              </button>

              <div className="flex items-center">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(!showCustomMsg); }} className={`flex h-[46px] w-[46px] items-center justify-center rounded-l-xl border-y border-l transition-all ${showCustomMsg ? 'border-green-300 bg-green-100 text-green-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`} title={t('ws_tooltip_customize')}>
                  <Edit2 size={16} />
                </button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickWhatsApp(activeLead); }} className="flex h-[46px] items-center justify-center gap-2 rounded-r-xl border-y border-r border-green-500 bg-green-500 px-4 text-sm font-bold text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all hover:bg-green-600 sm:px-5">
                  <img src={whatsappIconWhite} alt="" aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> {t('ws_start_conversation')}
                </button>
              </div>

              <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label={t('ws_close')}>
                <X size={18} />
              </button>
            </div>
          </div>

          {workspaceNotice?.anchor === 'whatsapp' && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-700 shadow-sm">
              {workspaceNotice.message}
            </div>
          )}

          {showCustomMsg && (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-inner">
              <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-800">{t('ws_wa_template_title')}</label>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('ws_insert')}</span>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate((prev) => prev + '(nombre)'); }} className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-[#FF5A1F] shadow-sm transition-colors hover:bg-orange-100">(nombre)</button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWaTemplate((prev) => prev + '(sector)'); }} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100">(sector)</button>
              </div>

              <textarea value={waTemplate} onChange={(e) => setWaTemplate(e.target.value)} className="h-28 w-full resize-none rounded-lg border border-slate-200/70 bg-white p-3 text-sm text-slate-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/40" placeholder={t('ws_write_custom_msg')} />

              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100">{t('ws_close')}</button>
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomMsg(false); }} className="rounded-lg bg-green-500/90 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-green-600">{t('ws_save_template')}</button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-8 sm:p-5 md:p-7 xl:flex-row xl:gap-8">
            <div className="w-full space-y-6 xl:w-1/3">
              <div onClick={() => onOpenAI(true)} className="group relative flex cursor-pointer flex-col items-start gap-4 overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 shadow-[0_8px_30px_-10px_rgba(79,70,229,0.3)] transition-all hover:scale-[1.02]">
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500 opacity-20 blur-[60px] transition-opacity group-hover:opacity-40"></div>
                <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-purple-500 opacity-20 blur-[50px] transition-opacity group-hover:opacity-40"></div>

                <div className="relative z-10 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-300 shadow-inner">
                    <Zap size={10} className="fill-amber-400 text-amber-400" /> {t('ws_coming_soon')}
                  </span>
                </div>

                <h3 className="relative z-10 text-lg font-black leading-snug text-white">
                  {t('ws_ai_title_1')}<span className="font-light">{t('ws_ai_title_2')}</span>{t('ws_ai_title_3')}<span className="font-light">{t('ws_ai_title_4')}</span>{t('ws_ai_title_5')}
                </h3>

                <div className="relative z-10 mt-1">
                  <span className="inline-flex items-center gap-2 rounded-xl border border-indigo-500 bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-indigo-500">
                    {t('ws_discover_how')} <ArrowRight size={14} />
                  </span>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm sm:p-5">
                <h4 className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{t('ws_lead_info')}</h4>
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400"><Mail size={10} /> {t('ws_email')}</p>
                  <p className="break-all text-sm font-medium text-slate-700">{activeLead.correo || t('ws_no_registered')}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ws_category')}</p>
                    <span className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-bold text-[#FF5A1F]">{t('ws_class')} {activeLead.categoria}</span>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ws_score')}</p>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold ${prob.bgClass} ${prob.textClass}`}>{prob.icon} {prob.nivel}</span>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ws_sector')}</p>
                    <p className="truncate text-sm font-medium text-slate-700">{sectorData.icon} {sectorData.nombre}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ws_origin')}</p>
                    <p className="truncate text-sm font-medium text-slate-700" title={activeLead.origen}>{activeLead.origen}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ws_lead_status')}</p>
                  <select
                    value={activeStageValue}
                    disabled={isViewOnly}
                    onChange={(e) => onChangeStatus(activeLead.id, e.target.value)}
                    className={`w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 ${isViewOnly ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    {pipelineOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-6 xl:w-2/3">
              <div className="flex flex-col rounded-2xl border border-yellow-200/50 bg-yellow-50/50 p-4 shadow-sm sm:p-5">
                <label className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-800">
                  <FileText size={14} /> {t('ws_additional_notes')}
                </label>
                <textarea value={notesDraft} readOnly={isViewOnly} onChange={(e) => setNotesDraftState({ leadId: activeLead.id, value: e.target.value })} className={`min-h-[120px] w-full flex-1 resize-y rounded-xl border border-yellow-200/60 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner outline-none transition-all placeholder:text-slate-300 focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400 ${isViewOnly ? 'cursor-not-allowed opacity-70' : ''}`} placeholder={t('ws_notes_placeholder')} />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSaveNotes(); }}
                    disabled={isViewOnly || notesDraft === (activeLead.nota || '')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${isViewOnly || notesDraft === (activeLead.nota || '') ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'bg-yellow-500 text-white shadow-sm hover:bg-yellow-600'}`}
                  >
                    {t('ws_save_notes')}
                  </button>
                </div>
              </div>

              <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <h4 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Clock size={14} /> {t('ws_activity_history')}
                </h4>
                <div className="max-h-[320px] space-y-0 overflow-y-auto pl-2 pr-2 no-scrollbar">
                  {(activeLead.historial || []).map((h, i) => (
                    <div key={i} className="relative flex gap-4 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FF5A1F] ring-2 ring-orange-50"></div>
                        {i !== (activeLead.historial || []).length - 1 && <div className="absolute bottom-[-16px] top-2.5 my-1 h-full w-0.5 bg-slate-100"></div>}
                      </div>
                      <div className="pb-5">
                        <p className="leading-tight text-slate-700 font-bold">{h.accion}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                          {new Date(h.fecha).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!activeLead.historial || activeLead.historial.length === 0) && (
                    <p className="text-xs italic text-slate-400">{t('ws_no_activity')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function upsertChatMessageList(messages, nextMessage) {
  const safeMessage = nextMessage && typeof nextMessage === 'object' ? nextMessage : null;
  if (!safeMessage?.id) return messages;

  const nextItems = [...messages];
  const currentIndex = nextItems.findIndex((item) => item.id === safeMessage.id);

  if (currentIndex >= 0) {
    nextItems[currentIndex] = { ...nextItems[currentIndex], ...safeMessage };
  } else {
    nextItems.push(safeMessage);
  }

  return nextItems.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

function upsertWhatsAppChatList(chats, payload = {}) {
  const jid = normalizeChatContactJid(payload?.jid || '');
  if (!jid) return chats;

  const nextItems = [...chats];
  const existingIndex = nextItems.findIndex((item) => normalizeChatContactJid(item.jid || '') === jid);
  const existingItem = existingIndex >= 0 ? nextItems[existingIndex] : null;
  const nextUnreadCount = payload.unreadCount !== undefined
    ? Number(payload.unreadCount || 0)
    : payload.direction === 'in'
      ? Number(existingItem?.unreadCount || 0) + 1
      : Number(existingItem?.unreadCount || 0);
  const nextChat = {
    jid,
    phoneNumber: payload.phoneNumber || `+${jid.split('@')[0]}`,
    name: payload.name || payload.pushName || '',
    avatarUrl: payload.avatarUrl || '',
    lastMessageText: payload.text || '',
    lastMessageTimestamp: payload.timestamp || Date.now(),
    lastMessageDirection: payload.direction || 'in',
    unreadCount: nextUnreadCount,
  };

  if (existingIndex >= 0) {
    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...nextChat,
    };
  } else {
    nextItems.push(nextChat);
  }

  return nextItems.sort((left, right) => (right.lastMessageTimestamp || 0) - (left.lastMessageTimestamp || 0));
}

function formatChatTimestamp(timestamp, locale) {
  if (!timestamp) return '';

  try {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

function formatChatDayLabel(timestamp, locale, t) {
  if (!timestamp) return '';

  try {
    const chatDate = new Date(timestamp);
    if (getLocalISODate(chatDate) === getLocalISODate(new Date())) {
      return t('common_today');
    }

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(chatDate);
  } catch {
    return '';
  }
}

function getMessagePreviewText(message, t) {
  if (!message || typeof message !== 'object') return '';
  if (message.deletedForEveryone) return t('ws_chat_deleted_message');
  if (message.text) return String(message.text);
  if (message.caption) return String(message.caption);
  if (message.type === 'image') return t('ws_chat_attach_media');
  if (message.type === 'video') return t('ws_chat_attach_media');
  if (message.type === 'audio') return t('ws_chat_attach_audio');
  if (message.type === 'document') return message.fileName || t('ws_chat_attach_document');
  if (message.type === 'contact') return message.contact?.displayName || t('ws_chat_attach_contact');
  if (message.type === 'sticker') return 'Sticker';
  return '';
}

function getChatStatusAppearance(status) {
  const numericStatus = Number(String(status || '').trim());

  if (numericStatus >= 4) {
    return <span className="tracking-[-0.2em] text-[#53bdeb]">✓✓</span>;
  }

  if (numericStatus >= 3) {
    return <span className="tracking-[-0.2em]">✓✓</span>;
  }

  return <span>✓</span>;
}

function getMediaTypeFromFile(file) {
  const mimeType = String(file?.type || '').toLowerCase();
  const fileName = String(file?.name || '').toLowerCase();

  if (mimeType === 'image/webp' || fileName.endsWith('.webp')) return 'sticker';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
}

function normalizeChatContactJid(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.includes('@')) {
    const [base] = raw.split(':');
    return base.includes('@') ? base : `${base}@s.whatsapp.net`;
  }

  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function renderInboxSourceLabel(sourceId, t) {
  if (sourceId === 'all') {
    return (
      <>
        <span className="font-light">Inbox</span>{' '}
        <span className="font-black">WhatsApp</span>
      </>
    );
  }

  if (sourceId === 'bigdata') {
    return (
      <>
        <span className="font-black">BigData</span>{' '}
        <span className="font-light">Leads</span>
      </>
    );
  }

  return <span className="font-black">{t('ws_inbox_title')}</span>;
}

const CHAT_ATTACHMENT_OPTIONS = [
  { id: 'document', labelKey: 'ws_chat_attach_document', icon: FileText, iconClass: 'text-violet-500' },
  { id: 'media', labelKey: 'ws_chat_attach_media', icon: ImageIcon, iconClass: 'text-sky-500' },
  { id: 'audio', labelKey: 'ws_chat_attach_audio', icon: Headphones, iconClass: 'text-orange-500' },
  { id: 'contact', labelKey: 'ws_chat_attach_contact', icon: UserRound, iconClass: 'text-cyan-500' },
  { id: 'catalog', labelKey: 'ws_chat_attach_catalog', icon: Store, iconClass: 'text-slate-400' },
  { id: 'quickReplies', labelKey: 'ws_chat_attach_quick_replies', icon: Zap, iconClass: 'text-amber-400' },
];

function formatRecordingDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

const EMOJI_GROUPS = [
  {
    id: 'people',
    labelKey: 'ws_emoji_people',
    items: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😍', '😘', '😎', '🤩', '🥳', '🤗', '🤔', '😴', '😭', '😡'],
  },
  {
    id: 'gestures',
    labelKey: 'ws_emoji_gestures',
    items: ['👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🔥', '✨', '✅', '❌', '⚡', '💯', '🎉', '💼', '📈', '📞', '💬'],
  },
  {
    id: 'nature',
    labelKey: 'ws_emoji_nature',
    items: ['🌟', '🌞', '🌈', '🌿', '🍀', '🌹', '🌻', '🍎', '☕', '🍾', '🏆', '🎯', '🚀', '💡', '🧠', '❤️', '🫶', '💚'],
  },
];

function WorkspaceChatPanel({ activeLead, isDarkMode, t, locale, language = 'es', onConversationActivity, onOpenLeadDetails, contactOptions = [], workspaceId = '' }) {
  const { sectors } = useSectors({ records: activeLead ? [activeLead] : [] });
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatConnection, setChatConnection] = useState(null);
  const [isChatStreamDegraded, setIsChatStreamDegraded] = useState(false);
  const [persistedChatSummary, setPersistedChatSummary] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactPickerMode, setContactPickerMode] = useState('share-contact');
  const [contactSearch, setContactSearch] = useState('');
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [isQuickReplyFormOpen, setIsQuickReplyFormOpen] = useState(false);
  const [quickReplyDraft, setQuickReplyDraft] = useState({ shortcut: '', title: '', message: '' });
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [isCatalogFormOpen, setIsCatalogFormOpen] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState({ name: '', price: '', description: '' });
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [messageMenuId, setMessageMenuId] = useState('');
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [isChatHeaderMenuOpen, setIsChatHeaderMenuOpen] = useState(false);
  const [isChatSummaryOpen, setIsChatSummaryOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const messageViewportRef = useRef(null);
  const composerFormRef = useRef(null);
  const chatTextareaRef = useRef(null);
  const documentInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const contactPickerRef = useRef(null);
  const quickRepliesRef = useRef(null);
  const catalogRef = useRef(null);
  const messageMenuRef = useRef(null);
  const chatHeaderMenuRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);
  const activeChatJid = useMemo(
    () => normalizeChatContactJid(activeLead?.__chatJid || activeLead?.numero || ''),
    [activeLead?.__chatJid, activeLead?.numero],
  );

  const filteredContactOptions = useMemo(() => {
    const normalizedSearch = contactSearch.trim().toLowerCase();
    return contactOptions.filter((contact) => {
      if (!contact?.phoneNumber) return false;
      if (!normalizedSearch) return true;

      return (
        String(contact.displayName || '').toLowerCase().includes(normalizedSearch) ||
        String(contact.phoneNumber || '').includes(contactSearch.trim())
      );
    });
  }, [contactOptions, contactSearch]);

  const quickReplySearch = useMemo(() => {
    const trimmed = chatDraft.trimStart();
    return trimmed.startsWith('/') ? trimmed.slice(1).trim().toLowerCase() : '';
  }, [chatDraft]);

  const filteredQuickReplies = useMemo(() => {
    const normalizedSearch = quickReplySearch;
    if (!normalizedSearch) return quickReplies;

    return quickReplies.filter((item) => (
      String(item.shortcut || '').toLowerCase().includes(normalizedSearch)
      || String(item.title || '').toLowerCase().includes(normalizedSearch)
      || String(item.message || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [quickReplies, quickReplySearch]);

  const filteredCatalogItems = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();
    if (!normalizedSearch) return catalogItems;

    return catalogItems.filter((item) => (
      String(item.name || '').toLowerCase().includes(normalizedSearch)
      || String(item.description || '').toLowerCase().includes(normalizedSearch)
      || String(item.price || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [catalogItems, catalogSearch]);

  const filteredChatMessages = useMemo(() => {
    const normalizedSearch = chatSearchTerm.trim().toLowerCase();
    if (!normalizedSearch) return chatMessages;

    return chatMessages.filter((message) => (
      getMessagePreviewText(message, t).toLowerCase().includes(normalizedSearch)
      || String(message.contact?.displayName || '').toLowerCase().includes(normalizedSearch)
      || String(message.contact?.phoneNumber || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [chatMessages, chatSearchTerm, t]);
  const isChatConnected = chatConnection?.status === 'open';
  const isChatReadOnly = Boolean(activeChatJid) && !isChatConnected;
  const isComposerDisabled = !activeChatJid || isSendingChat || isChatReadOnly;
  const chatSummary = useMemo(() => {
    const historyEntries = Array.isArray(activeLead?.historial) ? activeLead.historial : [];
    const latestMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
    const inboundMessages = chatMessages.filter((message) => !message?.fromMe).length;
    const outboundMessages = chatMessages.filter((message) => message?.fromMe).length;
    const latestHistory = historyEntries.length > 0 ? historyEntries[0] : null;
    const summaryLines = [];
    const recentMessages = chatMessages.slice(-8);
    const latestMessageText = latestMessage ? getMessagePreviewText(latestMessage, t) : '';
    const latestHistoryText = String(latestHistory?.accion || '');
    const combinedSignals = `${latestMessageText} ${latestHistoryText} ${activeLead?.nota || ''}`.toLowerCase();
    const recentSignalText = recentMessages
      .map((message) => getMessagePreviewText(message, t))
      .join(' || ')
      .toLowerCase();
    let toneLabel = t('ws_chat_summary_tone_cold');
    let nextStepLabel = t('ws_chat_summary_next_step_default');
    const agreementItems = [];
    const objectionItems = [];

    if (/(agendar|agenda|zoom|llamada|ma[nñ]ana|hoy|listo|confirmado|va bien|perfecto)/.test(recentSignalText)) {
      agreementItems.push(t('ws_chat_summary_agreement_followup'));
    }

    if (/(precio|plan|costo|inversi[oó]n|pago)/.test(recentSignalText)) {
      agreementItems.push(t('ws_chat_summary_agreement_pricing'));
    }

    if (/(duda|no se|despu[eé]s|luego|tiempo|ocupad|pensarlo|revisar)/.test(recentSignalText)) {
      objectionItems.push(t('ws_chat_summary_objection_timing'));
    }

    if (/(caro|precio|costo|inversi[oó]n|presupuesto)/.test(recentSignalText)) {
      objectionItems.push(t('ws_chat_summary_objection_budget'));
    }

    if (activeLead?.sector) {
      summaryLines.push(`${t('common_sector')}: ${getSectorLabel(language, activeLead.sector, sectors)}`);
    }

    if (activeLead?.origen) {
      summaryLines.push(`${t('ws_origin')}: ${activeLead.origen}`);
    }

    if (activeLead?.nota) {
      summaryLines.push(activeLead.nota);
    }

    if (latestHistory?.accion) {
      summaryLines.push(latestHistory.accion);
    }

    if (/(interes|listo|agendar|agenda|zoom|llamada|quiero|me interesa|precio|plan)/.test(combinedSignals)) {
      toneLabel = t('ws_chat_summary_tone_warm');
      nextStepLabel = t('ws_chat_summary_next_step_followup');
    } else if (/(duda|revisar|despu[eé]s|luego|pendiente|cotiz|informaci[oó]n)/.test(combinedSignals)) {
      toneLabel = t('ws_chat_summary_tone_nurture');
      nextStepLabel = t('ws_chat_summary_next_step_nurture');
    }

    return {
      latestMessage,
      inboundMessages,
      outboundMessages,
      latestHistory,
      historyEntries,
      summaryLines: summaryLines.slice(0, 3),
      toneLabel,
      nextStepLabel,
      agreementItems: agreementItems.slice(0, 2),
      objectionItems: objectionItems.slice(0, 2),
      storyText: persistedChatSummary || [
        latestHistory?.accion || '',
        agreementItems[0] || '',
        objectionItems[0] || '',
        nextStepLabel,
      ].filter(Boolean).join(' '),
    };
  }, [activeLead?.historial, activeLead?.nota, activeLead?.origen, activeLead?.sector, chatMessages, language, persistedChatSummary, sectors, t]);

  const filteredEmojis = useMemo(() => {
    const normalizedSearch = emojiSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return EMOJI_GROUPS;
    }

    const aliasMap = {
      feliz: ['😀', '😃', '😄', '😁', '😊'],
      love: ['😍', '😘', '❤️'],
      corazon: ['❤️', '💚', '🫶'],
      fuego: ['🔥'],
      ok: ['✅', '👍'],
      gracias: ['🙏', '💚'],
      venta: ['💼', '📈', '🎯', '🚀'],
    };

    return EMOJI_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((emoji) =>
        emoji.includes(normalizedSearch) || (aliasMap[normalizedSearch] || []).includes(emoji),
      ),
    })).filter((group) => group.items.length > 0);
  }, [emojiSearch]);

  useEffect(() => {
    const textarea = chatTextareaRef.current;
    if (!textarea) return;

    const computed = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
    const maxHeight = lineHeight * 5;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [chatDraft]);

  const glassPanelClass = isDarkMode
    ? 'border border-white/10 bg-[#11161cd6] backdrop-blur-[22px] shadow-[0_26px_80px_-42px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'border border-white/65 bg-white/76 backdrop-blur-[22px] shadow-[0_26px_80px_-40px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.85)]';
  const glassInputClass = isDarkMode
    ? 'border border-white/15 bg-black/15 text-white placeholder:text-slate-500'
    : 'border border-white/70 bg-white/55 text-slate-900 placeholder:text-slate-400';
  const glassHoverClass = isDarkMode
    ? 'hover:bg-[#ff7a1a]/12 hover:text-white'
    : 'hover:bg-[#ff7a1a]/10 hover:text-slate-900';
  const glassIconButtonClass = isDarkMode
    ? 'text-slate-400 hover:bg-[#ff7a1a]/12 hover:text-white'
    : 'text-slate-500 hover:bg-[#ff7a1a]/10 hover:text-slate-900';

  useEffect(() => {
    setQuickReplies(getWhatsAppQuickReplies(workspaceId));
    setCatalogItems(getWhatsAppCatalog(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    setChatDraft('');
    setPendingAttachment(null);
    setIsAttachmentMenuOpen(false);
    setIsEmojiPickerOpen(false);
    setIsContactPickerOpen(false);
    setIsQuickRepliesOpen(false);
    setIsCatalogOpen(false);
    setEmojiSearch('');
    setContactSearch('');
    setRecordingSeconds(0);
    setReplyingToMessage(null);
    setMessageMenuId('');
    setChatSearchTerm('');
    setIsChatSearchOpen(false);
    setIsChatHeaderMenuOpen(false);
    setIsChatSummaryOpen(false);
    setForwardingMessage(null);
    setContactPickerMode('share-contact');
  }, [activeLead?.id]);

  useEffect(() => () => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (attachmentMenuRef.current?.contains(event.target)) return;
      setIsAttachmentMenuOpen(false);
    };

    if (!isAttachmentMenuOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isAttachmentMenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (emojiPickerRef.current?.contains(event.target)) return;
      setIsEmojiPickerOpen(false);
    };

    if (!isEmojiPickerOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (contactPickerRef.current?.contains(event.target)) return;
      setIsContactPickerOpen(false);
    };

    if (!isContactPickerOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isContactPickerOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (quickRepliesRef.current?.contains(event.target)) return;
      setIsQuickRepliesOpen(false);
    };

    if (!isQuickRepliesOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isQuickRepliesOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (catalogRef.current?.contains(event.target)) return;
      setIsCatalogOpen(false);
    };

    if (!isCatalogOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isCatalogOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (messageMenuRef.current?.contains(event.target)) return;
      setMessageMenuId('');
    };

    if (!messageMenuId) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [messageMenuId]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (chatHeaderMenuRef.current?.contains(event.target)) return;
      setIsChatHeaderMenuOpen(false);
      setIsChatSummaryOpen(false);
    };

    if (!isChatHeaderMenuOpen && !isChatSummaryOpen) return undefined;
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isChatHeaderMenuOpen, isChatSummaryOpen]);

  useEffect(() => {
    const trimmed = chatDraft.trimStart();
    if (trimmed.startsWith('/')) {
      setIsQuickRepliesOpen(true);
      setIsAttachmentMenuOpen(false);
      setIsEmojiPickerOpen(false);
      setIsContactPickerOpen(false);
      setIsCatalogOpen(false);
      return;
    }

    if (!isQuickReplyFormOpen) {
      setIsQuickRepliesOpen(false);
    }
  }, [chatDraft, isQuickReplyFormOpen]);

  useEffect(() => {
    let cancelled = false;

    if (!activeLead) {
      setChatMessages([]);
      setChatError('');
      setChatConnection(null);
      setIsChatStreamDegraded(false);
      setPersistedChatSummary('');
      setIsLoadingChat(false);
      return undefined;
    }

    if (!activeChatJid) {
      setChatMessages([]);
      setChatError(t('ws_chat_no_phone'));
      setChatConnection(null);
      setIsChatStreamDegraded(false);
      setPersistedChatSummary('');
      setIsLoadingChat(false);
      return undefined;
    }

    setIsLoadingChat(true);
    setChatError('');
    setIsChatStreamDegraded(false);

    api.getWhatsAppChatMessages(activeChatJid)
      .then((response) => {
        if (cancelled) return;
        const nextItems = Array.isArray(response?.items)
          ? response.items.filter((message) => normalizeChatContactJid(message?.jid || '') === activeChatJid)
          : [];

        setChatMessages(nextItems);
        setChatConnection(response?.connection || null);
      })
      .catch((error) => {
        if (cancelled) return;
        setChatMessages([]);
        setChatConnection(error?.payload?.connection || null);
        setChatError(error?.message || t('ws_chat_load_error'));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChat(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatJid, activeLead?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!activeLead || !activeChatJid) {
      setPersistedChatSummary('');
      return undefined;
    }

    api.getWhatsAppChatSummary(activeChatJid)
      .then((response) => {
        if (cancelled) return;
        setPersistedChatSummary(String(response?.item?.summary || ''));
      })
      .catch(() => {
        if (cancelled) return;
        setPersistedChatSummary('');
      });

    return () => {
      cancelled = true;
    };
  }, [activeChatJid, activeLead?.id]);

  useEffect(() => {
    if (!activeChatJid) return undefined;

    const stream = new EventSource(api.getWhatsAppChatStreamUrl(activeChatJid));

    const handleReady = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        setChatConnection(payload?.connection || null);
        setChatError('');
        setIsChatStreamDegraded(false);
      } catch {
        // ignore malformed stream payloads
      }
    };

    const handleMessage = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (!payload?.message) return;
        if (normalizeChatContactJid(payload.message.jid || '') !== activeChatJid) return;
        setChatMessages((current) => upsertChatMessageList(current, payload.message));
        onConversationActivity?.(payload.message);
      } catch {
        // ignore malformed stream payloads
      }
    };

    const handleStatus = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        setChatConnection(payload?.connection || null);
        setIsChatStreamDegraded(false);
      } catch {
        // ignore malformed stream payloads
      }
    };

    const handleDeleted = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (!payload?.messageId) return;
        setChatMessages((current) => current.filter((message) => message.id !== payload.messageId));
      } catch {
        // ignore malformed stream payloads
      }
    };

    const handleError = () => {
      setIsChatStreamDegraded(true);
    };

    stream.addEventListener('ready', handleReady);
    stream.addEventListener('message', handleMessage);
    stream.addEventListener('status', handleStatus);
    stream.addEventListener('message_deleted', handleDeleted);
    stream.addEventListener('error', handleError);

    return () => {
      stream.removeEventListener('ready', handleReady);
      stream.removeEventListener('message', handleMessage);
      stream.removeEventListener('status', handleStatus);
      stream.removeEventListener('message_deleted', handleDeleted);
      stream.removeEventListener('error', handleError);
      stream.close();
    };
  }, [activeChatJid, t]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = viewport.scrollHeight;
  }, [chatMessages, isLoadingChat]);

  const handleSendMessage = async (event) => {
    event.preventDefault();

    const nextText = chatDraft.trim();
    const nextAttachment = pendingAttachment;
    if (!activeChatJid || (!nextText && !nextAttachment) || isSendingChat || isChatReadOnly) return;

    setIsSendingChat(true);
    setChatError('');
    setChatDraft('');
    setPendingAttachment(null);
    setIsAttachmentMenuOpen(false);
    setIsEmojiPickerOpen(false);
    setIsContactPickerOpen(false);
    setMessageMenuId('');
    const nextReplyingToMessage = replyingToMessage;
    setReplyingToMessage(null);

    try {
      const payload = {
        text: nextText,
        replyToMessageId: nextReplyingToMessage?.id || '',
      };

      if (nextAttachment?.type === 'contact') {
        payload.contact = {
          displayName: nextAttachment.displayName,
          phoneNumber: nextAttachment.phoneNumber,
        };
      } else if (nextAttachment) {
        payload.media = {
          type: nextAttachment.type,
          dataUrl: nextAttachment.dataUrl,
          fileName: nextAttachment.fileName,
          mimeType: nextAttachment.mimeType,
          ptt: Boolean(nextAttachment.ptt),
        };
      }

      const response = await api.sendWhatsAppChatMessage(activeChatJid, {
        ...payload,
      });
      if (response?.message && normalizeChatContactJid(response.message.jid || '') === activeChatJid) {
        setChatMessages((current) => upsertChatMessageList(current, response.message));
      }
      if (response?.message) {
        onConversationActivity?.(response.message);
      }
    } catch (error) {
      setChatDraft(nextText);
      setReplyingToMessage(nextReplyingToMessage);
      if (nextAttachment) {
        setPendingAttachment(nextAttachment);
      }
      setChatError(error?.message || t('ws_chat_send_error'));
    } finally {
      setIsSendingChat(false);
    }
  };

  const sendAudioAttachment = async (nextAudio, fallbackText = '') => {
    if (!activeChatJid || !nextAudio || isSendingChat || isChatReadOnly) return false;

    setIsSendingChat(true);
    setChatError('');

    try {
      const response = await api.sendWhatsAppChatMessage(activeChatJid, {
        text: String(fallbackText || '').trim(),
        media: {
          type: nextAudio.type,
          dataUrl: nextAudio.dataUrl,
          fileName: nextAudio.fileName,
          mimeType: nextAudio.mimeType,
          ptt: Boolean(nextAudio.ptt),
        },
      });

      if (response?.message && normalizeChatContactJid(response.message.jid || '') === activeChatJid) {
        setChatMessages((current) => upsertChatMessageList(current, response.message));
      }
      if (response?.message) {
        onConversationActivity?.(response.message);
      }
      return true;
    } catch (error) {
      setPendingAttachment(nextAudio);
      setChatError(error?.message || t('ws_chat_send_error'));
      return false;
    } finally {
      setIsSendingChat(false);
    }
  };

  const openFilePicker = (pickerRef) => {
    if (isSendingChat) return;
    pickerRef.current?.click();
  };

  const handleOpenAttachmentMenu = () => {
    if (isSendingChat) return;
    setIsAttachmentMenuOpen((current) => !current);
    setIsEmojiPickerOpen(false);
    setIsContactPickerOpen(false);
    setIsQuickRepliesOpen(false);
    setIsCatalogOpen(false);
  };

  const handlePickAttachmentOption = (optionId) => {
    setIsAttachmentMenuOpen(false);

    if (optionId === 'document') {
      openFilePicker(documentInputRef);
      return;
    }

    if (optionId === 'media') {
      openFilePicker(mediaInputRef);
      return;
    }

    if (optionId === 'contact') {
      setContactPickerMode('share-contact');
      setForwardingMessage(null);
      setIsContactPickerOpen(true);
      setIsEmojiPickerOpen(false);
      setIsQuickRepliesOpen(false);
      setIsCatalogOpen(false);
      return;
    }

    if (optionId === 'quickReplies') {
      setIsQuickRepliesOpen(true);
      setIsEmojiPickerOpen(false);
      setIsContactPickerOpen(false);
      setIsCatalogOpen(false);
      return;
    }

    if (optionId === 'catalog') {
      setIsCatalogOpen(true);
      setIsEmojiPickerOpen(false);
      setIsContactPickerOpen(false);
      setIsQuickRepliesOpen(false);
      return;
    }

    if (optionId === 'audio') {
      void startAudioRecording();
    }
  };

  const handleAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingAttachment({
        type: getMediaTypeFromFile(file),
        dataUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
      });
      setIsContactPickerOpen(false);
      setChatError('');
    } catch (error) {
      setChatError(error?.message || t('ws_chat_attachment_error'));
    }
  };

  const insertEmoji = (emoji) => {
    setChatDraft((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
    setEmojiSearch('');
  };

  const persistQuickReplies = (nextItems) => {
    const saved = saveWhatsAppQuickReplies(workspaceId, nextItems);
    setQuickReplies(saved);
  };

  const persistCatalogItems = (nextItems) => {
    const saved = saveWhatsAppCatalog(workspaceId, nextItems);
    setCatalogItems(saved);
  };

  const handleInsertQuickReply = (item) => {
    if (!item?.message) return;
    setChatDraft(item.message);
    setIsQuickRepliesOpen(false);
  };

  const handleSaveQuickReply = () => {
    const shortcut = String(quickReplyDraft.shortcut || '').trim();
    const title = String(quickReplyDraft.title || '').trim();
    const message = String(quickReplyDraft.message || '').trim();
    if (!shortcut || !title || !message) return;

    persistQuickReplies([
      ...quickReplies,
      {
        id: `reply-${Date.now()}`,
        shortcut,
        title,
        message,
      },
    ]);
    setQuickReplyDraft({ shortcut: '', title: '', message: '' });
    setIsQuickReplyFormOpen(false);
  };

  const handleDeleteQuickReply = (replyId) => {
    persistQuickReplies(quickReplies.filter((item) => item.id !== replyId));
  };

  const buildCatalogMessage = (item) => {
    const lines = [String(item?.name || '').trim()];
    if (item?.price) {
      lines.push(`${t('ws_chat_catalog_price')}: ${item.price}`);
    }
    if (item?.description) {
      lines.push(String(item.description).trim());
    }
    return lines.filter(Boolean).join('\n');
  };

  const handleUseCatalogItem = (item) => {
    const nextMessage = buildCatalogMessage(item);
    if (!nextMessage) return;
    setChatDraft(nextMessage);
    setIsCatalogOpen(false);
  };

  const handleSaveCatalogItem = () => {
    const name = String(catalogDraft.name || '').trim();
    const price = String(catalogDraft.price || '').trim();
    const description = String(catalogDraft.description || '').trim();
    if (!name) return;

    persistCatalogItems([
      ...catalogItems,
      {
        id: `catalog-${Date.now()}`,
        name,
        price,
        description,
      },
    ]);
    setCatalogDraft({ name: '', price: '', description: '' });
    setIsCatalogFormOpen(false);
  };

  const handleDeleteCatalogItem = (itemId) => {
    persistCatalogItems(catalogItems.filter((item) => item.id !== itemId));
  };

  const buildRecordedAudioPayload = async (audioBlob) => {
    const preferredType = audioBlob.type || 'audio/ogg;codecs=opus';
    const extension = preferredType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `nota-de-voz-${Date.now()}.${extension}`, { type: preferredType });
    const dataUrl = await readFileAsDataUrl(file);
    return {
      type: 'audio',
      dataUrl,
      fileName: file.name,
      mimeType: file.type || preferredType,
      ptt: true,
    };
  };

  const stopAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    recorder.stop();
  };

  const startAudioRecording = async () => {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setChatError(t('ws_chat_record_unsupported'));
      return;
    }

    if (isRecordingAudio || isPreparingAudio) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = window.MediaRecorder.isTypeSupported?.('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : window.MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      setChatError('');
      setIsRecordingAudio(true);
      setPendingAttachment(null);
      setRecordingSeconds(0);

      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);

      recorder.ondataavailable = (recordEvent) => {
        if (recordEvent.data?.size) {
          audioChunksRef.current.push(recordEvent.data);
        }
      };

      recorder.onerror = () => {
        setChatError(t('ws_chat_record_error'));
        setIsRecordingAudio(false);
        setRecordingSeconds(0);
        if (recordingIntervalRef.current) {
          window.clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/ogg;codecs=opus' });
        audioChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
        setIsPreparingAudio(true);
        setRecordingSeconds(0);

        try {
          const nextAudio = await buildRecordedAudioPayload(audioBlob);
          const draftText = chatDraft.trim();
          if (draftText) {
            setPendingAttachment(nextAudio);
            setChatError('');
          } else {
            await sendAudioAttachment(nextAudio);
          }
        } catch {
          setChatError(t('ws_chat_record_error'));
        } finally {
          setIsPreparingAudio(false);
        }
      };

      recorder.start();
    } catch {
      setChatError(t('ws_chat_record_error'));
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    }
  };

  const handlePrimaryAction = (event) => {
    if (chatDraft.trim() || pendingAttachment) {
      handleSendMessage(event);
      return;
    }

    event.preventDefault();
    if (isRecordingAudio) {
      stopAudioRecording();
      return;
    }

    void startAudioRecording();
  };

  const handleChooseContact = (contact) => {
    if (contactPickerMode === 'forward-message' && forwardingMessage?.id) {
      void handleForwardMessage(contact.phoneNumber);
      return;
    }

    setPendingAttachment({
      type: 'contact',
      displayName: contact.displayName,
      phoneNumber: contact.phoneNumber,
      fileName: contact.displayName || contact.phoneNumber,
      mimeType: 'text/vcard',
    });
    setIsContactPickerOpen(false);
    setContactSearch('');
    setChatError('');
  };

  const handleCopyMessage = async (message) => {
    const nextText = getMessagePreviewText(message, t);
    if (!nextText || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(nextText);
      setMessageMenuId('');
    } catch {
      // Ignore clipboard failures.
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyingToMessage(message);
    setMessageMenuId('');
  };

  const handleStartForwardMessage = (message) => {
    setForwardingMessage(message);
    setContactPickerMode('forward-message');
    setIsContactPickerOpen(true);
    setMessageMenuId('');
    setIsAttachmentMenuOpen(false);
  };

  const handleForwardMessage = async (targetPhoneNumber) => {
    if (!forwardingMessage?.id || !activeChatJid) return;

    try {
      const response = await api.forwardWhatsAppChatMessage(activeChatJid, forwardingMessage.id, {
        targetContactIds: [targetPhoneNumber],
      });
      (response?.items || []).forEach((item) => {
        if (item?.message) {
          onConversationActivity?.({
            ...item.message,
            jid: item.jid,
            unreadCount: 0,
          });
        }
      });
      setForwardingMessage(null);
      setIsContactPickerOpen(false);
      setContactPickerMode('share-contact');
      setContactSearch('');
    } catch (error) {
      setChatError(error?.message || t('ws_chat_forward_error'));
    }
  };

  const handleDeleteMessage = async (message, deleteForEveryone = false) => {
    if (!message?.id || !activeChatJid) return;

    try {
      const response = await api.deleteWhatsAppChatMessage(activeChatJid, message.id, { deleteForEveryone });
      if (deleteForEveryone && response?.message) {
        setChatMessages((current) => upsertChatMessageList(current, response.message));
      } else {
        setChatMessages((current) => current.filter((item) => item.id !== message.id));
      }
      setMessageMenuId('');
    } catch (error) {
      setChatError(error?.message || t('ws_chat_delete_error'));
    }
  };

  const handleChatDraftKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsQuickRepliesOpen(false);
      setIsCatalogOpen(false);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && quickReplySearch && filteredQuickReplies[0]) {
      event.preventDefault();
      handleInsertQuickReply(filteredQuickReplies[0]);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composerFormRef.current?.requestSubmit();
    }
  };

  const renderMessageBody = (message) => {
    const mediaUrl = message?.hasMedia ? api.getWhatsAppChatMediaUrl(activeChatJid, message.id) : '';
    const caption = String(message?.caption || '').trim();
    const isOutgoing = message.direction === 'out';
    const timeClass = isOutgoing ? panelTheme.timeOut : panelTheme.timeIn;
    const chatStatus = getChatStatusAppearance(message.status);
    const quotedPreview = message?.quotedMessage ? getMessagePreviewText(message.quotedMessage, t) : '';
    const quotedTypeLabel = message?.quotedMessage?.type && message.quotedMessage.type !== 'text'
      ? getMessagePreviewText({ type: message.quotedMessage.type }, t)
      : '';
    const quotedBlock = message?.quotedMessage ? (
      <div className={`mb-2 rounded-[0.8rem] border-l-4 px-2.5 py-2 ${isOutgoing ? 'border-white/60 bg-black/10' : 'border-[#25D366] bg-black/5'}`}>
        <p className="text-[11px] font-semibold opacity-80">
          {message.quotedMessage.fromMe ? t('ws_chat_you') : t('ws_chat_reply_label')}
        </p>
        <p className="truncate text-[12px] opacity-80">{quotedPreview || quotedTypeLabel || t('ws_chat_deleted_message')}</p>
      </div>
    ) : null;

    if (message.type === 'image' && mediaUrl) {
      return (
        <>
          {quotedBlock}
          <img src={mediaUrl} alt={caption || message.text || 'Imagen de WhatsApp'} className="max-h-[22rem] w-full rounded-[1.15rem] object-cover" loading="lazy" />
          {caption && <p className="mt-3 text-[14px] font-medium leading-[1.55] tracking-[-0.01em]">{caption}</p>}
          <div className={`mt-2.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    if (message.type === 'video' && mediaUrl) {
      return (
        <>
          {quotedBlock}
          <video controls preload="metadata" className="max-h-[22rem] w-full rounded-[1.15rem] bg-black/80">
            <source src={mediaUrl} type={message.mimeType || 'video/mp4'} />
          </video>
          {caption && <p className="mt-3 text-[14px] font-medium leading-[1.55] tracking-[-0.01em]">{caption}</p>}
          <div className={`mt-2.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    if (message.type === 'audio' && mediaUrl) {
      return (
        <>
          {quotedBlock}
          <div className={`rounded-[1rem] px-2.5 py-2 ${isOutgoing ? 'bg-black/10' : 'bg-black/5'}`}>
            <audio controls preload="metadata" className="w-full min-w-[15rem]">
              <source src={mediaUrl} type={message.mimeType || 'audio/ogg'} />
            </audio>
          </div>
          <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    if (message.type === 'sticker' && mediaUrl) {
      return (
        <>
          {quotedBlock}
          <img src={mediaUrl} alt="Sticker de WhatsApp" className="h-32 w-32 object-contain" loading="lazy" />
          <div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    if (message.type === 'document' && mediaUrl) {
      return (
        <>
          {quotedBlock}
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-[1rem] bg-black/5 px-3.5 py-3 transition-colors hover:bg-black/10"
          >
            <FileText size={18} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold">{message.fileName || message.text || 'Documento'}</p>
              <p className="truncate text-[11px] opacity-70">{message.mimeType || 'Archivo adjunto'}</p>
            </div>
          </a>
          {caption && <p className="mt-3 text-[14px] font-medium leading-[1.55] tracking-[-0.01em]">{caption}</p>}
          <div className={`mt-2.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    if (message.type === 'contact' && message.contact) {
      return (
        <>
          {quotedBlock}
          <div className="flex items-center gap-3 rounded-[1rem] bg-black/5 px-3.5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600">
              <UserRound size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold">{message.contact.displayName || t('ws_chat_contact_label')}</p>
              <p className="truncate text-[11px] opacity-70">{formatInboxPhoneLabel(message.contact.phoneNumber || '') || message.contact.phoneNumber || t('ws_no_contact')}</p>
            </div>
          </div>
          <div className={`mt-2.5 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
            <span>{formatChatTimestamp(message.timestamp, locale)}</span>
            {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
          </div>
        </>
      );
    }

    return (
      <>
        {quotedBlock}
        <p className="whitespace-pre-wrap break-words pt-2 text-[14px] font-normal leading-[1.45]">{message.text}</p>
        <div className={`mt-0 flex items-center justify-end gap-1 text-[10px] font-medium ${timeClass}`}>
          <span>{formatChatTimestamp(message.timestamp, locale)}</span>
          {isOutgoing && <span className="shrink-0">{chatStatus}</span>}
        </div>
      </>
    );
  };

  const panelTheme = isDarkMode
    ? {
        shell: 'bg-[#111b21] border-l border-white/5',
        header: 'border-b border-white/5 bg-[#202c33]',
        title: 'text-[#e9edef]',
        subtitle: 'text-[#8696a0]',
        actions: 'text-[#aebac1] hover:bg-[#ff7a1a]/10 hover:text-white',
        composerWrap: 'border-t border-white/5 bg-[#202c33]/92 backdrop-blur-xl',
        composer: 'border border-white/10 bg-[#1b2329]/80 shadow-[0_16px_38px_-28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl',
        composerInput: 'bg-transparent text-[#e9edef] placeholder:text-[#8696a0]',
        incoming: 'border border-white/8 bg-[#1f2b33]/88 text-[#e9edef] shadow-[0_18px_40px_-34px_rgba(0,0,0,0.75)] backdrop-blur-sm',
        outgoing: 'border border-[#34d399]/18 bg-[#005c4b]/96 text-[#e9edef] shadow-[0_18px_40px_-34px_rgba(0,0,0,0.8)]',
        timeIn: 'text-[#8696a0]',
        timeOut: 'text-[#a7d1c8]',
        emptyCard: 'bg-[#202c33]/78 border border-white/[0.06] text-[#aebac1] backdrop-blur-xl shadow-[0_16px_38px_-30px_rgba(0,0,0,0.75)]',
        topBadge: 'bg-[#202c33]/82 text-[#d4dbe0] border border-white/[0.07] backdrop-blur-xl shadow-[0_14px_32px_-28px_rgba(0,0,0,0.7)]',
        wallpaperBase: '#0b141a',
        wallpaperImage: `url(${chatWallpaperDark})`,
      }
    : {
        shell: 'bg-[#efeae2] border-l border-slate-200/80',
        header: 'border-b border-slate-200/80 bg-[#f0f2f5]',
        title: 'text-[#111b21]',
        subtitle: 'text-[#667781]',
        actions: 'text-[#667781] hover:bg-[#ff7a1a]/10 hover:text-[#111b21]',
        composerWrap: 'border-t border-slate-200/80 bg-[#f0f2f5]/90 backdrop-blur-xl',
        composer: 'border border-white/75 bg-white/72 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl',
        composerInput: 'bg-transparent text-[#111b21] placeholder:text-[#667781]',
        incoming: 'border border-white/85 bg-white/88 text-[#111b21] shadow-[0_14px_40px_-32px_rgba(15,23,42,0.18)] backdrop-blur-sm',
        outgoing: 'border border-[#b7ebc1] bg-[#d9fdd3]/96 text-[#111b21] shadow-[0_14px_40px_-32px_rgba(15,23,42,0.18)]',
        timeIn: 'text-[#667781]',
        timeOut: 'text-[#667781]',
        emptyCard: 'bg-white/72 border border-white/85 text-[#667781] backdrop-blur-xl shadow-[0_14px_36px_-28px_rgba(15,23,42,0.2)]',
        topBadge: 'bg-white/76 text-[#536471] border border-white/85 backdrop-blur-xl shadow-[0_12px_28px_-26px_rgba(15,23,42,0.2)]',
        wallpaperBase: '#efeae2',
        wallpaperImage: `url(${chatWallpaperLight})`,
      };
  const shouldShowChatEmptyState = !isLoadingChat && !chatError && (!activeLead || filteredChatMessages.length === 0);
  const emptyStateTitle = !activeLead ? t('ws_chat_empty_title') : t('ws_chat_no_messages');
  const emptyStateDescription = !activeLead ? t('ws_chat_empty_desc') : t('ws_chat_no_messages_desc');

  return (
    <div className={`hidden min-h-0 flex-1 flex-col lg:flex ${panelTheme.shell}`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-3.5 ${panelTheme.header}`}>
        <div className="flex min-w-0 items-center gap-3">
          <AvatarInitials name={activeLead?.nombre || 'Lead'} size="md" avatarUrl={activeLead?.__avatarUrl || ''} isDarkMode={isDarkMode} />
          <div className="min-w-0">
            <p className={`truncate text-[16px] font-semibold ${panelTheme.title}`}>
              {activeLead?.nombre || ''}
            </p>
            {isChatSearchOpen ? (
              <div className="mt-1 flex items-center gap-2 rounded-full bg-black/10 px-3 py-1.5">
                <Search size={14} className={panelTheme.subtitle} />
                <input
                  value={chatSearchTerm}
                  onChange={(event) => setChatSearchTerm(event.target.value)}
                  placeholder={t('ws_chat_search_placeholder')}
                  className={`w-full bg-transparent text-[12px] outline-none ${panelTheme.subtitle}`}
                />
              </div>
            ) : (
              <p className={`truncate pt-0.5 text-[12px] ${panelTheme.subtitle}`}>
                {activeLead
                  ? `${activeLead.numero || activeLead.correo || t('ws_no_contact')} · ${
                    isChatConnected ? t('ws_chat_connected') : t('ws_chat_waiting')
                  }`
                  : ''}
              </p>
            )}
          </div>
        </div>

        <div ref={chatHeaderMenuRef} className="relative flex items-center gap-1.5">
          <button type="button" onClick={() => setIsChatSearchOpen((current) => !current)} className={`rounded-full p-2.5 transition-colors ${panelTheme.actions}`} aria-label="Search conversation">
            <Search size={17} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsChatSummaryOpen((current) => !current);
              setIsChatHeaderMenuOpen(false);
            }}
            className={`rounded-full px-3 py-2.5 text-[12px] font-semibold transition-colors ${isChatSummaryOpen ? 'bg-[#ff7a1a]/12 text-[#ff7a1a]' : panelTheme.actions}`}
            aria-label={t('common_summary')}
          >
            <span className="flex items-center gap-1.5">
              <FileText size={15} strokeWidth={2} />
              <span>{t('common_summary')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsChatHeaderMenuOpen((current) => !current);
              setIsChatSummaryOpen(false);
            }}
            className={`rounded-full p-2.5 transition-colors ${isChatHeaderMenuOpen ? 'bg-[#ff7a1a]/12 text-[#ff7a1a]' : panelTheme.actions}`}
            aria-label="More options"
          >
            <MoreVertical size={17} strokeWidth={2} />
          </button>
          {isChatSummaryOpen && activeLead && (
            <div className={`absolute right-[3.8rem] top-[calc(100%+0.55rem)] z-30 w-[22rem] overflow-hidden rounded-[1.6rem] border border-[#ff7a1a]/15 px-4 py-4 shadow-[0_30px_70px_-38px_rgba(255,122,26,0.45)] ${isDarkMode ? 'bg-[linear-gradient(180deg,rgba(17,22,28,0.96),rgba(10,13,18,0.98))] backdrop-blur-[26px]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,248,242,0.96))] backdrop-blur-[26px]'}`}>
              <div className={`absolute inset-x-0 top-0 h-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.16),transparent_70%)]' : 'bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.14),transparent_72%)]'}`}></div>
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isDarkMode ? 'bg-[#ff7a1a]/16 text-[#ff9b55]' : 'bg-[#ff7a1a]/12 text-[#ff7a1a]'}`}>
                      <Bot size={16} strokeWidth={2} />
                    </span>
                    <p className={`text-[15px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {t('common_summary')}
                    </p>
                  </div>
                  <p className={`mt-2 text-[12px] leading-5 ${panelTheme.subtitle}`}>{t('ws_chat_summary_placeholder')}</p>
                </div>
                <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? 'bg-white/10 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                  {t('ws_chat_summary_live')}
                </div>
              </div>

              <div className={`relative mt-4 overflow-hidden rounded-[1.25rem] border px-3.5 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.045]' : 'border-white/90 bg-white/70'}`}>
                <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${isDarkMode ? 'bg-[#ff7a1a]/12' : 'bg-[#ff7a1a]/10'}`}></div>
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.14em] ${panelTheme.subtitle}`}>{t('ws_chat_summary_signal')}</p>
                    <p className={`mt-1 text-[16px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{chatSummary.toneLabel}</p>
                  </div>
                  <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? 'bg-emerald-500/12 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                    {t('ws_chat_summary_live')}
                  </div>
                </div>
                <p className={`relative mt-2 text-[12px] leading-5 ${panelTheme.subtitle}`}>{chatSummary.nextStepLabel}</p>
              </div>

              <div className="mt-4 space-y-3">
                <div className={`rounded-[1rem] px-3.5 py-3.5 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50/90'}`}>
                  <div className="flex items-center gap-2">
                    <FileText size={14} className={isDarkMode ? 'text-[#ff9b55]' : 'text-[#ff7a1a]'} />
                    <p className={`text-[11px] uppercase tracking-[0.12em] ${panelTheme.subtitle}`}>{t('ws_chat_summary_story')}</p>
                  </div>
                  <p className={`mt-2 text-[13px] leading-6 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                    {chatSummary.storyText || t('ws_chat_summary_pending')}
                  </p>
                  {(chatSummary.latestMessage?.timestamp || chatSummary.latestHistory?.fecha) && (
                    <p className={`mt-2 text-[11px] ${panelTheme.subtitle}`}>
                      {formatChatDayLabel(chatSummary.latestMessage?.timestamp || chatSummary.latestHistory?.fecha, locale, t)} · {formatChatTimestamp(chatSummary.latestMessage?.timestamp || chatSummary.latestHistory?.fecha, locale)}
                    </p>
                  )}
                </div>

                <div className={`rounded-[1rem] px-3 py-3 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50/90'}`}>
                  <p className={`text-[11px] uppercase tracking-[0.12em] ${panelTheme.subtitle}`}>{t('ws_chat_summary_agreements')}</p>
                  {chatSummary.agreementItems.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {chatSummary.agreementItems.map((item, index) => (
                        <p key={`${item}-${index}`} className={`text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                          {item}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-2 text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                      {t('ws_chat_summary_agreements_empty')}
                    </p>
                  )}
                </div>

                <div className={`rounded-[1rem] px-3 py-3 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50/90'}`}>
                  <p className={`text-[11px] uppercase tracking-[0.12em] ${panelTheme.subtitle}`}>{t('ws_chat_summary_objections')}</p>
                  {chatSummary.objectionItems.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {chatSummary.objectionItems.map((item, index) => (
                        <p key={`${item}-${index}`} className={`text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                          {item}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-2 text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                      {t('ws_chat_summary_objections_empty')}
                    </p>
                  )}
                </div>

                <div className={`rounded-[1rem] px-3 py-3 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50/90'}`}>
                  <p className={`text-[11px] uppercase tracking-[0.12em] ${panelTheme.subtitle}`}>{t('ws_chat_summary_context')}</p>
                  {chatSummary.summaryLines.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {chatSummary.summaryLines.map((line, index) => (
                        <p key={`${line}-${index}`} className={`text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className={`mt-1 text-[13px] leading-5 ${isDarkMode ? 'text-slate-100' : 'text-slate-700'}`}>
                      {t('ws_chat_summary_pending')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          {isChatHeaderMenuOpen && activeLead && (
            <div className={`absolute right-0 top-[calc(100%+0.55rem)] z-30 w-[13.5rem] overflow-hidden rounded-[1.4rem] px-2 py-2 ${glassPanelClass}`}>
              <button
                type="button"
                onClick={() => {
                  onOpenLeadDetails?.(activeLead.id);
                  setIsChatHeaderMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-[1rem] px-3.5 py-3 text-left text-[15px] font-medium transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'} ${glassHoverClass}`}
              >
                <ArrowRight size={17} className="text-[#ff7a1a]" />
                <span>{t('ws_view_details')}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={messageViewportRef}
        className="relative flex-1 overflow-y-auto px-5 py-4"
        style={{
          backgroundColor: panelTheme.wallpaperBase,
          backgroundImage: panelTheme.wallpaperImage,
          backgroundRepeat: 'repeat',
          backgroundSize: '240px 240px',
          backgroundPosition: 'center top',
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/[0.03]"></div>

        {isChatStreamDegraded && activeLead && (
          <div className="sticky top-3 z-[3] mx-auto mb-4 flex max-w-[30rem] justify-center px-3">
            <div className={`pointer-events-none w-full rounded-[1.25rem] border px-4 py-3 text-center text-[12px] font-medium shadow-[0_18px_40px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl ${isDarkMode ? 'border-white/10 bg-white/10 text-slate-100' : 'border-white/80 bg-white/55 text-slate-700'}`}>
              {t('ws_chat_stream_waiting')}
            </div>
          </div>
        )}

        {(isLoadingChat || chatError || shouldShowChatEmptyState) && (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-6">
            <div className={`mx-auto flex max-w-md flex-col items-center rounded-[1.8rem] px-8 py-8 text-center ${panelTheme.emptyCard}`}>
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isDarkMode ? 'bg-white/5 text-white/80' : 'bg-white/80 text-[#667781]'}`}>
                {chatError ? <RefreshCw size={24} /> : <MessageCircle size={24} />}
              </div>
              <h3 className={`text-[22px] font-semibold tracking-[-0.02em] ${panelTheme.title}`}>
                {isLoadingChat ? t('ws_chat_loading') : chatError || emptyStateTitle}
              </h3>
              {!isLoadingChat && (
                <p className={`mt-2 max-w-[28rem] text-[14px] leading-6 ${panelTheme.subtitle}`}>
                  {chatError || emptyStateDescription}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="relative mx-auto flex max-w-[45rem] flex-col gap-2">
          {filteredChatMessages.map((message, index) => {
            const previousMessage = filteredChatMessages[index - 1];
            const currentDay = formatChatDayLabel(message.timestamp, locale, t);
            const previousDay = previousMessage ? formatChatDayLabel(previousMessage.timestamp, locale, t) : '';
            const showDayDivider = Boolean(currentDay) && currentDay !== previousDay;
            const messageMediaUrl = message?.hasMedia ? api.getWhatsAppChatMediaUrl(activeChatJid, message.id) : '';
            const shouldOpenBelow = filteredChatMessages.length <= 4 || index < 2;
            const messageMenuAlignmentClass = message.direction === 'out'
              ? shouldOpenBelow
                ? 'right-0 origin-top-right'
                : 'right-0 origin-bottom-right'
              : shouldOpenBelow
                ? 'left-0 origin-top-left'
                : 'left-0 origin-bottom-left';
            const messageMenuPositionClass = shouldOpenBelow
              ? 'top-[calc(100%+1rem)]'
              : 'bottom-[calc(100%+1rem)]';
            const messageMenuOptions = [
              {
                id: 'reply',
                label: t('ws_chat_reply_action'),
                icon: Reply,
                onClick: () => handleReplyToMessage(message),
                highlight: true,
              },
              {
                id: 'react',
                label: t('ws_chat_react_action'),
                icon: Smile,
                onClick: () => {
                  setIsEmojiPickerOpen(true);
                  setIsAttachmentMenuOpen(false);
                  setIsContactPickerOpen(false);
                  setIsQuickRepliesOpen(false);
                  setIsCatalogOpen(false);
                  setMessageMenuId('');
                },
              },
              ...(message.type === 'sticker'
                ? []
                : [{
                    id: 'download',
                    label: t('ws_chat_download_action'),
                    icon: Download,
                    onClick: () => {
                      if (messageMediaUrl && typeof window !== 'undefined') {
                        window.open(messageMediaUrl, '_blank', 'noopener,noreferrer');
                      }
                      setMessageMenuId('');
                    },
                  }]),
              {
                id: 'forward',
                label: t('ws_chat_forward_action'),
                icon: ArrowRight,
                onClick: () => handleStartForwardMessage(message),
              },
              {
                id: 'pin',
                label: t('ws_chat_pin_action'),
                icon: Pin,
                onClick: () => setMessageMenuId(''),
              },
              {
                id: 'star',
                label: t('ws_chat_star_action'),
                icon: Star,
                onClick: () => setMessageMenuId(''),
                separated: true,
              },
              {
                id: 'delete',
                label: t('ws_delete'),
                icon: Trash2,
                onClick: () => handleDeleteMessage(message, false),
              },
            ];

            return (
              <React.Fragment key={message.id}>
                {showDayDivider && (
                  <div className="flex justify-center py-1">
                    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${panelTheme.topBadge}`}>
                      {currentDay}
                    </span>
                  </div>
                )}
                <div className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    ref={messageMenuId === message.id ? messageMenuRef : null}
                    className={`group relative max-w-[72%] ${
                      message.type === 'sticker'
                        ? 'bg-transparent p-0 shadow-none border-0'
                        : `rounded-[1.05rem] px-3.5 py-2.5 ${
                            message.direction === 'out'
                              ? `${panelTheme.outgoing} rounded-tr-[0.35rem] pr-9`
                              : `${panelTheme.incoming} rounded-tl-[0.35rem] pr-9`
                          }`
                    }`}
                  >
                    {!message.deletedForEveryone && (
                      <button
                        type="button"
                        onClick={() => setMessageMenuId((current) => current === message.id ? '' : message.id)}
                        className={`absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200 ${
                          messageMenuId === message.id
                            ? 'border-[#ff7a1a]/45 bg-[#ff7a1a]/14 text-white opacity-100 shadow-[0_10px_20px_-14px_rgba(255,122,26,0.8)]'
                            : isDarkMode
                              ? 'border-white/10 bg-black/15 text-white/70 opacity-0 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl group-hover:opacity-100 hover:border-[#ff7a1a]/35 hover:bg-[#ff7a1a]/12 hover:text-white'
                              : 'border-white/70 bg-white/72 text-slate-500 opacity-0 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)] backdrop-blur-xl group-hover:opacity-100 hover:border-[#ff7a1a]/35 hover:bg-[#ff7a1a]/12 hover:text-slate-900'
                        }`}
                        aria-label="Message actions"
                      >
                        <ChevronDown size={13} strokeWidth={2.35} />
                      </button>
                    )}
                    {messageMenuId === message.id && !message.deletedForEveryone && (
                      <div className={`absolute z-30 w-[17rem] overflow-hidden rounded-[1.7rem] px-2.5 py-2.5 shadow-[0_30px_80px_-36px_rgba(0,0,0,0.72)] ${messageMenuPositionClass} ${messageMenuAlignmentClass} ${glassPanelClass}`}>
                        {messageMenuOptions.map((option) => {
                          const OptionIcon = option.icon;
                          return (
                            <React.Fragment key={`${message.id}-${option.id}`}>
                              {option.separated && (
                                <div className={`mx-2.5 my-1.5 h-px ${isDarkMode ? 'bg-white/10' : 'bg-slate-200/80'}`}></div>
                              )}
                              <button
                                type="button"
                                onClick={option.onClick}
                                className={`flex w-full items-center gap-3 rounded-[1.1rem] px-4 py-3.5 text-left text-[15px] font-medium transition-all ${
                                  option.highlight
                                    ? isDarkMode
                                      ? 'border border-white/15 bg-white/[0.04] text-white'
                                      : 'border border-slate-200/85 bg-white/55 text-slate-900'
                                    : isDarkMode
                                      ? 'text-slate-100'
                                      : 'text-slate-800'
                                } ${glassHoverClass}`}
                              >
                                <OptionIcon size={18} className={option.id === 'delete' ? 'text-[#ff7a1a]' : option.id === 'react' ? 'text-amber-300' : option.id === 'reply' ? 'text-white' : 'opacity-90'} />
                                <span className="flex-1">{option.label}</span>
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                    {renderMessageBody(message)}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className={`px-4 py-3 ${panelTheme.composerWrap}`}>
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden"
          onChange={handleAttachmentChange}
        />
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleAttachmentChange}
        />

        <div className="mx-auto max-w-[46rem] space-y-3">
          {isChatReadOnly && (
            <div className={`rounded-[1.3rem] border px-4 py-3 text-sm ${isDarkMode ? 'border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="flex items-start gap-3">
                <Lock size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{t('ws_chat_readonly')}</p>
                  <p className={`mt-1 ${isDarkMode ? 'text-amber-100/80' : 'text-amber-700'}`}>{t('ws_chat_reconnect_to_send')}</p>
                </div>
              </div>
            </div>
          )}

          {isCatalogOpen && (
            <div ref={catalogRef} className={`rounded-[1.8rem] p-4 ${glassPanelClass} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{t('ws_chat_attach_catalog')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCatalogFormOpen((current) => !current)}
                    className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`}
                    aria-label={t('ws_chat_catalog_add')}
                  >
                    <Plus size={18} />
                  </button>
                  <button type="button" onClick={() => setIsCatalogOpen(false)} className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`} aria-label={t('ws_close')}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className={`mb-4 flex items-center gap-3 rounded-full px-4 py-3 ${glassInputClass}`}>
                <Search size={18} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder={t('ws_chat_catalog_search')}
                  className={`w-full bg-transparent text-base outline-none ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
                />
              </div>
              {isCatalogFormOpen && (
                <div className={`mb-4 grid gap-3 rounded-[1.5rem] p-4 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-white/45'}`}>
                  <input
                    value={catalogDraft.name}
                    onChange={(event) => setCatalogDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder={t('ws_chat_catalog_name')}
                    className={`rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <input
                    value={catalogDraft.price}
                    onChange={(event) => setCatalogDraft((current) => ({ ...current, price: event.target.value }))}
                    placeholder={t('ws_chat_catalog_price_placeholder')}
                    className={`rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <textarea
                    value={catalogDraft.description}
                    onChange={(event) => setCatalogDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder={t('ws_chat_catalog_description')}
                    className={`min-h-[92px] rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsCatalogFormOpen(false)} className={`rounded-full px-4 py-2 text-sm transition-colors ${glassIconButtonClass}`}>
                      {t('common_cancel')}
                    </button>
                    <button type="button" onClick={handleSaveCatalogItem} className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3f]">
                      {t('common_save')}
                    </button>
                  </div>
                </div>
              )}
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredCatalogItems.map((item) => (
                  <div key={item.id} className={`rounded-[1.5rem] p-4 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-white/45'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`truncate text-[15px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</p>
                        {item.price && <p className="mt-1 text-sm font-medium text-[#ff9a58]">{item.price}</p>}
                        {item.description && <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.description}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCatalogItem(item.id)}
                        className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`}
                        aria-label={t('ws_delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleUseCatalogItem(item)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${glassInputClass} ${glassHoverClass}`}
                      >
                        {t('ws_chat_catalog_use')}
                      </button>
                    </div>
                  </div>
                ))}
                {filteredCatalogItems.length === 0 && (
                  <div className={`rounded-2xl px-4 py-6 text-center text-sm ${isDarkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-white/45 text-slate-500'}`}>
                    {t('ws_chat_catalog_empty')}
                  </div>
                )}
              </div>
            </div>
          )}

          {isQuickRepliesOpen && (
            <div ref={quickRepliesRef} className={`rounded-[1.8rem] p-4 ${glassPanelClass} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{t('ws_chat_attach_quick_replies')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickReplyFormOpen((current) => !current)}
                    className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`}
                    aria-label={t('ws_chat_quick_reply_add')}
                  >
                    <Plus size={18} />
                  </button>
                  <button type="button" onClick={() => setIsQuickRepliesOpen(false)} className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`} aria-label={t('ws_close')}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <p className={`mb-4 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('ws_chat_quick_reply_hint')}</p>
              {isQuickReplyFormOpen && (
                <div className={`mb-4 grid gap-3 rounded-[1.5rem] p-4 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-white/45'}`}>
                  <input
                    value={quickReplyDraft.shortcut}
                    onChange={(event) => setQuickReplyDraft((current) => ({ ...current, shortcut: event.target.value }))}
                    placeholder={t('ws_chat_quick_reply_shortcut')}
                    className={`rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <input
                    value={quickReplyDraft.title}
                    onChange={(event) => setQuickReplyDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder={t('ws_chat_quick_reply_title')}
                    className={`rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <textarea
                    value={quickReplyDraft.message}
                    onChange={(event) => setQuickReplyDraft((current) => ({ ...current, message: event.target.value }))}
                    placeholder={t('ws_chat_quick_reply_message')}
                    className={`min-h-[92px] rounded-2xl px-4 py-3 outline-none ${glassInputClass}`}
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsQuickReplyFormOpen(false)} className={`rounded-full px-4 py-2 text-sm transition-colors ${glassIconButtonClass}`}>
                      {t('common_cancel')}
                    </button>
                    <button type="button" onClick={handleSaveQuickReply} className="rounded-full bg-[#ff7a1a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3f]">
                      {t('common_save')}
                    </button>
                  </div>
                </div>
              )}
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredQuickReplies.map((item) => (
                  <div key={item.id} className={`flex items-start gap-3 rounded-[1.5rem] p-4 ${isDarkMode ? 'bg-white/[0.04]' : 'bg-white/45'}`}>
                    <button
                      type="button"
                      onClick={() => handleInsertQuickReply(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>/{item.shortcut}</span>
                        <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.title}</span>
                      </div>
                      <p className={`mt-1 line-clamp-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{item.message}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuickReply(item.id)}
                      className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`}
                      aria-label={t('ws_delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {filteredQuickReplies.length === 0 && (
                  <div className={`rounded-2xl px-4 py-6 text-center text-sm ${isDarkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-white/45 text-slate-500'}`}>
                    {t('ws_chat_quick_reply_empty')}
                  </div>
                )}
              </div>
            </div>
          )}

          {isContactPickerOpen && (
            <div ref={contactPickerRef} className={`rounded-[1.8rem] p-4 ${glassPanelClass} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{contactPickerMode === 'forward-message' ? t('ws_chat_forward_title') : t('ws_chat_attach_contact')}</h3>
                <button type="button" onClick={() => setIsContactPickerOpen(false)} className={`rounded-full p-2 transition-colors ${glassIconButtonClass}`} aria-label={t('ws_close')}>
                  <X size={18} />
                </button>
              </div>
              <div className={`mb-4 flex items-center gap-3 rounded-full px-4 py-3 ${glassInputClass}`}>
                <Search size={18} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                <input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder={contactPickerMode === 'forward-message' ? t('ws_chat_forward_search') : t('ws_chat_contact_search')}
                  className={`w-full bg-transparent text-base outline-none ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
                />
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredContactOptions.map((contact) => (
                  <button
                    key={`${contact.phoneNumber}-${contact.displayName}`}
                    type="button"
                    onClick={() => handleChooseContact(contact)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${glassHoverClass}`}
                  >
                    <AvatarInitials name={contact.displayName} size="md" avatarUrl={contact.avatarUrl || ''} isDarkMode />
                    <div className="min-w-0">
                      <p className={`truncate text-[15px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{contact.displayName}</p>
                      <p className={`truncate text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{formatInboxPhoneLabel(contact.phoneNumber || '') || contact.phoneNumber}</p>
                    </div>
                  </button>
                ))}
                {filteredContactOptions.length === 0 && (
                  <div className={`rounded-2xl px-4 py-6 text-center text-sm ${isDarkMode ? 'bg-white/[0.04] text-slate-400' : 'bg-white/45 text-slate-500'}`}>
                    {t('ws_chat_contact_empty')}
                  </div>
                )}
              </div>
            </div>
          )}

          {isEmojiPickerOpen && (
            <div ref={emojiPickerRef} className={`rounded-[1.8rem] p-4 ${glassPanelClass} ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className={`mb-4 flex items-center gap-3 rounded-full px-4 py-3 ${glassInputClass}`}>
                <Search size={18} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                <input
                  value={emojiSearch}
                  onChange={(event) => setEmojiSearch(event.target.value)}
                  placeholder={t('ws_chat_emoji_search')}
                  className={`w-full bg-transparent text-base outline-none ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
                />
              </div>
              <div className="max-h-80 space-y-5 overflow-y-auto pr-1">
                {filteredEmojis.map((group) => (
                  <div key={group.id}>
                    <p className={`mb-2 text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>{t(group.labelKey)}</p>
                    <div className="grid grid-cols-8 gap-2">
                      {group.items.map((emoji) => (
                        <button
                          key={`${group.id}-${emoji}`}
                          type="button"
                          onClick={() => insertEmoji(emoji)}
                          className={`flex h-10 items-center justify-center rounded-2xl text-2xl transition-colors ${glassHoverClass}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form ref={composerFormRef} onSubmit={handlePrimaryAction} className={`relative flex items-end gap-1 rounded-[1.9rem] px-2.5 py-2 ${panelTheme.composer}`}>
            <div ref={attachmentMenuRef} className="relative">
              <button type="button" onClick={handleOpenAttachmentMenu} className={`rounded-full p-2.5 transition-colors ${isAttachmentMenuOpen ? 'bg-[#ff7a1a]/12 text-[#ff7a1a]' : panelTheme.actions}`} aria-label="Attach">
                <Plus size={17} strokeWidth={2} />
              </button>
              {isAttachmentMenuOpen && (
                <div className={`absolute bottom-[calc(100%+0.85rem)] left-0 z-30 min-w-[16rem] overflow-hidden rounded-[1.75rem] p-2 ${glassPanelClass}`}>
                  {CHAT_ATTACHMENT_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handlePickAttachmentOption(option.id)}
                        disabled={isChatReadOnly}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'} ${glassHoverClass}`}
                      >
                        <OptionIcon size={20} className={option.iconClass} />
                        <span className="text-[15px] font-medium">{t(option.labelKey)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="button" disabled={isChatReadOnly} onClick={() => { setIsEmojiPickerOpen((current) => !current); setIsAttachmentMenuOpen(false); setIsContactPickerOpen(false); setIsQuickRepliesOpen(false); setIsCatalogOpen(false); }} className={`rounded-full p-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isEmojiPickerOpen ? 'bg-[#ff7a1a]/12 text-[#ff7a1a]' : panelTheme.actions}`} aria-label="Emoji picker">
              <DonRafaelReactionIcon
                className={`h-[18px] w-[18px] transition-all ${isEmojiPickerOpen ? 'text-[#ff7a1a] opacity-95' : isDarkMode ? 'text-[#8696a0] opacity-85' : 'text-[#667781] opacity-85'}`}
              />
            </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2 px-1.5 py-1">
            {replyingToMessage && (
              <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-[11px] ${isDarkMode ? 'bg-white/[0.05]' : 'bg-black/[0.04]'}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-[#ff7a1a]">{t('ws_chat_reply_action')}</p>
                  <p className="truncate opacity-75">{getMessagePreviewText(replyingToMessage, t) || t('ws_chat_deleted_message')}</p>
                </div>
                <button type="button" onClick={() => setReplyingToMessage(null)} className="rounded-full p-1 transition-colors hover:bg-black/10">
                  <X size={14} />
                </button>
              </div>
            )}
            {pendingAttachment && (
              <div className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-[11px] font-medium ${isDarkMode ? 'bg-white/[0.05]' : 'bg-black/[0.04]'}`}>
                <div className="min-w-0">
                  <p className="truncate font-bold">{pendingAttachment.displayName || pendingAttachment.fileName}</p>
                  <p className="truncate opacity-70">
                    {pendingAttachment.type === 'contact'
                      ? (formatInboxPhoneLabel(pendingAttachment.phoneNumber || '') || pendingAttachment.phoneNumber || t('ws_chat_contact_label'))
                      : pendingAttachment.type}
                  </p>
                </div>
                <button type="button" onClick={() => setPendingAttachment(null)} className="rounded-full p-1 transition-colors hover:bg-black/10" aria-label="Remove attachment">
                  <X size={14} />
                </button>
              </div>
            )}
            {isRecordingAudio && (
              <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold ${isDarkMode ? 'bg-white/[0.06] text-white' : 'bg-black/[0.04] text-slate-800'}`}>
                <span className="h-2 w-2 rounded-full bg-[#ff7a1a] animate-pulse"></span>
                <span>{t('ws_chat_recording')}</span>
                <span className="font-mono">{formatRecordingDuration(recordingSeconds)}</span>
              </div>
            )}
            <textarea
              ref={chatTextareaRef}
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={handleChatDraftKeyDown}
              placeholder={isChatReadOnly ? t('ws_chat_reconnect_to_send') : t('ws_chat_placeholder')}
              disabled={isComposerDisabled || isRecordingAudio}
              rows={1}
              className={`min-h-[1.75rem] max-h-[7.5rem] min-w-0 resize-none border-0 py-1.5 text-[15px] font-normal leading-6 outline-none focus:ring-0 ${panelTheme.composerInput}`}
            />
          </div>
          <button
            type="submit"
            disabled={isComposerDisabled || isPreparingAudio}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              chatDraft.trim() || pendingAttachment
                ? 'bg-[#ff7a1a] text-white shadow-[0_14px_28px_-18px_rgba(255,122,26,0.85)] hover:bg-[#ff8f3f]'
                : isRecordingAudio
                  ? 'bg-[#ff7a1a] text-white shadow-[0_14px_28px_-18px_rgba(255,122,26,0.85)] hover:bg-[#ff8f3f]'
                  : panelTheme.actions
            }`}
            aria-label={chatDraft.trim() || pendingAttachment ? t('ws_chat_send_now') : t('ws_chat_record_audio')}
          >
            {chatDraft.trim() || pendingAttachment ? <ArrowRight size={19} strokeWidth={2.8} /> : <Mic size={18} strokeWidth={2} />}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ProspectingWorkspace({ records, onUpdateRecord, onChangeStatus, onAutoSelect, onArchiveRecord, onCreateRecord, waTemplate, setWaTemplate, t, currentUser, language = 'es', isViewOnly, isDarkMode = false, setActiveTab }) {
  const { sectors } = useSectors();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('active');
  const [inboxFilter, setInboxFilter] = useState('all');
  const [showCustomMsg, setShowCustomMsg] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [workspaceModal, setWorkspaceModal] = useState(null);
  const [notesDraftState, setNotesDraftState] = useState({ leadId: null, value: '' });
  const [workspaceNotice, setWorkspaceNotice] = useState(null);
  const [whatsAppChats, setWhatsAppChats] = useState(() => getWhatsAppInboxCache(currentUser?.workspaceId).chats || []);
  const [waChatsConnection, setWaChatsConnection] = useState(() => getWhatsAppInboxCache(currentUser?.workspaceId).connection || null);
  const [isInboxSourceMenuOpen, setIsInboxSourceMenuOpen] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(380);
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const workspaceLayoutRef = useRef(null);
  const inboxSourceMenuRef = useRef(null);
  const autoCreateInboxPhonesRef = useRef(new Set());
  const locale = LANG_LOCALES[language] || LANG_LOCALES.en;
  const workspaceId = currentUser?.workspaceId || '';
  const canAutoCreateWhatsappLeads = Boolean(currentUser?.autoCreateWhatsappLeads) && waChatsConnection?.status === 'open';
  const openedInboxStorageKey = workspaceId ? `crm-wa-opened-chats:${workspaceId}` : '';
  const MIN_LEFT_PANEL_WIDTH = 320;
  const MAX_LEFT_PANEL_WIDTH = 520;
  const MIN_RIGHT_PANEL_WIDTH = 420;
  const [openedInboxKeys, setOpenedInboxKeys] = useState(() => {
    if (typeof window === 'undefined' || !workspaceId) return [];

    try {
      const raw = window.sessionStorage.getItem(`crm-wa-opened-chats:${workspaceId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!workspaceNotice) return undefined;

    const timer = window.setTimeout(() => {
      setWorkspaceNotice(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [workspaceNotice]);

  useEffect(() => {
    if (!isInboxSourceMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (inboxSourceMenuRef.current?.contains(event.target)) return;
      setIsInboxSourceMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isInboxSourceMenuOpen]);

  useEffect(() => {
    if (!showLeadDetails) {
      setShowCustomMsg(false);
    }
  }, [showLeadDetails]);

  useEffect(() => {
    const cachedInbox = getWhatsAppInboxCache(workspaceId);
    setWhatsAppChats(Array.isArray(cachedInbox?.chats) ? cachedInbox.chats : []);
    setWaChatsConnection(cachedInbox?.connection || null);
  }, [workspaceId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !openedInboxStorageKey) {
      setOpenedInboxKeys([]);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(openedInboxStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setOpenedInboxKeys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setOpenedInboxKeys([]);
    }
  }, [openedInboxStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !openedInboxStorageKey) return;

    try {
      window.sessionStorage.setItem(openedInboxStorageKey, JSON.stringify(openedInboxKeys));
    } catch {
      // Ignore session storage errors.
    }
  }, [openedInboxKeys, openedInboxStorageKey]);

  useEffect(() => {
    setWhatsAppInboxCache(workspaceId, {
      chats: whatsAppChats,
      connection: waChatsConnection,
    });
  }, [waChatsConnection, whatsAppChats, workspaceId]);

  const ownerId = currentUser?.id;
  const ownerName = currentUser?.nombre;
  const normalizedSearch = searchTerm.toLowerCase();
  const ownerScopedRecords = useMemo(
    () => records.filter((record) => record.propietarioId === ownerId || record.responsable === ownerName),
    [ownerId, ownerName, records],
  );

  const workspaceContactOptions = useMemo(() => {
    const seenPhones = new Set();

    return ownerScopedRecords
      .filter((record) => {
        const phoneNumber = String(record.numero || '').trim();
        const cleanPhone = getCleanWhatsAppNumber(phoneNumber);
        if (!cleanPhone || seenPhones.has(cleanPhone)) return false;
        seenPhones.add(cleanPhone);
        return true;
      })
      .map((record) => ({
        displayName: getPreferredInboxName({
          leadName: record.nombre || '',
          chatName: '',
          phoneNumber: record.numero || '',
          email: record.correo || '',
          fallbackText: t('ws_no_contact'),
        }),
        phoneNumber: record.numero || '',
        avatarUrl: record.__avatarUrl || '',
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [ownerScopedRecords, t]);

  const activeRecords = useMemo(() => {
    return ownerScopedRecords
      .filter(r => r.inProspecting && !isArchivedLead(r) && !isLostLead(r) &&
        (r.nombre.toLowerCase().includes(normalizedSearch) ||
         (r.numero && r.numero.includes(searchTerm)) ||
         (r.correo && r.correo.toLowerCase().includes(normalizedSearch)))
      )
      .sort((a, b) => calcularPuntajeLead(b) - calcularPuntajeLead(a))
      .slice(0, 15);
  }, [normalizedSearch, ownerScopedRecords, searchTerm]);

  const archivedRecords = useMemo(() => {
    return ownerScopedRecords
      .filter(r => isArchivedLead(r) &&
        (r.nombre.toLowerCase().includes(normalizedSearch) ||
         (r.numero && r.numero.includes(searchTerm)) ||
         (r.correo && r.correo.toLowerCase().includes(normalizedSearch)))
      )
      .sort((a, b) => calcularPuntajeLead(b) - calcularPuntajeLead(a));
  }, [normalizedSearch, ownerScopedRecords, searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const loadWhatsAppChats = async () => {
      try {
        const response = await api.listWhatsAppChats();
        if (cancelled) return;
        setWhatsAppChats(Array.isArray(response?.items) ? response.items : []);
        setWaChatsConnection(response?.connection || null);
      } catch (error) {
        if (cancelled) return;
        setWaChatsConnection(error?.payload?.connection || null);
      }
    };

    loadWhatsAppChats();
    const intervalId = window.setInterval(loadWhatsAppChats, 6000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [workspaceId]);

  const recordsByPhone = useMemo(() => {
    const map = new Map();

    ownerScopedRecords.forEach((record) => {
      const phoneKey = getCleanWhatsAppNumber(record.numero || '');
      if (!phoneKey || map.has(phoneKey)) return;
      map.set(phoneKey, record);
    });

    return map;
  }, [ownerScopedRecords]);

  const bigDataThreads = useMemo(() => {
    return ownerScopedRecords
      .filter((record) => record.inProspecting)
      .map((record) => ({
        ...record,
        id: record.id,
        nombre: getPreferredInboxName({
          leadName: record.nombre || '',
          chatName: '',
          phoneNumber: record.numero || '',
          email: record.correo || '',
          fallbackText: t('ws_no_contact'),
        }),
        __chatJid: normalizeChatContactJid(record.numero || ''),
        __chatName: '',
        __lastMessageText: record.__lastMessageText || '',
        __lastMessageTimestamp: record.__lastMessageTimestamp || 0,
        __lastMessageDirection: record.__lastMessageDirection || 'in',
        __unreadCount: Number(record.__unreadCount || 0),
        __avatarUrl: record.__avatarUrl || '',
        __isKnownLead: true,
        __isInboxUnknown: false,
      }))
      .sort((left, right) => {
        const rightTime = new Date(right.__lastMessageTimestamp || getLatestInboxActivity(right)?.fecha || right.fechaIngreso || 0).getTime();
        const leftTime = new Date(left.__lastMessageTimestamp || getLatestInboxActivity(left)?.fecha || left.fechaIngreso || 0).getTime();
        return rightTime - leftTime;
      });
  }, [ownerScopedRecords, t]);

  const inboxThreads = useMemo(() => {
    return whatsAppChats.map((chat) => {
      const phoneKey = getCleanWhatsAppNumber(chat.phoneNumber || '');
      const matchedRecord = recordsByPhone.get(phoneKey) || null;
      const baseRecord = matchedRecord || {};
      const displayName = getPreferredInboxName({
        leadName: matchedRecord?.nombre || '',
        chatName: chat.name || '',
        phoneNumber: matchedRecord?.numero || chat.phoneNumber || '',
        email: matchedRecord?.correo || '',
        fallbackText: t('ws_no_contact'),
      });

      return {
        ...baseRecord,
        id: matchedRecord?.id || `wa:${chat.jid}`,
        nombre: displayName,
        numero: matchedRecord?.numero || chat.phoneNumber || '',
        correo: matchedRecord?.correo || '',
        origen: matchedRecord?.origen || 'WhatsApp',
        historial: matchedRecord?.historial || [],
        nota: matchedRecord?.nota || '',
        fechaIngreso: matchedRecord?.fechaIngreso || '',
        pipeline_stage: normalizePipelineStage(matchedRecord?.pipeline_stage, matchedRecord || baseRecord),
        estadoProspeccion: matchedRecord?.estadoProspeccion || getLegacyStatusFromPipelineStage(normalizePipelineStage(matchedRecord?.pipeline_stage, matchedRecord || baseRecord)),
        stage: matchedRecord?.stage || getLegacyStageIdFromPipelineStage(normalizePipelineStage(matchedRecord?.pipeline_stage, matchedRecord || baseRecord)),
        isArchived: matchedRecord ? matchedRecord.isArchived : false,
        inProspecting: matchedRecord ? matchedRecord.inProspecting : true,
        mensajeEnviado: matchedRecord ? matchedRecord.mensajeEnviado : false,
        propietarioId: matchedRecord?.propietarioId || ownerId,
        responsable: matchedRecord?.responsable || ownerName,
        sector: matchedRecord?.sector || '',
        categoria: matchedRecord?.categoria || 'C',
        __chatJid: chat.jid,
        __chatName: chat.name || '',
        __lastMessageText: chat.lastMessageText || '',
        __lastMessageTimestamp: chat.lastMessageTimestamp || 0,
        __lastMessageDirection: chat.lastMessageDirection || 'in',
        __unreadCount: Number(chat.unreadCount || 0),
        __avatarUrl: chat.avatarUrl || '',
        __isKnownLead: Boolean(matchedRecord),
        __isInboxUnknown: !matchedRecord,
      };
    });
  }, [ownerId, ownerName, recordsByPhone, t, whatsAppChats]);

  useEffect(() => {
    if (isViewOnly || typeof onCreateRecord !== 'function' || !canAutoCreateWhatsappLeads) return;

    inboxThreads.forEach((thread) => {
      if (!thread.__isInboxUnknown) return;

      const cleanPhone = getCleanWhatsAppNumber(thread.numero || '');
      if (!cleanPhone || recordsByPhone.has(cleanPhone) || autoCreateInboxPhonesRef.current.has(cleanPhone)) return;

      autoCreateInboxPhonesRef.current.add(cleanPhone);

      const nextRecord = {
        nombre: getPreferredInboxName({
          leadName: '',
          chatName: thread.__chatName || '',
          phoneNumber: thread.numero || '',
          email: '',
          fallbackText: t('ws_no_contact'),
        }),
        numero: thread.numero || '',
        correo: '',
        origen: 'WhatsApp Inbox',
        canal: 'WhatsApp',
        sector: thread.sector || 'General',
        subsector: thread.subsector || '',
        categoria: thread.categoria || '-',
        pais: thread.pais || 'OT',
        pipeline_stage: PIPELINE_STAGE_VALUES.NEW,
        estadoProspeccion: getLegacyStatusFromPipelineStage(PIPELINE_STAGE_VALUES.NEW),
        stage: getLegacyStageIdFromPipelineStage(PIPELINE_STAGE_VALUES.NEW),
        responsable: ownerName || 'Sin Asignar',
        propietarioId: ownerId || null,
        inProspecting: true,
        isArchived: false,
        mensajeEnviado: false,
        fechaIngreso: getLocalISODate(),
        nota: '',
        historial: [{
          fecha: getLocalISOTime(),
          accion: 'Lead creado automáticamente desde Inbox WhatsApp',
        }],
      };

      Promise.resolve(onCreateRecord(nextRecord))
        .catch(() => {
          autoCreateInboxPhonesRef.current.delete(cleanPhone);
        });
    });
  }, [canAutoCreateWhatsappLeads, inboxThreads, isViewOnly, onCreateRecord, ownerId, ownerName, recordsByPhone, t]);

  const currentList = useMemo(() => (
    workspaceTab === 'active'
      ? inboxThreads.filter((thread) => !thread.__isKnownLead || !isArchivedLead(thread))
      : inboxThreads.filter((thread) => thread.__isKnownLead && isArchivedLead(thread))
  ).filter((thread) => {
    if (!normalizedSearch) return true;

    const snippet = String(thread.__lastMessageText || '').toLowerCase();
    return (
      String(thread.nombre || '').toLowerCase().includes(normalizedSearch) ||
      String(thread.numero || '').includes(searchTerm) ||
      String(thread.correo || '').toLowerCase().includes(normalizedSearch) ||
      snippet.includes(normalizedSearch)
    );
  }), [inboxThreads, normalizedSearch, searchTerm, workspaceTab]);

  const bigDataList = useMemo(() => (
    workspaceTab === 'active'
      ? bigDataThreads.filter((thread) => !isArchivedLead(thread))
      : bigDataThreads.filter((thread) => isArchivedLead(thread))
  ).filter((thread) => {
    if (!normalizedSearch) return true;

    const snippet = String(getInboxSnippet(thread, t) || '').toLowerCase();
    return (
      String(thread.nombre || '').toLowerCase().includes(normalizedSearch) ||
      String(thread.numero || '').includes(searchTerm) ||
      String(thread.correo || '').toLowerCase().includes(normalizedSearch) ||
      snippet.includes(normalizedSearch)
    );
  }), [bigDataThreads, normalizedSearch, searchTerm, t, workspaceTab]);

  const filteredInboxList = useMemo(() => {
    if (inboxFilter === 'bigdata') {
      return bigDataList;
    }

    return currentList;
  }, [bigDataList, currentList, inboxFilter]);
  const resolvedActiveLeadId = filteredInboxList.some((record) => record.id === activeLeadId)
    ? activeLeadId
    : (filteredInboxList[0]?.id || currentList[0]?.id || null);
  const totalArchivedCount = useMemo(
    () => records.filter((r) => (r.propietarioId === ownerId || r.responsable === ownerName) && isArchivedLead(r)).length,
    [ownerId, ownerName, records],
  );
  const activeInboxCount = useMemo(
    () => (inboxFilter === 'bigdata'
      ? bigDataThreads.filter((thread) => !isArchivedLead(thread)).length
      : inboxThreads.filter((thread) => !thread.__isKnownLead || !isArchivedLead(thread)).length),
    [bigDataThreads, inboxFilter, inboxThreads],
  );
  const archivedInboxCount = useMemo(
    () => (inboxFilter === 'bigdata'
      ? bigDataThreads.filter((thread) => isArchivedLead(thread)).length
      : inboxThreads.filter((thread) => thread.__isKnownLead && isArchivedLead(thread)).length),
    [bigDataThreads, inboxFilter, inboxThreads],
  );

  const inboxSourceOptions = useMemo(() => ([
    { id: 'all', label: t('ws_inbox_title') },
    { id: 'bigdata', label: t('ws_filter_bigdata') },
  ]), [t]);
  const activeInboxSource = inboxSourceOptions.find((option) => option.id === inboxFilter) || inboxSourceOptions[0];

  const activeLead = useMemo(() => {
    if (resolvedActiveLeadId) {
      const found = filteredInboxList.find(r => r.id === resolvedActiveLeadId) || currentList.find(r => r.id === resolvedActiveLeadId);
      if (found) return found;
    }
    return filteredInboxList.length > 0 ? filteredInboxList[0] : (currentList.length > 0 ? currentList[0] : null);
  }, [currentList, filteredInboxList, resolvedActiveLeadId]);

  const notesDraft = notesDraftState.leadId === activeLead?.id ? notesDraftState.value : (activeLead?.nota || '');

  useEffect(() => {
    setShowCustomMsg(false);
    if (!activeLead && showLeadDetails) {
      setShowLeadDetails(false);
    }
  }, [activeLead, showLeadDetails]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = window.sessionStorage.getItem('crm-workspace-target-conversation');
      if (!raw) return;

      const target = JSON.parse(raw);
      if (target?.inboxFilter) {
        setInboxFilter(target.inboxFilter);
      }
      if (target?.workspaceTab) {
        setWorkspaceTab(target.workspaceTab);
      }
      if (target?.leadId) {
        setActiveLeadId(target.leadId);
      }
      window.sessionStorage.removeItem('crm-workspace-target-conversation');
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!isResizingPanels) return undefined;

    const handlePointerMove = (event) => {
      const layoutBounds = workspaceLayoutRef.current?.getBoundingClientRect();
      if (!layoutBounds) return;

      const availableWidth = layoutBounds.width;
      const nextWidth = event.clientX - layoutBounds.left;
      const clampedWidth = Math.max(
        MIN_LEFT_PANEL_WIDTH,
        Math.min(nextWidth, Math.min(MAX_LEFT_PANEL_WIDTH, availableWidth - MIN_RIGHT_PANEL_WIDTH)),
      );

      setLeftPanelWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      setIsResizingPanels(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingPanels]);

  const handleFillWorkspace = () => {
    if (isViewOnly) return;
    const actualActiveCount = records.filter((r) => (r.propietarioId === ownerId || r.responsable === ownerName) && r.inProspecting && !isArchivedLead(r) && !isLostLead(r)).length;
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
    const countsTowardDailyGoal = workspaceTab === 'active' && !isArchivedLead(record) && !isLostLead(record);
    const contactAction = countsTowardDailyGoal
      ? `💬 [CONTACTO REAL]${DAILY_GOAL_EVENT_TAG} Enlace de WhatsApp abierto y lead movido a ${PIPELINE_STAGE_VALUES.COLD_LEAD}`
      : `💬 [CONTACTO ARCHIVADO] Enlace de WhatsApp abierto desde ${PIPELINE_STAGE_VALUES.COLD_LEAD}`;

    onUpdateRecord({
      ...applyPipelineStageToRecord(record, PIPELINE_STAGE_VALUES.COLD_LEAD),
      mensajeEnviado: true,
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
      ...applyPipelineStageToRecord(record, PIPELINE_STAGE_VALUES.LOST),
      historial: [{ fecha: getLocalISOTime(), accion: `Lead marcado como ${PIPELINE_STAGE_VALUES.LOST}` }, ...(record.historial || [])]
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

  const handleOpenLeadDetails = (leadId) => {
    setActiveLeadId(leadId);
    setShowLeadDetails(true);
  };

  const markInboxThreadOpened = (record) => {
    const key = String(record?.__chatJid || record?.id || '').trim();
    if (!key) return;

    setOpenedInboxKeys((current) => (current.includes(key) ? current : [...current, key]));
    setWhatsAppChats((current) => current.map((chat) => (
      String(chat.jid || '').trim() === key
        ? { ...chat, unreadCount: 0 }
        : chat
    )));
  };

  const handleConversationActivity = (message) => {
    setWhatsAppChats((current) => upsertWhatsAppChatList(current, message));
  };

  const paisData = activeLead ? getCountryMetaForRecord(activeLead) : null;
  const sectorData = activeLead ? {
    nombre: getSectorLabel(language, activeLead.sector, sectors),
    icon: getSectorIcon(activeLead.sector, sectors),
    id: activeLead.sector,
  } : null;
  const prob = activeLead ? getProbabilidadObj(activeLead) : null;

  return (
    <div ref={workspaceLayoutRef} className="flex min-h-full flex-col overflow-y-auto overflow-x-hidden bg-white lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden">
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

      {showLeadDetails && activeLead && (
        <LeadDetailsModal
          activeLead={activeLead}
          paisData={paisData}
          prob={prob}
          sectorData={sectorData}
          locale={locale}
          t={t}
          isDarkMode={isDarkMode}
          isViewOnly={isViewOnly}
          language={language}
          onChangeStatus={onChangeStatus}
          onClose={() => setShowLeadDetails(false)}
          onOpenAI={setShowAIModal}
          onRestoreLead={handleRestoreLead}
          onArchiveLead={handleArchiveLead}
          onDiscardLead={handleDiscardLead}
          onQuickWhatsApp={handleQuickWhatsApp}
          waTemplate={waTemplate}
          setWaTemplate={setWaTemplate}
          showCustomMsg={showCustomMsg}
          setShowCustomMsg={setShowCustomMsg}
          workspaceNotice={workspaceNotice}
          notesDraft={notesDraft}
          setNotesDraftState={setNotesDraftState}
          onSaveNotes={handleSaveNotes}
        />
      )}

      <div
        className="flex w-full flex-col border-b border-slate-200 bg-slate-50/50 lg:min-h-0 lg:h-full lg:flex-shrink-0 lg:border-b-0"
        style={{ width: `min(100%, ${leftPanelWidth}px)` }}
      >
        <div className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <div ref={inboxSourceMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsInboxSourceMenuOpen((current) => !current)}
                className="group inline-flex items-center gap-2 rounded-2xl px-1 py-1 text-lg font-black text-slate-800 transition-colors hover:text-[#25D366]"
              >
                <span>{renderInboxSourceLabel(activeInboxSource.id, t)}</span>
                <ChevronDown size={18} className={`text-slate-400 transition-transform group-hover:text-[#25D366] ${isInboxSourceMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isInboxSourceMenuOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 min-w-[14rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.28)]">
                  {inboxSourceOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setInboxFilter(option.id);
                        setIsInboxSourceMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                        activeInboxSource.id === option.id
                          ? 'bg-emerald-50 text-[#25D366]'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span>{renderInboxSourceLabel(option.id, t)}</span>
                      {activeInboxSource.id === option.id && <Check size={15} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={handleFillWorkspace} className="p-2 bg-orange-50 text-[#FF5A1F] rounded-lg hover:bg-orange-100 transition-colors shadow-sm border border-orange-100" title={t('ws_fill_table')}>
              <Zap size={16} className="fill-current" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab?.('pipeline')}
            className={`group mb-4 flex w-full items-center justify-between overflow-hidden rounded-[1.35rem] border px-3 py-3 text-left transition-all duration-200 ${
              isDarkMode
                ? 'border-white/10 bg-[linear-gradient(135deg,rgba(255,122,26,0.14),rgba(255,255,255,0.03))] hover:border-orange-400/25 hover:bg-[linear-gradient(135deg,rgba(255,122,26,0.18),rgba(255,255,255,0.05))] hover:shadow-[0_20px_40px_-28px_rgba(255,122,26,0.55)]'
                : 'border-orange-100 bg-[linear-gradient(135deg,rgba(255,245,237,0.98),rgba(255,255,255,0.96))] hover:border-orange-200 hover:shadow-[0_18px_35px_-24px_rgba(255,90,31,0.4)]'
            }`}
          >
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
              isDarkMode
                ? 'bg-white/[0.06] text-orange-200'
                : 'bg-white text-[#FF5A1F] shadow-sm'
            }`}>
              <Target size={12} />
              Pipeline
            </span>

            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:translate-x-1 ${
              isDarkMode
                ? 'border-white/10 bg-white/[0.05] text-orange-300'
                : 'border-orange-100 bg-white text-[#FF5A1F] shadow-sm'
            }`}>
              <ArrowRight size={18} />
            </div>
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
            <button type="button" onClick={() => setWorkspaceTab('active')} className={`flex-1 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${workspaceTab === 'active' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('ws_tab_active')} ({activeInboxCount})</button>
            <button type="button" onClick={() => setWorkspaceTab('archived')} className={`flex-1 py-1.5 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all ${workspaceTab === 'archived' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('ws_tab_archived')} ({archivedInboxCount})</button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t('ws_search_inbox')} className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent rounded-lg text-sm outline-none focus:bg-white focus:border-[#25D366] focus:ring-2 focus:ring-green-100 transition-all" />
          </div>

          {workspaceNotice?.anchor === 'header' && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 shadow-sm">
              {workspaceNotice.message}
            </div>
          )}
        </div>

        <div className="relative max-h-[34vh] overflow-y-auto overscroll-contain p-2 no-scrollbar space-y-1 [webkit-overflow-scrolling:touch] sm:max-h-[38vh] lg:max-h-none lg:flex-1">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FF5A1F] rounded-full blur-[80px] opacity-15 pointer-events-none"></div>
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

          {filteredInboxList.map(record => {
            const isSelected = activeLeadId === record.id || (activeLead && activeLead.id === record.id);
            const recordCountry = getCountryMetaForRecord(record);
            const isUnknownLead = Boolean(record.__isInboxUnknown);
            const inboxName = getPreferredInboxName({
              leadName: record.nombre || '',
              chatName: record.__chatName || '',
              phoneNumber: record.numero || '',
              email: record.correo || '',
              fallbackText: t('ws_no_contact'),
            });
            const inboxSnippet = getInboxSnippet(record, t);
            const inboxTimestamp = getInboxTimestamp(record, locale);
            const hasAutomatedSnippet = isAutomatedInboxSnippet(record);
            const pipelineStage = getPipelineStageMeta(record.pipeline_stage, record);
            const statusLabel = pipelineStage.label;
            const openedKey = String(record.__chatJid || record.id || '').trim();
            const isChatOpened = openedKey ? openedInboxKeys.includes(openedKey) : false;
            const unreadCount = Number(record.__unreadCount || 0);

            return (
              <div key={record.id} onClick={() => { setActiveLeadId(record.id); markInboxThreadOpened(record); }} className={`relative cursor-pointer rounded-2xl border px-3.5 py-3 transition-all ${
                isSelected
                  ? 'z-20 border-[#25D366]/55 bg-white shadow-[0_10px_24px_-16px_rgba(37,211,102,0.42)]'
                  : 'z-10 border-transparent bg-white/78 hover:bg-white hover:shadow-[0_6px_18px_-14px_rgba(15,23,42,0.18)]'
              } ${record.isArchived && !isSelected ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3.5">
                  <div className="relative shrink-0 pt-0.5">
                    <AvatarInitials name={inboxName} size="md" avatarUrl={record.__avatarUrl || ''} isDarkMode={isDarkMode} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`truncate text-[15px] font-semibold ${isSelected ? 'text-[#111b21]' : 'text-[#111b21]'}`}>
                            {inboxName}
                          </p>
                          <span className="text-xs leading-none" title={recordCountry.nombre}>{recordCountry.flag}</span>
                          {!isUnknownLead && (
                            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] ${pipelineStage.classes}`}>
                              {statusLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        <div className={`text-[11px] font-medium ${unreadCount > 0 && record.__lastMessageDirection !== 'out' ? 'text-[#25D366]' : 'text-[#667781]'}`}>
                          {inboxTimestamp}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 pr-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        {hasAutomatedSnippet && <Bot size={12} className="shrink-0 text-amber-500" />}
                        <p className="truncate text-[13px] leading-5 text-[#667781]">
                          {inboxSnippet}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="inline-flex shrink-0 min-w-[1.2rem] items-center justify-center rounded-full bg-[#25D366] px-1.5 py-[0.1rem] text-[9px] font-bold leading-none text-white shadow-[0_6px_14px_-10px_rgba(37,211,102,0.9)]">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {record.isArchived && <Archive size={14} className="text-amber-500" title={t('ws_archived_lead')} />}
                        {record.mensajeEnviado && <CheckCircle size={14} className="text-green-500" title={t('ws_message_sent')} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredInboxList.length === 0 && (
            <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-white/75 px-4 py-6 text-center text-sm text-slate-400">
              {t('ws_inbox_empty_filter')}
            </div>
          )}
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize workspace panels"
        onMouseDown={() => setIsResizingPanels(true)}
        className={`group relative hidden w-4 shrink-0 cursor-col-resize items-stretch justify-center lg:flex ${isResizingPanels ? 'bg-orange-50/60' : ''}`}
      >
        <div className={`pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 transition-colors ${isResizingPanels ? 'bg-[#FF5A1F]/40' : 'group-hover:bg-[#FF5A1F]/30'}`}></div>
        <div className={`pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-2.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all ${isResizingPanels ? 'border-[#FF5A1F]/30 bg-white shadow-[0_8px_24px_-12px_rgba(255,90,31,0.35)]' : 'border-slate-200/80 bg-white/90 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.2)] group-hover:border-[#FF5A1F]/20 group-hover:bg-white'}`}></div>
      </div>

      <WorkspaceChatPanel activeLead={activeLead} isDarkMode={isDarkMode} t={t} locale={locale} language={language} onConversationActivity={handleConversationActivity} onOpenLeadDetails={handleOpenLeadDetails} contactOptions={workspaceContactOptions} workspaceId={workspaceId} />

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
