import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Archive, Award, BarChart2, Calendar, CheckCircle, Database, Edit2, Globe, PieChart, Target, TrendingUp, Users } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import { api } from '../lib/api';
import { PAISES } from '../lib/constants';
import { getLocalISODate } from '../lib/date';
import { usePersistentState } from '../hooks/usePersistentState';
import { LANG_LOCALES } from '../lib/i18n';

const isLiquidatedLead = (record) => record.estadoProspeccion === 'Liquidado';

function getLatestRealContactEntry(record) {
  const contactLogs = (record?.historial || []).filter((entry) => {
    const action = String(entry?.accion || '');
    return (
      action.includes('[META DIARIA]') ||
      action.includes('[CONTACTO REAL]') ||
      action.includes('WhatsApp abierto') ||
      action.includes('Marcado manual como mensaje enviado')
    );
  });

  if (contactLogs.length === 0) {
    return null;
  }

  return contactLogs[contactLogs.length - 1];
}

export function ReportsView({ records, duplicateRecords = [], currentUser, myAgents, usersDb = [], sharedLinks = [], t, language = 'es', isDarkMode = false }) {
  const [reportTab, setReportTab] = useState('captacion');
  const [metaCaptacion, setMetaCaptacion] = usePersistentState(`crm_report_goal:${currentUser?.id || 'guest'}`, 5000);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [tempMeta, setTempMeta] = useState(metaCaptacion);
  const [inlineNotice, setInlineNotice] = useState(null);
  const [teamOverview, setTeamOverview] = useState({ totals: { assigned: 0, worked: 0 }, ranking: [] });
  const locale = LANG_LOCALES[language] || LANG_LOCALES.en;
  const globalRecords = useMemo(() => [...records, ...duplicateRecords], [duplicateRecords, records]);
  const fmt = (key, values = {}) =>
    Object.entries(values).reduce((acc, [entryKey, entryValue]) => acc.replaceAll(`{${entryKey}}`, String(entryValue)), t(key));
  const getSourcePctClass = (count, variant = 'default') => {
    const pct = Math.round(((count || 0) / Math.max(stats.totalBase, 1)) * 100);
    const isFull = pct >= 100;

    if (variant === 'primary') {
      return isFull ? 'text-[clamp(3.25rem,8vw,5.5rem)]' : 'text-[clamp(3.75rem,9vw,6.5rem)]';
    }

    if (variant === 'secondary') {
      return isFull ? 'text-[clamp(3rem,7vw,4.8rem)]' : 'text-[clamp(3.4rem,8vw,5.6rem)]';
    }

    if (variant === 'compact') {
      return isFull ? 'text-[clamp(2rem,4vw,2.7rem)]' : 'text-[clamp(2.2rem,5vw,3rem)]';
    }

    return isFull ? 'text-[clamp(2.7rem,6vw,4.3rem)]' : 'text-[clamp(3rem,7vw,5rem)]';
  };

  useEffect(() => {
    setTempMeta(metaCaptacion);
  }, [metaCaptacion]);

  useEffect(() => {
    if (!inlineNotice) return undefined;
    const timeoutId = window.setTimeout(() => setInlineNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [inlineNotice]);

  useEffect(() => {
    if (reportTab !== 'equipo' || !currentUser?.id) {
      return;
    }

    let isCancelled = false;

    api.teamOverview()
      .then((result) => {
        if (isCancelled) return;
        setTeamOverview({
          totals: result?.totals || { assigned: 0, worked: 0 },
          ranking: Array.isArray(result?.ranking) ? result.ranking : [],
        });
      })
      .catch(() => {
        if (isCancelled) return;
        setTeamOverview({ totals: { assigned: 0, worked: 0 }, ranking: [] });
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id, reportTab]);

  const stats = useMemo(() => {
    const todayDate = new Date();
    const today = getLocalISODate(todayDate);
    const currentMonthPrefix = today.slice(0, 7);

    const nuevosHoy = globalRecords.filter(r => r.fechaIngreso === today).length;
    const nuevosMes = globalRecords.filter(r => r.fechaIngreso.startsWith(currentMonthPrefix)).length;
    const totalBase = globalRecords.length;
    const pctMeta = Math.min(Math.round((nuevosMes / metaCaptacion) * 100), 100);

    const leadsFaltantes = Math.max(metaCaptacion - nuevosMes, 0);
    const diasEnMes = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
    const diasRestantes = Math.max(diasEnMes - todayDate.getDate(), 1);
    const leadsPorDia = Math.ceil(leadsFaltantes / diasRestantes);

    const diasTranscurridos = Math.max(todayDate.getDate(), 1);
    const ritmoActual = nuevosMes / diasTranscurridos;
    const proyeccionMes = Math.round(ritmoActual * diasEnMes);
    const estadoRitmo = nuevosMes >= metaCaptacion ? 'logrado' : (proyeccionMes >= metaCaptacion ? 'bueno' : 'bajo');

    const origenCount = {};
    globalRecords.forEach(r => { origenCount[r.origen] = (origenCount[r.origen] || 0) + 1; });
    const topOrigenes = Object.entries(origenCount).map(([nombre, count]) => ({ nombre, count })).sort((a, b) => b.count - a.count);

    const countryCount = {};
    globalRecords.forEach((record) => {
      const key = record.pais || 'OT';
      countryCount[key] = (countryCount[key] || 0) + 1;
    });
    const topCountries = Object.entries(countryCount).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    const ownerId = currentUser?.id;
    const ownerName = currentUser?.nombre;
    const misLeads = records.filter((r) =>
      (r.propietarioId === ownerId || r.responsable === ownerName) &&
      !isLiquidatedLead(r),
    );
    const misTrabajados = misLeads.filter(r => r.estadoProspeccion !== 'Nuevo').length;
    const misContactados = misLeads.filter(r => r.mensajeEnviado).length;
    const misRespondieron = misLeads.filter(r => r.estadoProspeccion === 'Respondió').length;

    const misArchivadosMes = misLeads.filter(r => {
      if (r.estadoProspeccion !== 'Archivado' && !r.isArchived) return false;
      return (r.historial || []).some(h => getLocalISODate(new Date(h.fecha)).startsWith(currentMonthPrefix));
    }).length;

    const tasaRespuesta = misContactados > 0 ? Math.round((misRespondieron / misContactados) * 100) : 0;
    const tasaConversion = misTrabajados > 0 ? Math.round((misRespondieron / misTrabajados) * 100) : 0;

    const misContactadosHoy = misLeads.filter(r => {
      if (!r.mensajeEnviado) return false;
      const latestContactEntry = getLatestRealContactEntry(r);
      if (!latestContactEntry) return false;
      return getLocalISODate(new Date(latestContactEntry.fecha)) === today;
    }).length;
    const metaDiariaPersonal = 15;

    const teamMembers = usersDb.filter(
      (user) =>
        user.id !== currentUser?.id &&
        user.referidoPor &&
        currentUser?.codigoPropio &&
        user.referidoPor === currentUser.codigoPropio,
    );
    const teamMemberIds = new Set(teamMembers.map((user) => user.id));
    const teamMemberNames = new Set(teamMembers.map((user) => user.nombre));
    const teamMemberCodes = new Set(teamMembers.map((user) => user.codigoPropio).filter(Boolean));
    const teamMemberWorkspaces = new Set(teamMembers.map((user) => user.workspaceId).filter(Boolean));
    const relevantTeamLinks = sharedLinks.filter((link) => {
      if (!link) return false;
      if (link.teamMemberId && teamMemberIds.has(link.teamMemberId)) return true;
      if (link.teamMemberCode && teamMemberCodes.has(link.teamMemberCode)) return true;
      if (link.teamMemberName && teamMemberNames.has(link.teamMemberName)) return true;
      return false;
    });
    const sharedSourceIds = new Set(
      relevantTeamLinks.flatMap((link) => Array.isArray(link.sourceRecordIds) ? link.sourceRecordIds : []),
    );
    const teamReceivedRecords = records.filter((record) => {
      if (!record.sourceRecordId || !sharedSourceIds.has(record.sourceRecordId)) return false;
      if (record.estadoProspeccion === 'Descartado' || isLiquidatedLead(record)) return false;
      return (
        (record.propietarioId && teamMemberIds.has(record.propietarioId)) ||
        (record.workspaceId && teamMemberWorkspaces.has(record.workspaceId)) ||
        (record.responsable && teamMemberNames.has(record.responsable))
      );
    });
    const teamReceivedRecordIds = new Set(teamReceivedRecords.map((record) => record.id));
    const teamWorkedPredicate = (record) =>
      Boolean(record.mensajeEnviado) ||
      Boolean(getLatestRealContactEntry(record)) ||
      (record.estadoProspeccion !== 'Nuevo' && record.estadoProspeccion !== 'Archivado');
    const agentesStats = teamMembers.map((member) => {
      const leads = teamReceivedRecords.filter(
        (record) =>
          record.propietarioId === member.id ||
          record.workspaceId === member.workspaceId ||
          record.responsable === member.nombre,
      );
      const asignados = leads.length;
      const trabajados = leads.filter(teamWorkedPredicate).length;
      const contactados = leads.filter((record) => Boolean(record.mensajeEnviado) || Boolean(getLatestRealContactEntry(record))).length;
      const contactadosMes = leads.filter((record) => {
        const latestContactEntry = getLatestRealContactEntry(record);
        if (!latestContactEntry) return false;
        return getLocalISODate(new Date(latestContactEntry.fecha)).startsWith(currentMonthPrefix);
      }).length;
      const rendimiento = asignados > 0 ? Math.round((contactados / asignados) * 100) : 0;
      return {
        ...member,
        asignados,
        trabajados,
        contactados,
        contactadosMes,
        rendimiento,
      };
    }).filter((member) => member.asignados > 0).sort((a, b) => b.contactadosMes - a.contactadosMes || b.trabajados - a.trabajados);

    const equipoTotalAsignados = teamReceivedRecords.length;
    const equipoTotalTrabajados = teamReceivedRecords.filter((record) => teamReceivedRecordIds.has(record.id) && teamWorkedPredicate(record)).length;

    const heatmapData = Array(5).fill(0).map(() => Array(8).fill(0));
    let maxHeat = 0;

    misLeads.forEach(r => {
      (r.historial || []).forEach(h => {
        const act = h.accion.toLowerCase();
        if (act.includes('whatsapp') || act.includes('mensaje enviado') || act.includes('estado actualizado')) {
          const d = new Date(h.fecha);
          const day = d.getDay();
          if (day >= 1 && day <= 5) {
            const uiDay = day - 1;
            const hour = d.getHours();
            const slot = Math.floor(hour / 3);
            heatmapData[uiDay][slot]++;
            if (heatmapData[uiDay][slot] > maxHeat) {
              maxHeat = heatmapData[uiDay][slot];
            }
          }
        }
      });
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - (6 - i));
      return getLocalISODate(d);
    });

    const activityTrend = last7Days.map(dateStr => {
      const count = misLeads.filter(r => {
        if (!r.mensajeEnviado) return false;
        const contactLogs = (r.historial || []).filter(h =>
          h.accion.includes('[CONTACTO REAL]') || h.accion.includes('WhatsApp abierto') || h.accion.includes('Marcado manual como mensaje enviado')
        );
        if (contactLogs.length === 0) return false;
        return getLocalISODate(new Date(contactLogs[contactLogs.length - 1].fecha)) === dateStr;
      }).length;
      const label = new Date(dateStr).toLocaleDateString(locale, { weekday: 'short' }).toUpperCase().replace('.', '');
      return { date: dateStr, label, count };
    });

    const maxTrend = Math.max(...activityTrend.map(d => d.count), 1);
    const tendenciaHoy = activityTrend[6].count;
    const tendenciaAyer = activityTrend[5].count;
    const tendenciaCrecimiento = tendenciaAyer === 0 ? (tendenciaHoy > 0 ? 100 : 0) : Math.round(((tendenciaHoy - tendenciaAyer) / tendenciaAyer) * 100);

    return {
      nuevosHoy, nuevosMes, totalBase, metaCaptacion, pctMeta, topOrigenes, topCountries,
      leadsFaltantes, diasRestantes, leadsPorDia, proyeccionMes, estadoRitmo,
      misTotal: misLeads.length, misTrabajados, misContactados, misRespondieron, misArchivadosMes, tasaRespuesta, tasaConversion, misContactadosHoy, metaDiariaPersonal,
      agentesStats, equipoTotalAsignados, equipoTotalTrabajados,
      heatmapData, maxHeat,
      activityTrend, maxTrend, tendenciaCrecimiento
    };
  }, [currentUser, globalRecords, locale, metaCaptacion, myAgents, records, sharedLinks, usersDb]);

  const handleSaveMeta = () => {
    const val = parseInt(tempMeta, 10);
    if (isNaN(val) || val < 2500) {
      setInlineNotice(t('reports_min_goal_alert'));
      setTempMeta(metaCaptacion);
    } else {
      setMetaCaptacion(val);
    }
    setIsEditingMeta(false);
  };

  const effectiveTeamAssigned = teamOverview?.totals?.assigned ?? stats.equipoTotalAsignados;
  const effectiveTeamWorked = teamOverview?.totals?.worked ?? stats.equipoTotalTrabajados;
  const effectiveTeamRanking = teamOverview?.ranking?.length ? teamOverview.ranking : stats.agentesStats;

  return (
    <div className="h-full overflow-y-auto bg-slate-50/30 p-4 sm:p-6 lg:p-10 no-scrollbar">
      <header className="mb-6">
        <h2 className="flex items-center gap-3 text-2xl font-black text-slate-800 sm:text-3xl">
          <BarChart2 className="text-[#FF5A1F]" /> {t('reports_title')}
        </h2>
        <p className="text-slate-500 mt-1">{t('reports_subtitle')}</p>
      </header>

      <div className="mb-8 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex w-max min-w-full gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 sm:min-w-0 sm:w-fit">
          <button type="button" onClick={() => setReportTab('captacion')} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:px-5 ${reportTab === 'captacion' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-[#FF5A1F]'}`}>
            <Database size={16} /> {t('reports_tab_capture')}
          </button>
          <button type="button" onClick={() => setReportTab('personal')} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:px-5 ${reportTab === 'personal' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Target size={16} /> {t('reports_tab_personal')}
          </button>
          <button type="button" onClick={() => setReportTab('equipo')} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:px-5 ${reportTab === 'equipo' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Users size={16} /> {t('reports_tab_team')}
          </button>
          </div>
        </div>
        {reportTab === 'personal' && (
          <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm xl:w-auto xl:max-w-[420px] xl:shrink-0">
            <AvatarInitials name={currentUser.nombre} avatarUrl={currentUser.avatarUrl} isDarkMode={isDarkMode} />
            <p className="min-w-0 text-sm font-bold text-slate-700">
              {t('reports_viewing_data')} <span className="break-words text-emerald-600">{currentUser.nombre}</span>
            </p>
          </div>
        )}
      </div>

      {globalRecords.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
          <PieChart size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-slate-600">{t('reports_no_data')}</p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {reportTab === 'captacion' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                <div className="flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#FF5A1F]"><Calendar size={18} /></div>
                    <span className="font-bold text-sm text-slate-500 uppercase tracking-wider">{t('reports_new_today')}</span>
                  </div>
                  <h3 className="text-4xl font-black text-slate-800 sm:text-5xl">{stats.nuevosHoy}</h3>
                </div>
                <div className="flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#FF5A1F]"><TrendingUp size={18} /></div>
                    <span className="font-bold text-sm text-slate-500 uppercase tracking-wider">{t('reports_new_month')}</span>
                  </div>
                  <h3 className="text-4xl font-black text-slate-800 sm:text-5xl">{stats.nuevosMes}</h3>
                </div>
                <div className="flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Database size={18} /></div>
                    <span className="font-bold text-sm text-slate-500 uppercase tracking-wider">{t('reports_total_historical')}</span>
                  </div>
                  <h3 className="text-4xl font-black text-slate-800 sm:text-5xl">{stats.totalBase}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] gap-6">
                <div className="relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-neutral-900 to-black p-5 text-white shadow-md sm:p-6 md:p-8">
                  <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                  {inlineNotice ? (
                    <div className="relative z-10 mb-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                      {inlineNotice}
                    </div>
                  ) : null}

                  <div>
                    <h3 className="text-lg font-bold text-slate-400 mb-6 flex items-center justify-between gap-3 relative z-10">
                      {t('reports_capture_goal_month')}
                      <button type="button" onClick={() => { setTempMeta(stats.metaCaptacion); setIsEditingMeta(true); }} className="text-slate-500 transition-colors hover:text-[#FF5A1F]" title={t('reports_edit_goal')}>
                        <Edit2 size={14} />
                      </button>
                    </h3>
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1 mb-2 relative z-10 min-w-0">
                      <span className="text-[clamp(3rem,7vw,4.25rem)] font-black leading-none">{stats.nuevosMes}</span>
                      <div className="min-w-0 text-slate-500 font-medium mb-1 flex flex-wrap items-center gap-1 text-[clamp(1rem,2.3vw,1.1rem)]">
                        /
                        {isEditingMeta ? (
                          <input
                            type="number"
                            min="2500"
                            value={tempMeta}
                            onChange={(e) => {
                              setTempMeta(e.target.value);
                              setInlineNotice(null);
                            }}
                            onBlur={handleSaveMeta}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveMeta()}
                            autoFocus
                            className="w-20 bg-black/50 text-white px-1 py-0.5 rounded border border-neutral-700 outline-none focus:border-[#FF5A1F] text-sm"
                          />
                        ) : (
                          <span
                            onClick={() => { setTempMeta(stats.metaCaptacion); setIsEditingMeta(true); }}
                            className="cursor-pointer break-all border-b border-dashed border-slate-600 transition-colors hover:text-white"
                            title={t('reports_click_edit')}
                          >
                            {stats.metaCaptacion.toLocaleString()}
                          </span>
                        )}
                        {t('reports_leads')}
                      </div>
                    </div>

                    <div className="w-full bg-black/40 rounded-full h-3 mt-6 overflow-hidden relative shadow-inner z-10">
                      <div style={{ width: `${stats.pctMeta}%` }} className="h-full bg-gradient-to-r from-[#FF3C00] to-[#FFB36B] rounded-full relative z-10 transition-all duration-1000"></div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/10 relative z-10 flex flex-col gap-4">
                    <div className="flex flex-wrap justify-between items-end gap-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('reports_remaining_goal')}</span>
                        <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
                          <span className="text-[clamp(2rem,5vw,3rem)] font-black text-white leading-none">{stats.leadsFaltantes.toLocaleString()}</span>
                          <span className="text-xs font-medium text-slate-500">{t('reports_leads')}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t('reports_progress')}</span>
                        <span className="text-[clamp(2rem,5vw,3rem)] font-black text-[#FFB36B] leading-none tracking-tighter">{stats.pctMeta}%</span>
                      </div>
                    </div>

                    <div className={`p-3.5 rounded-xl border flex items-start gap-3 mt-1 ${
                      stats.estadoRitmo === 'logrado' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      stats.estadoRitmo === 'bueno' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <div className="mt-0.5 shrink-0">
                        {stats.estadoRitmo === 'logrado' ? <CheckCircle size={18} /> :
                          stats.estadoRitmo === 'bueno' ? <TrendingUp size={18} /> :
                            <Activity size={18} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold mb-0.5 text-white">
                          {stats.estadoRitmo === 'logrado' ? t('reports_goal_achieved') :
                            stats.estadoRitmo === 'bueno' ? t('reports_excellent_pace') :
                              t('reports_low_pace')}
                        </p>
                        <p className="text-[11px] opacity-90 leading-snug">
                          {stats.estadoRitmo === 'logrado' ? t('reports_goal_achieved_desc') :
                            stats.estadoRitmo === 'bueno' ? fmt('reports_excellent_pace_desc', { projection: stats.proyeccionMes.toLocaleString() }) :
                              fmt('reports_low_pace_desc', {
                                projection: stats.proyeccionMes.toLocaleString(),
                                perDay: stats.leadsPorDia.toLocaleString(),
                                remaining: stats.diasRestantes === 1 ? t('reports_last_day_month') : fmt('reports_remaining_days', { days: stats.diasRestantes }),
                              })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-col rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6 md:p-8">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h3 className="min-w-0 text-lg font-bold text-slate-800 flex items-center gap-2"><PieChart size={18} className="text-[#FF5A1F]" /> <span className="truncate">{t('reports_contact_sources')}</span></h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('reports_top5_distribution')}</p>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {[...stats.topOrigenes.slice(0, 5), ...Array.from({ length: Math.max(0, 5 - stats.topOrigenes.slice(0, 5).length) }, () => ({ nombre: '-', count: 0 }))].slice(0, 5).map((item, index) => {
                      const pct = Math.round(((item.count || 0) / Math.max(stats.totalBase, 1)) * 100);
                      return (
                        <div key={`mobile-origin-${index}`} className={`rounded-[1.25rem] p-4 ${index === 0 ? 'bg-gradient-to-r from-[#FF7A00] to-[#FFB36B] text-slate-900' : index === 1 ? 'bg-orange-100 text-slate-900' : 'bg-slate-50 text-slate-800'} border ${index <= 1 ? 'border-orange-200/60' : 'border-slate-100'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold leading-tight break-words">{item.nombre}</h4>
                              <p className={`mt-1 text-xs ${index === 0 ? 'text-slate-900/70' : 'text-slate-500'}`}>{t('reports_leads_captured').replace('{count}', item.count)}</p>
                            </div>
                            <span className="shrink-0 text-3xl font-black leading-none">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block">
                  {(() => {
                    const top5 = [...stats.topOrigenes];
                    while (top5.length < 5) top5.push({ nombre: '-', count: 0 });
                    const getPct = (c) => Math.round(((c || 0) / Math.max(stats.totalBase, 1)) * 100);
                    const softCardBase = isDarkMode
                      ? 'border border-white/10 text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
                      : 'border';
                    const softTitle = isDarkMode ? 'text-black' : 'text-slate-900';
                    const softMeta = isDarkMode ? 'text-black/70' : 'text-slate-800/60';
                    const softPct = isDarkMode ? 'text-black' : 'text-slate-900';

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[320px]">
                        <div className="flex flex-col gap-3 h-full">
                          <div className={`bg-[#FFF0EB] rounded-[1.5rem] rounded-bl-lg p-5 flex flex-col justify-between min-h-[120px] md:h-[28%] transition-transform hover:scale-[1.02] cursor-default overflow-hidden ${isDarkMode ? 'bg-[#F7E7E1]' : ''} ${softCardBase} ${isDarkMode ? 'border-orange-100/20' : 'border-orange-100/50'}`}>
                            <div className="min-w-0">
                              <h4 className={`font-bold text-xs leading-tight break-words line-clamp-2 ${softTitle}`}>{top5[3].nombre}</h4>
                            </div>
                            <span className={`${getSourcePctClass(top5[3].count)} font-black tracking-tighter leading-none ${softPct}`}>{getPct(top5[3].count)}%</span>
                          </div>

                          <div className={`bg-[#FFD4B8] rounded-[1.5rem] rounded-bl-lg p-5 flex flex-col justify-between flex-1 transition-transform hover:scale-[1.02] cursor-default overflow-hidden ${isDarkMode ? 'bg-[#F6CCAF]' : ''} ${softCardBase} ${isDarkMode ? 'border-orange-200/20' : 'border-orange-200/50'}`}>
                            <div className="min-w-0">
                              <h4 className={`font-bold text-sm leading-tight break-words line-clamp-2 ${softTitle}`}>{top5[2].nombre}</h4>
                              <p className={`text-[10px] break-words mt-0.5 ${softMeta}`}>{fmt('reports_leads_captured', { count: top5[2].count })}</p>
                            </div>
                            <span className={`${getSourcePctClass(top5[2].count, 'default')} font-black tracking-tighter leading-none ${softPct}`}>{getPct(top5[2].count)}%</span>
                          </div>

                          <div className={`rounded-[1.5rem] rounded-bl-lg p-4 flex flex-col justify-between min-h-[120px] md:h-[22%] transition-transform hover:scale-[1.02] cursor-default overflow-hidden ${isDarkMode ? 'bg-[#303030] border-white/14' : 'bg-slate-100 border-slate-200/50'} ${softCardBase}`}>
                            <div className="flex justify-between items-end gap-3 h-full min-w-0">
                              <h4 className={`font-bold text-xs leading-tight break-words line-clamp-3 mb-1 max-w-[65%] ${isDarkMode ? 'text-white' : softTitle}`}>{top5[4].nombre}</h4>
                              <span className={`shrink-0 ${getSourcePctClass(top5[4].count, 'compact')} font-black tracking-tighter leading-none ${isDarkMode ? 'text-white' : softPct}`}>{getPct(top5[4].count)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 h-full">
                          <div className="bg-[#FF7A00] rounded-[1.5rem] rounded-bl-lg p-5 md:p-6 flex flex-col justify-between flex-[1.3] transition-transform hover:scale-[1.02] cursor-default shadow-inner overflow-hidden">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-base md:text-lg leading-tight break-words line-clamp-2">{top5[0].nombre}</h4>
                              <p className="text-xs text-slate-900/70 font-medium mt-1 break-words">{fmt('reports_main_source', { count: top5[0].count })}</p>
                            </div>
                            <span className={`${getSourcePctClass(top5[0].count, 'primary')} font-black text-slate-900 tracking-tighter leading-none self-end`}>{getPct(top5[0].count)}%</span>
                          </div>

                          <div className="bg-[#FF9B40] rounded-[1.5rem] rounded-bl-lg p-5 md:p-6 flex flex-col justify-between flex-1 transition-transform hover:scale-[1.02] cursor-default shadow-inner overflow-hidden">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-base leading-tight break-words line-clamp-2">{top5[1].nombre}</h4>
                              <p className="text-[11px] text-slate-900/70 font-medium mt-1 break-words">{fmt('reports_second_source', { count: top5[1].count })}</p>
                            </div>
                            <span className={`${getSourcePctClass(top5[1].count, 'secondary')} font-black text-slate-900 tracking-tighter leading-none self-end`}>{getPct(top5[1].count)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Globe size={18} className="text-emerald-600" /> {t('reports_top_countries')}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('reports_top5')}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                    {stats.topCountries.length > 0 ? stats.topCountries.map((item, index) => {
                      const country = PAISES.find((entry) => entry.code === item.code) || { flag: '🌐', nombre: item.code };
                      const pct = Math.round((item.count / Math.max(stats.totalBase, 1)) * 100);

                      return (
                        <div key={`${item.code}-${index}`} className="bg-slate-50 rounded-xl px-4 py-4 border border-slate-100 min-h-[108px] flex flex-col justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="text-2xl leading-none mt-0.5">{country.flag}</span>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-sm truncate">{country.nombre}</div>
                              <div className="text-xs text-slate-400 font-medium">{item.code}</div>
                            </div>
                          </div>
                          <div className="flex items-end justify-between gap-3 shrink-0 mt-4">
                            <div className="text-2xl font-black text-slate-800 leading-none">{item.count}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{pct}%</div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-sm text-slate-400">{t('reports_not_enough_country')}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportTab === 'personal' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-orange-100 bg-white p-5 shadow-[0_8px_30px_-10px_rgba(255,90,31,0.15)] sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-2 w-full relative z-10">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Target size={18} className="text-[#FF5A1F]" /> {t('reports_daily_goal')}
                    </h3>
                    <span className="px-3 py-1 bg-orange-50 text-[#FF5A1F] text-[10px] font-bold rounded-full uppercase tracking-wider">{t('reports_connection')}</span>
                  </div>

                  <div className="relative w-full flex justify-center mt-6 mb-8 z-10">
                    <svg viewBox="0 0 200 110" className="w-full max-w-[220px] drop-shadow-md">
                      <defs>
                        <linearGradient id="dailyGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FFB36B" />
                          <stop offset="100%" stopColor="#FF3C00" />
                        </linearGradient>
                      </defs>
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#FFF0EB" strokeWidth="16" strokeLinecap="round" />
                      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#dailyGaugeGrad)" strokeWidth="16" strokeLinecap="round"
                        strokeDasharray={251.327}
                        strokeDashoffset={251.327 - (Math.min(stats.misContactadosHoy / stats.metaDiariaPersonal, 1)) * 251.327}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>

                    <div className="absolute bottom-1 left-0 w-full flex flex-col items-center justify-end">
                      <span className="text-4xl font-black text-slate-800 leading-none tracking-tighter">
                        {Math.round((stats.misContactadosHoy / stats.metaDiariaPersonal) * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{t('reports_completed')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-auto relative z-10">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> {t('reports_contacted_today')}</span>
                      <div className="text-sm font-black text-slate-800">{stats.misContactadosHoy} <span className="text-slate-400 font-medium">/ {stats.metaDiariaPersonal}</span></div>
                    </div>

                    {stats.misContactadosHoy >= stats.metaDiariaPersonal ? (
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5"><Target size={14} /> {t('reports_state')}</span>
                        <span className="text-sm font-black text-emerald-600">{t('reports_goal_achieved')}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                        <span className="text-xs font-bold text-[#FF5A1F] flex items-center gap-1.5"><Activity size={14} /> {t('reports_need_goal')}</span>
                        <span className="text-sm font-black text-[#FF5A1F]">{fmt('reports_need_more_today', { count: Math.max(stats.metaDiariaPersonal - stats.misContactadosHoy, 0) })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-6 lg:col-span-2">
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-[2rem] border border-slate-100 bg-white p-5 text-center shadow-sm sm:p-6 md:p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4 shadow-inner">
                      <Archive size={28} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{t('reports_archived_month')}</h3>
                    <div className="flex items-baseline gap-2">
                      <p className="text-6xl font-black text-slate-800">{stats.misArchivadosMes}</p>
                      <span className="text-sm font-bold text-slate-400">{t('reports_leads')}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 max-w-xs">{t('reports_total_contacted_archived')}</p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6 md:p-8">
                <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp size={16} className="text-[#FF5A1F]" /> {t('reports_activity_trend')}
                    </h3>
                    <div className="flex items-baseline gap-3 mt-2">
                      <span className="text-3xl font-black text-slate-800">{stats.activityTrend[6].count}</span>
                      <span className="text-sm font-medium text-slate-500">{t('reports_contacts_today')}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${stats.tendenciaCrecimiento >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {stats.tendenciaCrecimiento >= 0 ? '↑' : '↓'} {Math.abs(stats.tendenciaCrecimiento)}%
                      </span>
                    </div>
                  </div>
                  <select className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 outline-none">
                    <option>{t('reports_last_7_days')}</option>
                  </select>
                </div>

                {(() => {
                  const trendPts = stats.activityTrend.map((d, i) => {
                    const x = 50 + (i * (700 / 6));
                    const y = 180 - (d.count / stats.maxTrend) * 100;
                    return { x, y, label: d.label, count: d.count };
                  });

                  const createSmoothPath = (pts) => {
                    if (pts.length === 0) return '';
                    let d = `M ${pts[0].x},${pts[0].y} `;
                    for (let i = 1; i < pts.length; i++) {
                      const prev = pts[i - 1];
                      const curr = pts[i];
                      const cpX = (prev.x + curr.x) / 2;
                      d += `C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y} `;
                    }
                    return d;
                  };

                  const pathD = createSmoothPath(trendPts);
                  const areaD = `${pathD} L ${trendPts[trendPts.length - 1].x},180 L ${trendPts[0].x},180 Z`;

                  return (
                    <div className="w-full overflow-x-auto no-scrollbar">
                      <div className="min-w-[600px] h-[220px]">
                        <svg viewBox="0 0 800 220" className="w-full h-full overflow-visible">
                          <defs>
                            <pattern id="stripesTrend" width="12" height="12" patternTransform="rotate(45)">
                              <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(255, 90, 31, 0.15)" strokeWidth="3" />
                            </pattern>
                            <linearGradient id="fadeGradTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(255,90,31,0.25)" />
                              <stop offset="100%" stopColor="rgba(255,90,31,0)" />
                            </linearGradient>
                          </defs>

                          {[80, 130, 180].map((y, i) => (
                            <g key={`grid-${i}`}>
                              <line x1="50" y1={y} x2="750" y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth="1" strokeDasharray="4 4" />
                              <text x="40" y={y + 3} textAnchor="end" className="text-[10px] font-medium fill-slate-300">
                                {Math.round(stats.maxTrend - (i * stats.maxTrend / 2))}
                              </text>
                            </g>
                          ))}

                          <path d={areaD} fill="url(#stripesTrend)" />
                          <path d={areaD} fill="url(#fadeGradTrend)" />
                          <path d={pathD} fill="none" stroke="#FF5A1F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                          {trendPts.map((pt, i) => {
                            const isLast = i === trendPts.length - 1;
                            return (
                              <g key={i}>
                                <text x={pt.x} y="205" textAnchor="middle" className={`text-[10px] font-bold uppercase tracking-wider ${isLast ? 'fill-slate-800' : 'fill-slate-400'}`}>
                                  {pt.label}
                                </text>

                                {isLast && (
                                  <g>
                                    <rect x={pt.x - 12} y={pt.y - 12} width="24" height={180 - pt.y + 12} rx="12" fill="rgba(255,90,31,0.15)" stroke="#FF5A1F" strokeWidth="2" />
                                    <rect x={pt.x - 22} y={pt.y - 40} width="44" height="24" rx="8" fill="#1e293b" />
                                    <text x={pt.x} y={pt.y - 24} textAnchor="middle" alignmentBaseline="middle" className="text-[10px] font-bold fill-white">
                                      {stats.tendenciaCrecimiento >= 0 ? '+' : ''}{stats.tendenciaCrecimiento}%
                                    </text>
                                  </g>
                                )}

                                <circle cx={pt.x} cy={pt.y} r={isLast ? '5' : '4'} fill={isLast ? '#FF5A1F' : '#ffffff'} stroke="#FF5A1F" strokeWidth="2" />
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {reportTab === 'equipo' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <div className="flex items-center gap-4 rounded-[2rem] bg-gradient-to-br from-purple-600 to-indigo-600 p-5 text-white shadow-md sm:gap-6 sm:p-6">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center"><Globe size={28} /></div>
                  <div>
                    <p className="text-sm font-bold text-purple-200 uppercase tracking-wider mb-1">{t('reports_team_leads')}</p>
                    <h3 className="text-4xl font-black">{effectiveTeamAssigned}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:gap-6 sm:p-6">
                  <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center"><Activity size={28} /></div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{t('reports_team_worked')}</p>
                    <h3 className="text-4xl font-black text-slate-800">{effectiveTeamWorked}</h3>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Award className="text-yellow-500" /> {t('reports_performance_ranking')}</h3>
                </div>

                {effectiveTeamRanking.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">{t('reports_no_team_stats')}</div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex flex-col gap-3 p-4 sm:hidden">
                      {effectiveTeamRanking.slice(0, 3).map((agente, idx) => (
                        <div key={`mobile-rank-${agente.id}`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : 'bg-[#FF5A1F]'}`}>{idx + 1}</span>
                            <AvatarInitials name={agente.nombre} isDarkMode={isDarkMode} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800">{agente.nombre}</p>
                              <p className="text-xs text-slate-400">{agente.contactadosMes} {t('reports_prospected')}</p>
                            </div>
                          </div>
                          <span className="text-lg font-black text-slate-700">{agente.rendimiento}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="relative mt-2 hidden items-end justify-center gap-2 px-6 pb-8 pt-12 sm:flex sm:gap-6">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-yellow-400/10 rounded-full blur-[80px] pointer-events-none"></div>

                      {effectiveTeamRanking[1] && (
                        <div className="flex flex-col items-center w-28 sm:w-36 relative z-10 animate-in slide-in-from-bottom-4 duration-500 delay-100">
                          <div className="relative mb-3">
                            <AvatarInitials name={effectiveTeamRanking[1].nombre} isDarkMode={isDarkMode} />
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] border-2 shadow-sm bg-slate-400 text-white border-white">2</div>
                          </div>
                          <span className="font-bold text-slate-800 text-sm mb-3 truncate w-full text-center px-1">{effectiveTeamRanking[1].nombre}</span>
                          <div className="w-full rounded-t-2xl border-t-4 border-slate-300 border-x border-x-slate-100 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-2 h-32 bg-gradient-to-t from-slate-100/50 to-slate-50/30">
                            <span className="text-xl font-black text-slate-500 leading-none">{effectiveTeamRanking[1].contactadosMes}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{t('reports_prospected')}</span>
                          </div>
                        </div>
                      )}

                      {effectiveTeamRanking[0] && (
                        <div className="flex flex-col items-center w-32 sm:w-40 relative z-10 animate-in slide-in-from-bottom-8 duration-500">
                          <div className="absolute -top-7 text-3xl drop-shadow-sm">👑</div>
                          <div className="relative mb-3">
                            <AvatarInitials name={effectiveTeamRanking[0].nombre} size="lg" isDarkMode={isDarkMode} />
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-black text-[12px] border-2 shadow-sm bg-yellow-400 text-white border-white">1</div>
                          </div>
                          <span className="font-bold text-slate-800 text-base mb-3 truncate w-full text-center px-1">{effectiveTeamRanking[0].nombre}</span>
                          <div className="w-full rounded-t-2xl border-t-4 border-yellow-400 border-x border-x-slate-100 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-2 h-44 bg-gradient-to-t from-yellow-100/40 to-yellow-50/20">
                            <span className="text-3xl font-black text-yellow-600 leading-none">{effectiveTeamRanking[0].contactadosMes}</span>
                            <span className="text-[10px] font-bold text-yellow-700/60 uppercase tracking-wider mt-1">{t('reports_prospected')}</span>
                          </div>
                        </div>
                      )}

                      {effectiveTeamRanking[2] && (
                        <div className="flex flex-col items-center w-28 sm:w-36 relative z-10 animate-in slide-in-from-bottom-2 duration-500 delay-200">
                          <div className="relative mb-3">
                            <AvatarInitials name={effectiveTeamRanking[2].nombre} isDarkMode={isDarkMode} />
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] border-2 shadow-sm bg-[#FF5A1F] text-white border-white">3</div>
                          </div>
                          <span className="font-bold text-slate-800 text-sm mb-3 truncate w-full text-center px-1">{effectiveTeamRanking[2].nombre}</span>
                          <div className="w-full rounded-t-2xl border-t-4 border-[#FF5A1F] border-x border-x-slate-100 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-2 h-24 bg-gradient-to-t from-orange-100/40 to-orange-50/20">
                            <span className="text-xl font-black text-[#FF5A1F] leading-none">{effectiveTeamRanking[2].contactadosMes}</span>
                            <span className="text-[9px] font-bold text-[#FF5A1F]/70 uppercase tracking-wider mt-1">{t('reports_prospected')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {stats.agentesStats.length > 3 && (
                      <div className="flex flex-col gap-3 px-4 pb-6 sm:px-6 sm:pb-8">
                        {stats.agentesStats.slice(3).map((agente, idx) => (
                          <div key={agente.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="font-black text-slate-400 w-6 text-center text-sm">{idx + 4}</span>
                              <AvatarInitials name={agente.nombre} isDarkMode={isDarkMode} />
                              <div>
                                <h4 className="font-bold text-slate-800 text-sm">{agente.nombre} {agente.isMe && <span className="text-xs text-emerald-500 ml-1 font-semibold">({t('reports_me')})</span>}</h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 sm:gap-10 text-right pr-2">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('reports_prospected_month')}</p>
                                <p className="font-black text-emerald-600 text-sm">{agente.contactadosMes} {t('reports_prospected')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
