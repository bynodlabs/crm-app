import React, { useDeferredValue, useMemo, useState } from 'react';
import { Check, ChevronRight, Filter, Grid, Layers, Search, Sliders, Trash2, User, X } from 'lucide-react';
import { AvatarInitials } from '../components/AvatarInitials';
import { ESTADOS_PROSPECCION, ORIGENES, PAISES, SECTORES } from '../lib/constants';
import { getCountryMetaForRecord } from '../lib/country';
import { getProbabilidadObj } from '../lib/lead-utils';

const DIRECTORY_PAGE_SIZE = 100;
const isLiquidatedLead = (record) => record.estadoProspeccion === 'Liquidado';
const isDiscardedLead = (record) => record.estadoProspeccion === 'Descartado';
const isArchivedLead = (record) => (record.estadoProspeccion === 'Archivado' || record.isArchived) && !isDiscardedLead(record) && !isLiquidatedLead(record);
const countsAsProspecting = (record) => record.estadoProspeccion !== 'Nuevo' && !isDiscardedLead(record) && !isLiquidatedLead(record);

export function DataTableView({ records, onSelectRecord, searchTerm, setSearchTerm, onChangeStatus, onBulkChangeStatus, myAgents, duplicateRecords, onCleanDuplicates, onDeleteDuplicates, onRestoreDuplicates, sharedLinks = [], t, globalSectorFilter = 'ALL', setGlobalSectorFilter, isDarkMode = false }) {
  const [showFilters, setShowFilters] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState([]);
  const [confirmDuplicateAction, setConfirmDuplicateAction] = useState(null);
  const [confirmDirectoryAction, setConfirmDirectoryAction] = useState(null);
  const [directoryTab, setDirectoryTab] = useState('nuevos');
  const [filters, setFilters] = useState({
    pais: 'ALL',
    categoria: 'ALL',
    estado: 'ALL',
    origen: 'ALL',
    mensaje: 'ALL',
    responsable: 'ALL',
    espacio: 'ALL'
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionScopeKey, setSelectionScopeKey] = useState('init');
  const [currentPage, setCurrentPage] = useState(1);
  const [archiveSubtab, setArchiveSubtab] = useState('archivados');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const sectorNameById = useMemo(() => Object.fromEntries(SECTORES.map((sector) => [sector.id, sector.nombre])), []);
  const sharedSourceIds = useMemo(
    () =>
      new Set(
        (sharedLinks || [])
          .flatMap((link) => link?.sourceRecordIds || [])
          .filter(Boolean),
      ),
    [sharedLinks],
  );

  const workspaceRecords = useMemo(() => {
    return records.filter((record) => !isLiquidatedLead(record));
  }, [records]);

  const myDuplicateRecords = useMemo(() => duplicateRecords || [], [duplicateRecords]);

  const filteredRecords = useMemo(() => {
    const searchLower = deferredSearchTerm.toLowerCase();

    return workspaceRecords.filter((record) => {
      const sectorName = sectorNameById[record.sector] || '';
      const matchesSearch =
        record.nombre.toLowerCase().includes(searchLower) ||
        record.id.toLowerCase().includes(searchLower) ||
        (record.numero && record.numero.includes(deferredSearchTerm)) ||
        (record.correo && record.correo.toLowerCase().includes(searchLower)) ||
        sectorName.toLowerCase().includes(searchLower);

      const matchesPais = filters.pais === 'ALL' || record.pais === filters.pais;
      const matchesCategoria = filters.categoria === 'ALL' || record.categoria === filters.categoria;
      const matchesEstado = filters.estado === 'ALL' || (record.estadoProspeccion || 'Nuevo') === filters.estado;
      const matchesSector = globalSectorFilter === 'ALL' || record.sector === globalSectorFilter;
      const matchesOrigen = filters.origen === 'ALL' || record.origen === filters.origen;
      const matchesMensaje = filters.mensaje === 'ALL' || (filters.mensaje === 'ENVIADO' ? record.mensajeEnviado : !record.mensajeEnviado);
      const matchesResponsable = filters.responsable === 'ALL' || (record.responsable || 'Sin Asignar') === filters.responsable;

      const isProspecting = countsAsProspecting(record);
      const matchesEspacio = filters.espacio === 'ALL' || (filters.espacio === 'IN' ? isProspecting : !isProspecting);

      const isLeadDiscarded = isDiscardedLead(record);
      const isLeadArchivedRecord = isArchivedLead(record);
      const isSharedRecord = Boolean(record.isShared) || sharedSourceIds.has(record.id);
      const matchesTab =
        directoryTab === 'nuevos'
          ? (!isLeadArchivedRecord && !isLeadDiscarded && !isSharedRecord)
          : directoryTab === 'archivados'
            ? (archiveSubtab === 'compartidos' ? isSharedRecord : isLeadArchivedRecord && !isSharedRecord)
            : isLeadDiscarded;

      return matchesSearch && matchesPais && matchesCategoria && matchesEstado && matchesSector && matchesOrigen && matchesMensaje && matchesResponsable && matchesEspacio && matchesTab;
    });
  }, [archiveSubtab, deferredSearchTerm, directoryTab, filters, globalSectorFilter, sectorNameById, sharedSourceIds, workspaceRecords]);
  const displayRecords = filteredRecords;

  const localTotalPages = Math.max(1, Math.ceil(displayRecords.length / DIRECTORY_PAGE_SIZE));
  const safeLocalCurrentPage = Math.min(currentPage, localTotalPages);
  const localPageStart = (safeLocalCurrentPage - 1) * DIRECTORY_PAGE_SIZE;
  const localPageEnd = localPageStart + DIRECTORY_PAGE_SIZE;
  const localVisibleRecords = useMemo(() => displayRecords.slice(localPageStart, localPageEnd), [displayRecords, localPageEnd, localPageStart]);
  const directoryTotal = displayRecords.length;
  const directoryTotalPages = Math.max(1, Math.ceil(directoryTotal / DIRECTORY_PAGE_SIZE));
  const visibleRecords = localVisibleRecords;
  const currentDisplayPage = safeLocalCurrentPage;
  const currentRangeStart = directoryTotal === 0 ? 0 : ((currentDisplayPage - 1) * DIRECTORY_PAGE_SIZE) + 1;
  const currentRangeEnd = directoryTotal === 0 ? 0 : Math.min(currentDisplayPage * DIRECTORY_PAGE_SIZE, directoryTotal);
  const visibleRecordIds = useMemo(() => new Set(visibleRecords.map((record) => record.id)), [visibleRecords]);
  const isSharedArchiveView = directoryTab === 'archivados' && archiveSubtab === 'compartidos';
  const canBulkSelect = ['nuevos', 'descartados'].includes(directoryTab) || (directoryTab === 'archivados' && archiveSubtab === 'archivados');
  const currentScopeKey = JSON.stringify({
    page: currentDisplayPage,
    tab: directoryTab,
    archiveSubtab,
    filters,
    sector: globalSectorFilter,
    search: deferredSearchTerm,
  });
  const effectiveSelectedIds = useMemo(() => {
    const scopedSelectedIds = selectionScopeKey === currentScopeKey ? selectedIds : [];
    if (!canBulkSelect) return [];
    return scopedSelectedIds.filter((id) => visibleRecordIds.has(id));
  }, [canBulkSelect, currentScopeKey, selectedIds, selectionScopeKey, visibleRecordIds]);
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => effectiveSelectedIds.includes(record.id));
  const clearSelection = () => {
    setSelectionScopeKey(currentScopeKey);
    setSelectedIds([]);
  };
  const bulkActionLabel = directoryTab === 'descartados' ? 'Liquidar' : 'Eliminar';
  const isDuplicatesModalVisible = showDuplicatesModal && myDuplicateRecords.length > 0;

  const handleToggleSelectAll = () => {
    if (!canBulkSelect) return;
    if (allVisibleSelected) {
      setSelectionScopeKey(currentScopeKey);
      setSelectedIds(effectiveSelectedIds.filter((id) => !visibleRecords.some((record) => record.id === id)));
    } else {
      const visibleIds = visibleRecords.map((record) => record.id);
      setSelectionScopeKey(currentScopeKey);
      setSelectedIds([...new Set([...effectiveSelectedIds, ...visibleIds])]);
    }
  };

  const handleDirectoryTabChange = (nextTab) => {
    setDirectoryTab(nextTab);
    if (nextTab !== 'archivados') {
      setArchiveSubtab('archivados');
    }
    setCurrentPage(1);
    setSelectionScopeKey(`tab:${nextTab}`);
    setSelectedIds([]);
  };
  const handleArchiveSubtabChange = (nextSubtab) => {
    setArchiveSubtab(nextSubtab);
    setCurrentPage(1);
    setSelectionScopeKey(`archive:${nextSubtab}`);
    setSelectedIds([]);
  };

  const handleToggleSelectRow = (e, id) => {
    e.stopPropagation();
    if (!canBulkSelect) return;
    setSelectionScopeKey(currentScopeKey);
    if (effectiveSelectedIds.includes(id)) {
      setSelectedIds(effectiveSelectedIds.filter(selId => selId !== id));
    } else {
      setSelectedIds([...effectiveSelectedIds, id]);
    }
  };

  const handleBulkMove = (newStatus) => {
    onBulkChangeStatus(effectiveSelectedIds, newStatus);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (effectiveSelectedIds.length === 0) return;

    const isLiquidatingDiscarded = directoryTab === 'descartados';
    setConfirmDirectoryAction({
      title: isLiquidatingDiscarded ? 'Liquidar leads' : 'Mover a Eliminados',
      message: isLiquidatingDiscarded
        ? `Se liquidarán ${effectiveSelectedIds.length} leads seleccionados. Dejarán de aparecer para el socio y quedarán guardados internamente con estatus Liquidado.`
        : `Se eliminarán ${effectiveSelectedIds.length} leads seleccionados y se moverán a Eliminados.`,
      confirmLabel: isLiquidatingDiscarded ? 'Sí, liquidar' : 'Sí, eliminar',
      confirmTone: 'danger',
      onConfirm: () => {
        handleBulkMove(isLiquidatingDiscarded ? 'Liquidado' : 'Descartado');
        if (!isLiquidatingDiscarded) {
          setDirectoryTab('descartados');
        }
        setCurrentPage(1);
      },
    });
  };

  const handleToggleSelectAllDuplicates = () => {
    if (myDuplicateRecords && selectedDuplicateIds.length === myDuplicateRecords.length) {
      setSelectedDuplicateIds([]);
    } else if (myDuplicateRecords) {
      setSelectedDuplicateIds(myDuplicateRecords.map(r => r.id));
    }
  };

  const handleToggleSelectDuplicateRow = (e, id) => {
    e.stopPropagation();
    if (selectedDuplicateIds.includes(id)) {
      setSelectedDuplicateIds(selectedDuplicateIds.filter(selId => selId !== id));
    } else {
      setSelectedDuplicateIds([...selectedDuplicateIds, id]);
    }
  };

  const handleDeleteAllDuplicates = () => {
    setConfirmDuplicateAction({
      type: 'delete',
      title: 'Eliminar Todos los Duplicados',
      message: '¿Estás seguro de eliminar TODOS los registros duplicados seleccionados? Esta acción no se puede deshacer.'
    });
  };

  const handleRestoreDuplicates = () => {
    if (selectedDuplicateIds.length === 0) return;
    setConfirmDuplicateAction({
      type: 'restore',
      title: 'Guardar Duplicados en Directorio',
      message: `Estás a punto de guardar ${selectedDuplicateIds.length} contactos en el Directorio General.\n\nADVERTENCIA: Estos números ya están registrados. Al guardarlos, tendrás leads repetidos en tu base principal.\n\n¿Deseas continuar de todos modos?`
    });
  };

  const executeDuplicateAction = () => {
    if (confirmDuplicateAction.type === 'delete') {
      const toDelete = selectedDuplicateIds.length > 0 ? selectedDuplicateIds : myDuplicateRecords.map(r => r.id);
      onDeleteDuplicates(toDelete);
      setSelectedDuplicateIds([]);
    } else if (confirmDuplicateAction.type === 'restore') {
      onRestoreDuplicates(selectedDuplicateIds);
      setSelectedDuplicateIds([]);
    }
    setConfirmDuplicateAction(null);
  };

  const executeDirectoryAction = () => {
    confirmDirectoryAction?.onConfirm?.();
    setConfirmDirectoryAction(null);
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== 'ALL').length + (globalSectorFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto bg-slate-50/30 p-4 sm:p-6 lg:overflow-hidden lg:p-8">
      <div className={`absolute top-1/4 right-10 w-[30rem] h-[30rem] bg-[#FF5A1F] rounded-full blur-[120px] pointer-events-none ${isDarkMode ? 'opacity-20' : 'hidden sm:block opacity-20'}`}></div>
      <div className={`absolute bottom-10 left-10 w-[30rem] h-[30rem] bg-purple-500 rounded-full blur-[120px] pointer-events-none ${isDarkMode ? 'opacity-15' : 'hidden sm:block opacity-15'}`}></div>

      <div className="relative z-10 mb-6 flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{t('dir_title')}</h2>
          <div className="mt-3 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit">
              <button type="button" onClick={() => handleDirectoryTabChange('nuevos')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${directoryTab === 'nuevos' ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 text-white shadow-[0_10px_24px_-14px_rgba(147,51,234,0.55)] sm:from-[#FF3C00] sm:via-[#FF7A00] sm:to-[#FFB36B] sm:shadow-[0_10px_24px_-14px_rgba(255,90,31,0.45)]' : 'text-slate-500 hover:text-slate-700'}`}>
                {t('dir_tab_new')}
              </button>
              <button type="button" onClick={() => handleDirectoryTabChange('archivados')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${directoryTab === 'archivados' ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 text-white shadow-[0_10px_24px_-14px_rgba(147,51,234,0.55)] sm:from-[#FF3C00] sm:via-[#FF7A00] sm:to-[#FFB36B] sm:shadow-[0_10px_24px_-14px_rgba(255,90,31,0.45)]' : 'text-slate-500 hover:text-slate-700'}`}>
                {t('dir_tab_archived')}
              </button>
              <button type="button" onClick={() => handleDirectoryTabChange('descartados')} className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${directoryTab === 'descartados' ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 text-white shadow-[0_10px_24px_-14px_rgba(147,51,234,0.55)] sm:from-[#FF3C00] sm:via-[#FF7A00] sm:to-[#FFB36B] sm:shadow-[0_10px_24px_-14px_rgba(255,90,31,0.45)]' : 'text-slate-500 hover:text-slate-700'}`}>
                {t('dir_tab_discarded')}
              </button>
            </div>
            {directoryTab === 'archivados' && (
              <div className="flex w-full rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-fit">
                <button
                  type="button"
                  onClick={() => handleArchiveSubtabChange('archivados')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${archiveSubtab === 'archivados' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Archivados
                </button>
                <button
                  type="button"
                  onClick={() => handleArchiveSubtabChange('compartidos')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${archiveSubtab === 'compartidos' ? 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] text-white shadow-[0_10px_24px_-14px_rgba(255,90,31,0.45)]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Compartidos
                </button>
              </div>
            )}
            <p className="ml-1 text-xs font-medium text-slate-400 sm:ml-2">
              {t('dir_showing')} {directoryTotal} {t('dir_prospects')} {directoryTotal > 0 && <span className="ml-1">· página {currentDisplayPage}/{directoryTotalPages}</span>}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
          <div className="relative flex-1 min-w-[200px] xl:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                clearSelection();
              }}
              placeholder={t('dir_search')}
              className="w-full pl-11 pr-4 py-3 bg-white rounded-full text-sm outline-none shadow-sm focus:ring-2 focus:ring-orange-100 border border-slate-100 transition-shadow"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-full border transition-all relative ${showFilters || activeFiltersCount > 0 ? 'bg-orange-50 border-orange-200 text-[#FF5A1F]' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title={t('dir_btn_filters')}
          >
            <Filter size={20} />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowDuplicatesModal(true);
            }}
            className={`p-3 rounded-full border transition-all relative ${isDuplicatesModalVisible ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            title="Detectar, archivar y revisar duplicados"
          >
            <Layers size={20} />
            {myDuplicateRecords && myDuplicateRecords.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                {myDuplicateRecords.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 animate-in slide-in-from-top-4 fade-in rounded-[2rem] border border-slate-100 bg-white p-4 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] duration-200 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sliders size={16} className="text-[#FF5A1F]" /> {t('dir_filters_title')}
            </h3>
            {activeFiltersCount > 0 && (
              <button type="button" onClick={() => { setFilters({ pais: 'ALL', categoria: 'ALL', estado: 'ALL', origen: 'ALL', mensaje: 'ALL', responsable: 'ALL', espacio: 'ALL' }); setGlobalSectorFilter?.('ALL'); setCurrentPage(1); clearSelection(); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                {t('dir_clear_filters')}
              </button>
            )}
          </div>

          <div className="overflow-visible md:max-h-[68vh] md:overflow-y-auto md:overscroll-contain md:pr-1 no-scrollbar [webkit-overflow-scrolling:touch]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_country')}</label>
              <select value={filters.pais} onChange={(e) => { setFilters({ ...filters, pais: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_all')}</option>
                {PAISES.map(p => <option key={p.code} value={p.code}>{p.flag} {p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_category')}</label>
              <select value={filters.categoria} onChange={(e) => { setFilters({ ...filters, categoria: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_all_f')}</option>
                <option value="A">{t('dir_opt_class')} A</option>
                <option value="B">{t('dir_opt_class')} B</option>
                <option value="C">{t('dir_opt_class')} C</option>
                <option value="D">{t('dir_opt_class')} D</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_status')}</label>
              <select value={filters.estado} onChange={(e) => { setFilters({ ...filters, estado: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_all')}</option>
                {ESTADOS_PROSPECCION.filter((est) => est.id !== 'Descartado' && est.id !== 'Liquidado').map(est => <option key={est.id} value={est.id}>{est.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_sector')}</label>
              <select value={globalSectorFilter} onChange={(e) => { const nextSector = e.target.value; setGlobalSectorFilter?.(nextSector); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_all')}</option>
                {SECTORES.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_origin')}</label>
              <select value={filters.origen} onChange={(e) => { setFilters({ ...filters, origen: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_all')}</option>
                {ORIGENES.map((o, i) => <option key={i} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_wa')}</label>
              <select value={filters.mensaje} onChange={(e) => { setFilters({ ...filters, mensaje: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-100 outline-none appearance-none">
                <option value="ALL">{t('dir_opt_both')}</option>
                <option value="ENVIADO">{t('dir_opt_sent')}</option>
                <option value="PENDIENTE">{t('dir_opt_pending')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-2 text-emerald-500">{t('dir_flt_team')}</label>
              <select value={filters.responsable} onChange={(e) => { setFilters({ ...filters, responsable: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-200 outline-none appearance-none text-emerald-800 font-medium">
                <option value="ALL">{t('dir_opt_anyone')}</option>
                {myAgents.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#FF5A1F] uppercase tracking-wider mb-1.5 pl-2">{t('dir_flt_workspace')}</label>
              <select value={filters.espacio} onChange={(e) => { setFilters({ ...filters, espacio: e.target.value }); setCurrentPage(1); clearSelection(); }} className="w-full text-sm bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-orange-200 outline-none appearance-none text-orange-950 font-medium">
                <option value="ALL">{t('dir_opt_both')}</option>
                <option value="IN">{t('dir_opt_in_ws')}</option>
                <option value="OUT">{t('dir_opt_out_ws')}</option>
              </select>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] glass-panel">
        {canBulkSelect && effectiveSelectedIds.length > 0 && (
          <div className="bg-gradient-to-r from-[#FF3C00] to-[#FF7A00] p-4 flex flex-col lg:flex-row items-center justify-between gap-4 relative z-20 animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-bold text-white whitespace-nowrap">{effectiveSelectedIds.length} {t('dir_selected')}</span>

            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
              <button type="button" onClick={clearSelection} className="text-xs text-white/80 hover:text-white underline mr-2 transition-colors">{t('dir_clear_sel')}</button>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 bg-white text-[#FF5A1F] shadow-md hover:bg-orange-50 active:scale-95 transition-all"
              >
                <Trash2 size={16} /> {bulkActionLabel}
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 no-scrollbar [webkit-overflow-scrolling:touch] sm:p-4">
          <div className="space-y-3 md:hidden">
            {visibleRecords.length > 0 ? visibleRecords.map((r) => {
              const paisData = getCountryMetaForRecord(r);
              const prob = getProbabilidadObj(r);

              return (
                <div
                  key={r.id}
                  onClick={() => onSelectRecord(r)}
                  className={`rounded-[1.5rem] border p-4 transition-all ${canBulkSelect && effectiveSelectedIds.includes(r.id) ? 'border-orange-200 bg-orange-50/60 shadow-sm' : 'bg-white/90 hover:border-orange-200 hover:shadow-sm'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {canBulkSelect ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <label className="relative flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              onChange={(e) => handleToggleSelectRow(e, r.id)}
                              checked={effectiveSelectedIds.includes(r.id)}
                              className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                              <Check size={10} strokeWidth={3.5} />
                            </div>
                          </label>
                        </div>
                      ) : null}
                      <AvatarInitials name={r.nombre} size="lg" isDarkMode={isDarkMode} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-bold text-slate-800">{r.nombre || t('dir_no_name')}</p>
                          <span>{paisData.flag}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{r.numero || r.correo || '-'}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${prob.bgClass} ${prob.textClass}`}>
                      {prob.icon} {prob.nivel}
                    </span>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-[1.5rem] bg-white p-8 text-center">
                <Filter size={32} className="mx-auto mb-3 text-slate-300" />
                <p className="mb-1 text-sm font-medium text-slate-500">{t('dir_no_matches')}</p>
                <p className="text-xs text-slate-400">{t('dir_try_relax')}</p>
                {activeFiltersCount > 0 && (
                  <button type="button" onClick={() => { setFilters({ pais: 'ALL', categoria: 'ALL', estado: 'ALL', origen: 'ALL', mensaje: 'ALL', responsable: 'ALL', espacio: 'ALL' }); setGlobalSectorFilter?.('ALL'); clearSelection(); }} className="mt-4 rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-[#FF5A1F] transition-colors hover:bg-orange-100">
                    {t('dir_clear_filters')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-4 pl-4 w-12">
                  {canBulkSelect ? (
                    <label className="relative flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        onChange={handleToggleSelectAll}
                        checked={allVisibleSelected}
                        className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                        <Check size={10} strokeWidth={3.5} />
                      </div>
                    </label>
                  ) : null}
                </th>
                <th className="pb-4 pl-2">{t('dir_th_id')}</th>
                <th className="pb-4">{t('dir_th_profile')}</th>
                <th className="pb-4">{t('dir_th_sector')}</th>
                <th className="pb-4 text-center">{t('dir_th_quality')}</th>
                <th className="pb-4 text-right pr-6">{t('dir_th_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleRecords.length > 0 ? visibleRecords.map((r) => {
                const paisData = getCountryMetaForRecord(r);
                const idParts = r.id.split('-');
                const idPrefix = idParts.slice(0, -1).join('-') + '-';
                const idSuffix = idParts[idParts.length - 1];
                const estadoData = ESTADOS_PROSPECCION.find(e => e.id === (r.estadoProspeccion || 'Nuevo'));
                const prob = getProbabilidadObj(r);
                const ownerData = myAgents.find(a => a.nombre === r.responsable) || myAgents[0];
                const inProspecting = countsAsProspecting(r);
                const sectorLabel = sectorNameById[r.sector] || r.sector;

                const rowStateLabel = isSharedArchiveView ? 'Compartido' : r.estadoProspeccion;

                return (
                  <tr key={r.id} onClick={() => onSelectRecord(r)} className={`transition-colors group cursor-pointer ${canBulkSelect && effectiveSelectedIds.includes(r.id) ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="py-4 pl-4 w-12" onClick={(e) => e.stopPropagation()}>
                      {canBulkSelect ? (
                        <label className="relative flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={(e) => handleToggleSelectRow(e, r.id)}
                            checked={effectiveSelectedIds.includes(r.id)}
                            className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <Check size={10} strokeWidth={3.5} />
                          </div>
                        </label>
                      ) : null}
                    </td>
                    <td className="py-4 pl-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{idPrefix}</span>
                        <span className="font-mono text-sm font-black text-slate-800 tracking-wider">{idSuffix}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <AvatarInitials name={r.nombre} size="lg" isDarkMode={isDarkMode} />
                        <div>
                          <div className="font-bold text-slate-800 text-sm group-hover:text-[#FF5A1F] transition-colors flex items-center gap-1.5 truncate max-w-[200px]">
                            {r.nombre || t('dir_no_name')}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><span>{paisData.flag}</span>{r.numero && <span>• {r.numero}</span>}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-medium text-slate-700 text-sm flex items-center gap-2">
                        {sectorLabel}
                        {ownerData.id !== 'UNASSIGNED' && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${ownerData.color} flex items-center gap-1`} title={`Responsable: ${ownerData.nombre}`}>
                            <User size={8} className="inline mr-1" /> {ownerData.nombre.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[150px] mt-0.5">{r.subsector || r.origen}</div>
                    </td>
                    <td className="py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shadow-sm ${r.categoria === 'A' ? 'bg-emerald-100 text-emerald-600' : r.categoria === 'B' ? 'bg-orange-100 text-[#FF5A1F]' : r.categoria === 'C' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{r.categoria}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${prob.bgClass} ${prob.textClass}`} title={`Probabilidad ${prob.nivel}`}>{prob.icon} {prob.nivel}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSharedArchiveView ? 'bg-blue-100 text-blue-700' : `${estadoData?.bgLight} ${estadoData?.text}`}`}>{rowStateLabel}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right pr-6 flex justify-end gap-2 items-center h-full">
                      {!isSharedArchiveView && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onChangeStatus(r.id, inProspecting ? 'Nuevo' : 'En prospección'); }}
                          title={inProspecting ? t('dir_remove_ws') : t('dir_add_to_ws')}
                          className={`p-2 rounded-full transition-colors ${inProspecting ? 'text-[#FF5A1F] bg-orange-50 hover:bg-orange-100' : 'text-slate-300 hover:text-[#FF5A1F] hover:bg-orange-100'}`}
                        >
                          <Grid size={18} />
                        </button>
                      )}
                      <button type="button" className="p-2 text-slate-300 hover:text-[#FF5A1F] hover:bg-orange-100 rounded-full transition-colors">
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Filter size={32} className="text-slate-300 mb-3" />
                      <p className="text-sm font-medium text-slate-500 mb-1">{t('dir_no_matches')}</p>
                      <p className="text-xs text-slate-400">{t('dir_try_relax')}</p>
                      {activeFiltersCount > 0 && (
                        <button type="button" onClick={() => { setFilters({ pais: 'ALL', categoria: 'ALL', estado: 'ALL', origen: 'ALL', mensaje: 'ALL', responsable: 'ALL', espacio: 'ALL' }); setGlobalSectorFilter?.('ALL'); clearSelection(); }} className="mt-4 px-4 py-2 bg-orange-50 text-[#FF5A1F] rounded-full text-xs font-bold hover:bg-orange-100 transition-colors">
                          {t('dir_clear_filters')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        {directoryTotal > DIRECTORY_PAGE_SIZE && (
          <div className={`mx-3 mb-3 flex flex-col items-center justify-between gap-3 rounded-[1.5rem] px-4 py-4 md:mx-0 md:mb-0 md:rounded-none md:border-x-0 md:border-b-0 md:border-t md:px-5 md:shadow-none md:flex-row ${
            isDarkMode
              ? 'border border-white/10 bg-[#080808] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65)] md:border-white/10 md:bg-[#080808]'
              : 'border border-slate-200 bg-[#ffffff] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.22)] md:border-slate-200 md:bg-[#ffffff]'
          }`}>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-200' : 'text-[#111827]'}`}>
              Mostrando {currentRangeStart}-{currentRangeEnd} de {directoryTotal} leads
            </p>
            <div className="flex w-full items-center justify-center gap-2 md:w-auto">
              <button
                type="button"
                onClick={() => { clearSelection(); setCurrentPage((prev) => Math.max(prev - 1, 1)); }}
                disabled={currentDisplayPage === 1}
                className={`directory-page-btn flex-1 rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:flex-none md:shadow-none ${
                  isDarkMode
                    ? 'border border-white/10 bg-[#151515] text-slate-100 shadow-sm hover:bg-[#1d1d1d]'
                    : 'border border-slate-300 bg-[#ffffff] text-[#111827] shadow-sm hover:bg-slate-50'
                }`}
              >
                Anterior
              </button>
              <div className={`rounded-xl px-3 py-2 text-xs font-bold shadow-inner ${
                isDarkMode ? 'bg-[#1f1f1f] text-white' : 'bg-[#27272a] text-white'
              }`}>
                {currentDisplayPage} / {directoryTotalPages}
              </div>
              <button
                type="button"
                onClick={() => { clearSelection(); setCurrentPage((prev) => Math.min(prev + 1, directoryTotalPages)); }}
                disabled={currentDisplayPage === directoryTotalPages}
                className={`directory-page-btn flex-1 rounded-xl border px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 md:flex-none md:shadow-none ${
                  isDarkMode
                    ? 'border-orange-400/30 bg-gradient-to-r from-[#FF6A2A] to-[#FF8B2B] shadow-[0_12px_24px_-16px_rgba(255,106,42,0.7)]'
                    : 'border-orange-200 bg-gradient-to-r from-[#FF6A2A] to-[#FF8B2B] shadow-[0_12px_24px_-16px_rgba(255,106,42,0.9)] md:border-orange-200'
                }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {isDuplicatesModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowDuplicatesModal(false)}></div>
          <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl glass-panel animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100/50 p-4 sm:p-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Layers className="text-amber-500" /> {t('dir_dup_title')} ({myDuplicateRecords ? myDuplicateRecords.length : 0})
              </h3>
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => onCleanDuplicates?.({ silent: true })} className="px-4 py-2 text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors shadow-sm">
                  Archivar detectados
                </button>
                {myDuplicateRecords && myDuplicateRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAllDuplicates}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors shadow-sm"
                  >
                    {selectedDuplicateIds.length === myDuplicateRecords.length ? 'Quitar selección' : 'Seleccionar todos'}
                  </button>
                )}
                {selectedDuplicateIds.length > 0 && (
                  <button type="button" onClick={handleRestoreDuplicates} className="px-4 py-2 text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors shadow-sm">
                    {t('dir_dup_save')} ({selectedDuplicateIds.length})
                  </button>
                )}
                {myDuplicateRecords && myDuplicateRecords.length > 0 && (
                  <button type="button" onClick={handleDeleteAllDuplicates} className="px-4 py-2 text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shadow-sm">
                    {t('dir_dup_delete')}
                  </button>
                )}
                <button type="button" onClick={() => setShowDuplicatesModal(false)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 rounded-full transition-colors ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 p-0 no-scrollbar">
              {!myDuplicateRecords || myDuplicateRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-500">{t('dir_dup_empty')}</div>
              ) : (
                <>
                  <div className="space-y-3 p-4 sm:hidden">
                    {myDuplicateRecords.map((r) => (
                      <div key={r.id} onClick={(e) => handleToggleSelectDuplicateRow(e, r.id)} className={`cursor-pointer rounded-[1.25rem] border p-4 transition-colors ${selectedDuplicateIds.includes(r.id) ? 'border-orange-200 bg-orange-50/50' : 'bg-white hover:border-orange-200'}`}>
                        <div className="mb-3 flex items-start gap-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <label className="relative flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                onChange={(e) => handleToggleSelectDuplicateRow(e, r.id)}
                                checked={selectedDuplicateIds.includes(r.id)}
                                className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                              />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                <Check size={10} strokeWidth={3.5} />
                              </div>
                            </label>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-700">{r.nombre}</p>
                            <p className="mt-1 text-xs text-slate-500">{r.numero || '-'}</p>
                            <p className="mt-1 text-xs text-slate-400">{r.origen || 'Sin origen'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden sm:block">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 pl-6 w-12">
                        <label className="relative flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={handleToggleSelectAllDuplicates}
                            checked={myDuplicateRecords.length > 0 && selectedDuplicateIds.length === myDuplicateRecords.length}
                            className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <Check size={10} strokeWidth={3.5} />
                          </div>
                        </label>
                      </th>
                      <th className="py-3">{t('dir_th_name')}</th>
                      <th className="py-3">{t('dir_th_phone')}</th>
                      <th className="py-3">{t('dir_th_email')}</th>
                      <th className="py-3">{t('dir_flt_sector')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myDuplicateRecords.map((r, i) => (
                      <tr key={i} onClick={(e) => handleToggleSelectDuplicateRow(e, r.id)} className={`transition-colors cursor-pointer ${selectedDuplicateIds.includes(r.id) ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="py-3 pl-6" onClick={(e) => e.stopPropagation()}>
                          <label className="relative flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              onChange={(e) => handleToggleSelectDuplicateRow(e, r.id)}
                              checked={selectedDuplicateIds.includes(r.id)}
                              className="peer relative h-4 w-4 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-[#FF5A1F] checked:bg-[#FF5A1F] transition-all"
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white opacity-0 transition-opacity peer-checked:opacity-100">
                              <Check size={10} strokeWidth={3.5} />
                            </div>
                          </label>
                        </td>
                        <td className="py-3 font-bold text-sm text-slate-700">{r.nombre}</td>
                        <td className="py-3 text-sm text-slate-600">{r.numero}</td>
                        <td className="py-3 text-sm text-slate-600">{r.correo || '-'}</td>
                        <td className="py-3 text-sm text-slate-600">{SECTORES.find(s => s.id === r.sector)?.nombre || r.sector}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDuplicateAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmDuplicateAction(null)}></div>
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-[2rem] p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95">
            <h4 className="text-xl font-black text-slate-800 mb-3">{confirmDuplicateAction.title}</h4>
            <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap leading-relaxed">{confirmDuplicateAction.message}</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDuplicateAction(null)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
              <button type="button" onClick={executeDuplicateAction} className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm ${confirmDuplicateAction.type === 'delete' ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_4px_14px_rgba(244,63,94,0.3)]' : 'bg-amber-500 hover:bg-amber-600 shadow-[0_4px_14px_rgba(245,158,11,0.3)]'}`}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDirectoryAction && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setConfirmDirectoryAction(null)}></div>
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-lg overflow-hidden rounded-[2rem] border p-6 shadow-2xl animate-in zoom-in-95 ${
            isDarkMode ? 'border-white/10 bg-[#121212] text-white' : 'border-orange-100 bg-white text-slate-900'
          }`}>
            <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-[#FF5A1F]/15 blur-3xl"></div>
            <div className="pointer-events-none absolute -bottom-16 left-0 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl"></div>

            <div className="relative">
              <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${
                confirmDirectoryAction.confirmTone === 'danger'
                  ? 'bg-orange-100 text-[#FF5A1F]'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                BigData Confirmacion
              </div>
              <h4 className={`mb-3 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {confirmDirectoryAction.title}
              </h4>
              <p className={`mb-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {confirmDirectoryAction.message}
              </p>
              <p className={`mb-6 text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                Confirma solo si quieres aplicar el cambio en tu directorio.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDirectoryAction(null)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
                    isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeDirectoryAction}
                  className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all ${
                    confirmDirectoryAction.confirmTone === 'danger'
                      ? 'bg-gradient-to-r from-[#FF3C00] to-[#FF7A00] shadow-[0_10px_24px_-14px_rgba(255,90,31,0.55)] hover:brightness-110'
                      : 'bg-slate-900 hover:bg-black'
                  }`}
                >
                  {confirmDirectoryAction.confirmLabel || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
