import { rm } from 'node:fs/promises';
import path from 'node:path';
import { conversationService } from './conversation-service.js';

const WA_SESSION_ROOT = path.resolve(process.cwd(), 'server', '.wa-sessions');
const DEFAULT_BAILEYS_VERSION = [2, 3000, 1015901307];
const QR_WAIT_ATTEMPTS = 20;
const QR_WAIT_MS = 250;
const MAX_CACHED_CHAT_MESSAGES = 120;
const INITIAL_HISTORY_CHAT_LIMIT = 10;

const sessions = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const asErrorMessage = (error, fallback) => String(error?.message || fallback || 'Unexpected error');

const buildServiceErrorResponse = (error, fallbackMessage = 'No se pudo completar la conexión con WhatsApp.') => ({
  status: Number(error?.status) || 503,
  payload: {
    error: asErrorMessage(error, fallbackMessage),
  },
});

const ensureSessionState = (workspaceId) => {
  if (!sessions.has(workspaceId)) {
    sessions.set(workspaceId, {
      workspaceId,
      status: 'disconnected',
      qrCode: null,
      profileName: '',
      phoneNumber: '',
      lastError: null,
      socket: null,
      reconnectTimer: null,
      initPromise: null,
      saveCreds: null,
      authDir: path.join(WA_SESSION_ROOT, workspaceId),
      manuallyDisconnected: false,
      defaultDisappearingMode: 0,
      lidPhoneMap: new Map(),
      lidNameMap: new Map(),
      chatAvatarCache: new Map(),
      chatConfig: new Map(),
      messageCache: new Map(),
      rawMessageCache: new Map(),
      chatSubscribers: new Map(),
      unreadCounts: new Map(),
      historyBootstrapComplete: false,
    });
  }

  return sessions.get(workspaceId);
};

let baileysLoaderPromise = null;

const loadBaileys = async () => {
  if (!baileysLoaderPromise) {
    console.log('[wa][service] loadBaileys - starting dynamic imports');
    baileysLoaderPromise = Promise.all([
      import('@whiskeysockets/baileys'),
      import('qrcode'),
    ])
      .then(([baileysModule, qrModule]) => {
        console.log('[wa][service] loadBaileys - imports loaded successfully');
        return {
          baileys: baileysModule.default ? { ...baileysModule, default: baileysModule.default } : baileysModule,
          qrCodeLib: qrModule.default || qrModule,
        };
      })
      .catch((error) => {
        baileysLoaderPromise = null;
        console.error('[wa][service] loadBaileys - import failed:', error);
        const missingDependencyError = new Error(
          'WhatsApp service dependencies are not installed. Add @whiskeysockets/baileys and qrcode to run this module.',
        );
        missingDependencyError.status = 503;
        missingDependencyError.cause = error;
        throw missingDependencyError;
      });
  }

  return baileysLoaderPromise;
};

const formatPhoneNumberFromJid = (jid = '') => {
  const raw = String(jid || '').split(/[:@]/)[0];
  return raw ? `+${raw}` : '';
};

const isLidJid = (value = '') => String(value || '').includes('@lid');

const normalizeJid = (value = '') => String(value || '').trim();

const isGroupJid = (value = '') => normalizeJid(value).endsWith('@g.us');

const isDirectChatJid = (value = '') => {
  const normalized = normalizeJid(value);
  return normalized.endsWith('@s.whatsapp.net') || normalized.endsWith('@lid');
};

const normalizeContactJid = (session, value = '') => {
  const candidate = normalizeJid(value);
  if (!candidate) return '';

  if (candidate.includes('@')) {
    return isLidJid(candidate) ? normalizeJid(session?.lidPhoneMap.get(candidate) || candidate) : candidate;
  }

  const digits = candidate.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
};

const resolveFormattedPhoneCandidate = (value = '') => {
  const candidate = normalizeJid(value);
  if (!candidate || isLidJid(candidate)) return '';

  if (candidate.includes('@')) {
    return formatPhoneNumberFromJid(candidate);
  }

  const digits = candidate.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

const cacheParticipantIdentity = (session, { lid = '', jid = '', name = '' } = {}) => {
  const safeLid = normalizeJid(lid);
  const safeJid = normalizeJid(jid);
  const safeName = String(name || '').trim();

  if (safeLid && safeJid && !isLidJid(safeJid)) {
    session.lidPhoneMap.set(safeLid, safeJid);
  }

  if (safeLid && safeName) {
    session.lidNameMap.set(safeLid, safeName);
  }
};

const resolveParticipantPhoneNumber = (participant = {}) => {
  const candidates = [
    participant.phoneNumber,
    participant.jid,
  ];

  for (const candidate of candidates) {
    const formatted = resolveFormattedPhoneCandidate(candidate);
    if (formatted) return formatted;
  }

  return '';
};

const findNodeByTag = (node, tagName) => {
  if (!node || typeof node !== 'object') return null;
  if (node.tag === tagName) return node;

  const content = Array.isArray(node.content) ? node.content : [];
  for (const child of content) {
    const match = findNodeByTag(child, tagName);
    if (match) return match;
  }

  return null;
};

const queryProfilePictureUrl = async (socket, { target, to, type = 'image' } = {}) => {
  if (!socket || typeof socket.query !== 'function' || !target || !to) {
    return '';
  }

  try {
    const result = await socket.query({
      tag: 'iq',
      attrs: {
        target,
        to,
        type: 'get',
        xmlns: 'w:profile:picture',
      },
      content: [{ tag: 'picture', attrs: { type, query: 'url' } }],
    }, 5000);

    const pictureNode = findNodeByTag(result, 'picture');
    return typeof pictureNode?.attrs?.url === 'string' ? pictureNode.attrs.url.trim() : '';
  } catch {
    return '';
  }
};

const resolveGroupAvatarUrl = async (socket, groupId) => {
  if (!socket || !groupId || typeof socket.profilePictureUrl !== 'function') {
    return '';
  }

  const candidates = Array.from(new Set([
    String(groupId || '').trim(),
    String(groupId || '').trim().replace(/:\d+@g\.us$/, '@g.us'),
  ].filter(Boolean)));

  for (const candidate of candidates) {
    for (const type of ['image', 'preview']) {
      try {
        const avatarUrl = await socket.profilePictureUrl(candidate, type, 5000);
        if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
          return avatarUrl.trim();
        }
      } catch {
        // Continue with the next fallback candidate.
      }

      const manualQueryTargets = [
        { target: candidate, to: 's.whatsapp.net', type },
        { target: candidate, to: '@g.us', type },
        { target: candidate, to: candidate, type },
      ];

      for (const queryConfig of manualQueryTargets) {
        const avatarUrl = await queryProfilePictureUrl(socket, queryConfig);
        if (avatarUrl) {
          return avatarUrl;
        }
      }
    }
  }

  return '';
};

