import { readDb, writeDb } from '../db.js';
import { hashPassword, sanitizeUser, verifyPassword } from '../utils.js';

const isLiquidatedLead = (record) => record?.estadoProspeccion === 'Liquidado';
const isDiscardedLead = (record) => record?.estadoProspeccion === 'Descartado';
const normalized = (value = '') => String(value || '').trim().toLowerCase();
const getLatestRealContactEntry = (record) => {
  const contactLogs = (record?.historial || []).filter((entry) => {
    const action = String(entry?.accion || '');
    return (
      action.includes('[META DIARIA]') ||
      action.includes('[CONTACTO REAL]') ||
      action.includes('WhatsApp abierto') ||
      action.includes('Marcado manual como mensaje enviado')
    );
  });

  if (contactLogs.length === 0) {
    return null;
  }

  return contactLogs[contactLogs.length - 1];
};

export const userService = {
  async listUsers(currentUser) {
    const db = await readDb();
    if (!currentUser) {
      return [];
    }

    if (currentUser.rol === 'admin') {
      return db.users.map(sanitizeUser);
    }

    return db.users
      .filter(
        (candidate) =>
          candidate.id === currentUser.id ||
          candidate.referidoPor === currentUser.codigoPropio,
      )
      .map(sanitizeUser);
  },

  async updatePassword({ currentUser, userId, currentPassword, newPassword }) {
    if (!currentUser || !newPassword) {
      return { status: 400, payload: { error: 'Sesión válida y newPassword son obligatorios.' } };
    }

    if (String(newPassword).length < 6) {
      return { status: 400, payload: { error: 'La nueva contraseña debe tener al menos 6 caracteres.' } };
    }

    const db = await readDb();
    const targetUserId = currentUser.rol === 'admin' && userId ? userId : currentUser.id;

    const user = db.users.find((candidate) => candidate.id === targetUserId);

    if (!user) {
      return { status: 404, payload: { error: 'Usuario no encontrado.' } };
    }

    if (currentUser.rol !== 'admin') {
      if (!currentPassword || !verifyPassword(currentPassword, user.password)) {
        return { status: 401, payload: { error: 'La contraseña actual es incorrecta.' } };
      }
    }

    user.password = hashPassword(newPassword);
    await writeDb(db);

    return {
      status: 200,
      payload: { user: sanitizeUser(user) },
    };
  },

  async updateProfile({ currentUser, userId, nombre, codigoPropio, avatarUrl }) {
    const safeName = String(nombre || '').trim();
    const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined;

    if (!currentUser || !safeName) {
      return { status: 400, payload: { error: 'Sesión válida y nombre son obligatorios.' } };
    }

    if (codigoPropio !== undefined) {
      return { status: 403, payload: { error: 'El código de equipo no se puede modificar.' } };
    }

    const db = await readDb();
    const targetUserId = currentUser.rol === 'admin' && userId ? userId : currentUser.id;

    if (currentUser.rol === 'admin' && targetUserId === currentUser.id) {
      db.adminProfile = {
        ...(db.adminProfile || {}),
        nombre: safeName,
        ...(normalizedAvatarUrl !== undefined ? { avatarUrl: normalizedAvatarUrl } : {}),
      };

      await writeDb(db);

      return {
        status: 200,
        payload: {
          user: {
            ...currentUser,
            nombre: db.adminProfile.nombre,
            avatarUrl: db.adminProfile.avatarUrl || '',
          },
        },
      };
    }

    const user = db.users.find((candidate) => candidate.id === targetUserId);

    if (!user) {
      return { status: 404, payload: { error: 'Usuario no encontrado.' } };
    }

    user.nombre = safeName;
    if (normalizedAvatarUrl !== undefined) {
      user.avatarUrl = normalizedAvatarUrl;
    }

    await writeDb(db);

    return {
      status: 200,
      payload: { user: sanitizeUser(user) },
    };
  },

  async teamOverview(currentUser) {
    if (!currentUser) {
      return { status: 401, payload: { error: 'Sesión no válida.' } };
    }

    const db = await readDb();
    const teamMembers = db.users.filter(
      (candidate) =>
        candidate.id !== currentUser.id &&
        candidate.referidoPor &&
        currentUser.codigoPropio &&
        candidate.referidoPor === currentUser.codigoPropio,
    );

    const memberIds = new Set(teamMembers.map((member) => member.id));
    const memberCodes = new Set(teamMembers.map((member) => member.codigoPropio).filter(Boolean));
    const memberNames = new Set(teamMembers.map((member) => normalized(member.nombre)).filter(Boolean));
    const memberWorkspaces = new Set(teamMembers.map((member) => member.workspaceId).filter(Boolean));

    const relevantLinks = (db.sharedLinks || []).filter((link) => {
      if (!link || link.workspaceId !== currentUser.workspaceId) return false;
      if (link.teamMemberId && memberIds.has(link.teamMemberId)) return true;
      if (link.teamMemberCode && memberCodes.has(link.teamMemberCode)) return true;
      if (link.teamMemberName && memberNames.has(normalized(link.teamMemberName))) return true;
      return false;
    });

    const sharedSourceIds = new Set(
      relevantLinks.flatMap((link) => Array.isArray(link.sourceRecordIds) ? link.sourceRecordIds : []),
    );

    const teamReceivedRecords = (db.records || []).filter((record) => {
      if (!record?.sourceRecordId || !sharedSourceIds.has(record.sourceRecordId)) return false;
      if (isDiscardedLead(record) || isLiquidatedLead(record)) return false;
      return (
        (record.propietarioId && memberIds.has(record.propietarioId)) ||
        (record.workspaceId && memberWorkspaces.has(record.workspaceId)) ||
        (record.responsable && memberNames.has(normalized(record.responsable)))
      );
    });

    const isWorkedLead = (record) =>
      Boolean(record?.mensajeEnviado) ||
      Boolean(getLatestRealContactEntry(record)) ||
      (record?.estadoProspeccion !== 'Nuevo' && record?.estadoProspeccion !== 'Archivado');

    const ranking = teamMembers
      .map((member) => {
        const memberLeads = teamReceivedRecords.filter(
          (record) =>
            record.propietarioId === member.id ||
            record.workspaceId === member.workspaceId ||
            normalized(record.responsable) === normalized(member.nombre),
        );

        const asignados = memberLeads.length;
        const trabajados = memberLeads.filter(isWorkedLead).length;
        const contactados = memberLeads.filter(
          (record) => Boolean(record.mensajeEnviado) || Boolean(getLatestRealContactEntry(record)),
        ).length;
        const contactadosMes = memberLeads.filter((record) => Boolean(getLatestRealContactEntry(record))).length;
        const rendimiento = asignados > 0 ? Math.round((contactados / asignados) * 100) : 0;

        return {
          id: member.id,
          nombre: member.nombre,
          asignados,
          trabajados,
          contactados,
          contactadosMes,
          rendimiento,
        };
      })
      .filter((member) => member.asignados > 0)
      .sort((a, b) => b.contactadosMes - a.contactadosMes || b.trabajados - a.trabajados);

    return {
      status: 200,
      payload: {
        teamMembers: teamMembers.map(sanitizeUser),
        totals: {
          assigned: teamReceivedRecords.length,
          worked: teamReceivedRecords.filter(isWorkedLead).length,
        },
        ranking,
      },
    };
  },
};
