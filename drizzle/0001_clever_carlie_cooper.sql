CREATE TABLE `campaign_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` varchar(32) NOT NULL,
	`name` varchar(350) NOT NULL,
	`warning` text,
	`position` int NOT NULL,
	`status` enum('to_send','sent') NOT NULL DEFAULT 'to_send',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`templateId` varchar(32) NOT NULL,
	`name` varchar(140) NOT NULL,
	`excelFileKey` varchar(500) NOT NULL,
	`excelFileUrl` varchar(600) NOT NULL,
	`recipientCount` int NOT NULL,
	`status` enum('generating','ready','error') NOT NULL DEFAULT 'generating',
	`zipFileKey` varchar(500),
	`zipFileUrl` varchar(600),
	`pdfFileKey` varchar(500),
	`pdfFileUrl` varchar(600),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `letter_templates` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`originalFileName` varchar(220) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(600) NOT NULL,
	`placeholderCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `letter_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `campaign_recipients_campaign_position_idx` ON `campaign_recipients` (`campaignId`,`position`);--> statement-breakpoint
CREATE INDEX `campaigns_user_created_idx` ON `campaigns` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `letter_templates_user_created_idx` ON `letter_templates` (`userId`,`createdAt`);