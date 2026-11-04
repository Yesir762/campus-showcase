CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_username_unique` ON `admins` (`username`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`status` text NOT NULL,
	`bytes` integer NOT NULL,
	`key` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`adminId` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`assetId` text NOT NULL,
	`resultId` text,
	`state` text NOT NULL,
	`error` text,
	`lease` text,
	`leaseUntil` integer,
	`startedAt` integer,
	`updatedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversion_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`lastSeen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`sceneId` text NOT NULL,
	`data` text NOT NULL,
	`createdAt` integer NOT NULL,
	`adminId` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`published` text,
	`position` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`adminId` text NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`assetId` text NOT NULL,
	`uploadId` text NOT NULL,
	`key` text NOT NULL,
	`bytes` integer NOT NULL,
	`parts` text DEFAULT '[]' NOT NULL,
	`createdAt` integer NOT NULL
);
