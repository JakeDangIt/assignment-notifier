-- Per-user tenancy: Neon Auth `user.id` on every tenant-owned table.
-- Existing singleton/global rows keep `user_id` NULL (orphaned, unused) unless
-- `npm run db:seed` is run with MIGRATE_TO_USER_ID set.
ALTER TABLE "settings" DROP CONSTRAINT "settings_singleton";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "id_uuid" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "settings" RENAME COLUMN "id_uuid" TO "id";--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "default_reminder_rules" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "scheduled_notifications" AS sn
SET "user_id" = a."user_id"
FROM "assignments" AS a
WHERE sn."assignment_id" = a."id" AND sn."user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "assignments_user_due_at_idx" ON "assignments" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "default_reminder_rules_user_idx" ON "default_reminder_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_user_idx" ON "scheduled_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_user_id_idx" ON "settings" USING btree ("user_id");
