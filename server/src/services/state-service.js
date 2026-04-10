import { readDb, writeDb } from '../db.js';

export const stateService = {
  async getState() {
    const db = await readDb();

    return {
      records: db.records,
      duplicateRecords: db.duplicateRecords,
    };
  },

  async saveState({ records, duplicateRecords }) {
    const db = await readDb();

    if (Array.isArray(records)) db.records = records;
    if (Array.isArray(duplicateRecords)) db.duplicateRecords = duplicateRecords;

    await writeDb(db);

    return {
      records: db.records,
      duplicateRecords: db.duplicateRecords,
    };
  },
};
