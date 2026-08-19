ALTER TABLE `campaign_recipients` ADD `valuesJson` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `dataSourceType` varchar(20) DEFAULT 'excel' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `mappingsJson` text;--> statement-breakpoint
ALTER TABLE `letter_templates` ADD `fieldsJson` text;
--> statement-breakpoint
ALTER TABLE `campaign_recipients` ADD `valuesJson` text;
