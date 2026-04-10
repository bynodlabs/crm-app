import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDb } from '../src/db.js';
import { authService } from '../src/services/auth-service.js';
import { recordService } from '../src/services/record-service.js';
import { userService } from '../src/services/user-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.resolve(__dirname, '../data/db.json');

const originalDb = await readFile(dbFile, 'utf8');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

try {
  await writeFile(
    dbFile,
    JSON.stringify(
      {
        users: [
          {
            id: 'U1',
            nombre: 'Ana López',
            email: 'admin@bigdata.com',
            password: '123',
            codigoPropio: 'ANA-9X2',
            referidoPor: null,
            fechaRegistro: '2025-10-01',
            workspaceId: 'WS-U1',
            role: 'socio',
          },
        ],
        records: [],
        duplicateRecords: [],
        sharedLinks: [],
        sessions: [],
      },
      null,
      2,
    ),
  );

  const sponsorRegister = await authService.register({
    nombre: 'Carlos Sponsor',
    email: 'carlos@test.com',
    password: 'secreta123',
  });
  assert(sponsorRegister.status === 201, 'No se pudo registrar el sponsor');

  const sponsor = sponsorRegister.payload.user;
  const referredRegister = await authService.register({
    nombre: 'Laura Referida',
    email: 'laura@test.com',
    password: 'secreta123',
    referidoPor: sponsor.codigoPropio,
  });
  assert(referredRegister.status === 201, 'No se pudo registrar la referida');
  const referred = referredRegister.payload.user;

  const sponsorLogin = await authService.login({ email: 'carlos@test.com', password: 'secreta123' });
  assert(sponsorLogin.status === 200, 'No se pudo iniciar sesión con sponsor');
  const adminLogin = await authService.login({ email: 'admin@bigdata.com', password: 'bigdata@' });
  assert(adminLogin.status === 200, 'No se pudo iniciar sesión con admin');

  const dbAfterRegister = await readDb();
  const storedSponsor = dbAfterRegister.users.find((user) => user.email === 'carlos@test.com');
  assert(storedSponsor?.password && storedSponsor.password !== 'secreta123', 'La contraseña del sponsor no quedó hasheada');

  const createRecordResult = await recordService.createRecord(
    {
      nombre: 'Lead Uno',
      numero: '+52 55 1111 2222',
      correo: 'lead1@test.com',
      pais: 'MX',
      sector: 'TRA',
      propietarioId: sponsor.id,
      responsable: 'Sin Asignar',
    },
    sponsor.workspaceId,
  );
  assert(createRecordResult.status === 201, 'No se pudo crear el lead del sponsor');

  const sponsorRecordsBeforeShare = await recordService.listRecords({}, sponsor.workspaceId);
  const referredRecordsBeforeShare = await recordService.listRecords({}, referred.workspaceId);
  assert(sponsorRecordsBeforeShare.items.length === 1, 'El sponsor debería tener 1 lead antes del reparto');
  assert(referredRecordsBeforeShare.items.length === 0, 'La referida no debería tener leads antes del reparto');

  const shareResult = await recordService.shareRecordsToUser(
    {
      recordIds: [sponsorRecordsBeforeShare.items[0].id],
      targetUserId: referred.id,
      teamMemberName: referred.nombre,
    },
    { ...sponsor, rol: 'socio' },
  );
  assert(shareResult.status === 200, 'No se pudo compartir el lead al miembro del equipo');
  assert(shareResult.payload.shared === 1, 'El reparto debería haber compartido 1 lead');

  const sponsorRecordsAfterShare = await recordService.listRecords({}, sponsor.workspaceId);
  const referredRecordsAfterShare = await recordService.listRecords({}, referred.workspaceId);
  assert(sponsorRecordsAfterShare.items.length === 1, 'El sponsor debería conservar su lead');
  assert(referredRecordsAfterShare.items.length === 1, 'La referida debería recibir 1 lead compartido');
  assert(
    referredRecordsAfterShare.items[0].sourceRecordId === sponsorRecordsBeforeShare.items[0].id,
    'El lead compartido debe conservar referencia al lead origen',
  );

  const listUsersForSponsor = await userService.listUsers({ ...sponsor, rol: 'socio' });
  assert(
    listUsersForSponsor.some((user) => user.id === sponsor.id) &&
      listUsersForSponsor.some((user) => user.id === referred.id),
    'El sponsor debería ver su propio usuario y a su referida en Mi Equipo',
  );

  const adminImpersonation = await authService.impersonate(adminLogin.payload.user, sponsor.id);
  assert(adminImpersonation.status === 200, 'El admin no pudo entrar en modo observador');

  const impersonatedSessionUser = await authService.getSessionUser(adminImpersonation.payload.session.token);
  assert(impersonatedSessionUser.status === 200, 'La sesión observador debe ser válida');
  assert(
    impersonatedSessionUser.payload.user.id === sponsor.id,
    'La sesión de observador debe resolver al usuario objetivo',
  );

  const logoutObservedSession = await authService.logout(adminImpersonation.payload.session.token);
  assert(logoutObservedSession.status === 200, 'El logout de la sesión observador debe funcionar');

  const observedSessionAfterLogout = await authService.getSessionUser(adminImpersonation.payload.session.token);
  assert(observedSessionAfterLogout.status === 401, 'La sesión observador debe invalidarse tras logout');

  const badPasswordChange = await userService.updatePassword({
    currentUser: { ...sponsor, rol: 'socio' },
    userId: sponsor.id,
    currentPassword: 'incorrecta',
    newPassword: 'nuevo1234',
  });
  assert(badPasswordChange.status === 401, 'El cambio de contraseña con clave incorrecta debería fallar');

  const goodPasswordChange = await userService.updatePassword({
    currentUser: { ...sponsor, rol: 'socio' },
    userId: sponsor.id,
    currentPassword: 'secreta123',
    newPassword: 'nuevo1234',
  });
  assert(goodPasswordChange.status === 200, 'El cambio de contraseña correcto debería funcionar');

  const loginWithOldPassword = await authService.login({ email: 'carlos@test.com', password: 'secreta123' });
  const loginWithNewPassword = await authService.login({ email: 'carlos@test.com', password: 'nuevo1234' });
  assert(loginWithOldPassword.status === 401, 'La contraseña vieja ya no debería funcionar');
  assert(loginWithNewPassword.status === 200, 'La contraseña nueva debería funcionar');

  console.log('Simulacion core OK');
  console.log(
    JSON.stringify(
      {
        sponsorWorkspace: sponsor.workspaceId,
        referredWorkspace: referred.workspaceId,
        sponsorRecords: sponsorRecordsAfterShare.items.length,
        referredRecords: referredRecordsAfterShare.items.length,
        teamVisibleToSponsor: listUsersForSponsor.length,
        adminObservedUser: impersonatedSessionUser.payload.user.email,
        observedSessionClosed: observedSessionAfterLogout.status === 401,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(dbFile, originalDb);
}
