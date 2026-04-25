ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "avg_jitter_ms" integer;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "avg_rtt_ms" integer;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "reconnect_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "telemetry_samples" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "connection_quality" text;
--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY channel_id
      ORDER BY started_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM calls
  WHERE type = 'channel'
    AND is_active = true
    AND channel_id IS NOT NULL
)
UPDATE calls
SET is_active = false,
    status = 'ended',
    ended_at = COALESCE(ended_at, now())
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY LEAST(caller_id, callee_id), GREATEST(caller_id, callee_id)
      ORDER BY started_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM calls
  WHERE type = 'direct'
    AND is_active = true
    AND caller_id IS NOT NULL
    AND callee_id IS NOT NULL
)
UPDATE calls
SET is_active = false,
    status = 'ended',
    ended_at = COALESCE(ended_at, now())
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calls_active_channel_unique_idx"
ON "calls" ("channel_id")
WHERE "type" = 'channel'
  AND "is_active" = true
  AND "channel_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calls_active_direct_pair_unique_idx"
ON "calls" (LEAST("caller_id", "callee_id"), GREATEST("caller_id", "callee_id"))
WHERE "type" = 'direct'
  AND "is_active" = true
  AND "caller_id" IS NOT NULL
  AND "callee_id" IS NOT NULL;
