import "../envBootstrap.js";
import { db, schema } from "./index.js";
import { getNeo4jDriver, closeNeo4jDriver } from "../services/neo4jService.js";
import neo4j from "neo4j-driver";

// ---------------------------------------------------------------------------
// Concept pools
// ---------------------------------------------------------------------------
const NEIGHBORHOODS = [
  "Downtown", "Midtown", "Uptown", "Waterfront",
  "Arts District", "Tech Corridor", "Historic Quarter", "Industrial Park",
];

const LANDMARKS = [
  { name: "Central Station", type: "transit" },
  { name: "Metro Hub", type: "transit" },
  { name: "City Park", type: "park" },
  { name: "Riverside Green", type: "park" },
  { name: "State University", type: "education" },
  { name: "Community College", type: "education" },
  { name: "Convention Center", type: "commercial" },
  { name: "Shopping Mall", type: "commercial" },
  { name: "General Hospital", type: "medical" },
  { name: "Medical Plaza", type: "medical" },
  { name: "City Hall", type: "civic" },
  { name: "Public Library", type: "civic" },
];

const AMENITIES = [
  "lobby", "security", "gym", "rooftop", "conference-rooms",
  "co-working", "bike-storage", "ev-charging", "loading-dock", "courtyard",
  "pool", "cafe", "daycare", "storage-units", "concierge",
];

const USE_TYPES = [
  "office", "retail", "restaurant", "warehouse",
  "medical", "residential", "mixed-use", "tech",
];

// ---------------------------------------------------------------------------
// Assignment helpers
// ---------------------------------------------------------------------------
interface PropertyRow {
  id: number;
  features: {
    nearSubway: boolean | null;
    needsRenovation: boolean | null;
    parkingAvailable: boolean | null;
    hasElevator: boolean | null;
    estimatedCapacityPeople: number | null;
    conditionRating: number | null;
    recommendedUse: string | null;
    amenities: string[] | null;
  } | null;
}

const SECONDARY_USE: Record<string, string> = {
  office: "mixed-use",
  warehouse: "retail",
  restaurant: "retail",
  tech: "office",
  medical: "office",
  retail: "mixed-use",
  residential: "mixed-use",
  "mixed-use": "office",
  studio: "mixed-use",
};

const NEIGHBORHOOD_AFFINITY: Record<string, string[]> = {
  office:      ["Downtown", "Midtown", "Tech Corridor"],
  tech:        ["Downtown", "Midtown", "Tech Corridor"],
  retail:      ["Midtown", "Arts District", "Uptown"],
  restaurant:  ["Midtown", "Arts District", "Uptown"],
  warehouse:   ["Industrial Park", "Waterfront"],
  medical:     ["Midtown", "Uptown"],
  residential: ["Uptown", "Historic Quarter", "Waterfront"],
  "mixed-use": ["Arts District", "Downtown", "Waterfront"],
  studio:      ["Arts District", "Downtown", "Waterfront"],
};

function pick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function pickRange<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return pick(arr, n);
}

function assignUseTypes(row: PropertyRow): string[] {
  const use = row.features?.recommendedUse;
  if (!use) return pick(USE_TYPES, 1 + Math.round(Math.random()));

  // Map "studio" to "mixed-use" since there's no studio UseType
  const primary = USE_TYPES.includes(use) ? use : "mixed-use";
  const result = [primary];

  // 50% chance of secondary
  if (Math.random() < 0.5 && SECONDARY_USE[use]) {
    const secondary = SECONDARY_USE[use];
    if (secondary !== primary) result.push(secondary);
  }
  return result;
}

function assignAmenities(row: PropertyRow): string[] {
  const featureAmenities = row.features?.amenities ?? [];
  // Match feature amenities against the Neo4j pool
  const matched = featureAmenities.filter((a) => AMENITIES.includes(a));

  if (matched.length >= 4) return matched.slice(0, 4);
  if (matched.length >= 2) {
    // Pad to 2-4 total
    const remaining = AMENITIES.filter((a) => !matched.includes(a));
    const extra = pick(remaining, Math.floor(Math.random() * 2) + (2 - matched.length));
    return [...matched, ...extra].slice(0, 4);
  }
  // Fewer than 2 matches: pad with random
  const remaining = AMENITIES.filter((a) => !matched.includes(a));
  const padCount = 2 + Math.floor(Math.random() * 3) - matched.length; // target 2-4
  return [...matched, ...pick(remaining, padCount)].slice(0, 4);
}

function assignNeighborhoods(row: PropertyRow): string[] {
  const use = row.features?.recommendedUse ?? "";
  const affinity = NEIGHBORHOOD_AFFINITY[use];
  if (affinity) return pickRange(affinity, 1, 2);
  return pickRange(NEIGHBORHOODS, 1, 2);
}

function assignLandmarks(row: PropertyRow): { name: string; type: string }[] {
  const f = row.features;
  const assigned: { name: string; type: string }[] = [];
  const usedNames = new Set<string>();

  function addCandidate(candidates: { name: string; type: string }[]) {
    const available = candidates.filter((c) => !usedNames.has(c.name));
    if (available.length > 0) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      assigned.push(chosen);
      usedNames.add(chosen.name);
    }
  }

  if (f) {
    // Feature-driven picks
    if (f.nearSubway) {
      addCandidate(LANDMARKS.filter((l) => l.type === "transit"));
    }
    if (f.hasElevator && (f.estimatedCapacityPeople ?? 0) >= 200) {
      addCandidate(LANDMARKS.filter((l) => l.type === "commercial"));
    }
    if ((f.conditionRating ?? 0) >= 4) {
      addCandidate(LANDMARKS.filter((l) => l.type === "park"));
    }
    if (f.recommendedUse === "medical") {
      addCandidate(LANDMARKS.filter((l) => l.type === "medical"));
    }
  }

  // Fill to 2-3 total
  const target = 2 + Math.floor(Math.random() * 2); // 2 or 3
  while (assigned.length < target) {
    const available = LANDMARKS.filter((l) => !usedNames.has(l.name));
    if (available.length === 0) break;
    const chosen = available[Math.floor(Math.random() * available.length)];
    assigned.push(chosen);
    usedNames.add(chosen.name);
  }

  return assigned;
}
