import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "5000", 10),
  apiPrefix: process.env.API_PREFIX ?? "/api/v1",

  databaseUrl: requireEnv("DATABASE_URL"),

  jwtSecret: requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseBucketPaymentProof:
    process.env.SUPABASE_BUCKET_PAYMENT_PROOF ?? "payment-proofs",
  supabaseBucketVendorPortfolio:
    process.env.SUPABASE_BUCKET_VENDOR_PORTFOLIO ?? "vendor-portfolios",

  smtpHost: requireEnv("SMTP_HOST"),
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: requireEnv("SMTP_USER"),
  smtpPass: requireEnv("SMTP_PASS"),

  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
} as const;
