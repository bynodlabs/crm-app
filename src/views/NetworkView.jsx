import React, { useMemo, useState } from 'react';
import { Activity, Check, CheckCircle, Copy, Mail, PlusCircle, Share2, Target, User, UserPlus, Users, X } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import { PAISES } from '../lib/constants';
import { getRecordCountryCode } from '../lib/country';
import { getLocalISOTime } from '../lib/date';
import { useSectors } from '../hooks/useSectors';

function ShareLeadsModal({ onClose, records, teamMembers, onGenerated, t }) {
  const { activeSectors } = useSectors();
  const [filterPais, setFilterPais] = useState('ALL');
  const [filterSector, setFilterSector] = useState('ALL');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState(teamMembers[0]?.id || '');
  const [exactCount, setExactCount] = useState('');
  const [generatedLink, setGeneratedLink] = useState(null);
  const [shareSummary, setShareSummary] = useState(null);
  const [shareError, setShareError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasTeamMembers = teamMembers.length > 0;
  const selectedTeamMember = teamMembers.find((member) => member.id === selectedTeamMemberId) || null;

  React.useEffect(() => {
    if (!hasTeamMembers) {
      setSelectedTeamMemberId('');
      return;
    }

    if (!teamMembers.some((member) => member.id === selectedTeamMemberId)) {
      setSelectedTeamMemberId(teamMembers[0]?.id || '');
    }
  }, [hasTeamMembers, selectedTeamMemberId, teamMembers]);

  const availablePool = useMemo(() => {
    return records.filter(r =>
      r.estadoProspeccion === 'Nuevo' &&
      (!r.responsable || r.responsable === 'Sin Asignar' || r.responsable.trim() === '') &&
      (filterPais === 'ALL' || getRecordCountryCode(r) === filterPais) &&
      (filterSector === 'ALL' || r.sector === filterSector)
    );
  }, [records, filterPais, filterSector]);

  const totalAvailable = availablePool.length;
  const requestedCount = Number.parseInt(exactCount, 10);
  const shareCount = (() => {
    if (!Number.isNaN(requestedCount)) {
      return Math.max(0, Math.min(requestedCount, totalAvailable));
    }
    return Math.min(10, totalAvailable);
  })();

  const handleExactCountChange = (e) => {
    const nextValue = e.target.value;
    const parsed = Number.parseInt(nextValue, 10);

    if (Number.isNaN(parsed)) {
      setShareError('');
      setExactCount(nextValue);
      return;
    }

    setShareError('');
    setExactCount(Math.max(0, parsed).toString());
  };

  const handleGenerate = async () => {
    const desiredCount = Number.isNaN(requestedCount) ? Math.min(10, totalAvailable) : Math.max(0, requestedCount);

    if (!selectedTeamMember || desiredCount <= 0) {
      return;
    }

    if (desiredCount > totalAvailable) {
      setShareError(`Solo hay ${totalAvailable} leads disponibles para compartir ahora.`);
      return;
    }

    setShareError('');
    setIsSubmitting(true);
    const idsToShare = availablePool.slice(0, desiredCount).map((r) => r.id);
    const newLink = {
      id: `link-${Date.now()}`,
      hash: Math.random().toString(36).substring(2, 10),
      date: getLocalISOTime(),
      count: desiredCount,
      teamMemberId: selectedTeamMember.id,
      teamMemberName: selectedTeamMember.nombre,
      teamMemberCode: selectedTeamMember.codigoPropio || null,
      metrics: { viewed: 0, worked: 0, contacted: 0 }
    };

    try {
      const result = onGenerated
        ? await onGenerated(newLink, idsToShare, selectedTeamMember)
        : { sharedCount: idsToShare.length };

      const deliveredCount = Number(result?.sharedCount || 0);
      if (deliveredCount <= 0) {
        setShareError('No se pudieron asignar leads nuevos a este usuario. Revisa si ya los recibió o si no hay disponibles.');
        return;
      }

      setShareSummary({
        deliveredCount,
        targetName: selectedTeamMember.nombre,
      });
      setGeneratedLink(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        <div className="bg-slate-50 p-6 flex items-start justify-between border-b border-slate-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>
          <div className="relative z-10">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Share2 className="text-emerald-500" /> {t('team_modal_title')}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{t('team_modal_subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="relative z-10 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          {!generatedLink ? (
            <>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('team_modal_filters')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <select value={filterPais} onChange={(e) => setFilterPais(e.target.value)} className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none">
                    <option value="ALL">{t('team_modal_country_all')}</option>
                    {PAISES.map(p => <option key={p.code} value={p.code}>{p.nombre}</option>)}
                  </select>
                  <select value={filterSector} onChange={(e) => setFilterSector(e.target.value)} className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none">
                    <option value="ALL">{t('team_modal_sector_all')}</option>
                    {activeSectors.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-3 text-right">
                  {t('team_modal_available')} <span className="text-[#FF5A1F]">{totalAvailable}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('team_modal_who')}</label>
                {hasTeamMembers ? (
                  <select value={selectedTeamMemberId} onChange={(e) => setSelectedTeamMemberId(e.target.value)} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all font-medium text-slate-700">
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-bold">{t('team_no_partners_title')}</p>
                    <p className="mt-1 text-xs text-amber-700/90">{t('team_modal_no_team')}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t('team_modal_how_many')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {[10, 20, 40].map(num => (
                    <button type="button" key={num} onClick={() => setExactCount(num.toString())} disabled={totalAvailable < num} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${shareCount === num && requestedCount === num ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                      {num}
                    </button>
                  ))}
                  <button type="button" onClick={() => setExactCount(totalAvailable.toString())} disabled={totalAvailable === 0} className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${shareCount === totalAvailable && totalAvailable > 0 && requestedCount === totalAvailable ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                    {t('team_modal_all')}
                  </button>
                </div>
                <input type="number" min="0" max={totalAvailable} value={exactCount} onChange={handleExactCountChange} placeholder="Cantidad exacta" className="w-full text-sm bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all" />
                {shareError ? (
                  <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {shareError}
                  </p>
                ) : null}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button type="button" onClick={handleGenerate} disabled={isSubmitting || shareCount <= 0 || !hasTeamMembers} className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold shadow-[0_4px_14px_rgba(16,185,129,0.3)] hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50">
                  <Check size={16} /> {t('team_modal_confirm')}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 mb-1">{t('team_modal_success_title')}</h4>
              <p className="text-sm text-slate-500 text-center mb-6">
                {t('team_modal_success_desc_1')}<strong>{shareSummary?.deliveredCount || 0}{t('team_modal_success_desc_2')}</strong>{t('team_modal_success_desc_3')}{shareSummary?.targetName || selectedTeamMember?.nombre || ''}.
              </p>
              <button type="button" onClick={onClose} className="px-6 py-2 rounded-full border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors">
                {t('team_modal_close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NetworkView({ currentUser, usersDb, sharedLinks, records, onLinkCreated, t, isDarkMode = false }) {
  const miembrosEquipo = usersDb.filter(u => u.referidoPor === currentUser.codigoPropio);
  const [isCopied, setIsCopied] = useState(false);
  const [showShareLeadsModal, setShowShareLeadsModal] = useState(false);
  const [teamPage, setTeamPage] = useState(1);
  const [sharedLinksPage, setSharedLinksPage] = useState(1);
  const [receivedLeadsPage, setReceivedLeadsPage] = useState(1);
  const TEAM_PAGE_SIZE = 3;
  const SHARED_LINKS_PAGE_SIZE = 4;
  const RECEIVED_LEADS_PAGE_SIZE = 4;
  const availableNewLeads = useMemo(
    () =>
      records.filter((record) =>
        record.estadoProspeccion === 'Nuevo' &&
        (!record.responsable || record.responsable === 'Sin Asignar' || record.responsable.trim() === ''),
      ).length,
    [records],
  );
  const deliveredLeadsCount = useMemo(
    () => (sharedLinks || []).reduce((total, link) => total + Number(link?.count || 0), 0),
    [sharedLinks],
  );
  const recentSharedLinks = useMemo(
    () =>
      [...(sharedLinks || [])]
        .sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
        .slice((sharedLinksPage - 1) * SHARED_LINKS_PAGE_SIZE, sharedLinksPage * SHARED_LINKS_PAGE_SIZE),
    [sharedLinks, sharedLinksPage],
  );
  const totalSharedLinkPages = Math.max(1, Math.ceil((sharedLinks || []).length / SHARED_LINKS_PAGE_SIZE));
  const safeSharedLinksPage = Math.min(sharedLinksPage, totalSharedLinkPages);
  const totalSharedLinks = (sharedLinks || []).length;
  const receivedLeadBatches = useMemo(() => {
    const grouped = new Map();

    [...records]
      .filter((record) => Boolean(record.sourceRecordId))
      .forEach((record) => {
        const fallbackAction = (record.historial || []).find((entry) =>
          String(entry?.accion || '').toLowerCase().includes('lead recibido desde equipo por'),
        );
        const senderName =
          record.sharedFromUserName ||
          fallbackAction?.accion?.replace('Lead recibido desde equipo por ', '') ||
          'Equipo';
        const batchKey =
          record.receivedBatchId ||
          `${senderName}-${String(record.receivedAt || fallbackAction?.fecha || record.fechaIngreso || '').slice(0, 16)}`;

        if (!grouped.has(batchKey)) {
          grouped.set(batchKey, {
            id: batchKey,
            senderName,
            receivedAt: record.receivedAt || fallbackAction?.fecha || record.fechaIngreso || '',
            count: 0,
          });
        }

        grouped.get(batchKey).count += 1;
      });

    return [...grouped.values()].sort(
      (a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime(),
    );
  }, [records]);
  const totalReceivedLeadPages = Math.max(1, Math.ceil(receivedLeadBatches.length / RECEIVED_LEADS_PAGE_SIZE));
  const safeReceivedLeadsPage = Math.min(receivedLeadsPage, totalReceivedLeadPages);
  const paginatedReceivedLeadBatches = useMemo(
    () =>
      receivedLeadBatches.slice(
        (safeReceivedLeadsPage - 1) * RECEIVED_LEADS_PAGE_SIZE,
        safeReceivedLeadsPage * RECEIVED_LEADS_PAGE_SIZE,
      ),
    [receivedLeadBatches, safeReceivedLeadsPage],
  );
  const totalTeamPages = Math.max(1, Math.ceil(miembrosEquipo.length / TEAM_PAGE_SIZE));
  const safeTeamPage = Math.min(teamPage, totalTeamPages);
  const paginatedTeamMembers = useMemo(
    () => miembrosEquipo.slice((safeTeamPage - 1) * TEAM_PAGE_SIZE, safeTeamPage * TEAM_PAGE_SIZE),
    [miembrosEquipo, safeTeamPage],
  );

  const handleCopyCode = () => {
    const markCopied = () => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(currentUser.codigoPropio).then(markCopied).catch(() => {
        const tempInput = document.createElement('input');
        tempInput.value = currentUser.codigoPropio;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        markCopied();
      });
      return;
    }

    const tempInput = document.createElement('input');
    tempInput.value = currentUser.codigoPropio;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    markCopied();
  };

  React.useEffect(() => {
    setTeamPage((prev) => Math.min(prev, Math.max(1, Math.ceil(miembrosEquipo.length / TEAM_PAGE_SIZE))));
  }, [miembrosEquipo.length]);

  React.useEffect(() => {
    setSharedLinksPage((prev) => Math.min(prev, Math.max(1, Math.ceil((sharedLinks || []).length / SHARED_LINKS_PAGE_SIZE))));
  }, [sharedLinks]);

  React.useEffect(() => {
    setReceivedLeadsPage((prev) => Math.min(prev, Math.max(1, Math.ceil(receivedLeadBatches.length / RECEIVED_LEADS_PAGE_SIZE))));
  }, [receivedLeadBatches.length]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50/30 p-4 sm:p-6 lg:p-10 no-scrollbar">
      {showShareLeadsModal && (
        <ShareLeadsModal
          onClose={() => setShowShareLeadsModal(false)}
          records={records}
          teamMembers={miembrosEquipo}
          onGenerated={onLinkCreated}
          t={t}
        />
      )}

      <header className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-black text-slate-800 sm:text-3xl">
          <Users className="text-purple-600" /> {t('team_title')}
        </h2>
        <p className="text-slate-500 mt-1">{t('team_subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-purple-600 to-indigo-600 p-5 text-white shadow-md sm:p-8">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <h3 className="text-sm font-bold text-purple-200 uppercase tracking-wider mb-2">{t('team_code_title')}</h3>
            <div className="text-4xl font-black font-mono tracking-widest mb-6 relative z-10">{currentUser.codigoPropio}</div>
            <p className="text-sm text-purple-100 mb-6 relative z-10">{t('team_code_desc')}</p>
            <button type="button" onClick={handleCopyCode} className={`relative z-10 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition-all ${isCopied ? 'bg-emerald-500 text-white' : 'bg-white text-purple-600 hover:bg-purple-50 shadow-lg'}`}>
              {isCopied ? <Check size={18} /> : <Copy size={18} />} {isCopied ? t('team_code_copied') : t('team_code_copy')}
            </button>
          </div>

          <div className="flex items-start gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <Activity size={20} />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-bold text-slate-800">{t('team_growth_title')}</h4>
              <p className="text-xs leading-relaxed text-slate-500">{t('team_growth_desc_1')}<strong>{miembrosEquipo.length}{t('team_growth_desc_2')}</strong>{t('team_growth_desc_3')}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 relative space-y-6">
          <div className="absolute top-10 right-10 w-72 h-72 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-purple-500 rounded-full blur-[100px] opacity-15 pointer-events-none"></div>

          <div className={`relative z-10 overflow-hidden rounded-[2rem] border p-5 shadow-[0_22px_50px_-26px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-6 ${
            isDarkMode
              ? 'border-white/10 bg-[linear-gradient(135deg,rgba(18,18,20,0.92),rgba(28,28,32,0.82))]'
              : 'border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))]'
          }`}>
            <div className={`absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-500/12' : 'bg-emerald-200/35'}`}></div>
            <div className={`absolute bottom-0 left-0 h-32 w-32 rounded-full blur-3xl ${isDarkMode ? 'bg-purple-500/10' : 'bg-purple-200/20'}`}></div>
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${isDarkMode ? 'via-white/15' : 'via-emerald-200/70'} to-transparent`}></div>

            <div className="relative z-10 space-y-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold shadow-sm ${
                      isDarkMode ? 'border-emerald-400/25 bg-white/[0.04] text-emerald-300' : 'border-emerald-100 bg-white/90 text-emerald-700'
                    }`}>
                      {availableNewLeads} disponibles
                    </span>
                    <span className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold shadow-sm ${
                      isDarkMode ? 'border-orange-400/25 bg-white/[0.04] text-orange-300' : 'border-orange-100 bg-white/90 text-[#FF5A1F]'
                    }`}>
                      {deliveredLeadsCount} entregados
                    </span>
                  </div>
                </div>

                <div className="xl:ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowShareLeadsModal(true)}
                    className={`group relative z-10 flex w-full items-center justify-center gap-3 rounded-[1.6rem] border px-5 py-5 text-[1.05rem] font-black shadow-[0_14px_28px_-18px_rgba(15,23,42,0.32)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-18px_rgba(16,185,129,0.28)] ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.06] text-white hover:border-emerald-400/40'
                        : 'border-slate-200/80 bg-white/95 text-slate-800 hover:border-emerald-200'
                    }`}
                  >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full text-emerald-600 transition-colors ${
                      isDarkMode ? 'bg-emerald-500/12 group-hover:bg-emerald-500/18' : 'bg-emerald-50 group-hover:bg-emerald-100'
                    }`}>
                      <Share2 size={20} />
                    </span>
                    <span>Compartir Leads</span>
                  </button>
                </div>
              </div>

              <div className={`h-px w-full ${isDarkMode ? 'bg-white/8' : 'bg-slate-200/80'}`}></div>

              <div className="grid gap-4 xl:grid-cols-[auto_1fr] xl:items-start">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-400' : 'border-slate-200 bg-white/80 text-slate-500'
                  }`}>
                    Enviados
                  </span>
                  {totalSharedLinks > SHARED_LINKS_PAGE_SIZE && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-400' : 'border-slate-200 bg-white/80 text-slate-500'
                    }`}>
                      {safeSharedLinksPage}/{totalSharedLinkPages}
                    </span>
                  )}
                </div>

                {recentSharedLinks.length === 0 ? (
                  <div className={`rounded-[1.5rem] border border-dashed px-4 py-4 text-sm ${isDarkMode ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
                    Aún no has compartido leads con tu equipo.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {recentSharedLinks.map((link) => {
                        const targetLabel = link.teamMemberName && link.teamMemberName !== 'ALL'
                          ? link.teamMemberName
                          : t('team_general_pool');
                        const sharedDate = link.date
                          ? new Date(link.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                          : '--/--';

                        return (
                          <div key={link.id} className={`rounded-[1.35rem] border px-4 py-4 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-100 bg-white/80'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-[1rem] font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  {targetLabel}
                                </p>
                                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{link.count || 0} leads</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDarkMode ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                                {sharedDate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {totalSharedLinks > SHARED_LINKS_PAGE_SIZE && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSharedLinksPage((prev) => Math.max(1, prev - 1))}
                          disabled={safeSharedLinksPage === 1}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                            isDarkMode
                              ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          Anterior
                        </button>
                        <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                          isDarkMode ? 'bg-white/[0.08] text-white' : 'bg-slate-900 text-white'
                        }`}>
                          {safeSharedLinksPage}/{totalSharedLinkPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSharedLinksPage((prev) => Math.min(totalSharedLinkPages, prev + 1))}
                          disabled={safeSharedLinksPage === totalSharedLinkPages}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                            isDarkMode
                              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={`h-px w-full ${isDarkMode ? 'bg-white/8' : 'bg-slate-200/80'}`}></div>

              <div className="grid gap-4 xl:grid-cols-[auto_1fr] xl:items-start">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                    isDarkMode ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  }`}>
                    Recibidos
                  </span>
                  {receivedLeadBatches.length > RECEIVED_LEADS_PAGE_SIZE && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-400' : 'border-slate-200 bg-white/80 text-slate-500'
                    }`}>
                      {safeReceivedLeadsPage}/{totalReceivedLeadPages}
                    </span>
                  )}
                </div>

                {paginatedReceivedLeadBatches.length === 0 ? (
                  <div className={`rounded-[1.5rem] border border-dashed px-4 py-4 text-sm ${isDarkMode ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-white/60 text-slate-500'}`}>
                    Aún no has recibido leads compartidos.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {paginatedReceivedLeadBatches.map((batch) => {
                        const receivedDate = batch.receivedAt
                          ? new Date(batch.receivedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                          : '--/--';
                        return (
                          <div key={`received-${batch.id}`} className={`rounded-[1.35rem] border px-4 py-4 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] ${isDarkMode ? 'border-white/10 bg-black/10' : 'border-slate-100 bg-white/80'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-[1rem] font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  {batch.senderName}
                                </p>
                                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {batch.count} leads recibidos
                                </p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDarkMode ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                                {receivedDate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {receivedLeadBatches.length > RECEIVED_LEADS_PAGE_SIZE && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReceivedLeadsPage((prev) => Math.max(1, prev - 1))}
                          disabled={safeReceivedLeadsPage === 1}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                            isDarkMode
                              ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          Anterior
                        </button>
                        <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                          isDarkMode ? 'bg-white/[0.08] text-white' : 'bg-slate-900 text-white'
                        }`}>
                          {safeReceivedLeadsPage}/{totalReceivedLeadPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setReceivedLeadsPage((prev) => Math.min(totalReceivedLeadPages, prev + 1))}
                          disabled={safeReceivedLeadsPage === totalReceivedLeadPages}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
                            isDarkMode
                              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col overflow-hidden rounded-[2rem] shadow-sm glass-panel">
            <div className="header-socios flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 bg-white/50 p-4 sm:p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-slate-400" /> {t('team_direct_partners')}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-slate-100/50 text-slate-600 text-xs font-bold rounded-full border border-slate-200/50">
                  {miembrosEquipo.length} {t('team_partners_count')}
                </span>
                {miembrosEquipo.length > TEAM_PAGE_SIZE && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTeamPage((prev) => Math.max(1, prev - 1))}
                      disabled={safeTeamPage === 1}
                      className="rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-bold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black text-white">
                      {safeTeamPage}/{totalTeamPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTeamPage((prev) => Math.min(totalTeamPages, prev + 1))}
                      disabled={safeTeamPage === totalTeamPages}
                      className="rounded-full border border-orange-200/70 bg-orange-50/80 px-3 py-1 text-[11px] font-bold text-[#FF5A1F] transition-all hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-2 flex-1 bg-transparent">
              {miembrosEquipo.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center min-h-[220px]">
                  <UserPlus size={40} className="text-slate-300 mb-3 opacity-60" />
                  <h4 className="text-base font-bold text-slate-700 mb-1">{t('team_no_partners_title')}</h4>
                  <p className="text-xs text-slate-500 max-w-sm">{t('team_no_partners_desc')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {paginatedTeamMembers.map((miembro) => (
                    <div key={miembro.id} className="flex flex-col gap-3 rounded-2xl border border-transparent p-4 transition-colors hover:border-slate-100 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <AvatarInitials name={miembro.nombre} isDarkMode={isDarkMode} />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{miembro.nombre}</h4>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail size={12} /> {miembro.email}
                          </p>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t('team_entry_date')}</p>
                        <p className="text-sm font-medium text-slate-700">
                          {(() => {
                            const parts = (miembro.fechaRegistro || '').split('T')[0].split('-');
                            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                            return new Date(miembro.fechaRegistro).toLocaleDateString('es-ES');
                          })()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
