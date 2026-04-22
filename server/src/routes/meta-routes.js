import { config } from '../config.js';
import { readJsonBody, sendJson } from '../http.js';

const getMetaVerifyToken = () => String(process.env.META_WEBHOOK_VERIFY_TOKEN || config.metaWebhookVerifyToken || '').trim();

const sendText = (res, status, text) => {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(String(text || ''));
};

const handleMetaWebhookVerification = (res, query = {}) => {
  const mode = String(query['hub.mode'] || '').trim();
  const verifyToken = String(query['hub.verify_token'] || '').trim();
  const challenge = String(query['hub.challenge'] || '').trim();
  const expectedToken = getMetaVerifyToken();

  if (!mode || !challenge) {
    sendJson(res, 400, { error: 'Missing Meta webhook verification params.' });
    return true;
  }

  if (mode !== 'subscribe') {
    sendJson(res, 400, { error: 'Unsupported Meta webhook mode.', mode });
    return true;
  }

  if (expectedToken && verifyToken !== expectedToken) {
    sendJson(res, 403, { error: 'Meta webhook verification token mismatch.' });
    return true;
  }

  sendText(res, 200, challenge);
  return true;
};

const handleMetaWebhookEvent = async (req, res) => {
  const body = await readJsonBody(req);
  sendJson(res, 200, {
    ok: true,
    received: true,
    source: 'meta-webhook',
    entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
  });
  return true;
};

const handleMetaSend = async (req, res) => {
  const body = await readJsonBody(req);
  const phoneNumberId = String(body?.phoneNumberId || '').trim();
  const accessToken = String(body?.accessToken || '').trim();
  const testPhoneNumber = String(body?.testPhoneNumber || '').replace(/[^\d]/g, '').trim();

  if (!phoneNumberId || !accessToken || !testPhoneNumber) {
    sendJson(res, 400, {
      error: 'Missing required Meta send params.',
      details: 'phoneNumberId, accessToken y testPhoneNumber son obligatorios.',
    });
    return true;
  }

  const metaUrl = `https://graph.facebook.com/v18.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: testPhoneNumber,
    type: 'template',
    template: {
      name: 'hello_world',
      language: {
        code: 'en_US',
      },
    },
  };

  try {
    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let metaData = {};

    if (rawText) {
      try {
        metaData = JSON.parse(rawText);
      } catch {
        metaData = { raw: rawText };
      }
    }

    if (!response.ok) {
      const metaMessage =
        metaData?.error?.message
        || metaData?.error?.error_user_msg
        || metaData?.raw
        || 'Meta rejected the request.';

      sendJson(res, response.status || 502, {
        error: 'Meta send failed.',
        details: metaMessage,
        meta: metaData,
      });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      accepted: true,
      recipient: testPhoneNumber,
      meta: metaData,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: 'Unable to reach Meta Graph API.',
      details: error?.message || 'Unknown Meta connection error.',
    });
  }
  return true;
};

export const handleMetaRoutes = async (req, res, { pathname, query }) => {
  if (pathname === '/api/meta/webhook' && req.method === 'GET') {
    return handleMetaWebhookVerification(res, query);
  }

  if (pathname === '/api/meta/webhook' && req.method === 'POST') {
    return handleMetaWebhookEvent(req, res);
  }

  if (pathname === '/api/meta/send' && req.method === 'POST') {
    return handleMetaSend(req, res);
  }

  return false;
};
