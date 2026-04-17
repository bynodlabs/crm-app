import { rm } from 'node:fs/promises';
import path from 'node:path';

const WA_SESSION_ROOT = path.resolve(process.cwd(), 'server', '.wa-sessions');
const DEFAULT_BAILEYS_VERSION = [2, 3000, 1015901307];
const QR_WAIT_ATTEMPTS = 20;
const QR_WAIT_MS = 250;

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
      lidPhoneMap: new Map(),
      lidNameMap: new Map(),
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

    let socket;
    try {
      console.log('[wa][service] initializeWorkspaceSocket - creating socket');
      socket = makeWASocket({
        auth: state,
        browser: ['CRM NEW 2026', 'Chrome', '1.0.0'],
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
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
