import type { FastifyInstance } from "fastify";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { geocodeAddress } from "../services/geolocation.js";

export async function propertyRoutes(app: FastifyInstance) {
  // GET /api/properties
  app.get("/api/properties", async (_req, reply) => {
    try {
      const rows = await db.query.properties.findMany({
        with: { notes: true, propertyFeature: true },
        orderBy: (p, { desc: d }) => [d(p.createdAt)],
      });
      return reply.send({ data: rows, message: "Properties retrieved successfully", count: rows.length });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve properties" });
    }
  });

  // POST /api/properties
  app.post<{ Body: { name?: string; address?: string } }>("/api/properties", async (req, reply) => {
    try {
      const { name, address } = req.body ?? {};
      if (!name || name.length < 2 || name.length > 255) {
        return reply.status(422).send({ data: null, message: "Property name is required (2-255 chars)." });
      }
      if (!address || address.length < 5 || address.length > 500) {
        return reply.status(422).send({ data: null, message: "Address is required (5-500 chars)." });
      }

      const geo = await geocodeAddress(address);

      const [inserted] = await db.insert(schema.properties).values({
        name,
        address: geo.displayName,
        latitude: String(geo.latitude),
        longitude: String(geo.longitude),
        extraField: geo.extraField,
      }).returning();

      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, inserted.id),
        with: { notes: true, propertyFeature: true },
      });

      return reply.status(201).send({ data: property, message: "Property created successfully" });
    } catch (e) {
      app.log.error(e);
      const msg = e instanceof Error ? e.message : "Failed to create property";
      return reply.status(422).send({ data: null, message: `Failed to create property: ${msg}` });
    }
  });

  // GET /api/properties/:id
  app.get<{ Params: { id: string } }>("/api/properties/:id", async (req, reply) => {
    try {
      const id = Number(req.params.id);
      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, id),
        with: { notes: true, propertyFeature: true },
      });
      if (!property) {
        return reply.status(404).send({ data: null, message: "Property not found" });
      }
      return reply.send({ data: property, message: "Property retrieved successfully" });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve property" });
    }
  });

  // POST /api/properties/search
  app.post<{ Body: { criteria?: Record<string, unknown>; limit?: number } }>("/api/properties/search", async (req, reply) => {
    try {
      const criteria = req.body?.criteria ?? {};
      const limit = Math.min(200, Math.max(1, Number(req.body?.limit ?? 50)));

      let query = db
        .select()
        .from(schema.properties)
        .innerJoin(schema.propertyFeatures, eq(schema.properties.id, schema.propertyFeatures.propertyId))
        .orderBy(desc(schema.properties.createdAt))
        .limit(limit);

      const conditions = [];

      if (criteria.recommended_use) {
        conditions.push(sql`LOWER(${schema.propertyFeatures.recommendedUse}) LIKE ${`%${String(criteria.recommended_use).toLowerCase()}%`}`);
      }
      if (criteria.near_subway != null) {
        conditions.push(eq(schema.propertyFeatures.nearSubway, Boolean(criteria.near_subway)));
      }
      if (criteria.parking_required != null) {
        conditions.push(eq(schema.propertyFeatures.parkingAvailable, Boolean(criteria.parking_required)));
      }
      if (criteria.min_capacity) {
        conditions.push(gte(schema.propertyFeatures.estimatedCapacityPeople, Number(criteria.min_capacity)));
      }
      if (criteria.max_capacity) {
        conditions.push(lte(schema.propertyFeatures.estimatedCapacityPeople, Number(criteria.max_capacity)));
      }
      if (criteria.min_condition) {
        conditions.push(gte(schema.propertyFeatures.conditionRating, Number(criteria.min_condition)));
      }
      if (criteria.needs_renovation != null) {
        conditions.push(eq(schema.propertyFeatures.needsRenovation, Boolean(criteria.needs_renovation)));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const rows = await query;

      const properties = rows.map((r) => ({
        ...r.properties,
        property_feature: r.property_features,
      }));

      return reply.send({
        data: { properties, count: properties.length, criteria },
        message: "Properties search completed",
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to search properties" });
    }
  });

  // POST /api/properties/by-ids
  app.post<{ Body: { ids?: number[] } }>("/api/properties/by-ids", async (req, reply) => {
    try {
      const ids = (req.body?.ids ?? []).map(Number);
      if (ids.length === 0) {
        return reply.send({ data: { properties: [], count: 0 }, message: "Properties retrieved successfully" });
      }

      const rows = await db.query.properties.findMany({
        where: inArray(schema.properties.id, ids),
        with: { notes: true, propertyFeature: true },
      });

      const map = new Map(rows.map((r) => [r.id, r]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean);

      return reply.send({
        data: { properties: ordered, count: ordered.length },
        message: "Properties retrieved successfully",
      });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to load properties" });
    }
  });
}
