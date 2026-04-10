import { config } from "../config.js";

export interface GeocodedAddress {
  latitude: number;
  longitude: number;
  extraField: Record<string, unknown>;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress> {
  if (!address.trim()) {
    throw new Error("Address cannot be empty");
  }

  const url = new URL(config.nominatimBaseUrl);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": config.nominatimUserAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(config.nominatimTimeout),
  });

  if (!res.ok) {
    throw new Error(`Nominatim API request failed with status ${res.status}`);
  }

  const results = (await res.json()) as Record<string, unknown>[];
  if (!results.length) {
    throw new Error("No results found for the provided address");
  }

  const result = results[0];
  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: String(result.display_name ?? address),
    extraField: {
      display_name: result.display_name ?? "",
      type: result.type ?? "",
      class: result.class ?? "",
      importance: result.importance ?? 0,
      place_id: result.place_id ?? null,
      osm_type: result.osm_type ?? "",
      osm_id: result.osm_id ?? null,
      boundingbox: result.boundingbox ?? [],
    },
  };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<{ address: string; addressDetails: Record<string, unknown> }> {
  const url = new URL(config.nominatimReverseUrl);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url, {
    headers: { "User-Agent": config.nominatimUserAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(config.nominatimTimeout),
  });

  const data = (await res.json()) as Record<string, unknown>;
  return {
    address: String(data.display_name ?? "Unknown location"),
    addressDetails: (data.address ?? {}) as Record<string, unknown>,
  };
}