const resolveContactAvatarUrl = async (socket, session, jid) => {
  if (!socket || !jid || typeof socket.profilePictureUrl !== 'function') {
    return '';
  }

  const normalizedJid = normalizeContactJid(session, jid);
  if (!normalizedJid) return '';

  if (session.chatAvatarCache.has(normalizedJid)) {
    return session.chatAvatarCache.get(normalizedJid) || '';
  }

  const candidates = Array.from(new Set([
    normalizedJid,
    isLidJid(normalizedJid) ? normalizeJid(session.lidPhoneMap.get(normalizedJid) || '') : '',
  ].filter(Boolean)));

  for (const candidate of candidates) {
    for (const type of ['image', 'preview']) {
      try {
        const avatarUrl = await socket.profilePictureUrl(candidate, type, 5000);
        if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
          session.chatAvatarCache.set(normalizedJid, avatarUrl.trim());
          return avatarUrl.trim();
        }
      } catch {
        // Continue with fallback strategies.
      }

      const manualQueryTargets = [
        { target: candidate, to: 's.whatsapp.net', type },
        { target: candidate, to: candidate, type },
      ];

      for (const queryConfig of manualQueryTargets) {
        const avatarUrl = await queryProfilePictureUrl(socket, queryConfig);
        if (avatarUrl) {
          session.chatAvatarCache.set(normalizedJid, avatarUrl);
          return avatarUrl;
        }
      }
    }
  }

  return '';
};

const extractParticipantName = (participant = {}) => {
  const candidates = [
    participant.name,
    participant.notify,
    participant.pushName,
    participant.verifiedName,
    participant.formattedName,
  ];

  const match = candidates.find((value) => String(value || '').trim());
  return String(match || '').trim();
};

const serializeStatus = (session) => ({
  status: session.status,
  qrCode: session.qrCode,
  profileName: session.profileName || '',
  phoneNumber: session.phoneNumber || '',
  lastError: session.lastError || null,
});

const extractMessageText = (message = {}) => {
  if (!message || typeof message !== 'object') return '';

  if (message.conversation) return String(message.conversation).trim();
  if (message.extendedTextMessage?.text) return String(message.extendedTextMessage.text).trim();
  if (message.imageMessage?.caption) return String(message.imageMessage.caption).trim();
  if (message.videoMessage?.caption) return String(message.videoMessage.caption).trim();
  if (message.documentMessage?.caption) return String(message.documentMessage.caption).trim();
  if (message.buttonsResponseMessage?.selectedDisplayText) return String(message.buttonsResponseMessage.selectedDisplayText).trim();
  if (message.listResponseMessage?.title) return String(message.listResponseMessage.title).trim();
  if (message.ephemeralMessage?.message) return extractMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessageV2?.message) return extractMessageText(message.viewOnceMessageV2.message);
  if (message.viewOnceMessage?.message) return extractMessageText(message.viewOnceMessage.message);

  if (message.audioMessage) return 'Audio';
  if (message.stickerMessage) return 'Sticker';
  if (message.imageMessage) return 'Imagen';
  if (message.videoMessage) return 'Video';
  if (message.documentMessage) return 'Documento';
  if (message.contactMessage || message.contactsArrayMessage) return 'Contacto';

  return '';
};

const unwrapMessageContent = (message = {}) => {
  if (!message || typeof message !== 'object') return {};
  if (message.ephemeralMessage?.message) return unwrapMessageContent(message.ephemeralMessage.message);
  if (message.viewOnceMessageV2?.message) return unwrapMessageContent(message.viewOnceMessageV2.message);
  if (message.viewOnceMessage?.message) return unwrapMessageContent(message.viewOnceMessage.message);
  if (message.documentWithCaptionMessage?.message) return unwrapMessageContent(message.documentWithCaptionMessage.message);
  return message;
};

const getMessageMediaDescriptor = (message = {}) => {
  const content = unwrapMessageContent(message);
  if (content.contactMessage || content.contactsArrayMessage) {
    return {
      type: 'contact',
      mimeType: 'text/vcard',
      caption: '',
      fileName: '',
    };
  }

  if (content.imageMessage) {
    return {
      type: 'image',
      mimeType: String(content.imageMessage.mimetype || 'image/jpeg'),
      caption: String(content.imageMessage.caption || '').trim(),
      fileName: '',
    };
  }

  if (content.videoMessage) {
    return {
      type: 'video',
      mimeType: String(content.videoMessage.mimetype || 'video/mp4'),
      caption: String(content.videoMessage.caption || '').trim(),
      fileName: '',
    };
  }

  if (content.audioMessage) {
    return {
      type: 'audio',
      mimeType: String(content.audioMessage.mimetype || 'audio/ogg'),
      caption: '',
      fileName: '',
    };
  }

  if (content.stickerMessage) {
    return {
      type: 'sticker',
      mimeType: String(content.stickerMessage.mimetype || 'image/webp'),
      caption: '',
      fileName: '',
    };
  }

  if (content.documentMessage) {
    return {
      type: 'document',
      mimeType: String(content.documentMessage.mimetype || 'application/octet-stream'),
      caption: String(content.documentMessage.caption || '').trim(),
      fileName: String(content.documentMessage.fileName || '').trim(),
    };
  }

  return {
    type: 'text',
    mimeType: 'text/plain',
    caption: '',
    fileName: '',
  };
};

const resolveMessageContextInfo = (message = {}) => {
  const content = unwrapMessageContent(message);
  return (
    content.extendedTextMessage?.contextInfo
    || content.imageMessage?.contextInfo
    || content.videoMessage?.contextInfo
    || content.documentMessage?.contextInfo
    || content.audioMessage?.contextInfo
    || content.contactMessage?.contextInfo
    || content.contactsArrayMessage?.contextInfo
    || null
  );
};

const buildQuotedMessagePreview = (contextInfo = {}) => {
  const quotedId = String(contextInfo?.stanzaId || '').trim();
  if (!quotedId) return null;

  const quotedContent = unwrapMessageContent(contextInfo?.quotedMessage);
  const media = getMessageMediaDescriptor(quotedContent);
  const text = extractMessageText(quotedContent);

  return {
    id: quotedId,
    text: text || '',
    type: media.type,
    fromMe: Boolean(contextInfo?.participant && String(contextInfo.participant).includes('@') === false ? false : false),
  };
};

const extractPhoneFromVcard = (vcard = '') => {
  const raw = String(vcard || '');
  const waidMatch = raw.match(/waid=(\d+)/i);
  if (waidMatch?.[1]) {
    return `+${waidMatch[1]}`;
  }

  const telMatch = raw.match(/TEL[^:]*:([^\n\r]+)/i);
  if (!telMatch?.[1]) return '';
  const digits = String(telMatch[1]).replace(/[^\d+]/g, '');
  return digits ? (digits.startsWith('+') ? digits : `+${digits}`) : '';
};

