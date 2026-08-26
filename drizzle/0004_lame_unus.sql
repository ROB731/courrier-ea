ALTER TABLE `campaign_recipients` ADD `dedupeStatus` enum('new','sent_confirmed','review') DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `dedupeReason` text;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `matchedRecipientId` int;--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `matchedCampaignId` varchar(32);--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `includeInGeneration` boolean DEFAULT true NOT NULL;