UPDATE `api_keys`
SET
	`key_prefix` = CASE
		WHEN `key_prefix` = '' THEN substr(`masked_key`, 1, 8)
		ELSE `key_prefix`
	END,
	`fingerprint` = CASE
		WHEN `fingerprint` = '' THEN substr(`secret_hash`, 1, 12)
		ELSE `fingerprint`
	END,
	`deleted_at` = CASE
		WHEN `deleted_at` IS NULL AND `masked_key` LIKE 'artk_%' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		ELSE `deleted_at`
	END,
	`updated_at` = CASE
		WHEN `key_prefix` = '' OR `fingerprint` = '' OR (`deleted_at` IS NULL AND `masked_key` LIKE 'artk_%') THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		ELSE `updated_at`
	END
WHERE
	`key_prefix` = ''
	OR `fingerprint` = ''
	OR (`deleted_at` IS NULL AND `masked_key` LIKE 'artk_%');
-- Custom SQL migration file, put your code below! --