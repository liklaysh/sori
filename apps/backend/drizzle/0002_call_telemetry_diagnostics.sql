ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "min_bitrate" integer;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "max_packet_loss" text;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "max_jitter_ms" integer;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "max_rtt_ms" integer;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "avg_connection_quality" text;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "excellent_samples" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "good_samples" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "poor_samples" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "lost_samples" integer DEFAULT 0;
