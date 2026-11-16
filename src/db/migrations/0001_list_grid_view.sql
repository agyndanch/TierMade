CREATE TYPE "public"."list_view" AS ENUM('list', 'grid');--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "view" "list_view" DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "grid_columns" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "grid_rows" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "show_numbers" boolean DEFAULT true NOT NULL;