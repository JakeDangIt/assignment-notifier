CREATE TYPE "public"."delivery_status" AS ENUM('sent', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_reason" AS ENUM('quiet_hours_substituted', 'quiet_hours_dropped', 'deduped', 'past_coalesced', 'past_skipped', 'overdue_nudge');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'enqueued', 'sending', 'sent', 'failed', 'canceled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."past_reminder_policy" AS ENUM('fire_now', 'skip');--> statement-breakpoint
CREATE TYPE "public"."rule_kind" AS ENUM('offset', 'time_of_day', 'absolute');--> statement-breakpoint
CREATE TYPE "public"."rule_origin" AS ENUM('default', 'manual');--> statement-breakpoint
CREATE TYPE "public"."substitution_strategy" AS ENUM('evening_before', 'shift_to_quiet_end', 'drop');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"class_name" text,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_title_not_blank" CHECK (length(trim("assignments"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "default_reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "rule_kind" NOT NULL,
	"offset_minutes" integer,
	"day_offset" integer,
	"time_local" time,
	"label" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "default_rule_kind_allowed" CHECK ("default_reminder_rules"."kind" IN ('offset', 'time_of_day')),
	CONSTRAINT "default_rule_shape" CHECK ((
      ("default_reminder_rules"."kind" = 'offset' AND "default_reminder_rules"."offset_minutes" IS NOT NULL
        AND "default_reminder_rules"."day_offset" IS NULL AND "default_reminder_rules"."time_local" IS NULL)
      OR ("default_reminder_rules"."kind" = 'time_of_day' AND "default_reminder_rules"."day_offset" IS NOT NULL
        AND "default_reminder_rules"."time_local" IS NOT NULL AND "default_reminder_rules"."offset_minutes" IS NULL)
      OR ("default_reminder_rules"."kind" = 'absolute' AND "default_reminder_rules"."offset_minutes" IS NULL
        AND "default_reminder_rules"."day_offset" IS NULL AND "default_reminder_rules"."time_local" IS NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_notification_id" uuid NOT NULL,
	"subscription_id" uuid,
	"status" "delivery_status" NOT NULL,
	"http_status" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"kind" "rule_kind" NOT NULL,
	"offset_minutes" integer,
	"day_offset" integer,
	"time_local" time,
	"absolute_at" timestamp with time zone,
	"label" text,
	"origin" "rule_origin" DEFAULT 'manual' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_rule_shape" CHECK ((
      ("reminder_rules"."kind" = 'offset' AND "reminder_rules"."offset_minutes" IS NOT NULL
        AND "reminder_rules"."day_offset" IS NULL AND "reminder_rules"."time_local" IS NULL)
      OR ("reminder_rules"."kind" = 'time_of_day' AND "reminder_rules"."day_offset" IS NOT NULL
        AND "reminder_rules"."time_local" IS NOT NULL AND "reminder_rules"."offset_minutes" IS NULL)
      OR ("reminder_rules"."kind" = 'absolute' AND "reminder_rules"."offset_minutes" IS NULL
        AND "reminder_rules"."day_offset" IS NULL AND "reminder_rules"."time_local" IS NULL)
    )),
	CONSTRAINT "reminder_rule_absolute_at" CHECK (("reminder_rules"."kind" = 'absolute') = ("reminder_rules"."absolute_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"rule_id" uuid,
	"fire_at" timestamp with time zone NOT NULL,
	"original_fire_at" timestamp with time zone,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"reason" "notification_reason",
	"qstash_message_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"quiet_enabled" boolean DEFAULT true NOT NULL,
	"quiet_start_local" time DEFAULT '00:00:00' NOT NULL,
	"quiet_end_local" time DEFAULT '07:00:00' NOT NULL,
	"substitution_strategy" "substitution_strategy" DEFAULT 'evening_before' NOT NULL,
	"substitution_time_local" time DEFAULT '21:00:00' NOT NULL,
	"allow_due_time_in_quiet" boolean DEFAULT true NOT NULL,
	"dedupe_window_minutes" integer DEFAULT 15 NOT NULL,
	"past_reminder_policy" "past_reminder_policy" DEFAULT 'fire_now' NOT NULL,
	"overdue_nudge_enabled" boolean DEFAULT true NOT NULL,
	"overdue_nudge_delay_minutes" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_dedupe_window_nonneg" CHECK ("settings"."dedupe_window_minutes" >= 0),
	CONSTRAINT "settings_overdue_delay_nonneg" CHECK ("settings"."overdue_nudge_delay_minutes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_scheduled_notification_id_scheduled_notifications_id_fk" FOREIGN KEY ("scheduled_notification_id") REFERENCES "public"."scheduled_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_rule_id_reminder_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."reminder_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_due_at_idx" ON "assignments" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" USING btree ("scheduled_notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_created_idx" ON "notification_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_disabled_idx" ON "push_subscriptions" USING btree ("disabled_at");--> statement-breakpoint
CREATE INDEX "reminder_rules_assignment_idx" ON "reminder_rules" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_status_fire_at_idx" ON "scheduled_notifications" USING btree ("status","fire_at");--> statement-breakpoint
CREATE INDEX "scheduled_notifications_assignment_idx" ON "scheduled_notifications" USING btree ("assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_notifications_live_slot_idx" ON "scheduled_notifications" USING btree ("assignment_id","fire_at") WHERE status NOT IN ('canceled', 'skipped');