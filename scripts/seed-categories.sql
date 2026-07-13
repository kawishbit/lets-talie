INSERT INTO "transaction_categories" ("id", "label", "created_at", "updated_at")
VALUES
	(gen_random_uuid(), 'food', now(), now()),
	(gen_random_uuid(), 'subscriptions', now(), now()),
	(gen_random_uuid(), 'rent', now(), now()),
	(gen_random_uuid(), 'travel', now(), now()),
	(gen_random_uuid(), 'general', now(), now()),
	(gen_random_uuid(), 'miscellaneous', now(), now());
