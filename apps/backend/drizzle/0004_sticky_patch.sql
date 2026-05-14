ALTER TABLE "users" ADD COLUMN "noise_suppression_mode" text DEFAULT 'webrtc_basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "web_noise_suppression_fallback_mode" text;--> statement-breakpoint
UPDATE "users"
SET
  "noise_suppression_mode" = CASE
    WHEN "noise_suppression" = true THEN 'rnnoise'
    ELSE 'webrtc_basic'
  END,
  "web_noise_suppression_fallback_mode" = CASE
    WHEN "noise_suppression" = true THEN 'rnnoise'
    ELSE NULL
  END;
