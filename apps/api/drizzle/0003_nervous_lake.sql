CREATE TYPE "public"."chat_channel_kind" AS ENUM('all', 'students');--> statement-breakpoint
CREATE TYPE "public"."chat_message_type" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" "chat_channel_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_channels_group_kind_uq" UNIQUE("group_id","kind")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"type" "chat_message_type" NOT NULL,
	"text" text,
	"storage_key" text,
	"mime_type" text,
	"size_bytes" bigint,
	"duration_ms" integer,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"reply_to_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_chat_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_created_id_idx" ON "chat_messages" USING btree ("channel_id","created_at" DESC,"id");--> statement-breakpoint
INSERT INTO chat_channels (id, group_id, kind, created_at)
SELECT gen_random_uuid(), g.id, k.kind, now()
FROM groups g
CROSS JOIN (VALUES ('all'::chat_channel_kind), ('students'::chat_channel_kind)) AS k(kind)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels c WHERE c.group_id = g.id AND c.kind = k.kind
);
