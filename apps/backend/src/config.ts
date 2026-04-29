import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optionalList(key: string, fallback: string): string[] {
  return optional(key, fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(optional("PORT", "3000")),
  jwt: {
    secret: required("JWT_SECRET"),
  },
  db: {
    url: required("DATABASE_URL"),
  },
  redis: {
    url: required("VALKEY_URL"),
  },
  s3: {
    endpoint: required("S3_ENDPOINT"),
    publicUrl: required("S3_PUBLIC_URL"),
    region: optional("S3_REGION", "us-east-1"),
    accessKey: required("S3_ACCESS_KEY"),
    secretKey: required("S3_SECRET_KEY"),
    bucket: required("S3_BUCKET"),
  },
  livekit: {
    url: required("LIVEKIT_URL"),
    apiKey: required("LIVEKIT_API_KEY"),
    apiSecret: required("LIVEKIT_API_SECRET"),
  },
  public: {
    webUrl: required("PUBLIC_WEB_URL"),
    apiUrl: required("PUBLIC_API_URL"),
    wsUrl: required("PUBLIC_WS_URL"),
    livekitUrl: required("PUBLIC_LIVEKIT_URL"),
    mediaUrl: required("PUBLIC_MEDIA_URL"),
    defaultCommunityId: optional("PUBLIC_DEFAULT_COMMUNITY_ID", "default-community"),
  },
  cors: {
    allowedOrigins: required("ALLOWED_ORIGINS").split(","),
  },
  desktop: {
    allowedOrigins: optionalList(
      "DESKTOP_APP_ORIGINS",
      "tauri://localhost,http://tauri.localhost,https://tauri.localhost"
    ),
  },
  storage: {
    logRetentionDays: Number(optional("LOG_RETENTION_DAYS", "3")),
    maxUploadSizeMb: Number(optional("MAX_UPLOAD_SIZE_MB", "25")),
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
  if (!config.jwt.secret) missing.push("JWT_SECRET");
  if (!config.db.url) missing.push("DATABASE_URL");
  if (!config.redis.url) missing.push("VALKEY_URL");
  if (!config.s3.endpoint) missing.push("S3_ENDPOINT");
  if (!config.s3.publicUrl) missing.push("S3_PUBLIC_URL");
  if (!config.s3.accessKey) missing.push("S3_ACCESS_KEY");
  if (!config.s3.secretKey) missing.push("S3_SECRET_KEY");
  if (!config.s3.bucket) missing.push("S3_BUCKET");
  if (!config.livekit.url) missing.push("LIVEKIT_URL");
  if (!config.livekit.apiKey) missing.push("LIVEKIT_API_KEY");
  if (!config.livekit.apiSecret) missing.push("LIVEKIT_API_SECRET");
  if (!config.public.webUrl) missing.push("PUBLIC_WEB_URL");
  if (!config.public.apiUrl) missing.push("PUBLIC_API_URL");
  if (!config.public.wsUrl) missing.push("PUBLIC_WS_URL");
  if (!config.public.livekitUrl) missing.push("PUBLIC_LIVEKIT_URL");
  if (!config.public.mediaUrl) missing.push("PUBLIC_MEDIA_URL");
  if (!config.cors.allowedOrigins.length || !config.cors.allowedOrigins[0]) missing.push("ALLOWED_ORIGINS");
  
  if (missing.length > 0) {
    console.error(`❌ [Fatal] Missing critical configuration: ${missing.join(", ")}`);
    process.exit(1);
  }
};
