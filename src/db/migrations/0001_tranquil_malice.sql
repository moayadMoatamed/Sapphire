CREATE TABLE "chat_idea_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"mini_round_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_idea_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"mini_round_index" integer DEFAULT 0 NOT NULL,
	"confidence" varchar(16) DEFAULT 'medium' NOT NULL,
	"linked_book_entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
