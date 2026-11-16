CREATE TYPE "public"."file_source" AS ENUM('upload', 'recording');--> statement-breakpoint
ALTER TYPE "public"."file_status" ADD VALUE IF NOT EXISTS 'processing';--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "processing_error" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "source" "public"."file_source" DEFAULT 'upload' NOT NULL;
