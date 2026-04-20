const QUICK_REPLIES_KEY = 'crm-wa-quick-replies';
const CATALOG_KEY = 'crm-wa-catalog';

const DEFAULT_QUICK_REPLIES = [
  {
    id: 'qr-gracias',
    shortcut: 'gracias',
    title: 'Gracias',
    message: 'Gracias por escribirnos. Con gusto te ayudo con la informacion que necesites.',
  },
  {
    id: 'qr-horario',
    shortcut: 'horario',
    title: 'Horario',
    message: 'Nuestro horario de atencion es de lunes a viernes de 10:00 a 19:00 hrs y sabados de 10:00 a 14:00 hrs.',
  },
  {
    id: 'qr-seguimiento',
    shortcut: 'seguimiento',
    title: 'Seguimiento',
    message: 'Claro, te comparto seguimiento en este mismo chat. Si gustas, tambien te mando mas detalles por aqui.',
  },
];

const sanitizeWorkspaceId = (workspaceId) => String(workspaceId || '').trim() || 'default';

const readScopedStorage = (storageKey) => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeScopedStorage = (storageKey, value) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
};

const normalizeQuickReply = (item = {}, index = 0) => {
  const shortcut = String(item.shortcut || item.title || `reply-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return {
    id: String(item.id || `reply-${index + 1}`),
    shortcut,
    title: String(item.title || shortcut).trim() || `Respuesta ${index + 1}`,
    message: String(item.message || '').trim(),
  };
};

const normalizeCatalogItem = (item = {}, index = 0) => ({
  id: String(item.id || `product-${index + 1}`),
  name: String(item.name || `Producto ${index + 1}`).trim(),
  price: String(item.price || '').trim(),
  description: String(item.description || '').trim(),
});

export function getWhatsAppQuickReplies(workspaceId) {
  const scopedKey = sanitizeWorkspaceId(workspaceId);
  const allItems = readScopedStorage(QUICK_REPLIES_KEY);
  const workspaceItems = Array.isArray(allItems[scopedKey]) ? allItems[scopedKey] : null;
  const source = workspaceItems && workspaceItems.length > 0 ? workspaceItems : DEFAULT_QUICK_REPLIES;
  return source.map((item, index) => normalizeQuickReply(item, index));
}

export function saveWhatsAppQuickReplies(workspaceId, items = []) {
  const scopedKey = sanitizeWorkspaceId(workspaceId);
  const allItems = readScopedStorage(QUICK_REPLIES_KEY);
  allItems[scopedKey] = items.map((item, index) => normalizeQuickReply(item, index));
  writeScopedStorage(QUICK_REPLIES_KEY, allItems);
  return allItems[scopedKey];
}

export function getWhatsAppCatalog(workspaceId) {
  const scopedKey = sanitizeWorkspaceId(workspaceId);
  const allItems = readScopedStorage(CATALOG_KEY);
  const workspaceItems = Array.isArray(allItems[scopedKey]) ? allItems[scopedKey] : [];
  return workspaceItems.map((item, index) => normalizeCatalogItem(item, index));
}

export function saveWhatsAppCatalog(workspaceId, items = []) {
  const scopedKey = sanitizeWorkspaceId(workspaceId);
  const allItems = readScopedStorage(CATALOG_KEY);
  allItems[scopedKey] = items.map((item, index) => normalizeCatalogItem(item, index));
  writeScopedStorage(CATALOG_KEY, allItems);
  return allItems[scopedKey];
}
