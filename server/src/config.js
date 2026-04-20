const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  apiHost: process.env.HOST || process.env.API_HOST || '0.0.0.0',
  apiPort: toPositiveInt(process.env.PORT || process.env.API_PORT, 3001),
  sessionTtlMs: toPositiveInt(process.env.SESSION_TTL_MS, 1000 * 60 * 60 * 24 * 7),
  bodyLimitBytes: toPositiveInt(process.env.API_BODY_LIMIT_BYTES, 25 * 1024 * 1024),
  authRateLimit: toPositiveInt(process.env.AUTH_RATE_LIMIT, 10),
  authRateWindowMs: toPositiveInt(process.env.AUTH_RATE_WINDOW_MS, 1000 * 60 * 15),
  corsOrigin: process.env.CORS_ORIGIN || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@bigdata.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'bigdata@',
  mysqlHost: process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1',
  mysqlPort: toPositiveInt(process.env.MYSQL_PORT || process.env.DB_PORT, 3306),
  mysqlUser: process.env.MYSQL_USER || process.env.DB_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'crm_new_2026',
  mysqlConnectionLimit: toPositiveInt(process.env.MYSQL_CONNECTION_LIMIT, 10),
};
