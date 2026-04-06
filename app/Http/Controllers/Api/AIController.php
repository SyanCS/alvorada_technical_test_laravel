<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ScorePropertiesRequest;
use App\Models\PropertyFeature;
use App\Services\FeatureExtractionService;
use App\Services\PropertyScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class AIController extends Controller
{
    private FeatureExtractionService $featureExtractionService;
    private PropertyScoringService $scoringService;

    public function __construct(
        FeatureExtractionService $featureExtractionService,
        PropertyScoringService $scoringService
    ) {
        $this->featureExtractionService = $featureExtractionService;
        $this->scoringService = $scoringService;
    }

    /**
     * Extract features from property notes.
     * POST /api/ai/extract-features
     * Body: { "property_id": 1, "force_refresh": false }
     */
    public function extractFeatures(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'property_id' => 'required|integer|exists:properties,id',
                'force_refresh' => 'nullable|boolean',
            ]);

            $propertyId = (int) $request->property_id;
            $forceRefresh = (bool) ($request->force_refresh ?? false);

            $features = $this->featureExtractionService->extractFeaturesFromProperty($propertyId, $forceRefresh);

            return response()->json([
                'data' => [
                    'property_id' => $propertyId,
                    'features' => $features,
                    'summary' => $features->getSummary(),
                ],
                'message' => 'Features extracted successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Feature extraction error: ' . $e->getMessage());

            $status = str_contains($e->getMessage(), 'not found') ? 404 : 500;

            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
            ], $status);
        }
    }

    /**
     * Score properties against client requirements.
     * POST /api/ai/score
     * Body: { "requirements": "office near subway, 20 people", "limit": 10 }
     */
    public function scoreProperties(ScorePropertiesRequest $request): JsonResponse
    {
        try {
            $requirements = trim($request->requirements);
            $limit = $request->limit ? (int) $request->limit : null;

            $result = $this->scoringService->scoreAllProperties($requirements, $limit);

            return response()->json([
                'data' => $result,
                'message' => 'Properties scored successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Property scoring error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get extracted features for a property.
     * GET /api/properties/{id}/features
     */
    public function getPropertyFeatures(int $id): JsonResponse
    {
        try {
            $features = PropertyFeature::where('property_id', $id)->first();

            if (!$features) {
                return response()->json([
                    'data' => [
                        'property_id' => $id,
                        'features' => null,
                        'has_features' => false,
                    ],
                    'message' => 'No features found for this property',
                ]);
            }

            return response()->json([
                'data' => [
                    'property_id' => $id,
                    'features' => $features,
                    'summary' => $features->getSummary(),
                    'has_features' => true,
                ],
                'message' => 'Features retrieved successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Get features error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to retrieve features',
            ], 500);
        }
    }
}
