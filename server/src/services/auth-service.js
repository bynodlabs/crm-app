import { readDb, writeDb } from '../db.js';
import { config } from '../config.js';
import { createSessionToken, createUniqueUserCode, createUniqueUserId, createUniqueWorkspaceId, hashPassword, normalizeEmail, nowIso, sanitizeUser, verifyPassword } from '../utils.js';

const ADMIN_USER_ID = 'ADMIN_CLEAN';
const RESERVED_USER_IDS = ['U1', ADMIN_USER_ID];
const RESERVED_WORKSPACE_IDS = ['WS-U1'];
const RESERVED_USER_CODES = ['ANA-9X2'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeReferralCode = (value = '') => String(value || '').trim().toUpperCase();
const isValidEmail = (value = '') => EMAIL_REGEX.test(String(value || '').trim());

const isSessionExpired = (session) => {
  const createdAt = new Date(session.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return true;
  return Date.now() - createdAt > config.sessionTtlMs;
};

const buildAdminUser = (profile = {}) => ({
  id: ADMIN_USER_ID,
  nombre: String(profile.nombre || 'Admin Maestro').trim() || 'Admin Maestro',
  email: config.adminEmail,
  codigoPropio: 'ANA-9X2',
  workspaceId: 'WS-U1',
  rol: 'admin',
  avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl.trim() : '',
});

const createSession = (userId, role = 'user', extra = {}) => ({
  token: createSessionToken(),
  userId,
  role,
  createdAt: nowIso(),
  ...extra,
});

export const authService = {
  async login({ email, password }) {
    const db = await readDb();
    const normalizedEmail = normalizeEmail(email);
    const safePassword = String(password || '');

    if (!normalizedEmail || !safePassword) {
      return { status: 400, payload: { error: 'Email y contraseña son obligatorios.' } };
    }

    db.sessions = (db.sessions || []).filter((session) => !isSessionExpired(session));

    if (normalizedEmail === normalizeEmail(config.adminEmail) && safePassword === String(config.adminPassword)) {
      const session = createSession(ADMIN_USER_ID, 'admin');

      db.sessions.unshift(session);
      await writeDb(db);

      return {
        status: 200,
        payload: {
          session,
          user: buildAdminUser(db.adminProfile),
        },
      };
    }

    const user = db.users.find((candidate) => normalizeEmail(candidate.email) === normalizedEmail);
    if (!user || !verifyPassword(safePassword, user.password)) {
      return { status: 401, payload: { error: 'Credenciales incorrectas' } };
    }

    const session = createSession(user.id, 'user');

    db.sessions.unshift(session);
    await writeDb(db);

    return {
      status: 200,
      payload: { session, user: { ...sanitizeUser(user), rol: 'socio' } },
    };
  },

  async getSessionUser(token) {
    if (!token) {
      return { status: 401, payload: { error: 'Sesión no autenticada.' } };
    }

    const db = await readDb();
    const previousSessionCount = (db.sessions || []).length;
    db.sessions = (db.sessions || []).filter((session) => !isSessionExpired(session));
    const session = db.sessions.find((candidate) => candidate.token === token);

    if (db.sessions.length !== previousSessionCount) {
      await writeDb(db);
    }

    if (!session) {
      return { status: 401, payload: { error: 'Sesión inválida o expirada.' } };
    }

    if (session.userId === ADMIN_USER_ID) {
      return {
        status: 200,
        payload: {
          session,
          user: buildAdminUser(db.adminProfile),
        },
      };
    }

    const user = db.users.find((candidate) => candidate.id === session.userId);
    if (!user) {
      return { status: 404, payload: { error: 'Usuario de sesión no encontrado.' } };
    }

    return {
      status: 200,
      payload: {
        session,
        user: { ...sanitizeUser(user), rol: session.role || 'socio' },
      },
    };
  },

  async logout(token) {
    if (!token) {
      return { status: 204, payload: { ok: true } };
    }

    const db = await readDb();
    db.sessions = db.sessions.filter((candidate) => candidate.token !== token);
    await writeDb(db);

    return { status: 200, payload: { ok: true } };
  },

  async impersonate(currentUser, targetUserId) {
    if (!currentUser || currentUser.rol !== 'admin') {
      return { status: 403, payload: { error: 'Solo el administrador puede usar modo observador.' } };
    }

    if (!targetUserId) {
      return { status: 400, payload: { error: 'targetUserId es obligatorio.' } };
    }

    const db = await readDb();
    db.sessions = (db.sessions || []).filter((session) => !isSessionExpired(session));

    const targetUser = db.users.find((candidate) => candidate.id === targetUserId);
    if (!targetUser) {
      return { status: 404, payload: { error: 'Usuario objetivo no encontrado.' } };
    }

    const session = createSession(targetUser.id, 'user', {
      impersonatedBy: ADMIN_USER_ID,
    });

    db.sessions.unshift(session);
    await writeDb(db);

    return {
      status: 200,
      payload: {
        session,
        user: { ...sanitizeUser(targetUser), rol: 'socio' },
      },
    };
  },

  async register({ nombre, email, password, referidoPor = null }) {
    const db = await readDb();
    const normalizedEmail = normalizeEmail(email);
    const safeName = String(nombre || '').trim();
    const safePassword = String(password || '');
    const safeReferralCode = normalizeReferralCode(referidoPor);

    if (safeName.length < 2 || safeName.length > 60 || !isValidEmail(normalizedEmail) || safePassword.length < 6) {
      return { status: 400, payload: { error: 'Nombre, email válido y contraseña de al menos 6 caracteres son obligatorios.' } };
    }

    if (normalizedEmail === normalizeEmail(config.adminEmail)) {
      return { status: 409, payload: { error: 'Ese correo está reservado para administración.' } };
    }

    if (db.users.some((candidate) => normalizeEmail(candidate.email) === normalizedEmail)) {
      return { status: 409, payload: { error: 'El correo ya está registrado.' } };
    }

    if (safeReferralCode) {
      const referralExists = safeReferralCode === 'ANA-9X2' || db.users.some(
        (candidate) => String(candidate.codigoPropio || '').trim().toUpperCase() === safeReferralCode,
      );

      if (!referralExists) {
        return { status: 400, payload: { error: 'El código de equipo no existe.' } };
      }
    }

    const nextUserId = createUniqueUserId([...db.users.map((candidate) => candidate.id), ...RESERVED_USER_IDS]);
    const nextWorkspaceId = createUniqueWorkspaceId([...db.users.map((candidate) => candidate.workspaceId), ...RESERVED_WORKSPACE_IDS], nextUserId);
    const nextCodigoPropio = createUniqueUserCode(safeName, [...db.users.map((candidate) => candidate.codigoPropio), ...RESERVED_USER_CODES]);

    const user = {
      id: nextUserId,
      nombre: safeName,
      email: normalizedEmail,
      password: hashPassword(safePassword),
      codigoPropio: nextCodigoPropio,
      referidoPor: safeReferralCode || null,
      fechaRegistro: nowIso().slice(0, 10),
      workspaceId: nextWorkspaceId,
      role: 'socio',
    };

    db.users.push(user);
    const session = createSession(user.id, 'socio');
    db.sessions.unshift(session);
    await writeDb(db);

    return {
      status: 201,
      payload: { session, user: { ...sanitizeUser(user), rol: 'socio' } },
    };
  },
};
