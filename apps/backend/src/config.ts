import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`❌ Missing required environment variable: ${key}`);
    }
    return "";
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(optional("PORT", "3000")),
  jwt: {
    secret: required("JWT_SECRET") || "dev-secret-only",
  },
  db: {
    url: required("DATABASE_URL"),
  },
  redis: {
    url: optional("VALKEY_URL", "redis://localhost:6379"),
  },
  s3: {
    endpoint: optional("S3_ENDPOINT", "http://localhost:9000"),
    publicUrl: optional("S3_PUBLIC_URL", "http://localhost:9000"),
    region: optional("S3_REGION", "us-east-1"),
    accessKey: optional("S3_ACCESS_KEY", "minioadmin"),
    secretKey: optional("S3_SECRET_KEY", "minioadmin"),
    bucket: optional("S3_BUCKET", "sori"),
  },
  livekit: {
    url: optional("LIVEKIT_URL", "http://livekit:7880"),
    apiKey: optional("LIVEKIT_API_KEY", "devkey"),
    apiSecret: optional("LIVEKIT_API_SECRET", "secret"),
  },
  cors: {
    allowedOrigins: optional("ALLOWED_ORIGINS", "https://sori-web.sori.orb.local,http://localhost:5173").split(","),
  },
  storage: {
    logRetentionDays: Number(optional("LOG_RETENTION_DAYS", "3")),
  },
  logging: {
    level: optional("LOG_LEVEL", "info"),
    sampleRate: Number(optional("LOG_SAMPLE_RATE", "1.0")),
  },
  security: {
    isProduction: process.env.NODE_ENV === "production",
  },
  alerts: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  }
};

export const validateConfig = () => {
  const missing = [];
  if (!config.jwt.secret && config.env === "production") missing.push("JWT_SECRET");
  if (!config.db.url) missing.push("DATABASE_URL");
  
  if (missing.length > 0) {
    console.error(`❌ [Fatal] Missing critical configuration: ${missing.join(", ")}`);
    process.exit(1);
  }
};
