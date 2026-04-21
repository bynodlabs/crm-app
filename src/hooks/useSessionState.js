import { INITIAL_USERS, STORAGE_KEYS } from '../lib/constants';
import { getLocalISODate } from '../lib/date';
import { api, setApiSessionToken } from '../lib/api';
import { writeStorage } from '../lib/storage';
import { useCallback, useEffect } from 'react';
import { usePersistentState } from './usePersistentState';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_USER_IDS = ['U1', 'ADMIN_CLEAN'];
const RESERVED_WORKSPACE_IDS = ['WS-U1'];
const RESERVED_USER_CODES = ['ANA-9X2'];

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const normalizeReferralCode = (value = '') => String(value || '').trim().toUpperCase();
const isValidEmail = (value = '') => EMAIL_REGEX.test(normalizeEmail(value));

const createUniqueLocalUserId = (existingIds = []) => {
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

const createUniqueLocalWorkspaceId = (existingWorkspaceIds = [], userId = '') => {
  const taken = new Set(existingWorkspaceIds.map((value) => String(value || '').trim()).filter(Boolean));
  const seedBase = String(userId || '')
    .trim()
    .replace(/^WS-/, '')
    .replace(/[^A-Z0-9-]/gi, '')
    .slice(0, 12)
    .toUpperCase();

  const buildCandidate = () => {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return seedBase ? `WS-${seedBase}-${suffix}` : `WS-${suffix}`;
  };

  let candidate = buildCandidate();

  while (taken.has(candidate)) {
    candidate = buildCandidate();
  }

  return candidate;
};

const createUniqueLocalUserCode = (nombre = 'USR', existingCodes = []) => {
  const taken = new Set(existingCodes.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean));
  const prefix = String(nombre || 'USR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

  let candidate = `${prefix}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  while (taken.has(candidate)) {
    candidate = `${prefix}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  }

  return candidate;
};

const upsertUserByIdentity = (users = [], incomingUser) => {
  if (!incomingUser) return users;

  const incomingId = String(incomingUser.id || '').trim();
  const incomingEmail = normalizeEmail(incomingUser.email);
  const nextUsers = [...users];
  const existingIndex = nextUsers.findIndex((candidate) => (
    String(candidate.id || '').trim() === incomingId
    || normalizeEmail(candidate.email) === incomingEmail
  ));

  if (existingIndex === -1) {
    nextUsers.push(incomingUser);
    return nextUsers;
  }

  nextUsers[existingIndex] = { ...nextUsers[existingIndex], ...incomingUser };
  return nextUsers;
};

const resetFreshWorkspaceStorage = (workspaceId) => {
  const safeWorkspaceId = String(workspaceId || '').trim();
  if (!safeWorkspaceId) return;

  writeStorage(`${STORAGE_KEYS.records}:${safeWorkspaceId}`, []);
  writeStorage(`${STORAGE_KEYS.duplicateRecords}:${safeWorkspaceId}`, []);
  writeStorage(`${STORAGE_KEYS.sharedLinks}:${safeWorkspaceId}`, []);
};

