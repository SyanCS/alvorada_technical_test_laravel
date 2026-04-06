<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePropertyRequest;
use App\Models\Property;
use App\Services\GeolocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Exception;

class PropertyController extends Controller
{
    private GeolocationService $geolocationService;

    public function __construct(GeolocationService $geolocationService)
    {
        $this->geolocationService = $geolocationService;
    }

    /**
     * List all properties.
     */
    public function index(): JsonResponse
    {
        try {
            $properties = Property::with(['notes', 'propertyFeature'])
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'data' => $properties,
                'message' => 'Properties retrieved successfully',
                'count' => $properties->count(),
            ]);
        } catch (Exception $e) {
            Log::error('PropertyController::index Error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to retrieve properties',
            ], 500);
        }
    }

    /**
     * Create a new property with geocoding.
     */
    public function store(StorePropertyRequest $request): JsonResponse
    {
        try {
            // Geocode the address
            $geoData = $this->geolocationService->geocodeAddress($request->address);

            $property = Property::create([
                'name' => $request->name,
                'address' => $geoData['display_name'] ?? $request->address,
                'latitude' => $geoData['latitude'],
                'longitude' => $geoData['longitude'],
                'extra_field' => $geoData['extra_field'],
            ]);

            $property->load(['notes', 'propertyFeature']);

            return response()->json([
                'data' => $property,
                'message' => 'Property created successfully',
            ], 201);
        } catch (Exception $e) {
            Log::error('PropertyController::store Error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to create property: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Show a property with notes and features.
     */
    public function show(int $id): JsonResponse
    {
        try {
            $property = Property::with(['notes', 'propertyFeature'])->find($id);

            if (!$property) {
                return response()->json([
                    'data' => null,
                    'message' => 'Property not found',
                ], 404);
            }

            return response()->json([
                'data' => $property,
                'message' => 'Property retrieved successfully',
            ]);
        } catch (Exception $e) {
            Log::error('PropertyController::show Error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to retrieve property',
            ], 500);
        }
    }
}
