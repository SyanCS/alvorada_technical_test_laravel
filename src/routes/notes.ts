import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function noteRoutes(app: FastifyInstance) {
  // GET /api/notes?property_id=N
  app.get<{ Querystring: { property_id?: string } }>("/api/notes", async (req, reply) => {
    try {
      const propertyId = Number(req.query.property_id);
      if (!propertyId || isNaN(propertyId)) {
        return reply.status(400).send({ data: null, message: "Invalid or missing property_id parameter" });
      }

      const rows = await db.query.notes.findMany({
        where: eq(schema.notes.propertyId, propertyId),
        orderBy: (n, { desc: d }) => [d(n.createdAt)],
      });

      return reply.send({ data: rows, message: "Notes retrieved successfully", count: rows.length });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to retrieve notes" });
    }
  });

  // POST /api/notes
  app.post<{ Body: { property_id?: number; note?: string } }>("/api/notes", async (req, reply) => {
    try {
      const { property_id, note } = req.body ?? {};
      if (!property_id) {
        return reply.status(422).send({ data: null, message: "Property ID is required." });
      }
      if (!note || note.length > 5000) {
        return reply.status(422).send({ data: null, message: "Note content is required (max 5000 chars)." });
      }

      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, property_id),
      });
      if (!property) {
        return reply.status(422).send({ data: null, message: "Property not found." });
      }

      const [inserted] = await db.insert(schema.notes).values({
        propertyId: property_id,
        note,
      }).returning();

      return reply.status(201).send({ data: inserted, message: "Note added successfully" });
    } catch (e) {
      app.log.error(e);
      return reply.status(500).send({ data: null, message: "Failed to add note" });
    }
  });
}
