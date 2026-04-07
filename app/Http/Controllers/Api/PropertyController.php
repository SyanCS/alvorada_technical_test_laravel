<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PropertiesByIdsRequest;
use App\Http\Requests\SearchPropertiesRequest;
use App\Http\Requests\StorePropertyRequest;
use App\Models\Property;
use App\Services\GeolocationService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

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
            Log::error('PropertyController::index Error: '.$e->getMessage());

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
            Log::error('PropertyController::store Error: '.$e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to create property: '.$e->getMessage(),
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

            if (! $property) {
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
            Log::error('PropertyController::show Error: '.$e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to retrieve property',
            ], 500);
        }
    }

    /**
     * Search properties by structured feature criteria (for RAG retrieval).
     * POST /api/properties/search
     */
    public function search(SearchPropertiesRequest $request): JsonResponse
    {
        try {
            $criteria = $request->input('criteria') ?? [];
            $limit = (int) ($request->input('limit', 50));

            $query = Property::query()
                ->with('propertyFeature')
                ->whereHas('propertyFeature');

            if (! empty($criteria['recommended_use'])) {
                $use = $criteria['recommended_use'];
                $query->whereHas('propertyFeature', function ($q) use ($use) {
                    $q->whereRaw('LOWER(recommended_use) LIKE ?', ['%'.strtolower($use).'%']);
                });
            }

            if (array_key_exists('near_subway', $criteria) && $criteria['near_subway'] !== null) {
                $val = (bool) $criteria['near_subway'];
                $query->whereHas('propertyFeature', fn ($q) => $q->where('near_subway', $val));
            }

            if (array_key_exists('parking_required', $criteria) && $criteria['parking_required'] !== null) {
                $required = (bool) $criteria['parking_required'];
                $query->whereHas('propertyFeature', fn ($q) => $q->where('parking_available', $required));
            }

            if (! empty($criteria['min_capacity'])) {
                $min = (int) $criteria['min_capacity'];
                $query->whereHas('propertyFeature', fn ($q) => $q
                    ->whereNotNull('estimated_capacity_people')
                    ->where('estimated_capacity_people', '>=', $min));
            }

            if (! empty($criteria['max_capacity'])) {
                $max = (int) $criteria['max_capacity'];
                $query->whereHas('propertyFeature', fn ($q) => $q
                    ->whereNotNull('estimated_capacity_people')
                    ->where('estimated_capacity_people', '<=', $max));
            }

            if (! empty($criteria['min_condition'])) {
                $minCond = (int) $criteria['min_condition'];
                $query->whereHas('propertyFeature', fn ($q) => $q
                    ->whereNotNull('condition_rating')
                    ->where('condition_rating', '>=', $minCond));
            }

            if (array_key_exists('needs_renovation', $criteria) && $criteria['needs_renovation'] !== null) {
                $nr = (bool) $criteria['needs_renovation'];
                $query->whereHas('propertyFeature', fn ($q) => $q->where('needs_renovation', $nr));
            }

            $properties = $query->orderByDesc('created_at')->limit($limit)->get();

            return response()->json([
                'data' => [
                    'properties' => $properties,
                    'count' => $properties->count(),
                    'criteria' => $criteria,
                ],
                'message' => 'Properties search completed',
            ]);
        } catch (Exception $e) {
            Log::error('PropertyController::search Error: '.$e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to search properties',
            ], 500);
        }
    }

    /**
     * Batch load properties with notes and features (for Graph RAG hydrate).
     * POST /api/properties/by-ids
     */
    public function byIds(PropertiesByIdsRequest $request): JsonResponse
    {
        try {
            $ids = array_map('intval', $request->input('ids', []));
            $rows = Property::with(['notes', 'propertyFeature'])
                ->whereIn('id', $ids)
                ->get()
                ->keyBy('id');
            $ordered = collect($ids)
                ->map(fn (int $id) => $rows->get($id))
                ->filter()
                ->values();

            return response()->json([
                'data' => [
                    'properties' => $ordered,
                    'count' => $ordered->count(),
                ],
                'message' => 'Properties retrieved successfully',
            ]);
        } catch (Exception $e) {
            Log::error('PropertyController::byIds Error: '.$e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to load properties',
            ], 500);
        }
    }
}
