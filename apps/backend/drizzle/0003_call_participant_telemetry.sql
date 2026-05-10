ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "participant_telemetry" jsonb;