const getMessageContactDescriptor = (message = {}) => {
  const content = unwrapMessageContent(message);
  const singleContact = content.contactMessage;
  const multiContact = Array.isArray(content.contactsArrayMessage?.contacts)
    ? content.contactsArrayMessage.contacts[0]
    : null;
  const source = multiContact || singleContact || null;
  if (!source) return null;

  const displayName = String(
    source.displayName
      || source.structuredName?.displayName
      || content.contactsArrayMessage?.displayName
      || '',
  ).trim();
  const vcard = String(source.vcard || '').trim();
  const phoneNumber = extractPhoneFromVcard(vcard);

  return {
    displayName,
    phoneNumber,
    vcard,
  };
};

const asMessageTimestamp = (value) => {
  if (typeof value === 'number') return value * 1000;
  if (typeof value === 'bigint') return Number(value) * 1000;
  if (value && typeof value === 'object') {
    if (typeof value.low === 'number') return value.low * 1000;
    if (typeof value.toNumber === 'function') return value.toNumber() * 1000;
  }

  return Date.now();
};

const resolveHistoryMessageJid = (session, message = {}) => {
  const protocolMessage = unwrapMessageContent(message?.message)?.protocolMessage;
  const protocolJid = protocolMessage?.key?.remoteJid || message?.key?.remoteJid || message?.key?.participant || '';
  const jid = normalizeContactJid(session, protocolJid);
  return isDirectChatJid(jid) ? jid : '';
};

const selectInitialHistoryMessages = (session, messages = [], limit = INITIAL_HISTORY_CHAT_LIMIT) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  if (!Number.isFinite(limit) || limit <= 0) return [];

  const latestByJid = new Map();

  messages.forEach((message) => {
    const jid = resolveHistoryMessageJid(session, message);
    if (!jid) return;

    const timestamp = asMessageTimestamp(message?.messageTimestamp);
    const previousTimestamp = latestByJid.get(jid) || 0;
    if (timestamp >= previousTimestamp) {
      latestByJid.set(jid, timestamp);
    }
  });

  if (latestByJid.size === 0) return [];

  const allowedJids = new Set(
    Array.from(latestByJid.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([jid]) => jid),
  );

  return messages.filter((message) => allowedJids.has(resolveHistoryMessageJid(session, message)));
};

const normalizeEphemeralExpiration = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
};

const serializeChatMessage = (session, message) => {
  const jid = normalizeContactJid(session, message?.key?.remoteJid || message?.key?.participant || '');
  if (!jid || !isDirectChatJid(jid)) {
    return null;
  }

  const messageContent = unwrapMessageContent(message?.message);
  const media = getMessageMediaDescriptor(messageContent);
  const text = extractMessageText(messageContent);
  if (!text && media.type === 'text') {
    return null;
  }

  return {
    id: String(message?.key?.id || `${jid}-${asMessageTimestamp(message?.messageTimestamp)}`),
    jid,
    text: text || '',
    timestamp: asMessageTimestamp(message?.messageTimestamp),
    direction: message?.key?.fromMe ? 'out' : 'in',
    fromMe: Boolean(message?.key?.fromMe),
    pushName: String(message?.pushName || '').trim(),
    status: String(message?.status || '').toLowerCase(),
    type: media.type,
    mimeType: media.mimeType,
    caption: media.caption,
    fileName: media.fileName,
    hasMedia: media.type !== 'text',
    contact: media.type === 'contact' ? getMessageContactDescriptor(messageContent) : null,
    quotedMessage: buildQuotedMessagePreview(resolveMessageContextInfo(messageContent) || {}),
    deletedForEveryone: false,
  };
};

const markMessageDeletedForEveryone = (session, jid, messageId) => {
  const existingMessages = session.messageCache.get(jid) || [];
  const nextMessages = existingMessages.map((message) => (
    message.id === messageId
      ? {
          ...message,
          text: 'Mensaje eliminado',
          caption: '',
          fileName: '',
          hasMedia: false,
          type: 'text',
          mimeType: 'text/plain',
          contact: null,
          quotedMessage: null,
          deletedForEveryone: true,
        }
      : message
  ));

  session.messageCache.set(jid, nextMessages);
  return nextMessages.find((message) => message.id === messageId) || null;
};

const removeMessageForCurrentSession = (session, jid, messageId) => {
  const existingMessages = session.messageCache.get(jid) || [];
  const nextMessages = existingMessages.filter((message) => message.id !== messageId);
  session.messageCache.set(jid, nextMessages);
  session.rawMessageCache.delete(`${jid}::${messageId}`);
};

const cacheChatConfig = (session, chats = []) => {
  chats.forEach((chat) => {
    const jid = normalizeContactJid(session, chat?.id || chat?.jid || '');
    if (!jid || !isDirectChatJid(jid)) return;

    const hasEphemeralExpiration = Object.prototype.hasOwnProperty.call(chat || {}, 'ephemeralExpiration');
    const hasEphemeralTimestamp = Object.prototype.hasOwnProperty.call(chat || {}, 'ephemeralSettingTimestamp');
    if (!hasEphemeralExpiration && !hasEphemeralTimestamp) return;

    const existing = session.chatConfig.get(jid) || {};
    const next = { ...existing };

    if (hasEphemeralExpiration) {
      const ephemeralExpiration = normalizeEphemeralExpiration(chat?.ephemeralExpiration);
      if (ephemeralExpiration > 0) {
        next.ephemeralExpiration = ephemeralExpiration;
      } else {
        delete next.ephemeralExpiration;
      }
    }

    if (hasEphemeralTimestamp) {
      const ephemeralSettingTimestamp = Number(chat?.ephemeralSettingTimestamp || 0);
      if (Number.isFinite(ephemeralSettingTimestamp) && ephemeralSettingTimestamp > 0) {
        next.ephemeralSettingTimestamp = ephemeralSettingTimestamp;
      } else {
        delete next.ephemeralSettingTimestamp;
      }
    }

    if (Object.keys(next).length > 0) {
      session.chatConfig.set(jid, next);
    } else {
      session.chatConfig.delete(jid);
    }
  });
};

const resolveSendMessageOptions = (session, jid) => {
  const ephemeralExpiration = normalizeEphemeralExpiration(
    session.chatConfig.get(jid)?.ephemeralExpiration || session.defaultDisappearingMode,
  );
  return ephemeralExpiration > 0 ? { ephemeralExpiration } : {};
};

const emitChatEvent = (session, jid, eventName, payload) => {
  const subscribers = session.chatSubscribers.get(jid);
  if (!subscribers || subscribers.size === 0) return;

  const body = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const subscriber of Array.from(subscribers)) {
    try {
      subscriber.write(body);
    } catch {
      subscribers.delete(subscriber);
    }
  }

  if (subscribers.size === 0) {
    session.chatSubscribers.delete(jid);
  }
};

