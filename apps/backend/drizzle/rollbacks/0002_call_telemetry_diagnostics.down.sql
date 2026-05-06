ALTER TABLE "calls" DROP COLUMN IF EXISTS "lost_samples";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "poor_samples";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "good_samples";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "excellent_samples";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "avg_connection_quality";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "max_rtt_ms";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "max_jitter_ms";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "max_packet_loss";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "min_bitrate";
