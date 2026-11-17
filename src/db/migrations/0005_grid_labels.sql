ALTER TABLE "lists" ALTER COLUMN "view" SET DEFAULT 'grid';--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "show_titles" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "show_creators" boolean DEFAULT true NOT NULL;