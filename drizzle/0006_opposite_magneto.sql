ALTER TABLE `campaigns` ADD `styleJson` text;--> statement-breakpoint
ALTER TABLE `letter_templates` ADD `parentTemplateId` varchar(32);--> statement-breakpoint
ALTER TABLE `letter_templates` ADD `versionNumber` int DEFAULT 1 NOT NULL;