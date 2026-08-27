CREATE TABLE `campaign_batches` (
	`id` varchar(32) NOT NULL,
	`campaignId` varchar(32) NOT NULL,
	`sourceType` enum('excel','paste','directory','manual') NOT NULL,
	`sourceFileKey` varchar(500),
	`sourceFileUrl` varchar(600),
	`mappingsJson` text,
	`recipientCount` int NOT NULL,
	`includedCount` int NOT NULL,
	`zipFileKey` varchar(500),
	`zipFileUrl` varchar(600),
	`pdfFileKey` varchar(500),
	`pdfFileUrl` varchar(600),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `batchId` varchar(32);--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `origin` enum('import','directory','manual') DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `dedupeKey` varchar(500);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `lifecycleStatus` enum('open','closed') DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `closedAt` timestamp;--> statement-breakpoint
CREATE INDEX `campaign_batches_campaign_created_idx` ON `campaign_batches` (`campaignId`,`createdAt`);