const cacheChatMessages = async (session, messages = [], { emit = false } = {}) => {
  for (const message of messages) {
    const protocolMessage = unwrapMessageContent(message?.message)?.protocolMessage;
    const protocolType = Number(protocolMessage?.type || 0);
    if (protocolMessage?.key?.id && protocolType === 0) {
      const revokedJid = normalizeContactJid(session, protocolMessage?.key?.remoteJid || message?.key?.remoteJid || '');
      if (revokedJid) {
        const updatedMessage = markMessageDeletedForEveryone(session, revokedJid, String(protocolMessage.key.id));
        if (updatedMessage && emit) {
          emitChatEvent(session, revokedJid, 'message', { message: updatedMessage });
        }
      }
      continue;
    }

    const serialized = serializeChatMessage(session, message);
    if (!serialized) continue;
    session.rawMessageCache.set(`${serialized.jid}::${serialized.id}`, message);

    const avatarUrl = await resolveContactAvatarUrl(session.socket, session, serialized.jid);
    const nextMessage = avatarUrl ? { ...serialized, avatarUrl } : serialized;

    const existing = session.messageCache.get(serialized.jid) || [];
    const next = [...existing];
    const existingIndex = next.findIndex((item) => item.id === serialized.id);

    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...nextMessage };
    } else {
      next.push(nextMessage);
      if (serialized.direction === 'in') {
        session.unreadCounts.set(serialized.jid, (session.unreadCounts.get(serialized.jid) || 0) + 1);
      }
    }

    next.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
    if (next.length > MAX_CACHED_CHAT_MESSAGES) {
      const removed = next.splice(0, next.length - MAX_CACHED_CHAT_MESSAGES);
      removed.forEach((item) => {
        session.rawMessageCache.delete(`${item.jid}::${item.id}`);
      });
    }

    session.messageCache.set(serialized.jid, next);
    await conversationService.persistChatMessage(session.workspaceId, nextMessage, {
      session,
      channelKey: session.phoneNumber || session.workspaceId,
    }).catch((error) => {
      console.error('[wa][service] persistChatMessage - failed:', error);
    });

    if (emit) {
      emitChatEvent(session, serialized.jid, 'message', { message: nextMessage });
    }
  }
};

const removeChatSubscriber = (session, jid, subscriber) => {
  const subscribers = session.chatSubscribers.get(jid);
  if (!subscribers) return;

  subscribers.delete(subscriber);
  if (subscribers.size === 0) {
    session.chatSubscribers.delete(jid);
  }
};

const buildChatListItems = async (session) => {
  const items = await Promise.all(
    Array.from(session.messageCache.entries()).map(async ([jid, messages]) => {
      const latestMessage = Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]
        : null;

      if (!latestMessage) return null;

      return {
        jid,
        phoneNumber: resolveFormattedPhoneCandidate(jid),
        name: latestMessage.pushName || session.lidNameMap.get(normalizeJid(jid)) || '',
        avatarUrl: await resolveContactAvatarUrl(session.socket, session, jid),
        lastMessageText: latestMessage.text || '',
        lastMessageTimestamp: latestMessage.timestamp || 0,
        lastMessageDirection: latestMessage.direction || 'in',
        unreadCount: session.unreadCounts.get(jid) || 0,
      };
    }),
  );

  return items
    .filter(Boolean)
    .sort((left, right) => (right.lastMessageTimestamp || 0) - (left.lastMessageTimestamp || 0));
};

const mergeChatLists = (liveItems = [], storedItems = []) => {
  const merged = new Map();

  for (const item of storedItems) {
    const key = String(item?.jid || item?.id || '').trim();
    if (!key) continue;
    merged.set(key, { ...item });
  }

  for (const item of liveItems) {
    const key = String(item?.jid || item?.id || '').trim();
    if (!key) continue;
    const existing = merged.get(key) || {};
    merged.set(key, {
      ...existing,
      ...item,
      jid: item.jid || existing.jid || key,
      id: existing.id || item.id || `wa:${item.jid || key}`,
      name: item.name || existing.name || '',
      phoneNumber: item.phoneNumber || existing.phoneNumber || '',
      avatarUrl: item.avatarUrl || existing.avatarUrl || '',
      lastMessageText: item.lastMessageText || existing.lastMessageText || '',
      lastMessageTimestamp: item.lastMessageTimestamp || existing.lastMessageTimestamp || 0,
      lastMessageDirection: item.lastMessageDirection || existing.lastMessageDirection || 'in',
      unreadCount: Number(item.unreadCount ?? existing.unreadCount ?? 0),
    });
  }

  return Array.from(merged.values()).sort((left, right) => (right.lastMessageTimestamp || 0) - (left.lastMessageTimestamp || 0));
};

const clearReconnectTimer = (session) => {
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
};

const releaseSocket = (session) => {
  clearReconnectTimer(session);
  session.socket = null;
};

const destroySocket = (session) => {
  clearReconnectTimer(session);
  const currentSocket = session.socket;
  session.socket = null;

  if (currentSocket?.ws && typeof currentSocket.ws.close === 'function') {
    try {
      currentSocket.ws.close();
    } catch {
      // ignore teardown errors
    }
  }
};

const markSessionError = (session, error, fallbackMessage) => {
  session.status = 'disconnected';
  session.qrCode = null;
  session.lastError = asErrorMessage(error, fallbackMessage);
};

const getDisconnectStatusCode = (lastDisconnect) =>
  Number(lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode || 0);

const parseDataUrl = (value = '') => {
  const raw = String(value || '');
  const match = raw.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/);
  if (!match) {
    const error = new Error('Archivo adjunto inválido.');
    error.status = 400;
    throw error;
  }

  const mimeType = String(match[1] || 'application/octet-stream').trim();
  const payload = match[3] || '';
  const buffer = Buffer.from(payload, 'base64');
  return { buffer, mimeType };
};

