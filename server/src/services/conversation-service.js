import { randomUUID } from 'node:crypto';
import { executeQuery, queryRows } from '../db.js';

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const toSqlDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
};

const fromSqlDateTime = (value) => {
  if (!value) return 0;
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const normalizePhone = (value = '') => String(value || '').replace(/\D+/g, '');
const normalizeText = (value = '') => String(value || '').trim();

const buildSummaryFromMessages = (messages = []) => {
  const recentMessages = messages.slice(-12);
  const textBlob = recentMessages
    .map((message) => normalizeText(message.text || message.caption || ''))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const agreements = [];
  const objections = [];
  let nextStep = 'Conviene mantener seguimiento y validar el siguiente avance del lead.';

  if (/(agendar|agenda|zoom|llamada|ma[nñ]ana|hoy|listo|confirmad|perfecto|va bien)/.test(textBlob)) {
    agreements.push('Ya hay señales de disposición para agendar o retomar seguimiento.');
    nextStep = 'Empuja un seguimiento puntual para concretar fecha, hora o siguiente contacto.';
  }

  if (/(precio|plan|costo|inversi[oó]n|pago|membres[ií]a)/.test(textBlob)) {
    agreements.push('La conversación ya tocó tema de precio, plan o inversión.');
  }

  if (/(despu[eé]s|luego|ocupad|tiempo|revisar|pensarlo|no se)/.test(textBlob)) {
    objections.push('El lead muestra fricción de tiempo o quiere revisarlo después.');
    nextStep = 'Conviene nutrir con contexto breve y acordar un nuevo punto de contacto.';
  }

  if (/(caro|precio|costo|presupuesto|inversi[oó]n)/.test(textBlob)) {
    objections.push('Puede existir sensibilidad por precio o presupuesto.');
  }

  const latestText = normalizeText(recentMessages[recentMessages.length - 1]?.text || recentMessages[recentMessages.length - 1]?.caption || '');
  const parts = [
    latestText ? `Último intercambio: ${latestText}.` : '',
    agreements[0] || '',
    objections[0] || '',
    `Siguiente paso sugerido: ${nextStep}`,
  ].filter(Boolean);

  return {
    summary: parts.join(' '),
    agreements: agreements.slice(0, 2),
    objections: objections.slice(0, 2),
    nextStep,
    messageCount: recentMessages.length,
    fromMessageAt: recentMessages[0]?.sentAt || null,
    toMessageAt: recentMessages[recentMessages.length - 1]?.sentAt || null,
  };
};

const mapStoredMessage = (row) => ({
  id: row.waMessageId,
  jid: row.chatJid,
  text: row.text || '',
  timestamp: fromSqlDateTime(row.sentAt),
  direction: row.direction || 'in',
  fromMe: row.fromMe === 1 || row.fromMe === true,
  pushName: row.pushName || '',
  status: row.status || '',
  type: row.messageType || 'text',
  mimeType: row.mimeType || '',
  caption: row.caption || '',
  fileName: row.fileName || '',
  hasMedia: row.hasMedia === 1 || row.hasMedia === true,
  deletedForEveryone: row.deletedForEveryone === 1 || row.deletedForEveryone === true,
  avatarUrl: row.avatarUrl || '',
  contact: row.contactDisplayName || row.contactPhoneNumber || row.contactVcard
    ? {
        displayName: row.contactDisplayName || '',
        phoneNumber: row.contactPhoneNumber || '',
        vcard: row.contactVcard || '',
      }
    : null,
  quotedMessage: row.quotedMessageId || row.quotedMessageText
    ? {
        id: row.quotedMessageId || '',
        text: row.quotedMessageText || '',
      }
    : null,
});

const mapStoredConversation = (row) => ({
  id: row.leadId || `wa:${row.chatJid}`,
  leadId: row.leadId || null,
  jid: row.chatJid,
  phoneNumber: row.phoneNumber || '',
  name: row.displayName || '',
  avatarUrl: row.avatarUrl || '',
  lastMessageText: row.lastMessageText || '',
  lastMessageTimestamp: fromSqlDateTime(row.lastMessageAt),
  lastMessageDirection: row.lastMessageDirection || 'in',
  unreadCount: 0,
  channelId: row.channelId || null,
  status: row.status || 'active',
  latestSummary: row.latestSummary || '',
});

const findLeadByPhone = async (workspaceId, phoneNumber = '') => {
  const digits = normalizePhone(phoneNumber);
  if (!workspaceId || !digits) return null;

  const rows = await queryRows(
    `SELECT \`id\`, \`nombre\`, \`numero\`, \`correo\`, \`workspaceId\`
     FROM \`records\`
     WHERE \`workspaceId\` = ?
       AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(\`numero\`, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '') = ?
     ORDER BY \`fechaIngreso\` DESC, \`id\` DESC
     LIMIT 1`,
    [workspaceId, digits],
  );

  return rows[0] || null;
};

const ensureChannel = async ({ workspaceId, session = {}, channelKey = '' } = {}) => {
  if (!workspaceId || !channelKey) return null;

  const rows = await queryRows(
    'SELECT `id` FROM `wa_channels` WHERE `workspaceId` = ? AND `channelKey` = ? LIMIT 1',
    [workspaceId, channelKey],
  );
  const now = nowSql();
  const status = normalizeText(session.status || 'disconnected') || 'disconnected';
  const phoneNumber = normalizeText(session.phoneNumber || '');
  const profileName = normalizeText(session.profileName || '');

  if (rows[0]?.id) {
    await executeQuery(
      `UPDATE \`wa_channels\`
       SET \`phoneNumber\` = ?, \`profileName\` = ?, \`status\` = ?,
           \`lastConnectedAt\` = ?, \`lastDisconnectedAt\` = ?, \`updatedAt\` = ?
       WHERE \`id\` = ?`,
      [
        phoneNumber,
        profileName,
        status,
        status === 'open' ? now : null,
        status === 'disconnected' ? now : null,
        now,
        rows[0].id,
      ],
    );
    return rows[0].id;
  }

  const id = randomUUID();
  await executeQuery(
    `INSERT INTO \`wa_channels\`
     (\`id\`, \`workspaceId\`, \`channelKey\`, \`channelType\`, \`phoneNumber\`, \`profileName\`, \`status\`, \`lastConnectedAt\`, \`lastDisconnectedAt\`, \`createdAt\`, \`updatedAt\`)
     VALUES (?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      channelKey,
      phoneNumber,
      profileName,
      status,
      status === 'open' ? now : null,
      status === 'disconnected' ? now : null,
      now,
      now,
    ],
  );
  return id;
};

const ensureConversation = async ({ workspaceId, chatJid, phoneNumber = '', displayName = '', avatarUrl = '', channelId = null, lastMessageText = '', lastMessageDirection = 'in', lastMessageAt = null } = {}) => {
  if (!workspaceId || !chatJid) return null;

  const rows = await queryRows(
    'SELECT `id`, `leadId`, `displayName`, `avatarUrl` FROM `lead_conversations` WHERE `workspaceId` = ? AND `chatJid` = ? LIMIT 1',
    [workspaceId, chatJid],
  );
  const existing = rows[0] || null;
  const matchedLead = await findLeadByPhone(workspaceId, phoneNumber);
  const leadId = matchedLead?.id || existing?.leadId || null;
  const now = nowSql();

  if (existing?.id) {
    await executeQuery(
      `UPDATE \`lead_conversations\`
       SET \`leadId\` = ?, \`channelId\` = COALESCE(?, \`channelId\`), \`phoneNumber\` = ?, \`displayName\` = ?, \`avatarUrl\` = ?,
           \`lastMessageText\` = ?, \`lastMessageDirection\` = ?, \`lastMessageAt\` = COALESCE(?, \`lastMessageAt\`),
           \`lastInboundAt\` = CASE WHEN ? = 'in' THEN COALESCE(?, \`lastInboundAt\`) ELSE \`lastInboundAt\` END,
           \`lastOutboundAt\` = CASE WHEN ? = 'out' THEN COALESCE(?, \`lastOutboundAt\`) ELSE \`lastOutboundAt\` END,
           \`updatedAt\` = ?
       WHERE \`id\` = ?`,
      [
        leadId,
        channelId,
        normalizeText(phoneNumber),
        normalizeText(displayName) || matchedLead?.nombre || existing.displayName || '',
        normalizeText(avatarUrl) || existing.avatarUrl || '',
        lastMessageText,
        lastMessageDirection,
        lastMessageAt,
        lastMessageDirection,
        lastMessageAt,
        lastMessageDirection,
        lastMessageAt,
        now,
        existing.id,
      ],
    );
    return { id: existing.id, leadId };
  }

  const id = randomUUID();
  await executeQuery(
    `INSERT INTO \`lead_conversations\`
     (\`id\`, \`workspaceId\`, \`leadId\`, \`channelId\`, \`chatJid\`, \`phoneNumber\`, \`displayName\`, \`avatarUrl\`, \`status\`, \`lastMessageText\`, \`lastMessageDirection\`, \`lastMessageAt\`, \`lastInboundAt\`, \`lastOutboundAt\`, \`createdAt\`, \`updatedAt\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      workspaceId,
      leadId,
      channelId,
      chatJid,
      normalizeText(phoneNumber),
      normalizeText(displayName) || matchedLead?.nombre || '',
      normalizeText(avatarUrl),
      lastMessageText,
      lastMessageDirection,
      lastMessageAt,
      lastMessageDirection === 'in' ? lastMessageAt : null,
      lastMessageDirection === 'out' ? lastMessageAt : null,
      now,
      now,
    ],
  );
  return { id, leadId };
};

export const conversationService = {
  async syncChannel(workspaceId, session = {}, channelKey = '') {
    if (!workspaceId || !channelKey) return null;
    return ensureChannel({ workspaceId, session, channelKey });
  },

  async persistChatMessage(workspaceId, message = {}, { session = {}, channelKey = '' } = {}) {
    const chatJid = normalizeText(message.jid);
    if (!workspaceId || !chatJid || !normalizeText(message.id)) return null;

    const sentAt = toSqlDateTime(message.timestamp) || nowSql();
    const channelId = await ensureChannel({ workspaceId, session, channelKey });
    const conversation = await ensureConversation({
      workspaceId,
      chatJid,
      phoneNumber: message.contact?.phoneNumber || message.jid,
      displayName: message.pushName || '',
      avatarUrl: message.avatarUrl || '',
      channelId,
      lastMessageText: normalizeText(message.text || message.caption || (message.deletedForEveryone ? 'Mensaje eliminado' : '')),
      lastMessageDirection: normalizeText(message.direction || 'in') || 'in',
      lastMessageAt: sentAt,
    });

    if (!conversation?.id) return null;

    const now = nowSql();
    const contact = message.contact && typeof message.contact === 'object' ? message.contact : null;
    const quotedMessage = message.quotedMessage && typeof message.quotedMessage === 'object' ? message.quotedMessage : null;

    await executeQuery(
      `INSERT INTO \`lead_conversation_messages\`
       (\`id\`, \`conversationId\`, \`workspaceId\`, \`leadId\`, \`channelId\`, \`chatJid\`, \`waMessageId\`, \`direction\`, \`messageType\`, \`text\`, \`caption\`, \`mimeType\`, \`fileName\`, \`status\`, \`hasMedia\`, \`fromMe\`, \`pushName\`, \`avatarUrl\`, \`contactDisplayName\`, \`contactPhoneNumber\`, \`contactVcard\`, \`quotedMessageId\`, \`quotedMessageText\`, \`deletedForEveryone\`, \`sentAt\`, \`createdAt\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         \`direction\` = VALUES(\`direction\`),
         \`messageType\` = VALUES(\`messageType\`),
         \`text\` = VALUES(\`text\`),
         \`caption\` = VALUES(\`caption\`),
         \`mimeType\` = VALUES(\`mimeType\`),
         \`fileName\` = VALUES(\`fileName\`),
         \`status\` = VALUES(\`status\`),
         \`hasMedia\` = VALUES(\`hasMedia\`),
         \`fromMe\` = VALUES(\`fromMe\`),
         \`pushName\` = VALUES(\`pushName\`),
         \`avatarUrl\` = VALUES(\`avatarUrl\`),
         \`contactDisplayName\` = VALUES(\`contactDisplayName\`),
         \`contactPhoneNumber\` = VALUES(\`contactPhoneNumber\`),
         \`contactVcard\` = VALUES(\`contactVcard\`),
         \`quotedMessageId\` = VALUES(\`quotedMessageId\`),
         \`quotedMessageText\` = VALUES(\`quotedMessageText\`),
         \`deletedForEveryone\` = VALUES(\`deletedForEveryone\`),
         \`sentAt\` = VALUES(\`sentAt\`),
         \`updatedAt\` = VALUES(\`updatedAt\`)`,
      [
        randomUUID(),
        conversation.id,
        workspaceId,
        conversation.leadId,
        channelId,
        chatJid,
        normalizeText(message.id),
        normalizeText(message.direction || 'in') || 'in',
        normalizeText(message.type || 'text') || 'text',
        message.text || '',
        message.caption || '',
        normalizeText(message.mimeType || ''),
        normalizeText(message.fileName || ''),
        normalizeText(message.status || ''),
        message.hasMedia ? 1 : 0,
        message.fromMe ? 1 : 0,
        normalizeText(message.pushName || ''),
        normalizeText(message.avatarUrl || ''),
        normalizeText(contact?.displayName || ''),
        normalizeText(contact?.phoneNumber || ''),
        contact?.vcard || '',
        normalizeText(quotedMessage?.id || ''),
        quotedMessage?.text || '',
        message.deletedForEveryone ? 1 : 0,
        sentAt,
        now,
        now,
      ],
    );

    await this.refreshConversationSummary(workspaceId, conversation.id).catch(() => null);

    return { conversationId: conversation.id, leadId: conversation.leadId };
  },

  async refreshConversationSummary(workspaceId, conversationId) {
    if (!workspaceId || !conversationId) return null;

    const messageRows = await queryRows(
      `SELECT \`text\`, \`caption\`, \`sentAt\`
       FROM \`lead_conversation_messages\`
       WHERE \`workspaceId\` = ? AND \`conversationId\` = ?
       ORDER BY \`sentAt\` ASC, \`waMessageId\` ASC`,
      [workspaceId, conversationId],
    );

    if (messageRows.length === 0) return null;

    const conversationRows = await queryRows(
      'SELECT `leadId` FROM `lead_conversations` WHERE `workspaceId` = ? AND `id` = ? LIMIT 1',
      [workspaceId, conversationId],
    );
    const leadId = conversationRows[0]?.leadId || null;
    const generated = buildSummaryFromMessages(messageRows);
    const now = nowSql();
    const existingRows = await queryRows(
      `SELECT \`id\`
       FROM \`lead_conversation_summaries\`
       WHERE \`workspaceId\` = ? AND \`conversationId\` = ?
       ORDER BY \`updatedAt\` DESC
       LIMIT 1`,
      [workspaceId, conversationId],
    );

    if (existingRows[0]?.id) {
      await executeQuery(
        `UPDATE \`lead_conversation_summaries\`
         SET \`leadId\` = ?, \`summary\` = ?, \`messageCount\` = ?, \`fromMessageAt\` = ?, \`toMessageAt\` = ?, \`updatedAt\` = ?
         WHERE \`id\` = ?`,
        [leadId, generated.summary, generated.messageCount, generated.fromMessageAt, generated.toMessageAt, now, existingRows[0].id],
      );
      return generated;
    }

    await executeQuery(
      `INSERT INTO \`lead_conversation_summaries\`
       (\`id\`, \`conversationId\`, \`workspaceId\`, \`leadId\`, \`summary\`, \`messageCount\`, \`fromMessageAt\`, \`toMessageAt\`, \`createdAt\`, \`updatedAt\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), conversationId, workspaceId, leadId, generated.summary, generated.messageCount, generated.fromMessageAt, generated.toMessageAt, now, now],
    );
    return generated;
  },

  async listConversations(workspaceId) {
    if (!workspaceId) return [];

    const rows = await queryRows(
      `SELECT c.\`id\`, c.\`leadId\`, c.\`channelId\`, c.\`chatJid\`, c.\`phoneNumber\`, c.\`displayName\`, c.\`avatarUrl\`,
              c.\`status\`, c.\`lastMessageText\`, c.\`lastMessageDirection\`, c.\`lastMessageAt\`,
              (
                SELECT s.\`summary\`
                FROM \`lead_conversation_summaries\` s
                WHERE s.\`conversationId\` = c.\`id\`
                ORDER BY s.\`updatedAt\` DESC
                LIMIT 1
              ) AS latestSummary
       FROM \`lead_conversations\` c
       WHERE c.\`workspaceId\` = ?
       ORDER BY c.\`lastMessageAt\` DESC, c.\`updatedAt\` DESC`,
      [workspaceId],
    );

    return rows.map(mapStoredConversation);
  },

  async getConversationMessages(workspaceId, contactId) {
    const safeContactId = normalizeText(contactId);
    if (!workspaceId || !safeContactId) return [];

    const rows = await queryRows(
      `SELECT \`waMessageId\`, \`chatJid\`, \`text\`, \`sentAt\`, \`direction\`, \`fromMe\`, \`pushName\`, \`status\`, \`messageType\`,
              \`mimeType\`, \`caption\`, \`fileName\`, \`hasMedia\`, \`deletedForEveryone\`, \`avatarUrl\`,
              \`contactDisplayName\`, \`contactPhoneNumber\`, \`contactVcard\`, \`quotedMessageId\`, \`quotedMessageText\`
       FROM \`lead_conversation_messages\`
       WHERE \`workspaceId\` = ?
         AND (\`chatJid\` = ? OR \`leadId\` = ?)
       ORDER BY \`sentAt\` ASC, \`waMessageId\` ASC`,
      [workspaceId, safeContactId, safeContactId],
    );

    return rows.map(mapStoredMessage);
  },

  async getConversationSummary(workspaceId, contactId) {
    const safeContactId = normalizeText(contactId);
    if (!workspaceId || !safeContactId) return null;

    const conversationRows = await queryRows(
      `SELECT \`id\`, \`leadId\`
       FROM \`lead_conversations\`
       WHERE \`workspaceId\` = ?
         AND (\`chatJid\` = ? OR \`leadId\` = ?)
       ORDER BY \`updatedAt\` DESC
       LIMIT 1`,
      [workspaceId, safeContactId, safeContactId],
    );
    const conversation = conversationRows[0] || null;
    if (!conversation?.id) return null;

    const summaryRows = await queryRows(
      `SELECT \`summary\`, \`messageCount\`, \`fromMessageAt\`, \`toMessageAt\`, \`updatedAt\`
       FROM \`lead_conversation_summaries\`
       WHERE \`workspaceId\` = ? AND \`conversationId\` = ?
       ORDER BY \`updatedAt\` DESC
       LIMIT 1`,
      [workspaceId, conversation.id],
    );

    if (!summaryRows[0]) {
      return this.refreshConversationSummary(workspaceId, conversation.id);
    }

    return {
      summary: summaryRows[0].summary || '',
      messageCount: Number(summaryRows[0].messageCount || 0),
      fromMessageAt: fromSqlDateTime(summaryRows[0].fromMessageAt),
      toMessageAt: fromSqlDateTime(summaryRows[0].toMessageAt),
      updatedAt: fromSqlDateTime(summaryRows[0].updatedAt),
      leadId: conversation.leadId || null,
      conversationId: conversation.id,
    };
  },
};
