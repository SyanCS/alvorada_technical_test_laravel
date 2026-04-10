import { pgTable, serial, varchar, text, decimal, json, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  address: varchar("address", { length: 255 }).unique().notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  extraField: json("extra_field"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }).notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertyFeatures = pgTable("property_features", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }).unique().notNull(),
  nearSubway: boolean("near_subway"),
  needsRenovation: boolean("needs_renovation"),
  parkingAvailable: boolean("parking_available"),
  hasElevator: boolean("has_elevator"),
  estimatedCapacityPeople: integer("estimated_capacity_people"),
  floorLevel: integer("floor_level"),
  conditionRating: integer("condition_rating"),
  recommendedUse: varchar("recommended_use", { length: 100 }),
  amenities: json("amenities").$type<string[]>(),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  sourceNotesCount: integer("source_notes_count"),
  rawAiResponse: json("raw_ai_response"),
  extractedAt: timestamp("extracted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const propertiesRelations = relations(properties, ({ many, one }) => ({
  notes: many(notes),
  propertyFeature: one(propertyFeatures, {
    fields: [properties.id],
    references: [propertyFeatures.propertyId],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  property: one(properties, {
    fields: [notes.propertyId],
    references: [properties.id],
  }),
}));

export const propertyFeaturesRelations = relations(propertyFeatures, ({ one }) => ({
  property: one(properties, {
    fields: [propertyFeatures.propertyId],
    references: [properties.id],
  }),
}));