const buildMessageContentFromCachedMessage = async (connection, rawMessage, fallbackText = '') => {
  const content = unwrapMessageContent(rawMessage?.message);
  const descriptor = getMessageMediaDescriptor(content);
  const text = String(fallbackText || extractMessageText(content) || '').trim();

  if (descriptor.type === 'image' || descriptor.type === 'video' || descriptor.type === 'audio' || descriptor.type === 'sticker' || descriptor.type === 'document') {
    const { baileys } = await loadBaileys();
    const mediaBuffer = await baileys.downloadMediaMessage(
      rawMessage,
      'buffer',
      {},
      {
        logger: console,
        reuploadRequest: connection.socket.updateMediaMessage?.bind(connection.socket),
      },
    );

    if (descriptor.type === 'image') {
      return {
        image: mediaBuffer,
        mimetype: descriptor.mimeType,
        caption: text || descriptor.caption || '',
      };
    }

    if (descriptor.type === 'video') {
      return {
        video: mediaBuffer,
        mimetype: descriptor.mimeType,
        caption: text || descriptor.caption || '',
      };
    }

    if (descriptor.type === 'audio') {
      return {
        audio: mediaBuffer,
        mimetype: descriptor.mimeType,
        ptt: true,
      };
    }

    if (descriptor.type === 'sticker') {
      return {
        sticker: mediaBuffer,
      };
    }

    return {
      document: mediaBuffer,
      mimetype: descriptor.mimeType,
      fileName: descriptor.fileName || 'archivo',
      caption: text || descriptor.caption || '',
    };
  }

  if (descriptor.type === 'contact') {
    const contact = getMessageContactDescriptor(content);
    if (contact?.phoneNumber) {
      const digits = String(contact.phoneNumber || '').replace(/\D/g, '');
      const displayName = String(contact.displayName || digits).trim() || digits;
      const formattedNumber = String(contact.phoneNumber || '').trim() || `+${digits}`;
      const vcard = contact.vcard || [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${displayName}`,
        `TEL;type=CELL;type=VOICE;waid=${digits}:${formattedNumber}`,
        'END:VCARD',
      ].join('\n');

      return {
        contacts: {
          displayName,
          contacts: [{ displayName, vcard }],
        },
      };
    }
  }

  return { text };
};

const initializeWorkspaceSocket = async (workspaceId) => {
  const session = ensureSessionState(workspaceId);
  if (session.initPromise) {
    console.log('[wa][service] initializeWorkspaceSocket - reusing in-flight init for workspace:', workspaceId);
    return session.initPromise;
  }

  if (session.socket && (session.status === 'connecting' || session.status === 'open')) {
    console.log('[wa][service] initializeWorkspaceSocket - reusing existing socket for workspace:', workspaceId, 'status:', session.status);
    return session.socket;
  }

  session.initPromise = (async () => {
    console.log('[wa][service] initializeWorkspaceSocket - starting for workspace:', workspaceId);
    const {
      baileys: {
        default: makeWASocket,
        DisconnectReason,
        fetchLatestBaileysVersion,
        useMultiFileAuthState,
      },
      qrCodeLib,
    } = await loadBaileys();

    const { state, saveCreds } = await useMultiFileAuthState(session.authDir);
    const versionInfo = await fetchLatestBaileysVersion().catch(() => ({ version: DEFAULT_BAILEYS_VERSION }));

    session.status = 'connecting';
    session.lastError = null;
    session.saveCreds = saveCreds;
    session.manuallyDisconnected = false;
    session.historyBootstrapComplete = false;
    session.defaultDisappearingMode = normalizeEphemeralExpiration(
      state?.creds?.accountSettings?.defaultDisappearingMode?.ephemeralExpiration,
    );

    let socket;
    try {
      console.log('[wa][service] initializeWorkspaceSocket - creating socket');
      socket = makeWASocket({
        auth: state,
        browser: ['Giga BigData', 'Chrome', '1.0.0'],
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: true,
        version: versionInfo.version || DEFAULT_BAILEYS_VERSION,
      });
      console.log('[wa][service] initializeWorkspaceSocket - socket created');
    } catch (error) {
      console.error('[wa][service] initializeWorkspaceSocket - socket creation failed:', error);
      markSessionError(session, error, 'No se pudo crear la sesión de WhatsApp.');
      throw error;
    }

    session.socket = socket;

    socket.ev.on('creds.update', (credsUpdate) => {
      if (Object.prototype.hasOwnProperty.call(credsUpdate?.accountSettings?.defaultDisappearingMode || {}, 'ephemeralExpiration')) {
        session.defaultDisappearingMode = normalizeEphemeralExpiration(
          credsUpdate?.accountSettings?.defaultDisappearingMode?.ephemeralExpiration,
        );
      }
      Promise.resolve(saveCreds(credsUpdate)).catch((error) => {
        console.error('[wa][service] creds.update - save failed:', error);
        markSessionError(session, error, 'No se pudieron persistir las credenciales de WhatsApp.');
      });
    });

    socket.ev.on('chats.phoneNumberShare', (payload = {}) => {
      cacheParticipantIdentity(session, {
        lid: payload.lid,
        jid: payload.jid,
      });
    });

    socket.ev.on('contacts.upsert', (contacts = []) => {
      contacts.forEach((contact) => {
        cacheParticipantIdentity(session, {
          lid: contact.lid,
          jid: contact.jid || contact.id,
          name: contact.name,
        });
      });
    });

    socket.ev.on('messaging-history.set', (payload = {}) => {
      cacheChatConfig(session, payload.chats || []);
      const historyMessages = session.historyBootstrapComplete
        ? []
        : selectInitialHistoryMessages(session, payload.messages || []);

      session.historyBootstrapComplete = true;

      Promise.resolve(cacheChatMessages(session, historyMessages)).catch((error) => {
        console.error('[wa][service] messaging-history.set - cache failed:', error);
      });
    });

    socket.ev.on('chats.upsert', (chats = []) => {
      cacheChatConfig(session, chats);
    });

    socket.ev.on('chats.update', (updates = []) => {
      cacheChatConfig(session, updates);
    });

    socket.ev.on('messages.upsert', ({ messages = [] } = {}) => {
      Promise.resolve(cacheChatMessages(session, messages, { emit: true })).catch((error) => {
        console.error('[wa][service] messages.upsert - cache failed:', error);
      });
    });

    socket.ev.on('messages.update', (updates = []) => {
      updates.forEach((update) => {
        const jid = normalizeContactJid(session, update?.key?.remoteJid || update?.key?.participant || '');
        if (!jid) return;

        const existingMessages = session.messageCache.get(jid) || [];
        const nextMessages = existingMessages.map((message) => (
          message.id === update?.key?.id
            ? {
                ...message,
                status: String(update?.update?.status || message.status || '').toLowerCase(),
              }
            : message
        ));

        session.messageCache.set(jid, nextMessages);
        const updatedMessage = nextMessages.find((message) => message.id === update?.key?.id);
        if (updatedMessage) {
          emitChatEvent(session, jid, 'message', { message: updatedMessage });
        }
      });
    });

    socket.ev.on('connection.update', (update) => {
      Promise.resolve().then(async () => {
        const { connection, lastDisconnect, qr } = update;
        console.log('[wa][service] connection.update - event:', {
          workspaceId,
          connection,
          hasQr: Boolean(qr),
        });

        if (qr) {
          try {
            session.status = 'connecting';
            session.qrCode = await qrCodeLib.toDataURL(qr, {
              errorCorrectionLevel: 'M',
              margin: 1,
              scale: 10,
            });
            console.log('[wa][service] connection.update - QR generated');
          } catch (error) {
            console.error('[wa][service] connection.update - QR generation failed:', error);
            markSessionError(session, error, 'No se pudo generar el código QR de WhatsApp.');
            return;
          }
        }

        if (connection === 'open') {
          console.log('[wa][service] connection.update - connection opened');
          clearReconnectTimer(session);
          session.status = 'open';
          session.qrCode = null;
          session.lastError = null;
          session.profileName = socket.user?.name || '';
          session.phoneNumber = formatPhoneNumberFromJid(socket.user?.id);
          session.chatSubscribers.forEach((subscribers, jid) => {
            emitChatEvent(session, jid, 'status', { connection: serializeStatus(session) });
          });
          await conversationService.syncChannel(workspaceId, session, session.phoneNumber || workspaceId).catch((error) => {
            console.error('[wa][service] syncChannel(open) - failed:', error);
          });
        }

        if (connection === 'close') {
          const statusCode = getDisconnectStatusCode(lastDisconnect);
          const wasLoggedOut = statusCode === DisconnectReason.loggedOut;
          const shouldReconnect = !session.manuallyDisconnected && !wasLoggedOut;

          console.log('[wa][service] connection.update - connection closed', {
            workspaceId,
            statusCode,
            wasLoggedOut,
            shouldReconnect,
          });

          releaseSocket(session);
          session.qrCode = null;

          if (wasLoggedOut) {
            session.status = 'disconnected';
            session.profileName = '';
            session.phoneNumber = '';
            session.lastError = 'La sesión de WhatsApp cerró y requiere volver a vincularse.';
            session.chatSubscribers.forEach((subscribers, jid) => {
              emitChatEvent(session, jid, 'status', { connection: serializeStatus(session) });
            });
            await conversationService.syncChannel(workspaceId, session, workspaceId).catch((error) => {
              console.error('[wa][service] syncChannel(loggedOut) - failed:', error);
            });
            return;
          }

          if (shouldReconnect) {
            session.status = 'connecting';
            session.lastError = null;
            session.reconnectTimer = setTimeout(() => {
              session.reconnectTimer = null;
              initializeWorkspaceSocket(workspaceId).catch((error) => {
                console.error('[wa][service] reconnect - initialization failed:', error);
                markSessionError(session, error, 'No se pudo restablecer la conexión con WhatsApp.');
              });
            }, 1200);
            return;
          }

          session.status = 'disconnected';
          session.lastError = 'La conexión con WhatsApp se interrumpió.';
          session.chatSubscribers.forEach((subscribers, jid) => {
            emitChatEvent(session, jid, 'status', { connection: serializeStatus(session) });
          });
          await conversationService.syncChannel(workspaceId, session, session.phoneNumber || workspaceId).catch((error) => {
            console.error('[wa][service] syncChannel(close) - failed:', error);
          });
        }
      }).catch((error) => {
        console.error('[wa][service] connection.update - handler failed:', error);
        markSessionError(session, error, 'La inicialización de WhatsApp falló durante una actualización de conexión.');
      });
    });

    return socket;
  })()
    .catch((error) => {
      console.error('[wa][service] initializeWorkspaceSocket - initialization failed:', error);
      markSessionError(session, error, 'No se pudo inicializar WhatsApp.');
      throw error;
    })
    .finally(() => {
      session.initPromise = null;
    });

  return session.initPromise;
};

const ensureConnectedSocket = async (workspaceId) => {
  const session = ensureSessionState(workspaceId);

  if (session.status !== 'open' || !session.socket) {
    await initializeWorkspaceSocket(workspaceId);
  }

  if (session.status !== 'open' || !session.socket) {
    return {
      ok: false,
      status: 409,
      payload: {
        error: 'WhatsApp todavía no está conectado.',
        connection: serializeStatus(session),
      },
    };
  }

  return {
    ok: true,
    session,
    socket: session.socket,
  };
};

export const whatsappService = {
  async getQr(workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    const session = ensureSessionState(workspaceId);
    console.log('[wa][service] getQr - start for workspace:', workspaceId);
    try {
      await initializeWorkspaceSocket(workspaceId);
    } catch (error) {
      console.error('[wa][service] getQr - initialization error:', error);
      return {
        ...buildServiceErrorResponse(error, 'No se pudo inicializar la sesión de WhatsApp para generar el QR.'),
        payload: {
          ...buildServiceErrorResponse(error, 'No se pudo inicializar la sesión de WhatsApp para generar el QR.').payload,
          connection: serializeStatus(session),
        },
      };
    }

    for (let attempt = 0; attempt < QR_WAIT_ATTEMPTS; attempt += 1) {
      if (session.qrCode || session.status === 'open' || session.status === 'disconnected') {
        break;
      }
      await sleep(QR_WAIT_MS);
    }

    console.log('[wa][service] getQr - returning connection snapshot:', {
      workspaceId,
      status: session.status,
      hasQr: Boolean(session.qrCode),
      lastError: session.lastError,
    });
    return {
      status: 200,
      payload: {
        connection: serializeStatus(session),
      },
    };
  },

  async getStatus(workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    const session = ensureSessionState(workspaceId);
    return {
      status: 200,
      payload: {
        connection: serializeStatus(session),
      },
    };
  },

  async listGroups(workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para listar grupos.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    try {
      const groupsMap = await connection.socket.groupFetchAllParticipating();
      const items = Object.values(groupsMap || {})
        .filter((group) => isGroupJid(group?.id))
        .map((group) => ({
          id: group.id,
          name: group.subject || 'Grupo sin nombre',
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));

      return {
        status: 200,
        payload: {
          items,
          connection: serializeStatus(connection.session),
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudieron obtener los grupos de WhatsApp.');
    }
  },

  async listGroupParticipants(workspaceId, groupId) {
    if (!workspaceId || !groupId) {
      return { status: 400, payload: { error: 'workspaceId y groupId son obligatorios.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para consultar participantes.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    try {
      const session = connection.session;
      const metadata = await connection.socket.groupMetadata(groupId);
      const avatarUrl = await resolveGroupAvatarUrl(connection.socket, metadata?.id || groupId);
      const items = (metadata?.participants || []).map((participant) => ({
        jid: participant.id,
        name: extractParticipantName(participant) || session.lidNameMap.get(normalizeJid(participant.id)) || session.lidNameMap.get(normalizeJid(participant.lid)) || '',
        phoneNumber: resolveParticipantPhoneNumber({
          ...participant,
          phoneNumber: participant.phoneNumber || session.lidPhoneMap.get(normalizeJid(participant.id)) || session.lidPhoneMap.get(normalizeJid(participant.lid)) || '',
        }),
        isAdmin: Boolean(participant.admin),
        adminRole: participant.admin || null,
      }));

      return {
        status: 200,
        payload: {
          group: {
            id: metadata?.id || groupId,
            name: metadata?.subject || 'Grupo sin nombre',
            avatarUrl,
          },
          items,
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudieron obtener los participantes del grupo.');
    }
  },

  async listChats(workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    const session = ensureSessionState(workspaceId);
    const storedItems = await conversationService.listConversations(workspaceId).catch((error) => {
      console.error('[wa][service] listChats - stored fallback failed:', error);
      return [];
    });
    try {
      await initializeWorkspaceSocket(workspaceId);
    } catch (error) {
      return {
        status: 200,
        payload: {
          items: storedItems,
          connection: serializeStatus(session),
          warning: asErrorMessage(error, 'No se pudo abrir la sesión de WhatsApp para listar chats en tiempo real.'),
        },
      };
    }

    const liveItems = await buildChatListItems(session);
    return {
      status: 200,
      payload: {
        items: mergeChatLists(liveItems, storedItems),
        connection: serializeStatus(session),
      },
    };
  },

  async getChatMessages(workspaceId, contactId) {
    if (!workspaceId || !contactId) {
      return { status: 400, payload: { error: 'workspaceId y contactId son obligatorios.' } };
    }

    const storedItems = await conversationService.getConversationMessages(workspaceId, contactId).catch((error) => {
      console.error('[wa][service] getChatMessages - stored fallback failed:', error);
      return [];
    });
    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return {
        status: 200,
        payload: {
          jid: contactId,
          items: storedItems,
          connection: serializeStatus(ensureSessionState(workspaceId)),
          warning: asErrorMessage(error, 'No se pudo abrir la sesión de WhatsApp para consultar mensajes en tiempo real.'),
        },
      };
    }
    if (!connection.ok) {
      return {
        status: 200,
        payload: {
          jid: contactId,
          items: storedItems,
          connection: connection.payload.connection,
          warning: connection.payload.error,
        },
      };
    }

    const jid = normalizeContactJid(connection.session, contactId);
    if (!jid) {
      return { status: 400, payload: { error: 'El contacto seleccionado no tiene un número válido para WhatsApp.' } };
    }

    connection.session.unreadCounts.set(jid, 0);

    return {
      status: 200,
      payload: {
        jid,
        items: (connection.session.messageCache.get(jid) || []).length > 0
          ? connection.session.messageCache.get(jid) || []
          : storedItems,
        connection: serializeStatus(connection.session),
      },
    };
  },

  async getChatMedia(workspaceId, contactId, messageId) {
    if (!workspaceId || !contactId || !messageId) {
      return { status: 400, payload: { error: 'workspaceId, contactId y messageId son obligatorios.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para descargar el adjunto.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    const jid = normalizeContactJid(connection.session, contactId);
    if (!jid) {
      return { status: 400, payload: { error: 'El contacto seleccionado no tiene un número válido para WhatsApp.' } };
    }

    const rawMessage = connection.session.rawMessageCache.get(`${jid}::${String(messageId || '').trim()}`);
    if (!rawMessage) {
      return { status: 404, payload: { error: 'No se encontró el adjunto solicitado.' } };
    }

    const descriptor = getMessageMediaDescriptor(rawMessage?.message);
    if (descriptor.type === 'text') {
      return { status: 400, payload: { error: 'El mensaje solicitado no contiene un archivo multimedia.' } };
    }

    try {
      const { baileys } = await loadBaileys();
      const mediaBuffer = await baileys.downloadMediaMessage(
        rawMessage,
        'buffer',
        {},
        {
          logger: console,
          reuploadRequest: connection.socket.updateMediaMessage?.bind(connection.socket),
        },
      );

      return {
        status: 200,
        payload: {
          buffer: mediaBuffer,
          mimeType: descriptor.mimeType || 'application/octet-stream',
          fileName: descriptor.fileName || `${messageId}.${descriptor.mimeType?.split('/')[1] || 'bin'}`,
          disposition: descriptor.type === 'document' ? 'attachment' : 'inline',
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo descargar el archivo multimedia de WhatsApp.');
    }
  },

  async sendChatMessage(workspaceId, contactId, payload = {}) {
    if (!workspaceId || !contactId) {
      return { status: 400, payload: { error: 'workspaceId y contactId son obligatorios.' } };
    }

    const text = String(payload.text || '').trim();
    const mediaPayload = payload.media && typeof payload.media === 'object' ? payload.media : null;
    const contactPayload = payload.contact && typeof payload.contact === 'object' ? payload.contact : null;
    const replyToMessageId = String(payload.replyToMessageId || '').trim();
    if (!text && !mediaPayload?.dataUrl && !contactPayload?.phoneNumber) {
      return { status: 400, payload: { error: 'El mensaje no puede estar vacío.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para enviar el mensaje.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    const jid = normalizeContactJid(connection.session, contactId);
    if (!jid) {
      return { status: 400, payload: { error: 'El contacto seleccionado no tiene un número válido para WhatsApp.' } };
    }

    try {
      const quotedMessage = replyToMessageId
        ? connection.session.rawMessageCache.get(`${jid}::${replyToMessageId}`) || null
        : null;
      let messageContent;
      if (contactPayload?.phoneNumber) {
        const digits = String(contactPayload.phoneNumber || '').replace(/\D/g, '');
        if (!digits) {
          return { status: 400, payload: { error: 'El contacto seleccionado no tiene un número válido.' } };
        }

        const displayName = String(contactPayload.displayName || contactPayload.name || '').trim() || digits;
        const formattedNumber = String(contactPayload.phoneNumber || '').trim() || `+${digits}`;
        const organization = String(contactPayload.organization || 'BigData CRM').trim();
        const vcard = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${displayName}`,
          `ORG:${organization};`,
          `TEL;type=CELL;type=VOICE;waid=${digits}:${formattedNumber}`,
          'END:VCARD',
        ].join('\n');

        messageContent = {
          contacts: {
            displayName,
            contacts: [{ displayName, vcard }],
          },
        };
      } else if (mediaPayload?.dataUrl) {
        const { buffer, mimeType } = parseDataUrl(mediaPayload.dataUrl);
        const requestedType = String(mediaPayload.type || '').trim().toLowerCase();
        const resolvedType = requestedType || (
          mimeType.startsWith('image/')
            ? (mimeType === 'image/webp' ? 'sticker' : 'image')
            : mimeType.startsWith('video/')
              ? 'video'
              : mimeType.startsWith('audio/')
                ? 'audio'
                : 'document'
        );

        if (resolvedType === 'image') {
          messageContent = {
            image: buffer,
            mimetype: mimeType,
            caption: text || String(mediaPayload.caption || '').trim(),
          };
        } else if (resolvedType === 'video') {
          messageContent = {
            video: buffer,
            mimetype: mimeType,
            caption: text || String(mediaPayload.caption || '').trim(),
          };
        } else if (resolvedType === 'audio') {
          messageContent = {
            audio: buffer,
            mimetype: mimeType,
            ptt: Boolean(mediaPayload.ptt),
          };
        } else if (resolvedType === 'sticker') {
          messageContent = {
            sticker: buffer,
          };
        } else {
          messageContent = {
            document: buffer,
            mimetype: mimeType,
            fileName: String(mediaPayload.fileName || 'archivo').trim() || 'archivo',
            caption: text || String(mediaPayload.caption || '').trim(),
          };
        }
      } else {
        messageContent = { text };
      }

      const sentMessage = await connection.socket.sendMessage(
        jid,
        messageContent,
        {
          ...resolveSendMessageOptions(connection.session, jid),
          ...(quotedMessage ? { quoted: quotedMessage } : {}),
        },
      );
      await cacheChatMessages(connection.session, sentMessage ? [sentMessage] : [], { emit: true });

      const items = connection.session.messageCache.get(jid) || [];
      return {
        status: 200,
        payload: {
          ok: true,
          jid,
          message: items[items.length - 1] || null,
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo enviar el mensaje de WhatsApp.');
    }
  },

  async forwardChatMessage(workspaceId, sourceContactId, messageId, payload = {}) {
    if (!workspaceId || !sourceContactId || !messageId) {
      return { status: 400, payload: { error: 'workspaceId, contactId y messageId son obligatorios.' } };
    }

    const targetContactIds = Array.isArray(payload.targetContactIds) ? payload.targetContactIds : [];
    if (targetContactIds.length === 0) {
      return { status: 400, payload: { error: 'Debes seleccionar al menos un contacto para reenviar.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para reenviar el mensaje.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    const sourceJid = normalizeContactJid(connection.session, sourceContactId);
    if (!sourceJid) {
      return { status: 400, payload: { error: 'El chat origen no tiene un número válido para WhatsApp.' } };
    }

    const rawMessage = connection.session.rawMessageCache.get(`${sourceJid}::${String(messageId).trim()}`);
    if (!rawMessage) {
      return { status: 404, payload: { error: 'No se encontró el mensaje que quieres reenviar.' } };
    }

    try {
      const results = [];
      for (const targetContactId of targetContactIds) {
        const targetJid = normalizeContactJid(connection.session, targetContactId);
        if (!targetJid) continue;

        const messageContent = await buildMessageContentFromCachedMessage(connection, rawMessage);
        const sentMessage = await connection.socket.sendMessage(
          targetJid,
          messageContent,
          resolveSendMessageOptions(connection.session, targetJid),
        );
        await cacheChatMessages(connection.session, sentMessage ? [sentMessage] : [], { emit: true });
        const items = connection.session.messageCache.get(targetJid) || [];
        results.push({
          jid: targetJid,
          message: items[items.length - 1] || null,
        });
      }

      return {
        status: 200,
        payload: {
          ok: true,
          items: results,
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo reenviar el mensaje de WhatsApp.');
    }
  },

  async deleteChatMessage(workspaceId, contactId, messageId, payload = {}) {
    if (!workspaceId || !contactId || !messageId) {
      return { status: 400, payload: { error: 'workspaceId, contactId y messageId son obligatorios.' } };
    }

    const deleteForEveryone = Boolean(payload.deleteForEveryone);

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para borrar el mensaje.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    const jid = normalizeContactJid(connection.session, contactId);
    if (!jid) {
      return { status: 400, payload: { error: 'El chat seleccionado no tiene un número válido para WhatsApp.' } };
    }

    const messageKey = `${jid}::${String(messageId).trim()}`;
    const rawMessage = connection.session.rawMessageCache.get(messageKey);
    if (!rawMessage) {
      return { status: 404, payload: { error: 'No se encontró el mensaje seleccionado.' } };
    }

    if (!deleteForEveryone) {
      removeMessageForCurrentSession(connection.session, jid, String(messageId).trim());
      emitChatEvent(connection.session, jid, 'message_deleted', { messageId: String(messageId).trim(), mode: 'me' });
      return {
        status: 200,
        payload: {
          ok: true,
          messageId: String(messageId).trim(),
          mode: 'me',
        },
      };
    }

    if (!rawMessage?.key?.fromMe) {
      return { status: 409, payload: { error: 'Solo puedes borrar para todos mensajes enviados desde este WhatsApp.' } };
    }

    try {
      await connection.socket.sendMessage(jid, { delete: rawMessage.key });
      const updatedMessage = markMessageDeletedForEveryone(connection.session, jid, String(messageId).trim());
      if (updatedMessage) {
        emitChatEvent(connection.session, jid, 'message', { message: updatedMessage });
      }
      return {
        status: 200,
        payload: {
          ok: true,
          message: updatedMessage,
          mode: 'everyone',
        },
      };
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo borrar el mensaje para todos.');
    }
  },

  async subscribeToChat(workspaceId, contactId, subscriber) {
    if (!workspaceId || !contactId || !subscriber) {
      return { status: 400, payload: { error: 'workspaceId, contactId y subscriber son obligatorios.' } };
    }

    let connection;
    try {
      connection = await ensureConnectedSocket(workspaceId);
    } catch (error) {
      return buildServiceErrorResponse(error, 'No se pudo abrir la sesión de WhatsApp para escuchar mensajes.');
    }
    if (!connection.ok) {
      return { status: connection.status, payload: connection.payload };
    }

    const jid = normalizeContactJid(connection.session, contactId);
    if (!jid) {
      return { status: 400, payload: { error: 'El contacto seleccionado no tiene un número válido para WhatsApp.' } };
    }

    const subscribers = connection.session.chatSubscribers.get(jid) || new Set();
    subscribers.add(subscriber);
    connection.session.chatSubscribers.set(jid, subscribers);

    return {
      status: 200,
      payload: {
        jid,
        connection: serializeStatus(connection.session),
      },
      unsubscribe: () => {
        removeChatSubscriber(connection.session, jid, subscriber);
      },
    };
  },

  async disconnect(workspaceId) {
    if (!workspaceId) {
      return { status: 400, payload: { error: 'workspaceId es obligatorio.' } };
    }

    const session = ensureSessionState(workspaceId);
    session.manuallyDisconnected = true;
    destroySocket(session);
    session.status = 'disconnected';
    session.qrCode = null;
    session.profileName = '';
    session.phoneNumber = '';
    session.lastError = null;
    session.chatSubscribers.forEach((subscribers, jid) => {
      emitChatEvent(session, jid, 'status', { connection: serializeStatus(session) });
      subscribers.forEach((subscriber) => {
        try {
          subscriber.end();
        } catch {
          // ignore teardown errors
        }
      });
    });
    session.chatSubscribers.clear();

    await rm(session.authDir, { recursive: true, force: true }).catch(() => {});

    return {
      status: 200,
      payload: {
        ok: true,
        connection: serializeStatus(session),
      },
    };
  },
};
