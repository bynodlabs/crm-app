import { useMemo, useState } from 'react';
import { Plus, Search, User, Users, X } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import { RecordCard } from '../components/RecordCard';
import { SECTORES } from '../lib/constants';
import { getSectorByCode, getSectorLabel } from '../lib/sector-utils';
import { calcularPuntajeLead, getProbabilidadObj } from '../lib/lead-utils';
import { translateSector } from '../lib/i18n';
import { useSectors } from '../hooks/useSectors';

const DEFAULT_DASHBOARD_SECTOR_IDS = SECTORES.slice(0, -1).map((sector) => sector.id);
const DEFAULT_SECTOR_IDS = new Set(SECTORES.map((sector) => sector.id));
const DEFAULT_CUSTOM_SECTOR_COLOR = 'from-sky-400 to-indigo-500';

export function DashboardView({ records, allRecords = records, onSelectRecord, dashboardSectorFilter = 'ALL', setDashboardSectorFilter, setActiveTab, myAgents, t, currentUser, language = 'es', isDarkMode = false }) {
  const { sectors, activeSectors, createSector, deleteSector } = useSectors();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateSectorOpen, setIsCreateSectorOpen] = useState(false);
  const [customSectorTitle, setCustomSectorTitle] = useState('');
  const [customSectorEmoji, setCustomSectorEmoji] = useState('✨');
  const [sectorActionState, setSectorActionState] = useState({ status: 'idle', message: '' });
  const dashboardBaseRecords = allRecords;
  const globalTotalRecords = dashboardBaseRecords.length;

  const resolveSectorId = (sectorValue) => {
    const safeValue = String(sectorValue || '').trim();
    if (!safeValue) return 'UNKNOWN';

    const directMatch = getSectorByCode(sectors, safeValue);
    if (directMatch) return directMatch.id;

    const defaultMatch = SECTORES.find((sector) => sector.id === safeValue);
    if (defaultMatch) return defaultMatch.id;

    const normalizedValue = safeValue.toLowerCase();
    const namedMatch = sectors.find((sector) => {
      const normalizedId = sector.id.toLowerCase();
      const normalizedName = String(sector.nombre || '').trim().toLowerCase();
      const normalizedTranslated = translateSector(language, sector.id).toLowerCase();
      return normalizedValue === normalizedId || normalizedValue === normalizedName || normalizedValue === normalizedTranslated;
    });

    return namedMatch?.id || safeValue;
  };
  const sectorCounts = dashboardBaseRecords.reduce((acc, record) => {
    const sectorId = resolveSectorId(record.sector);
    acc[sectorId] = (acc[sectorId] || 0) + 1;
    return acc;
  }, {});

  const filteredRecords = records.filter((r) =>
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.numero && r.numero.includes(searchTerm))
  );

  const dashboardSectors = useMemo(() => {
    const activeById = new Map(activeSectors.map((sector) => [sector.id, sector]));
    const defaults = DEFAULT_DASHBOARD_SECTOR_IDS.map((sectorId) => activeById.get(sectorId)).filter(Boolean);
    const custom = activeSectors.find((sector) => !DEFAULT_SECTOR_IDS.has(sector.id));
    return { defaults, custom };
  }, [activeSectors]);

  const handleOpenCreateSector = () => {
    setCustomSectorTitle('');
    setCustomSectorEmoji('✨');
    setSectorActionState({ status: 'idle', message: '' });
    setIsCreateSectorOpen(true);
  };

  const handleCreateCustomSector = async () => {
    const safeTitle = String(customSectorTitle || '').trim();
    if (!safeTitle) {
      setSectorActionState({ status: 'error', message: 'El nombre del sector es obligatorio.' });
      return;
    }

    setSectorActionState({ status: 'saving', message: '' });

    try {
      const result = await createSector({
        name: safeTitle,
        icon: String(customSectorEmoji || '').trim() || '✨',
        color: DEFAULT_CUSTOM_SECTOR_COLOR,
      });
      setSectorActionState({
        status: 'success',
        message: result?.source === 'local' ? 'Sector creado localmente.' : 'Sector creado.',
      });
      setIsCreateSectorOpen(false);
      setDashboardSectorFilter?.('ALL');
    } catch (error) {
      setSectorActionState({ status: 'error', message: error?.message || 'No se pudo crear el sector.' });
    }
  };

  const handleDeleteCustomSector = async (event, sector) => {
    event.preventDefault();
    event.stopPropagation();
    if (!sector?.entityId) return;

    setSectorActionState({ status: 'deleting', message: '' });

    try {
      const result = await deleteSector(sector.entityId);
      if (dashboardSectorFilter === sector.id) {
        setDashboardSectorFilter?.('ALL');
      }
      setSectorActionState({
        status: 'success',
        message: result?.source === 'local' ? 'Sector eliminado localmente.' : 'Sector eliminado.',
      });
    } catch (error) {
      setSectorActionState({ status: 'error', message: error?.message || 'No se pudo eliminar el sector.' });
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 no-scrollbar">
        <header className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="flex gap-5 text-sm font-medium sm:gap-6">
            <span className="text-[#FF5A1F] font-bold relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-[#FF5A1F] after:rounded-full cursor-pointer">{t('dash_discover')}</span>
            <span onClick={() => setActiveTab('reports')} className="text-slate-400 hover:text-[#FF5A1F] cursor-pointer transition-colors">{t('dash_metrics')}</span>
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('dash_search_placeholder')}
                className="w-full pl-11 pr-4 py-2.5 bg-white rounded-full text-sm outline-none shadow-sm border border-transparent focus:ring-2 focus:ring-orange-100 focus:border-orange-200 transition-shadow"
              />
            </div>
          </div>
        </header>

        {searchTerm ? (
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-6">{t('dash_search_results')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                <RecordCard key={record.id} record={record} onClick={() => onSelectRecord(record)} isDarkMode={isDarkMode} t={t} language={language} />
              )) : <p className="text-slate-500">{t('dash_no_results')}</p>}
            </div>
          </section>
        ) : (
          <>
            <section className="mb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">{t('dash_top_sectors')}</h2>
                <div className="flex items-center gap-2">
                  {sectorActionState.message && (
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      sectorActionState.status === 'error'
                        ? 'bg-rose-50 text-rose-600'
                        : sectorActionState.status === 'success'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sectorActionState.status === 'saving' || sectorActionState.status === 'deleting' ? 'Guardando...' : sectorActionState.message}
                    </span>
                  )}
                  {dashboardSectorFilter !== 'ALL' && (
                    <button
                      onClick={() => setDashboardSectorFilter?.('ALL')}
                      className="text-xs font-bold text-slate-500 hover:text-[#FF5A1F] bg-slate-100 hover:bg-orange-50 px-3 py-1.5 rounded-full transition-all dark:bg-slate-800 dark:hover:bg-orange-900/30"
                    >
                      {t('dash_show_all')}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-0">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-6 xl:gap-y-1.5">
                  {dashboardSectors.defaults.map((sec) => {
                    const isSelected = dashboardSectorFilter === sec.id;
                    const isDimmed = dashboardSectorFilter !== 'ALL' && dashboardSectorFilter !== sec.id;
                    const sectorTotal = sectorCounts[sec.id] || 0;

                    return (
                      <div
                        key={sec.id}
                        onClick={() => setDashboardSectorFilter?.(isSelected ? 'ALL' : sec.id)}
                        className={`group relative flex min-h-[114px] min-w-0 cursor-pointer flex-col items-center justify-start px-2 py-0.5 text-center transition-all duration-200 ${
                          isDimmed ? 'opacity-45 saturate-50' : 'opacity-100'
                        }`}
                      >
                        <div className={`
                          relative mb-1.5 flex h-[4.3rem] w-[4.3rem] items-center justify-center rounded-full border text-3xl shadow-sm transition-all duration-200
                          ${isSelected
                            ? isDarkMode
                              ? 'border-white/45 bg-white/[0.09] shadow-[0_0_0_6px_rgba(255,255,255,0.04)]'
                              : 'border-slate-300 bg-slate-50 shadow-[0_0_0_6px_rgba(148,163,184,0.08)]'
                            : isDarkMode
                              ? 'border-white/18 bg-white/[0.04] group-hover:border-white/28'
                              : 'border-slate-200 bg-slate-50 group-hover:border-slate-300'}
                        `}>
                          <div className={`absolute inset-[6px] rounded-full bg-gradient-to-br ${sec.color} ${isSelected ? 'opacity-100 scale-100' : 'opacity-95 scale-[0.98]'} transition-transform duration-200`}></div>
                          <span className="relative z-10 drop-shadow-sm">{sec.icon}</span>
                        </div>
                        <span className={`w-full break-words px-1 text-center text-sm font-bold leading-tight transition-colors duration-200 sm:text-[15px] ${
                          isDarkMode
                            ? isSelected
                              ? 'text-white'
                              : 'text-slate-200 group-hover:text-white'
                            : isSelected
                              ? 'text-slate-900'
                              : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {getSectorLabel(language, sec.id, sectors)}
                        </span>
                        <span className={`mt-0 text-[11px] font-bold tracking-[0.11em] transition-colors duration-200 ${
                          isDarkMode
                            ? isSelected
                              ? 'text-slate-100'
                              : 'text-slate-300'
                            : isSelected
                              ? 'text-slate-700'
                              : 'text-slate-500'
                        }`}>
                          {sectorTotal} LEADS
                        </span>
                      </div>
                    );
                  })}

                  {dashboardSectors.custom ? (() => {
                    const sec = dashboardSectors.custom;
                    const isSelected = dashboardSectorFilter === sec.id;
                    const isDimmed = dashboardSectorFilter !== 'ALL' && dashboardSectorFilter !== sec.id;
                    const sectorTotal = sectorCounts[sec.id] || 0;

                    return (
                      <div
                        key={sec.id}
                        onClick={() => setDashboardSectorFilter?.(isSelected ? 'ALL' : sec.id)}
                        className={`group relative flex min-h-[114px] min-w-0 cursor-pointer flex-col items-center justify-start px-2 py-0.5 text-center transition-all duration-200 ${
                          isDimmed ? 'opacity-45 saturate-50' : 'opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(event) => handleDeleteCustomSector(event, sec)}
                          disabled={sectorActionState.status === 'deleting'}
                          className={`absolute right-6 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border bg-white text-slate-400 shadow-sm transition-all hover:border-rose-200 hover:text-rose-500 ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          aria-label={`Eliminar ${sec.nombre}`}
                        >
                          <X size={14} />
                        </button>
                        <div className={`
                          relative mb-1.5 flex h-[4.3rem] w-[4.3rem] items-center justify-center rounded-full border text-3xl shadow-sm transition-all duration-200
                          ${isSelected
                            ? isDarkMode
                              ? 'border-white/45 bg-white/[0.09] shadow-[0_0_0_6px_rgba(255,255,255,0.04)]'
                              : 'border-slate-300 bg-slate-50 shadow-[0_0_0_6px_rgba(148,163,184,0.08)]'
                            : isDarkMode
                              ? 'border-white/18 bg-white/[0.04] group-hover:border-white/28'
                              : 'border-slate-200 bg-slate-50 group-hover:border-slate-300'}
                        `}>
                          <div className={`absolute inset-[6px] rounded-full bg-gradient-to-br ${sec.color} ${isSelected ? 'opacity-100 scale-100' : 'opacity-95 scale-[0.98]'} transition-transform duration-200`}></div>
                          <span className="relative z-10 drop-shadow-sm">{sec.icon}</span>
                        </div>
                        <span className={`w-full break-words px-1 text-center text-sm font-bold leading-tight transition-colors duration-200 sm:text-[15px] ${
                          isDarkMode
                            ? isSelected
                              ? 'text-white'
                              : 'text-slate-200 group-hover:text-white'
                            : isSelected
                              ? 'text-slate-900'
                              : 'text-slate-700 group-hover:text-slate-900'
                        }`}>
                          {getSectorLabel(language, sec.id, sectors)}
                        </span>
                        <span className={`mt-0 text-[11px] font-bold tracking-[0.11em] transition-colors duration-200 ${
                          isDarkMode
                            ? isSelected
                              ? 'text-slate-100'
                              : 'text-slate-300'
                            : isSelected
                              ? 'text-slate-700'
                              : 'text-slate-500'
                        }`}>
                          {sectorTotal} LEADS
                        </span>
                      </div>
                    );
                  })() : (
                    <button
                      type="button"
                      onClick={handleOpenCreateSector}
                      className="group relative flex min-h-[114px] min-w-0 flex-col items-center justify-start px-2 py-0.5 text-center transition-all duration-200"
                    >
                      <div className={`relative mb-1.5 flex h-[4.3rem] w-[4.3rem] items-center justify-center rounded-full border text-3xl shadow-sm transition-all duration-200 ${
                        isDarkMode
                          ? 'border-dashed border-white/18 bg-white/[0.04] group-hover:border-white/30'
                          : 'border-dashed border-slate-200 bg-slate-50 group-hover:border-slate-300'
                      }`}>
                        <div className={`absolute inset-[6px] rounded-full ${isDarkMode ? 'bg-white/[0.03]' : 'bg-white'} transition-transform duration-200`}></div>
                        <span className="relative z-10 text-slate-400 group-hover:text-[#FF5A1F]"><Plus size={28} /></span>
                      </div>
                      <span className={`w-full break-words px-1 text-center text-sm font-bold leading-tight transition-colors duration-200 sm:text-[15px] ${
                        isDarkMode ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                        Agregar sector
                      </span>
                      <span className={`mt-0 text-[11px] font-bold tracking-[0.11em] transition-colors duration-200 ${
                        isDarkMode ? 'text-slate-300' : 'text-slate-500'
                      }`}>
                        PERSONALIZADO
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-10">
              <div className="grid grid-cols-3 gap-3 md:grid-cols-3 md:gap-6">
                <div className="group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-neutral-800 bg-gradient-to-br from-neutral-900 to-black p-3 text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] sm:min-h-[190px] sm:rounded-[2rem] sm:p-5 md:h-64 md:p-6">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                  <h3 className="mb-1 text-2xl font-black leading-none sm:text-3xl md:text-5xl">{globalTotalRecords}</h3>
                  <p className="text-[11px] font-medium leading-tight text-neutral-400 sm:text-xs md:text-base">{t('dash_total_records')}</p>
                </div>

                <div className="group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#FF3C00] to-[#FF7A00] p-3 text-white shadow-[0_20px_40px_-15px_rgba(255,90,31,0.4)] sm:min-h-[190px] sm:rounded-[2rem] sm:p-5 md:h-64 md:p-6">
                  <div className="absolute -left-10 top-20 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                  <h3 className="mb-1 text-2xl font-black leading-none sm:text-3xl md:text-5xl">{dashboardBaseRecords.filter((r) => r.responsable === currentUser?.nombre && r.inProspecting && !r.isArchived).length}</h3>
                  <p className="text-[11px] font-medium leading-tight text-orange-100 sm:text-xs md:text-base">{t('dash_extracted_leads')}</p>
                </div>

                <div className="group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-stone-700 bg-gradient-to-br from-stone-900 to-stone-800 p-3 text-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] sm:min-h-[190px] sm:rounded-[2rem] sm:p-5 md:h-64 md:p-6">
                  <div className="absolute right-10 bottom-20 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                  <h3 className="mb-1 text-2xl font-black leading-none text-[#FFB36B] sm:text-3xl md:text-5xl">{dashboardBaseRecords.filter((r) => calcularPuntajeLead(r) >= 70).length}</h3>
                  <p className="flex items-center gap-1 text-[11px] font-medium leading-tight text-stone-300 sm:text-xs md:text-base">{t('dash_high_prob_leads')} <span className="text-xs sm:text-sm">🔥</span></p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-bold text-slate-800">{t('dash_recent_records')}</h2>
              </div>
              <div className="space-y-3 sm:space-y-4">
                {records.slice(-3).reverse().map((record) => (
                  <RecordCard key={record.id} record={record} onClick={() => onSelectRecord(record)} isDarkMode={isDarkMode} t={t} language={language} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {isCreateSectorOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setIsCreateSectorOpen(false)}></div>
          <div className="relative w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Nuevo sector</h3>
                <p className="mt-1 text-sm text-slate-500">Agrega un sector personalizado para usarlo en toda la app.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSectorOpen(false)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={customSectorTitle}
                onChange={(event) => setCustomSectorTitle(event.target.value)}
                placeholder="Titulo del sector"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
              />
              <input
                type="text"
                value={customSectorEmoji}
                onChange={(event) => setCustomSectorEmoji(event.target.value)}
                placeholder="Emoji"
                maxLength={4}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100"
              />
              {sectorActionState.status === 'error' && sectorActionState.message ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">{sectorActionState.message}</p>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateSectorOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100"
              >
                {t('common_cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateCustomSector}
                disabled={sectorActionState.status === 'saving'}
                className="rounded-xl bg-[#FF5A1F] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,90,31,0.28)] transition-colors hover:bg-[#e6501a]"
              >
                {sectorActionState.status === 'saving' ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:flex flex-col w-[320px] bg-white border-l border-slate-200 p-6 h-full shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.05)] z-10 relative">
        <div className="flex-1 overflow-y-auto no-scrollbar mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">{t('dash_team_activity')}</h3>
            <Users size={16} className="text-slate-400" />
          </div>
          <div className="space-y-6">
            {filteredRecords.slice(0, 10).map((record, i) => {
              const prob = getProbabilidadObj(record);
              const ownerData = myAgents.find((a) => a.nombre === record.responsable) || myAgents[0];

              return (
                <div
                  key={i}
                  onClick={() => onSelectRecord(record)}
                  className={`flex items-start gap-3 cursor-pointer group p-2 rounded-xl transition-all -mx-2 ${
                    isDarkMode
                      ? 'hover:bg-[linear-gradient(135deg,rgba(255,90,31,0.18),rgba(255,179,107,0.06))] hover:shadow-[0_12px_30px_-18px_rgba(255,90,31,0.45)]'
                      : 'hover:bg-orange-50/50'
                  }`}
                >
                  <AvatarInitials name={record.nombre} isDarkMode={isDarkMode} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#FF5A1F] transition-colors">{record.nombre || 'Sin nombre'}</h4>
                      <span className="text-xs" title={`Probabilidad ${prob.nivel}`}>{prob.icon}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        Cat. {record.categoria} • {record.estadoProspeccion}
                      </p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${ownerData.color} flex items-center gap-1 ml-1 truncate max-w-[80px]`}>
                        <User size={8} /> {ownerData.nombre.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
