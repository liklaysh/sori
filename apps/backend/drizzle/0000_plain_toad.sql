CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`details` text,
	`timestamp` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`caller_id` text NOT NULL,
	`callee_id` text NOT NULL,
	`status` text NOT NULL,
	`duration` integer,
	`is_read` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `dm_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`callee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `call_participants` (
	`call_id` text,
	`user_id` text,
	`joined_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`left_at` integer,
	PRIMARY KEY(`call_id`, `user_id`),
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'channel' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`channel_id` text,
	`caller_id` text,
	`callee_id` text,
	`is_active` integer DEFAULT true,
	`mos` text,
	`avg_bitrate` integer,
	`packet_loss` text,
	`started_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`ended_at` integer,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`callee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`community_id` text,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`community_id` text,
	`category_id` text,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon_url` text,
	`owner_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `direct_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`file_url` text,
	`file_name` text,
	`file_size` integer,
	`file_type` text,
	`is_read` integer DEFAULT false,
	`is_delivered` integer DEFAULT false,
	`type` text DEFAULT 'text' NOT NULL,
	`call_id` text,
	`link_metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `dm_conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `dm_created_idx` ON `direct_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `dm_conv_idx` ON `direct_messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `dm_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user1_id` text NOT NULL,
	`user2_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000),
	FOREIGN KEY (`user1_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user2_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dm_unique_conv_idx` ON `dm_conversations` (`user1_id`,`user2_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`user_id` text,
	`community_id` text,
	`role` text DEFAULT 'member' NOT NULL,
	PRIMARY KEY(`user_id`, `community_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`author_id` text NOT NULL,
	`channel_id` text,
	`parent_id` text,
	`file_url` text,
	`file_name` text,
	`file_size` integer,
	`file_type` text,
	`is_edited` integer DEFAULT false,
	`edited_at` integer,
	`is_deleted` integer DEFAULT false,
	`type` text DEFAULT 'text' NOT NULL,
	`link_metadata` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `msg_created_idx` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `msg_channel_idx` ON `messages` (`channel_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_reaction_idx` ON `reactions` (`message_id`,`user_id`,`emoji`);--> statement-breakpoint
CREATE TABLE `server_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now') * 1000)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_url` text,
	`status` text DEFAULT 'offline',
	`role` text DEFAULT 'user' NOT NULL,
	`noise_suppression` integer DEFAULT false,
	`mic_gain` integer DEFAULT 100,
	`output_volume` integer DEFAULT 100,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);