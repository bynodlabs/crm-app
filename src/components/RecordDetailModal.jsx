import { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Save, User, X } from 'lucide-react';
import { detectCountryCodeFromPhone, getCountryMetaForRecord } from '../lib/country';
import { getLocalISOTime } from '../lib/date';
import { getPipelineStageMeta, getPipelineStageOptions, normalizeLeadStage } from '../lib/lead-pipeline';
import { GENERAL_SECTOR_ID, getSectorLabel, normalizeSectorCode } from '../lib/sector-utils';
import { LANG_LOCALES } from '../lib/i18n';
import { useSectors } from '../hooks/useSectors';

const countsAsProspecting = (status) => status !== 'Nuevo' && status !== 'Descartado' && status !== 'Liquidado';
const isArchivedStatus = (status) => status === 'Archivado';

export function RecordDetailModal({ record, onClose, onUpdate, myAgents, t, language = 'es' }) {
  const { sectors, activeSectors } = useSectors({ records: record ? [record] : [] });
  const [draft, setDraft] = useState(record);
  const locale = LANG_LOCALES[language] || LANG_LOCALES.en;

  useEffect(() => {
    setDraft(record);
  }, [record?.id]);

  const paisData = useMemo(
    () => getCountryMetaForRecord(draft),
    [draft],
  );
  const pipelineOptions = useMemo(() => getPipelineStageOptions(), []);
  const activeStage = useMemo(() => getPipelineStageMeta(draft?.stage, draft), [draft]);
  const normalizedDraftSector = useMemo(() => normalizeSectorCode(draft?.sector), [draft?.sector]);

  if (!record || !draft) return null;

  const handleSave = () => {
    const nextRecord = {
      ...record,
      ...draft,
      sector: normalizeSectorCode(draft?.sector),
    };

    if ((draft.estadoProspeccion || 'Nuevo') !== (record.estadoProspeccion || 'Nuevo')) {
      nextRecord.inProspecting = countsAsProspecting(draft.estadoProspeccion);
      nextRecord.isArchived = isArchivedStatus(draft.estadoProspeccion);
      nextRecord.historial = [
        { fecha: getLocalISOTime(), accion: `Estado global actualizado a: ${draft.estadoProspeccion}` },
        ...(draft.historial || record.historial || []),
      ];
    }

    if (normalizeLeadStage(draft.stage, draft) !== normalizeLeadStage(record.stage, record)) {
      nextRecord.stage = normalizeLeadStage(draft.stage, draft);
      nextRecord.historial = [
        { fecha: getLocalISOTime(), accion: `Pipeline actualizado a: ${getPipelineStageMeta(draft.stage, draft).label}` },
        ...(nextRecord.historial || draft.historial || record.historial || []),
      ];
    }

    onUpdate(nextRecord);
    onClose();
  };

  const handlePhoneChange = (value) => {
    const nextPhone = value.replace(/[^\d+\s-()]/g, '');
    setDraft((prev) => ({
      ...prev,
      numero: nextPhone,
      pais: detectCountryCodeFromPhone(nextPhone, prev?.pais || 'OT'),
    }));
  };

  const handleStageChange = (nextStage) => {
    const normalizedStage = normalizeLeadStage(nextStage, draft);
    const currentStage = normalizeLeadStage(record.stage, record);

    if (normalizedStage === currentStage) {
      setDraft((prev) => ({
        ...prev,
        stage: normalizedStage,
      }));
      return;
    }

    const stageLabel = getPipelineStageMeta(normalizedStage, { ...record, ...draft, stage: normalizedStage }).label;
    const nextHistory = [
      { fecha: getLocalISOTime(), accion: `Pipeline actualizado a: ${stageLabel}` },
      ...(draft.historial || record.historial || []),
    ];

    setDraft((prev) => ({
      ...prev,
      stage: normalizedStage,
      historial: nextHistory,
    }));

    onUpdate({
      ...record,
      stage: normalizedStage,
      historial: nextHistory,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative flex max-h-[100svh] w-full flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h3 className="text-xl font-black text-slate-800">{t('detail_lead_title')}</h3>
            <p className="text-xs text-slate-500 mt-1">{record.id}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-4 no-scrollbar sm:p-6 lg:grid-cols-[1.3fr_0.9fr] lg:gap-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('common_name')}</span>
                <input
                  value={draft.nombre || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, nombre: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('common_email')}</span>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={draft.correo || draft.email || ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, correo: e.target.value, email: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('common_phone')}</span>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={draft.numero || ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('detail_responsible')}</span>
                  <select
                    value={draft.responsable || t('common_unassigned')}
                    onChange={(e) => setDraft((prev) => ({ ...prev, responsable: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
                >
                  {myAgents.map((agent) => (
                    <option key={agent.id} value={agent.nombre}>
                      {agent.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('common_notes')}</span>
              <textarea
                value={draft.nota || draft.notes || ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, nota: e.target.value, notes: e.target.value }))}
                rows={6}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 resize-none"
              />
            </label>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <h4 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Pipeline</h4>
              <div className="flex flex-wrap gap-2">
                {pipelineOptions.map((stage) => {
                  const isActive = activeStage.id === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleStageChange(stage.id)}
                      className={`rounded-full border px-3 py-2 text-xs font-bold transition-all ${
                        isActive
                          ? 'border-[#FF5A1F] bg-orange-50 text-[#FF5A1F] shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200 hover:text-[#FF5A1F]'
                      }`}
                    >
                      {stage.icon} {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common_summary')}</h4>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{t('common_country')}</span>
                  <span className="font-bold text-slate-800 flex items-center gap-2">{paisData.flag} {paisData.nombre}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">Calidad</span>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black ${
                    draft.categoria === 'A'
                      ? 'bg-emerald-100 text-emerald-600'
                      : draft.categoria === 'B'
                        ? 'bg-orange-100 text-[#FF5A1F]'
                        : draft.categoria === 'C'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-slate-100 text-slate-500'
                  }`}>
                    {draft.categoria || '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{t('common_sector')}</span>
                  <select
                    value={normalizedDraftSector}
                    onChange={(e) => setDraft((prev) => ({ ...prev, sector: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 sm:min-w-[170px] sm:w-auto"
                  >
                    <option value={GENERAL_SECTOR_ID}>
                      {getSectorLabel(language, GENERAL_SECTOR_ID, sectors)}
                    </option>
                    {activeSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {getSectorLabel(language, sector.id, sectors)}
                      </option>
                    ))}
                    {!activeSectors.some((sector) => sector.id === normalizedDraftSector) && normalizedDraftSector !== GENERAL_SECTOR_ID ? (
                      <option value={normalizedDraftSector}>
                        {getSectorLabel(language, normalizedDraftSector, sectors)}
                      </option>
                    ) : null}
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">{t('common_history')}</h4>
              <div className="space-y-3 max-h-[280px] overflow-y-auto no-scrollbar">
                {(draft.historial || []).length > 0 ? (
                  draft.historial.map((entry, index) => (
                    <div key={`${entry.fecha}-${index}`} className="border-l-2 border-orange-200 pl-3">
                      <p className="text-xs font-bold text-slate-700">{entry.accion}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{new Date(entry.fecha).toLocaleString(locale)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">{t('detail_no_history')}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100">
            {t('common_cancel')}
          </button>
          <button type="button" onClick={handleSave} className="flex items-center justify-center gap-2 rounded-xl bg-[#FF5A1F] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,90,31,0.28)] transition-colors hover:bg-[#e6501a]">
            <Save size={16} /> {t('common_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
