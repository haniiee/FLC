ALTER TABLE "files" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "files_group_direct_kind_number_uq" ON "files" USING btree ("group_id","kind","number") WHERE "files"."session_id" is null AND "files"."topic_id" is null;
