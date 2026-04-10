import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordService } from '../src/services/record-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFile = path.resolve(__dirname, '../data/db.json');

const workspaceId = 'WS-SIM';

const sampleRecords = [
  {
    id: 'SIM-1',
    nombre: 'Carlos Mendez',
    numero: '+57 300 123 4567',
    correo: 'carlos@example.com',
    pais: 'CO',
    sector: 'TRA',
    responsable: 'Sin Asignar',
    propietarioId: 'SIM-U1',
  },
  {
    id: 'SIM-2',
    nombre: 'Laura Rojas',
    numero: '+52 55 1234 5678',
    correo: 'laura@example.com',
    pais: 'MX',
    sector: 'CRI',
    responsable: 'Sin Asignar',
    propietarioId: 'SIM-U1',
  },
  {
    id: 'SIM-3',
    nombre: 'Sofia Castro',
    numero: '+1 809 555 9988',
    correo: '',
    pais: 'DO',
    sector: 'MAR',
    responsable: 'Sin Asignar',
    propietarioId: 'SIM-U1',
  },
];

const originalDb = await readFile(dbFile, 'utf8');

try {
  await writeFile(
    dbFile,
    JSON.stringify(
      {
        users: [
          {
            id: 'SIM-U1',
            nombre: 'Sim User',
            email: 'sim@example.com',
            password: 'sim',
            codigoPropio: 'SIM-001',
            referidoPor: null,
            fechaRegistro: '2026-04-03',
            workspaceId,
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

  const firstImport = await recordService.bulkCreateRecords({ records: sampleRecords }, workspaceId);
  const secondImport = await recordService.bulkCreateRecords({ records: sampleRecords }, workspaceId);

  const firstAccepted = firstImport.payload.items?.length || 0;
  const firstDuplicates = firstImport.payload.duplicates?.length || 0;
  const secondAccepted = secondImport.payload.items?.length || 0;
  const secondDuplicates = secondImport.payload.duplicates?.length || 0;

  if (firstAccepted !== 3 || firstDuplicates !== 0) {
    throw new Error(`Primera importacion invalida: ${firstAccepted} aceptados, ${firstDuplicates} duplicados`);
  }

  if (secondAccepted !== 0 || secondDuplicates !== 3) {
    throw new Error(`Segunda importacion invalida: ${secondAccepted} aceptados, ${secondDuplicates} duplicados`);
  }

  console.log('Simulacion OK');
  console.log(JSON.stringify({
    firstAccepted,
    firstDuplicates,
    secondAccepted,
    secondDuplicates,
  }, null, 2));
} finally {
  await writeFile(dbFile, originalDb);
}
