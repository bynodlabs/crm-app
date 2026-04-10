import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const nowIso = () => new Date().toISOString();

export const createUserCode = (nombre = 'USR') => {
  const prefix = nombre.slice(0, 3).toUpperCase().padEnd(3, 'X');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${suffix}`;
};

export const createRecordId = () => `R-${randomUUID().slice(0, 8).toUpperCase()}`;

export const createSessionToken = () => randomUUID();

export const createWorkspaceId = (seed = randomUUID().slice(0, 8).toUpperCase()) => `WS-${seed}`;

export const createUniqueUserId = (existingIds = []) => {
  const taken = new Set(existingIds.map((value) => String(value || '').trim()).filter(Boolean));
  let nextNumber = 1;

  taken.forEach((value) => {
    const match = /^U(\d+)$/.exec(value);
    if (!match) return;
    nextNumber = Math.max(nextNumber, Number.parseInt(match[1], 10) + 1);
  });

  let candidate = `U${nextNumber}`;
  while (taken.has(candidate)) {
    nextNumber += 1;
    candidate = `U${nextNumber}`;
  }

  return candidate;
};

export const createUniqueWorkspaceId = (existingWorkspaceIds = [], preferredSeed = '') => {
  const taken = new Set(existingWorkspaceIds.map((value) => String(value || '').trim()).filter(Boolean));

  const seedBase = String(preferredSeed || '')
    .trim()
    .replace(/^WS-/, '')
    .replace(/[^A-Z0-9-]/gi, '')
    .slice(0, 12)
    .toUpperCase();

  const buildCandidate = () => {
    if (!seedBase) {
      return createWorkspaceId();
    }

    return createWorkspaceId(`${seedBase}-${randomUUID().slice(0, 4).toUpperCase()}`);
  };

  let candidate = buildCandidate();
  while (taken.has(candidate)) {
    candidate = buildCandidate();
  }

  return candidate;
};

export const createUniqueUserCode = (nombre = 'USR', existingCodes = []) => {
  const taken = new Set(existingCodes.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean));
  let candidate = createUserCode(nombre);

  while (taken.has(candidate)) {
    candidate = createUserCode(nombre);
  }

  return candidate;
};

export const sanitizeUser = (user) => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

export const normalizePhone = (value = '') => value.replace(/\D/g, '');

export const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildRecordIdentity = (record = {}) => {
  const phone = normalizePhone(record.numero || record.telefono || record.phone || '');
  if (phone.length >= 8) return `phone:${phone}`;

  const email = normalizeEmail(record.correo || record.email || '');
  if (email) return `email:${email}`;

  const name = normalizeText(record.nombre || record.full_name || record.username || '');
  const sector = String(record.sector || '').trim().toUpperCase();
  const country = String(record.pais || record.country || '').trim().toUpperCase();

  if (name && sector) return `name:${name}|sector:${sector}`;
  if (name && country) return `name:${name}|country:${country}`;
  if (name) return `name:${name}`;

  return null;
};

export const isPasswordHashed = (value = '') => String(value || '').startsWith('scrypt$');

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

export const verifyPassword = (password, storedHash) => {
  if (!storedHash) return false;

  if (!isPasswordHashed(storedHash)) {
    return String(password) === String(storedHash);
  }

  const [, salt, hash] = String(storedHash).split('$');
  if (!salt || !hash) return false;

  const derived = scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, 'hex');

  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
};
