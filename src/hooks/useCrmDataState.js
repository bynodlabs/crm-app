import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../lib/constants';
import { usePersistentState } from './usePersistentState';

const scopedKey = (baseKey, scope) => `${baseKey}:${scope}`;

export function useCrmDataState(currentUser) {
  const userScope = currentUser?.id || 'guest';
  const workspaceScope = currentUser?.workspaceId || currentUser?.id || 'guest';

  const [isDarkMode, setIsDarkMode] = usePersistentState(scopedKey(STORAGE_KEYS.isDarkMode, userScope), false);
  const [activeTab, setActiveTab] = usePersistentState(scopedKey(STORAGE_KEYS.activeTab, userScope), 'home');
  const [records, setRecords] = useState([]);
  const [globalSectorFilter, setGlobalSectorFilter] = usePersistentState(scopedKey(STORAGE_KEYS.globalSectorFilter, userScope), 'ALL');
  const [duplicateRecords, setDuplicateRecords] = useState([]);
  const [sharedLinks, setSharedLinks] = useState([]);
  const [waTemplate, setWaTemplate] = usePersistentState(
    scopedKey(STORAGE_KEYS.waTemplate, userScope),
    'Hola (nombre), vi que estás en el sector de (sector), ¿podemos platicar?',
  );

  useEffect(() => {
    setRecords([]);
    setDuplicateRecords([]);
    setSharedLinks([]);
  }, [workspaceScope]);

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
