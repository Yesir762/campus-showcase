CREATE UNIQUE INDEX `one_active_conversion_per_asset` ON `conversion_jobs` (`assetId`) WHERE "conversion_jobs"."state" IN ('queued','validating','converting','uploading');--> statement-breakpoint
CREATE INDEX `jobs_claim` ON `conversion_jobs` (`state`,`createdAt`);--> statement-breakpoint
CREATE INDEX `releases_scene` ON `releases` (`sceneId`,`createdAt`);