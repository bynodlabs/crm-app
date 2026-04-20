const INBOX_CACHE_KEY = 'crm-wa-inbox-cache-v1';
const QR_CACHE_KEY = 'crm-wa-qr-cache-v1';

const inboxMemoryCache = new Map();
const qrMemoryCache = new Map();

const readSessionJson = (key, fallback) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return fallback;

  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeSessionJson = (key, value) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore session storage limits or privacy restrictions.
  }
};

const readWorkspaceSnapshot = (storageKey, workspaceId) => {
  const allSnapshots = readSessionJson(storageKey, {});
  if (!workspaceId) return null;
  return allSnapshots?.[workspaceId] || null;
};

const writeWorkspaceSnapshot = (storageKey, workspaceId, snapshot) => {
  if (!workspaceId) return;

  const allSnapshots = readSessionJson(storageKey, {});
  writeSessionJson(storageKey, {
    ...allSnapshots,
    [workspaceId]: snapshot,
  });
};

export function getWhatsAppInboxCache(workspaceId) {
  if (!workspaceId) {
    return { chats: [], connection: null };
  }

  if (inboxMemoryCache.has(workspaceId)) {
    return inboxMemoryCache.get(workspaceId);
  }

  const snapshot = readWorkspaceSnapshot(INBOX_CACHE_KEY, workspaceId) || { chats: [], connection: null };
  inboxMemoryCache.set(workspaceId, snapshot);
  return snapshot;
}

export function setWhatsAppInboxCache(workspaceId, snapshot) {
  if (!workspaceId) return;

  const nextSnapshot = {
    chats: Array.isArray(snapshot?.chats) ? snapshot.chats : [],
    connection: snapshot?.connection || null,
    updatedAt: Date.now(),
  };

  inboxMemoryCache.set(workspaceId, nextSnapshot);
  writeWorkspaceSnapshot(INBOX_CACHE_KEY, workspaceId, nextSnapshot);
}

export function getWhatsAppQrCache(workspaceId) {
  if (!workspaceId) {
    return {
      groups: [],
      selectedGroup: '',
      selectedGroupIds: [],
      selectedGroupMeta: null,
      participantsByGroup: {},
      selection: {},
    };
  }

  if (qrMemoryCache.has(workspaceId)) {
    return qrMemoryCache.get(workspaceId);
  }

  const snapshot = readWorkspaceSnapshot(QR_CACHE_KEY, workspaceId) || {
    groups: [],
    selectedGroup: '',
    selectedGroupIds: [],
    selectedGroupMeta: null,
    participantsByGroup: {},
    selection: {},
  };
  qrMemoryCache.set(workspaceId, snapshot);
  return snapshot;
}

export function setWhatsAppQrCache(workspaceId, snapshot) {
  if (!workspaceId) return;

  const nextSnapshot = {
    groups: Array.isArray(snapshot?.groups) ? snapshot.groups : [],
    selectedGroup: String(snapshot?.selectedGroup || ''),
    selectedGroupIds: Array.isArray(snapshot?.selectedGroupIds) ? snapshot.selectedGroupIds : [],
    selectedGroupMeta: snapshot?.selectedGroupMeta || null,
    participantsByGroup: snapshot?.participantsByGroup && typeof snapshot.participantsByGroup === 'object'
      ? snapshot.participantsByGroup
      : {},
    selection: snapshot?.selection && typeof snapshot.selection === 'object'
      ? snapshot.selection
      : {},
    updatedAt: Date.now(),
  };

  qrMemoryCache.set(workspaceId, nextSnapshot);
  writeWorkspaceSnapshot(QR_CACHE_KEY, workspaceId, nextSnapshot);
}
