import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { SECTORES, STORAGE_KEYS } from '../lib/constants';
import { readStorage, writeStorage } from '../lib/storage';

const normalizeSector = (sector) => ({
  entityId: sector.entityId || sector.id || sector.code,
  id: sector.code || sector.id,
  code: sector.code || sector.id,
  nombre: sector.name || sector.nombre || sector.code || sector.id,
  name: sector.name || sector.nombre || sector.code || sector.id,
  icon: sector.icon || '📌',
  color: sector.color || 'from-slate-500 to-slate-700',
  isActive: sector.isActive !== false,
  sortOrder: Number.isFinite(Number(sector.sortOrder)) ? Number(sector.sortOrder) : 0,
});

const FALLBACK_SECTORS = SECTORES.map((sector, index) => normalizeSector({ ...sector, sortOrder: index, isActive: true }));

const buildSectorStorageKey = (workspaceScope = 'guest') => `${STORAGE_KEYS.sectors}:${workspaceScope}`;

const getWorkspaceScope = () => {
  const currentUser = readStorage(STORAGE_KEYS.currentUser, null);
  return currentUser?.workspaceId || currentUser?.id || 'guest';
};

const getStoredCustomSectors = (workspaceScope) => {
  const stored = readStorage(buildSectorStorageKey(workspaceScope), []);
  return Array.isArray(stored)
    ? stored.map(normalizeSector).sort((a, b) => a.sortOrder - b.sortOrder || a.nombre.localeCompare(b.nombre))
    : [];
};

const buildLocalSectorList = (workspaceScope) =>
  [...FALLBACK_SECTORS, ...getStoredCustomSectors(workspaceScope)]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nombre.localeCompare(b.nombre));

const hasApiSession = () => Boolean(readStorage(STORAGE_KEYS.sessionToken, null));

const shouldUseLocalFallback = (error) => {
  const status = Number(error?.status);
  return !status || status === 401 || status === 403;
};

const buildLocalSectorCode = (name = '') => {
  const normalized = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return normalized || `CUS_${Date.now().toString(36).toUpperCase()}`;
};

export function useSectors() {
  const workspaceScope = useMemo(() => getWorkspaceScope(), []);
  const [sectors, setSectors] = useState(() => buildLocalSectorList(workspaceScope));
  const [status, setStatus] = useState('fallback');
  const [error, setError] = useState(null);
  const [source, setSource] = useState(hasApiSession() ? 'constants' : 'local');

  const refresh = useCallback(async () => {
    if (!hasApiSession()) {
      const localItems = buildLocalSectorList(workspaceScope);
      setSectors(localItems);
      setStatus('fallback');
      setSource('local');
      setError(null);
      return localItems;
    }

    try {
      setStatus('loading');
      const result = await api.listSectors({ includeInactive: true });
      const items = Array.isArray(result?.items)
        ? result.items.map(normalizeSector).sort((a, b) => a.sortOrder - b.sortOrder || a.nombre.localeCompare(b.nombre))
        : [];

      if (items.length === 0) {
        const localItems = buildLocalSectorList(workspaceScope);
        setSectors(localItems);
        setStatus('fallback');
        setSource('local');
        setError(null);
        return localItems;
      }

      setSectors(items);
      setStatus('ready');
      setSource('api');
      setError(null);
      return items;
    } catch (nextError) {
      const localItems = buildLocalSectorList(workspaceScope);
      setSectors(localItems);
      setStatus('fallback');
      setSource('local');
      setError(nextError);
      return localItems;
    }
  }, [workspaceScope]);

  const createSector = async (payload = {}) => {
    if (hasApiSession()) {
      try {
        const result = await api.createSector(payload);
        await refresh();
        return { sector: normalizeSector(result?.sector || payload), source: 'api' };
      } catch (nextError) {
        if (!shouldUseLocalFallback(nextError)) {
          throw nextError;
        }
      }
    }

    const safeName = String(payload.name || payload.nombre || '').trim();
    if (!safeName) {
      const nextError = new Error('El nombre del sector es obligatorio.');
      nextError.status = 400;
      throw nextError;
    }

    const storedCustomSectors = getStoredCustomSectors(workspaceScope);
    const nextSortOrder = [...FALLBACK_SECTORS, ...storedCustomSectors].reduce(
      (maxSortOrder, sector) => Math.max(maxSortOrder, Number(sector.sortOrder) || 0),
      -1,
    ) + 1;

    const baseCode = buildLocalSectorCode(safeName);
    const existingCodes = new Set(
      [...FALLBACK_SECTORS, ...storedCustomSectors]
        .map((sector) => String(sector.code || sector.id || '').trim())
        .filter(Boolean),
    );

    let candidateCode = baseCode;
    let suffix = 1;
    while (existingCodes.has(candidateCode)) {
      candidateCode = `${baseCode}_${suffix}`;
      suffix += 1;
    }

    const localSector = normalizeSector({
      entityId: `local-${candidateCode}`,
      id: candidateCode,
      code: candidateCode,
      name: safeName,
      icon: String(payload.icon || '').trim() || '✨',
      color: String(payload.color || '').trim() || 'from-sky-400 to-indigo-500',
      sortOrder: nextSortOrder,
      isActive: true,
    });

    writeStorage(buildSectorStorageKey(workspaceScope), [...storedCustomSectors, localSector]);
    const nextItems = buildLocalSectorList(workspaceScope);
    setSectors(nextItems);
    setStatus('fallback');
    setSource('local');
    setError(null);
    return { sector: localSector, source: 'local' };
  };

  const deleteSector = async (sectorId) => {
    const safeSectorId = String(sectorId || '').trim();
    if (!safeSectorId) return { ok: false, source: 'local' };

    if (hasApiSession() && !safeSectorId.startsWith('local-')) {
      try {
        const result = await api.deleteSector(safeSectorId);
        await refresh();
        return { ...result, source: 'api' };
      } catch (nextError) {
        if (!shouldUseLocalFallback(nextError)) {
          throw nextError;
        }
      }
    }

    const storedCustomSectors = getStoredCustomSectors(workspaceScope);
    const nextCustomSectors = storedCustomSectors.map((sector) => {
      const matchesEntityId = sector.entityId === safeSectorId;
      const matchesCode = sector.id === safeSectorId || sector.code === safeSectorId;

      if (!matchesEntityId && !matchesCode) {
        return sector;
      }

      return {
        ...sector,
        isActive: false,
      };
    });

    writeStorage(buildSectorStorageKey(workspaceScope), nextCustomSectors);
    const nextItems = buildLocalSectorList(workspaceScope);
    setSectors(nextItems);
    setStatus('fallback');
    setSource('local');
    setError(null);
    return { ok: true, source: 'local' };
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextSectors = await refresh();
      if (cancelled || !nextSectors) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return {
    sectors,
    activeSectors: sectors.filter((sector) => sector.isActive !== false),
    status,
    error,
    source,
    refresh,
    createSector,
    deleteSector,
  };
}
