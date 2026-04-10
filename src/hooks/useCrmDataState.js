import { STORAGE_KEYS } from '../lib/constants';
import { usePersistentState } from './usePersistentState';

const scopedKey = (baseKey, scope) => `${baseKey}:${scope}`;

export function useCrmDataState(currentUser) {
  const userScope = currentUser?.id || 'guest';
  const workspaceScope = currentUser?.workspaceId || currentUser?.id || 'guest';

  const [isDarkMode, setIsDarkMode] = usePersistentState(scopedKey(STORAGE_KEYS.isDarkMode, userScope), false);
  const [activeTab, setActiveTab] = usePersistentState(scopedKey(STORAGE_KEYS.activeTab, userScope), 'home');
  const [records, setRecords] = usePersistentState(scopedKey(STORAGE_KEYS.records, workspaceScope), []);
  const [globalSectorFilter, setGlobalSectorFilter] = usePersistentState(scopedKey(STORAGE_KEYS.globalSectorFilter, userScope), 'ALL');
  const [duplicateRecords, setDuplicateRecords] = usePersistentState(scopedKey(STORAGE_KEYS.duplicateRecords, workspaceScope), []);
  const [sharedLinks, setSharedLinks] = usePersistentState(scopedKey(STORAGE_KEYS.sharedLinks, workspaceScope), []);
  const [waTemplate, setWaTemplate] = usePersistentState(
    scopedKey(STORAGE_KEYS.waTemplate, userScope),
    'Hola (nombre), vi que estás en el sector de (sector), ¿podemos platicar?',
  );

  return {
    isDarkMode,
    setIsDarkMode,
    activeTab,
    setActiveTab,
    records,
    setRecords,
    globalSectorFilter,
    setGlobalSectorFilter,
    duplicateRecords,
    setDuplicateRecords,
    sharedLinks,
    setSharedLinks,
    waTemplate,
    setWaTemplate,
  };
}
