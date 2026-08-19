CREATE TABLE `recipient_directory` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(350) NOT NULL,
	`normalizedName` varchar(350) NOT NULL,
	`valuesJson` text NOT NULL,
	`source` enum('import','manual') NOT NULL DEFAULT 'import',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipient_directory_id` PRIMARY KEY(`id`),
	CONSTRAINT `recipient_directory_user_normalized_name_idx` UNIQUE(`userId`,`normalizedName`)
);
--> statement-breakpoint
CREATE INDEX `recipient_directory_user_updated_idx` ON `recipient_directory` (`userId`,`updatedAt`);