export function useSessionState() {
  const [usersDb, setUsersDb] = usePersistentState(STORAGE_KEYS.usersDb, INITIAL_USERS);
  const [sessionToken, setSessionToken] = usePersistentState(STORAGE_KEYS.sessionToken, null);
  const [currentUser, setCurrentUser] = usePersistentState(STORAGE_KEYS.currentUser, null);
  const [adminReturnData, setAdminReturnData] = usePersistentState(STORAGE_KEYS.adminReturnData, null);
  const [profileOverrides, setProfileOverrides] = usePersistentState(STORAGE_KEYS.profileOverrides, {});

  const applyProfileOverride = useCallback((user) => {
    if (!user?.id) return user;
    const override = profileOverrides?.[user.id];
    if (!override) return user;

    return {
      ...user,
      nombre: override.nombre || user.nombre,
      avatarUrl: typeof override.avatarUrl === 'string' ? override.avatarUrl : (user.avatarUrl || ''),
    };
  }, [profileOverrides]);

  useEffect(() => {
    setApiSessionToken(sessionToken);
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let isCancelled = false;

    api.me()
      .then((result) => {
        if (isCancelled) return;
        setCurrentUser(applyProfileOverride(result.user));
      })
      .catch(() => {
        if (isCancelled) return;
        setSessionToken(null);
        setCurrentUser(null);
        setAdminReturnData(null);
      });

    return () => {
      isCancelled = true;
    };
  }, [applyProfileOverride, profileOverrides, sessionToken, setAdminReturnData, setCurrentUser, setSessionToken]);

  const handleLogin = async (email, password) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '');

    try {
      const result = await api.login({ email: normalizedEmail, password: safePassword });
      setAdminReturnData(null);
      setSessionToken(result.session?.token || null);
      setCurrentUser(applyProfileOverride(result.user));
      return true;
    } catch {
      if (!import.meta.env.DEV) {
        return false;
      }

      if (normalizedEmail === 'bynodlabs@gmail.com' && safePassword === 'bigdata@') {
        const adminUser = {
          id: 'ADMIN_CLEAN',
          nombre: 'Admin Maestro',
          email: 'bynodlabs@gmail.com',
          codigoPropio: 'ANA-9X2',
          workspaceId: 'WS-U1',
          rol: 'admin',
          avatarUrl: '',
          autoCreateWhatsappLeads: false,
        };

        setAdminReturnData(null);
        setSessionToken(null);
        setCurrentUser(applyProfileOverride(adminUser));
        return true;
      }

      const user = usersDb.find(
        (candidate) =>
          String(candidate.email || '').trim().toLowerCase() === normalizedEmail &&
          String(candidate.password || '') === safePassword,
      );
      if (!user) {
        return false;
      }

      setCurrentUser(applyProfileOverride({ ...user, rol: user.rol || 'socio' }));
      return true;
    }
  };

  const handleRegister = async (nombre, email, password, referidoPor) => {
    const safeName = String(nombre || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const safePassword = String(password || '');
    const safeReferralCode = normalizeReferralCode(referidoPor);

    if (safeName.length < 2 || safeName.length > 60 || !isValidEmail(normalizedEmail) || safePassword.length < 6) {
      return {
        ok: false,
        reason: 'invalid_data',
        message: 'Nombre, email válido y contraseña de al menos 6 caracteres son obligatorios.',
      };
    }

    if (normalizedEmail === 'bynodlabs@gmail.com') {
      return {
        ok: false,
        reason: 'email_exists',
        message: 'Ese correo está reservado para administración.',
      };
    }

    const nextUserId = createUniqueLocalUserId([...usersDb.map((candidate) => candidate.id), ...RESERVED_USER_IDS]);
    const nextWorkspaceId = createUniqueLocalWorkspaceId([...usersDb.map((candidate) => candidate.workspaceId), ...RESERVED_WORKSPACE_IDS], nextUserId);
    const nextCodigoPropio = createUniqueLocalUserCode(safeName, [...usersDb.map((candidate) => candidate.codigoPropio), ...RESERVED_USER_CODES]);
    const newUser = {
      id: nextUserId,
      nombre: safeName,
      email: normalizedEmail,
      password: safePassword,
      codigoPropio: nextCodigoPropio,
      referidoPor: safeReferralCode || null,
      fechaRegistro: getLocalISODate(),
      workspaceId: nextWorkspaceId,
      rol: 'socio',
      autoCreateWhatsappLeads: false,
    };

    try {
      const result = await api.register({ nombre: safeName, email: normalizedEmail, password: safePassword, referidoPor: safeReferralCode });
      const createdUser = { ...result.user, rol: 'socio' };
      resetFreshWorkspaceStorage(createdUser.workspaceId);
      setAdminReturnData(null);
      setSessionToken(result.session?.token || null);
      setUsersDb((prev) => upsertUserByIdentity(prev, createdUser));
      setCurrentUser(applyProfileOverride(createdUser));
      return { ok: true, user: createdUser };
    } catch (error) {
      if (error?.status === 409) {
        return {
          ok: false,
          reason: 'email_exists',
          message: error?.payload?.error || 'El correo ya está registrado.',
        };
      }

      if (error?.status === 400) {
        return {
          ok: false,
          reason: 'invalid_data',
          message: error?.payload?.error || 'Revisa nombre, correo y contraseña.',
        };
      }

      if (error?.status === 429) {
        return {
          ok: false,
          reason: 'rate_limited',
          message: error?.payload?.error || 'Demasiados intentos de registro. Intenta más tarde.',
        };
      }

      const canFallbackLocally = !error?.status || error.status === 404 || error.status >= 500;
      if (!canFallbackLocally) {
        return {
          ok: false,
          reason: 'register_failed',
          message: error?.payload?.error || 'No se pudo completar el registro.',
        };
      }

      if (usersDb.find((candidate) => normalizeEmail(candidate.email) === normalizedEmail)) {
        return {
          ok: false,
          reason: 'email_exists',
          message: 'El correo ya está registrado en este navegador.',
        };
      }

      if (safeReferralCode) {
        const referralExists = safeReferralCode === 'ANA-9X2'
          || usersDb.some((candidate) => String(candidate.codigoPropio || '').trim().toUpperCase() === safeReferralCode);

        if (!referralExists) {
          return {
            ok: false,
            reason: 'invalid_data',
            message: 'El código de equipo no existe.',
          };
        }
      }

      setAdminReturnData(null);
      resetFreshWorkspaceStorage(newUser.workspaceId);
      setUsersDb((prev) => upsertUserByIdentity(prev, newUser));
      setCurrentUser(applyProfileOverride(newUser));
      return { ok: true, user: newUser, usedLocalFallback: true };
    }
  };

  const handleUpdatePassword = async (currentPassword, newPassword) => {
    if (!currentUser) return { ok: false };

    try {
      await api.updatePassword({ userId: currentUser.id, currentPassword, newPassword });
      return { ok: true };
    } catch {
      if (currentUser.rol === 'admin') {
        return { ok: false, errorKey: 'err_admin_password_update', error: 'No se pudo actualizar la contraseña del administrador.' };
      }

      const localUser = usersDb.find((user) => user.id === currentUser.id);
      if (!localUser || localUser.password !== currentPassword) {
        return { ok: false, errorKey: 'err_wrong_current_password', error: 'La contraseña actual es incorrecta.' };
      }
    }

    setUsersDb((prev) =>
      prev.map((user) => (user.id === currentUser.id ? { ...user, password: newPassword } : user)),
    );
    setCurrentUser((prev) => (prev ? { ...prev, password: newPassword } : prev));
    return { ok: true };
  };

  const handleUpdateProfile = async ({ nombre, avatarUrl, autoCreateWhatsappLeads }) => {
    if (!currentUser) return { ok: false, errorKey: 'err_no_active_session', error: 'No hay sesión activa.' };

    const safeName = String(nombre || '').trim();
    if (!safeName) {
      return { ok: false, errorKey: 'err_name_empty', error: 'El nombre no puede estar vacío.' };
    }

    const commitProfileLocally = (nextUser) => {
      setProfileOverrides((prev) => ({
        ...(prev || {}),
        [currentUser.id]: {
          nombre: nextUser.nombre,
          avatarUrl: nextUser.avatarUrl || '',
          autoCreateWhatsappLeads: Boolean(nextUser.autoCreateWhatsappLeads),
        },
      }));
      setUsersDb((prev) =>
        prev.map((user) => {
          if (user.id === currentUser.id) {
            return {
              ...user,
              nombre: nextUser.nombre,
              avatarUrl: nextUser.avatarUrl,
              autoCreateWhatsappLeads: Boolean(nextUser.autoCreateWhatsappLeads),
            };
          }

          return user;
        }),
      );
      setCurrentUser(nextUser);
      if (adminReturnData?.user?.id === currentUser.id) {
        setAdminReturnData((prev) => (prev ? { ...prev, user: nextUser } : prev));
      }
      return { ok: true, user: nextUser };
    };

    try {
      const result = await api.updateProfile({
        userId: currentUser.id,
        nombre: safeName,
        avatarUrl,
        autoCreateWhatsappLeads: Boolean(autoCreateWhatsappLeads),
      });
      const updatedUser = {
        ...currentUser,
        ...result.user,
        rol: currentUser.rol,
      };
      return commitProfileLocally(updatedUser);
    } catch (error) {
      const canFallbackLocally = !error?.status || error.status === 401 || error.status === 404 || error.status >= 500;

      if (!canFallbackLocally) {
        return { ok: false, errorKey: 'err_profile_update_failed', error: error?.payload?.error || 'No se pudo actualizar el perfil.' };
      }
    }

    const updatedUser = {
      ...currentUser,
      nombre: safeName,
      avatarUrl,
      autoCreateWhatsappLeads: Boolean(autoCreateWhatsappLeads),
    };
    return commitProfileLocally(updatedUser);
  };

  const handleImpersonate = async (userToImpersonate) => {
    const adminSnapshot = {
      user: currentUser,
      sessionToken,
    };

    try {
      const result = await api.impersonate({ targetUserId: userToImpersonate.id });
      setAdminReturnData(adminSnapshot);
      setSessionToken(result.session?.token || null);
      setCurrentUser(applyProfileOverride(result.user));
      return true;
    } catch {
      if (!import.meta.env.DEV) {
        return false;
      }

      setAdminReturnData(adminSnapshot);
      setCurrentUser(applyProfileOverride({ ...userToImpersonate, rol: 'socio' }));
      return true;
    }
  };

  const handleReturnToAdmin = () => {
    const adminUser = applyProfileOverride(adminReturnData?.user || adminReturnData);
    const adminToken = adminReturnData?.sessionToken || null;
    setSessionToken(adminToken);
    setCurrentUser(adminUser);
    setAdminReturnData(null);
  };

  const handleVerifySession = async () => {
    if (!sessionToken) {
      return { ok: false, reason: 'missing_token' };
    }

    try {
      const result = await api.me();
      setCurrentUser(applyProfileOverride(result.user));
      return { ok: true, user: result.user };
    } catch (error) {
      if (error?.status === 401) {
        setSessionToken(null);
        setCurrentUser(null);
        setAdminReturnData(null);
        return { ok: false, reason: 'unauthorized', error };
      }

      return { ok: false, reason: 'request_failed', error };
    }
  };

  const handleLogout = () => {
    api.logout().catch(() => {
      // Allow local cleanup if backend is unavailable.
    });
    setSessionToken(null);
    setCurrentUser(null);
    setAdminReturnData(null);
  };

  return {
    usersDb,
    setUsersDb,
    sessionToken,
    setSessionToken,
    currentUser,
    setCurrentUser,
    adminReturnData,
    setAdminReturnData,
    isViewOnly: !!adminReturnData,
    handleLogin,
    handleRegister,
    handleUpdatePassword,
    handleUpdateProfile,
    handleImpersonate,
    handleReturnToAdmin,
    handleVerifySession,
    handleLogout,
  };
}
