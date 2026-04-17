import { randomUUID } from 'node:crypto';
import { parse } from 'node:url';
import { config } from './config.js';
import { readJsonBody, sendJson } from './http.js';
import { clearRateLimit, consumeRateLimit } from './rate-limit.js';
import { authService } from './services/auth-service.js';
import { recordService } from './services/record-service.js';
import { sectorService } from './services/sector-service.js';
import { sharedLinkService } from './services/shared-link-service.js';
import { userService } from './services/user-service.js';
import { whatsappService } from './services/whatsapp-service.js';

const withCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
};

const getSessionToken = (req) => req.headers['x-session-token'];

const getAuthenticatedUser = async (req, res) => {
  const result = await authService.getSessionUser(getSessionToken(req));
  if (result.status !== 200) {
    sendJson(res, result.status, result.payload);
    return null;
  }

  return result.payload.user;
};

export async function handleRequest(req, res) {
  withCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = parse(req.url, true);
  const pathname = url.pathname || '/';
  const requestId = randomUUID();

  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, requestId, service: 'crm-api' });
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const rate = consumeRateLimit(req, 'auth-login');
    if (!rate.allowed) {
      sendJson(res, 429, { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' });
      return;
    }
    const body = await readJsonBody(req);
    const result = await authService.login(body);
    if (result.status === 200) {
      clearRateLimit(req, 'auth-login');
    }
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const rate = consumeRateLimit(req, 'auth-register');
    if (!rate.allowed) {
      sendJson(res, 429, { error: 'Demasiados intentos de registro. Intenta más tarde.' });
      return;
    }
    const body = await readJsonBody(req);
    const result = await authService.register(body);
    if (result.status === 201) {
      clearRateLimit(req, 'auth-register');
    }
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const result = await authService.getSessionUser(getSessionToken(req));
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    const result = await authService.logout(getSessionToken(req));
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/auth/impersonate' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await authService.impersonate(authUser, body?.targetUserId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/users' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const users = await userService.listUsers(authUser);
    sendJson(res, 200, { items: users });
    return;
  }

  if (pathname === '/api/wa/qr' && req.method === 'GET') {
    console.log('[wa][route] GET /api/wa/qr - request received');
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    console.log('[wa][route] GET /api/wa/qr - authenticated workspace:', authUser.workspaceId);
    const result = await whatsappService.getQr(authUser.workspaceId);
    console.log('[wa][route] GET /api/wa/qr - responding with status:', result.status);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/wa/status' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await whatsappService.getStatus(authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/wa/groups' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await whatsappService.listGroups(authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/wa/disconnect' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await whatsappService.disconnect(authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/sectors' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const includeInactive = String(url.query?.includeInactive || '').toLowerCase() === 'true';
    const result = await sectorService.listSectors(authUser.workspaceId, { includeInactive });
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/sectors' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await sectorService.createSector(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/shared-links' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const links = await sharedLinkService.listSharedLinks(authUser.workspaceId);
    sendJson(res, 200, { items: links });
    return;
  }

  if (pathname === '/api/shared-links' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await sharedLinkService.createSharedLink(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/users/password' && req.method === 'PATCH') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await userService.updatePassword({ ...body, currentUser: authUser });
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/users/profile' && req.method === 'PATCH') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await userService.updateProfile({ ...body, currentUser: authUser });
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/users/team-overview' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await userService.teamOverview(authUser);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    if (authUser.rol !== 'admin') {
      sendJson(res, 403, { error: 'Solo el administrador puede ver el panel global.' });
      return;
    }

    const fetchAllAdminRecords = async () => {
      const limit = 250;
      let page = 1;
      let allItems = [];
      let hasMore = true;

      while (hasMore) {
        const result = await recordService.listRecords({ ...url.query, page, limit }, null);
        const items = Array.isArray(result.items) ? result.items : [];
        allItems = [...allItems, ...items];
        hasMore = Boolean(result.hasMore);
        page += 1;
      }

      return {
        items: allItems,
        total: allItems.length,
      };
    };

    const [users, recordsResult, duplicates, links] = await Promise.all([
      userService.listUsers(authUser),
      fetchAllAdminRecords(),
      recordService.listDuplicateRecords(null),
      sharedLinkService.listSharedLinks(null),
    ]);

    const normalizedName = (value = '') => String(value || '').trim().toLowerCase();
    const recordsByUser = new Map();

    for (const user of users) {
      recordsByUser.set(user.id, new Set());
    }

    for (const record of recordsResult.items || []) {
      const ownerId = String(record.propietarioId || '').trim();
      const workspaceId = String(record.workspaceId || '').trim();
      const responsibleName = normalizedName(record.responsable);

      users.forEach((user) => {
        const matchesUser =
          (ownerId && ownerId === user.id) ||
          (workspaceId && workspaceId === user.workspaceId) ||
          (responsibleName && responsibleName === normalizedName(user.nombre));

        if (!matchesUser) return;
        recordsByUser.get(user.id)?.add(record.id);
      });
    }

    const workspaceLeadCounts = Object.fromEntries(
      users.map((user) => [
        user.id,
        {
          workspaceId: user.workspaceId,
          leadsWorkspace: recordsByUser.get(user.id)?.size || 0,
        },
      ]),
    );

    sendJson(res, 200, {
      users,
      records: recordsResult.items || [],
      recordsTotal: recordsResult.total || 0,
      duplicates,
      sharedLinks: links,
      workspaceLeadCounts,
    });
    return;
  }

  if (pathname === '/api/records' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const recordsResult = await recordService.listRecords(url.query, authUser.workspaceId);
    sendJson(res, 200, recordsResult);
    return;
  }

  if (pathname === '/api/duplicates' && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const duplicates = await recordService.listDuplicateRecords(authUser.workspaceId);
    sendJson(res, 200, { items: duplicates });
    return;
  }

  if (pathname === '/api/duplicates/bulk' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.bulkStoreDuplicateRecords(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.createRecord(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records' && req.method === 'DELETE') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.deleteRecords(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records/bulk' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.bulkCreateRecords(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records/bulk-status' && req.method === 'PATCH') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.bulkChangeStatus(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records/share' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.shareRecordsToUser(body, authUser);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/records/clean-duplicates' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await recordService.cleanDuplicates(authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/duplicates/restore' && req.method === 'POST') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.restoreDuplicateRecords(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  if (pathname === '/api/duplicates' && req.method === 'DELETE') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.deleteDuplicateRecords(body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  const recordMatch = pathname.match(/^\/api\/records\/([^/]+)$/);
  if (recordMatch && req.method === 'PATCH') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const body = await readJsonBody(req);
    const result = await recordService.updateRecord(recordMatch[1], body, authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  const sectorMatch = pathname.match(/^\/api\/sectors\/([^/]+)$/);
  if (sectorMatch && req.method === 'DELETE') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await sectorService.deleteSector(sectorMatch[1], authUser.workspaceId);
    sendJson(res, result.status, result.payload);
    return;
  }

  const waGroupParticipantsMatch = pathname.match(/^\/api\/wa\/groups\/([^/]+)\/participants$/);
  if (waGroupParticipantsMatch && req.method === 'GET') {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;
    const result = await whatsappService.listGroupParticipants(
      authUser.workspaceId,
      decodeURIComponent(waGroupParticipantsMatch[1]),
    );
    sendJson(res, result.status, result.payload);
    return;
  }

  sendJson(res, 404, { error: 'Route not found', path: pathname });
}
