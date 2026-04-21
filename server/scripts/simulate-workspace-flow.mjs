import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authService } from '../src/services/auth-service.js';
import { PIPELINE_STAGE_VALUES } from '../src/lead-pipeline.js';
import { recordService } from '../src/services/record-service.js';

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

  const registerResult = await authService.register({
    nombre: 'María Operadora',
    email: 'maria@test.com',
    password: 'secreta123',
  });
  assert(registerResult.status === 201, 'No se pudo registrar la operadora');

  const user = registerResult.payload.user;

  const createResult = await recordService.createRecord(
    {
      id: 'BIG-TRA-MX-2026-04-0001',
      nombre: 'Laura Gómez',
      numero: '+52 55 1234 5678',
      correo: 'laura@test.com',
      pais: 'MX',
      sector: 'TRA',
      subsector: 'Forex',
      origen: 'Manual',
      categoria: 'A',
      canal: 'Automático',
      nota: 'Lead creado manualmente',
      pipeline_stage: PIPELINE_STAGE_VALUES.NEW,
      propietarioId: user.id,
      responsable: 'Sin Asignar',
      inProspecting: false,
      isArchived: false,
      historial: [{ fecha: new Date().toISOString(), accion: `Creado manual en el sistema (${PIPELINE_STAGE_VALUES.NEW})` }],
    },
    user.workspaceId,
  );
  assert(createResult.status === 201, 'No se pudo crear el lead manual');
  assert(createResult.payload.record.correo === 'laura@test.com', 'El correo no se guardó correctamente');
  assert(createResult.payload.record.pais === 'MX', 'El país no se guardó correctamente');
  assert(createResult.payload.record.workspaceId === user.workspaceId, 'El workspace del lead manual es incorrecto');

  const recordId = createResult.payload.record.id;

  const prospectingUpdate = await recordService.updateRecord(
    recordId,
    {
      pipeline_stage: PIPELINE_STAGE_VALUES.NEW_LEAD,
      inProspecting: true,
      responsable: user.nombre,
      nota: 'Primer contacto listo',
      historial: [
        { fecha: new Date().toISOString(), accion: 'Lead enviado a prospección' },
        ...(createResult.payload.record.historial || []),
      ],
    },
    user.workspaceId,
  );
  assert(prospectingUpdate.status === 200, 'No se pudo mover el lead a prospección');

  const archivedUpdate = await recordService.updateRecord(
    recordId,
    {
      pipeline_stage: PIPELINE_STAGE_VALUES.COLD_LEAD,
      inProspecting: true,
      isArchived: true,
      historial: [
        { fecha: new Date().toISOString(), accion: 'Archivado dentro del Workspace' },
        ...(prospectingUpdate.payload.record.historial || []),
      ],
    },
    user.workspaceId,
  );
  assert(archivedUpdate.status === 200, 'No se pudo archivar el lead');

  const restoredUpdate = await recordService.updateRecord(
    recordId,
    {
      pipeline_stage: PIPELINE_STAGE_VALUES.NEW_LEAD,
      inProspecting: true,
      isArchived: false,
      historial: [
        { fecha: new Date().toISOString(), accion: 'Restaurado a la mesa activa del Workspace' },
        ...(archivedUpdate.payload.record.historial || []),
      ],
    },
    user.workspaceId,
  );
  assert(restoredUpdate.status === 200, 'No se pudo restaurar el lead archivado');

  const removedUpdate = await recordService.updateRecord(
    recordId,
    {
      pipeline_stage: PIPELINE_STAGE_VALUES.NEW,
      inProspecting: false,
      isArchived: false,
      mensajeEnviado: false,
      responsable: 'Sin Asignar',
      historial: [
        { fecha: new Date().toISOString(), accion: `Retirado del Workspace y devuelto al Directorio (${PIPELINE_STAGE_VALUES.NEW})` },
        ...(restoredUpdate.payload.record.historial || []),
      ],
    },
    user.workspaceId,
  );
  assert(removedUpdate.status === 200, 'No se pudo devolver el lead al directorio');

  const finalList = await recordService.listRecords({}, user.workspaceId);
  const finalRecord = (finalList.items || []).find((record) => record.id === recordId);
  assert(finalRecord, 'El lead final no quedó en el workspace del usuario');
  assert(finalRecord.pipeline_stage === PIPELINE_STAGE_VALUES.NEW, 'El lead final debería haber regresado a 🆕 New');
  assert(finalRecord.inProspecting === false, 'El lead final no debería seguir en prospección');
  assert(finalRecord.isArchived === false, 'El lead final no debería seguir archivado');

  console.log('Simulacion workspace OK');
  console.log(
    JSON.stringify(
      {
        workspaceId: user.workspaceId,
        createdLeadId: recordId,
        finalStatus: finalRecord.pipeline_stage,
        finalResponsible: finalRecord.responsable,
        finalHistoryEntries: (finalRecord.historial || []).length,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(dbFile, originalDb);
}
