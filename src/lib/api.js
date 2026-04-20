const API_BASE = import.meta.env.VITE_API_URL || '/api';
let sessionToken = null;

export function setApiSessionToken(token) {
  sessionToken = token || null;
}

function buildStreamUrl(path) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  if (sessionToken) {
    url.searchParams.set('sessionToken', sessionToken);
  }

  return url.toString();
}

function buildAuthenticatedUrl(path) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  if (sessionToken) {
    url.searchParams.set('sessionToken', sessionToken);
  }

  return url.toString();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.error || `API error ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export const api = {
  health() {
    return apiRequest('/health');
  },

  login(payload) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  register(payload) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  me() {
    return apiRequest('/auth/me');
  },

  logout() {
    return apiRequest('/auth/logout', {
      method: 'POST',
    });
  },

  impersonate(payload) {
    return apiRequest('/auth/impersonate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePassword(payload) {
    return apiRequest('/users/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateProfile(payload) {
    return apiRequest('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  teamOverview() {
    return apiRequest('/users/team-overview');
  },

  listUsers() {
    return apiRequest('/users');
  },

  listSectors(params = {}) {
    return apiRequest(`/sectors${buildQueryString(params)}`);
  },

  createSector(payload) {
    return apiRequest('/sectors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteSector(sectorId) {
    return apiRequest(`/sectors/${sectorId}`, {
      method: 'DELETE',
    });
  },

  getWhatsAppQr() {
    return apiRequest('/wa/qr');
  },

  getWhatsAppStatus() {
    return apiRequest('/wa/status');
  },

  listWhatsAppGroups() {
    return apiRequest('/wa/groups');
  },

  listWhatsAppGroupParticipants(groupId) {
    return apiRequest(`/wa/groups/${encodeURIComponent(groupId)}/participants`);
  },

  disconnectWhatsApp() {
    return apiRequest('/wa/disconnect', {
      method: 'POST',
    });
  },

  listWhatsAppChats() {
    return apiRequest('/wa/chats');
  },

  getWhatsAppChatMessages(contactId) {
    return apiRequest(`/wa/chats/${encodeURIComponent(contactId)}/messages`);
  },

  sendWhatsAppChatMessage(contactId, payload) {
    return apiRequest(`/wa/chats/${encodeURIComponent(contactId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  forwardWhatsAppChatMessage(contactId, messageId, payload) {
    return apiRequest(`/wa/chats/${encodeURIComponent(contactId)}/messages/${encodeURIComponent(messageId)}/forward`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteWhatsAppChatMessage(contactId, messageId, payload = {}) {
    return apiRequest(`/wa/chats/${encodeURIComponent(contactId)}/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      body: JSON.stringify(payload),
    });
  },

  getWhatsAppChatStreamUrl(contactId) {
    return buildStreamUrl(`/wa/chats/${encodeURIComponent(contactId)}/stream`);
  },

  getWhatsAppChatMediaUrl(contactId, messageId) {
    return buildAuthenticatedUrl(`/wa/chats/${encodeURIComponent(contactId)}/messages/${encodeURIComponent(messageId)}/media`);
  },

  adminOverview(params = {}) {
    return apiRequest(`/admin/overview${buildQueryString(params)}`);
  },

  createRecord(payload) {
    return apiRequest('/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteRecords(recordIds = []) {
    return apiRequest('/records', {
      method: 'DELETE',
      body: JSON.stringify({ recordIds }),
    });
  },

  listRecords(params = {}) {
    return apiRequest(`/records${buildQueryString(params)}`);
  },

  async listAllRecords(params = {}) {
    const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 250, 1), 250);
    let page = Math.max(Number.parseInt(params.page, 10) || 1, 1);
    let allItems = [];
    let hasMore = true;
    let lastResponse = { total: 0, limit, page, hasMore: false };

    while (hasMore) {
      const response = await apiRequest(`/records${buildQueryString({ ...params, page, limit })}`);
      const items = Array.isArray(response.items) ? response.items : [];
      allItems = [...allItems, ...items];
      hasMore = Boolean(response.hasMore);
      lastResponse = response;
      page += 1;
    }

    return {
      ...lastResponse,
      items: allItems,
      total: lastResponse.total || allItems.length,
      limit,
      page: 1,
      hasMore: false,
    };
  },

  bulkCreateRecords(records) {
    return apiRequest('/records/bulk', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  },

  updateRecord(recordId, payload) {
    return apiRequest(`/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  bulkChangeStatus(payload) {
    return apiRequest('/records/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  shareRecords(payload) {
    return apiRequest('/records/share', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  cleanDuplicates() {
    return apiRequest('/records/clean-duplicates', {
      method: 'POST',
    });
  },

  listDuplicates() {
    return apiRequest('/duplicates');
  },

  bulkStoreDuplicates(records) {
    return apiRequest('/duplicates/bulk', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  },

  listSharedLinks() {
    return apiRequest('/shared-links');
  },

  createSharedLink(payload) {
    return apiRequest('/shared-links', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  restoreDuplicates(duplicateIds) {
    return apiRequest('/duplicates/restore', {
      method: 'POST',
      body: JSON.stringify({ duplicateIds }),
    });
  },

  deleteDuplicates(duplicateIds = []) {
    return apiRequest('/duplicates', {
      method: 'DELETE',
      body: JSON.stringify({ duplicateIds }),
    });
  },
};
