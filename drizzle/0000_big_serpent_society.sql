CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"extra_field" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "properties_name_unique" UNIQUE("name"),
	CONSTRAINT "properties_address_unique" UNIQUE("address")
);
--> statement-breakpoint
CREATE TABLE "property_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" integer NOT NULL,
	"near_subway" boolean,
	"needs_renovation" boolean,
	"parking_available" boolean,
	"has_elevator" boolean,
	"estimated_capacity_people" integer,
	"floor_level" integer,
	"condition_rating" integer,
	"recommended_use" varchar(100),
	"amenities" json,
	"confidence_score" numeric(3, 2),
	"source_notes_count" integer,
	"raw_ai_response" json,
	"extracted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "property_features_property_id_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_features" ADD CONSTRAINT "property_features_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;