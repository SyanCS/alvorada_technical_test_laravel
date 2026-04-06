<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

/**
 * Geolocation Service
 * Handles address geocoding using OpenStreetMap Nominatim API.
 */
class GeolocationService
{
    private string $baseUrl;
    private string $reverseUrl;
    private string $userAgent;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('geolocation.base_url', 'https://nominatim.openstreetmap.org/search');
        $this->reverseUrl = config('geolocation.reverse_url', 'https://nominatim.openstreetmap.org/reverse');
        $this->userAgent = config('geolocation.user_agent', 'AlvoradaPropertyResearch/1.0');
        $this->timeout = config('geolocation.timeout', 10);
    }

    /**
     * Geocode an address and return enriched data.
     *
     * @throws Exception
     */
    public function geocodeAddress(string $address): array
    {
        if (empty(trim($address))) {
            throw new Exception('Address cannot be empty');
        }

        try {
            $response = Http::timeout($this->timeout)
                ->withUserAgent($this->userAgent)
                ->acceptJson()
                ->get($this->baseUrl, [
                    'q' => $address,
                    'format' => 'json',
                    'limit' => 1,
                    'addressdetails' => 1,
                    'extratags' => 1,
                ]);

            if ($response->failed()) {
                throw new Exception('Nominatim API request failed with status ' . $response->status());
            }

            $results = $response->json();

            if (empty($results)) {
                throw new Exception('No results found for the provided address');
            }

            $result = $results[0];

            $latitude = (float) $result['lat'];
            $longitude = (float) $result['lon'];

            $extraData = [
                'display_name' => $result['display_name'] ?? '',
                'type' => $result['type'] ?? '',
                'class' => $result['class'] ?? '',
                'importance' => $result['importance'] ?? 0,
                'place_id' => $result['place_id'] ?? null,
                'osm_type' => $result['osm_type'] ?? '',
                'osm_id' => $result['osm_id'] ?? null,
                'boundingbox' => $result['boundingbox'] ?? [],
            ];

            return [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'extra_field' => $extraData,
                'display_name' => $result['display_name'] ?? $address,
            ];
        } catch (Exception $e) {
            Log::error('GeolocationService Error: ' . $e->getMessage());
            throw new Exception('Failed to geocode address: ' . $e->getMessage());
        }
    }

    /**
     * Reverse geocode: get address from coordinates.
     *
     * @throws Exception
     */
    public function reverseGeocode(float $latitude, float $longitude): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->withUserAgent($this->userAgent)
                ->acceptJson()
                ->get($this->reverseUrl, [
                    'lat' => $latitude,
                    'lon' => $longitude,
                    'format' => 'json',
                    'addressdetails' => 1,
                ]);

            $data = $response->json();

            return [
                'address' => $data['display_name'] ?? 'Unknown location',
                'address_details' => $data['address'] ?? [],
            ];
        } catch (Exception $e) {
            Log::error('ReverseGeocode Error: ' . $e->getMessage());
            throw new Exception('Failed to reverse geocode: ' . $e->getMessage());
        }
    }

    /**
     * Validate coordinates.
     */
    public function validateCoordinates(float $latitude, float $longitude): bool
    {
        return $latitude >= -90 && $latitude <= 90 && $longitude >= -180 && $longitude <= 180;
    }
}
