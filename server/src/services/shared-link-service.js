import { readDb, writeDb } from '../db.js';

export const sharedLinkService = {
  async listSharedLinks(workspaceId) {
    const db = await readDb();
    return workspaceId ? db.sharedLinks.filter((link) => link.workspaceId === workspaceId) : db.sharedLinks;
  },

  async createSharedLink(input = {}, workspaceId) {
    const db = await readDb();

    const link = {
      id: input.id || `link-${Date.now()}`,
      hash: input.hash || Math.random().toString(36).substring(2, 10),
      date: input.date || new Date().toISOString(),
      count: input.count || 0,
      teamMemberId: input.teamMemberId || null,
      teamMemberName: input.teamMemberName || 'ALL',
      teamMemberCode: input.teamMemberCode || null,
      sourceRecordIds: Array.isArray(input.sourceRecordIds) ? input.sourceRecordIds : [],
      metrics: {
        viewed: input.metrics?.viewed || 0,
        worked: input.metrics?.worked || 0,
        contacted: input.metrics?.contacted || 0,
      },
      workspaceId: workspaceId || input.workspaceId || null,
    };

    db.sharedLinks.unshift(link);
    await writeDb(db);

    return {
      status: 201,
      payload: { link },
    };
  },
};
