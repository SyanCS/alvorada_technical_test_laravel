<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyFeature;
use Illuminate\Support\Facades\Log;
use Exception;

/**
 * Property Scoring Service
 * Scores properties based on client requirements using AI.
 */
class PropertyScoringService
{
    private OpenRouterService $llmService;

    public function __construct(OpenRouterService $llmService)
    {
        $this->llmService = $llmService;
    }

    /**
     * Score all properties based on client requirements.
     *
     * @throws Exception
     */
    public function scoreAllProperties(string $clientRequirements, ?int $limit = null): array
    {
        if (empty(trim($clientRequirements))) {
            throw new Exception('Client requirements cannot be empty');
        }

        $properties = Property::with('propertyFeature')->orderByDesc('created_at')->limit(1000)->get();

        if ($properties->isEmpty()) {
            return [
                'scored_properties' => [],
                'total_properties' => 0,
                'results_shown' => 0,
                'requirements' => $clientRequirements,
                'message' => 'No properties found in database',
            ];
        }

        if (!$this->llmService->isConfigured()) {
            throw new Exception('LLM API key is not configured. Please add LLM_API_KEY to your .env file.');
        }

        $scoredProperties = [];
        foreach ($properties as $property) {
            try {
                $score = $this->scoreProperty($property, $clientRequirements);
                $scoredProperties[] = $score;
            } catch (Exception $e) {
                Log::error("Error scoring property {$property->id}: " . $e->getMessage());
            }
        }

        // Sort by score descending
        usort($scoredProperties, fn($a, $b) => $b['score'] <=> $a['score']);

        if ($limit !== null && $limit > 0) {
            $scoredProperties = array_slice($scoredProperties, 0, $limit);
        }

        return [
            'scored_properties' => $scoredProperties,
            'total_properties' => $properties->count(),
            'results_shown' => count($scoredProperties),
            'requirements' => $clientRequirements,
        ];
    }

    /**
     * Score a single property against client requirements.
     *
     * @throws Exception
     */
    public function scoreProperty(Property $property, string $clientRequirements): array
    {
        $features = $property->relationLoaded('propertyFeature')
            ? $property->propertyFeature
            : PropertyFeature::where('property_id', $property->id)->first();

        $systemPrompt = $this->buildScoringSystemPrompt();
        $userPrompt = $this->buildScoringUserPrompt($property, $features, $clientRequirements);

        $result = $this->llmService->extractStructuredData(
            $systemPrompt,
            $userPrompt,
            ['temperature' => 0.1, 'max_tokens' => 800]
        );

        return $this->parseScoreResponse($result['data'], $property, $features);
    }

    /**
     * Build system prompt for scoring.
     */
    private function buildScoringSystemPrompt(): string
    {
        return <<<'PROMPT'
You are an expert commercial real estate broker assistant with deep knowledge of property evaluation and client-property matching. Your task is to score how well a property matches a client's requirements using both basic property information and AI-extracted structured features.

## SCORING SCALE
Provide a score from 0 to 10:
- 0-3: Poor match (major misalignment, multiple critical requirements not met)
- 4-5: Fair match (some alignment, significant gaps in key requirements)
- 6-7: Good match (solid alignment, minor gaps or compromises needed)
- 8-9: Excellent match (strong alignment, meets most/all key requirements)
- 10: Perfect match (exceeds or perfectly meets all requirements)

## FEATURE IMPORTANCE WEIGHTS
When extracted features are available, weight them according to relevance:

**HIGH IMPORTANCE (30-40% of score):**
- Location & Transit Access (near_subway, address, city)
- Property Type & Use Case (recommended_use)
- Capacity/Size (estimated_capacity_people)

**MEDIUM IMPORTANCE (20-30% of score):**
- Condition & Readiness (condition_rating, needs_renovation)
- Core Amenities (parking_available, has_elevator, amenities)

**LOWER IMPORTANCE (10-20% of score):**
- Nice-to-have features (floor_level, additional amenities)
- Budget considerations (if mentioned)

## SCORING GUIDELINES

1. **With Extracted Features Available:**
   - Prioritize structured features over just property name/address
   - Use specific feature matches to justify score
   - High confidence features (confidence_score > 0.8) should carry more weight
   - Match recommended_use to client needs very carefully
   - Consider feature completeness (more features = more confident scoring)

2. **Without Extracted Features:**
   - Score conservatively (typically 4-6 range)
   - Base score on property name, address, and general location info
   - Indicate lower confidence (typically 0.4-0.6)
   - Note that feature extraction would improve accuracy

3. **Feature Matching Logic:**
   - near_subway=true + "near transit" requirement = strong match (+1.5 to +2.5 points)
   - capacity matches requirement exactly = strong match (+1.5 to +2.0 points)
   - capacity exceeds requirement by 20-50% = excellent (+2.0 to +2.5 points)
   - recommended_use matches need (office for office, retail for retail) = strong match (+2.0 to +3.0 points)
   - condition_rating 4-5 + "move-in ready" need = strong match (+1.0 to +1.5 points)
   - condition_rating 1-2 or needs_renovation=true + "ready to use" need = major penalty (-2.0 to -3.0 points)

4. **Deal Breakers:**
   - Wrong property type (office vs retail vs warehouse) = max score 3.0
   - Capacity too small by >50% = max score 4.0
   - Critical feature missing (e.g., needs parking, parking=false) = -2.0 to -3.0 points

## OUTPUT FORMAT
Return a valid JSON object (no markdown, no additional text):
{
  "score": float (0.0 to 10.0),
  "explanation": string (2-3 sentences explaining the score with specific feature references),
  "strengths": array of strings (specific features that match well),
  "weaknesses": array of strings (specific features that don't match or are missing),
  "confidence": float (0.0 to 1.0, your confidence in this assessment)
}

## IMPORTANT
- Be specific in explanations - reference actual features when available
- Strengths/weaknesses should cite concrete features (e.g., "Near subway (10 min walk)" not just "good location")
- Confidence should reflect both feature availability and match clarity
- Be practical - partial matches can still score 7-8 if core needs are met
- Return valid JSON only, no markdown formatting

PROMPT;
    }

    /**
     * Build user prompt with property and requirements.
     */
    private function buildScoringUserPrompt(Property $property, ?PropertyFeature $features, string $clientRequirements): string
    {
        $propertyInfo = "PROPERTY NAME: {$property->name}\n";
        $propertyInfo .= "ADDRESS: {$property->address}\n";

        $extraField = $property->extra_field;
        if (is_array($extraField)) {
            if (isset($extraField['city'])) {
                $propertyInfo .= "CITY: {$extraField['city']}\n";
            }
            if (isset($extraField['state'])) {
                $propertyInfo .= "STATE: {$extraField['state']}\n";
            }
        }

        if ($features) {
            $propertyInfo .= "\n========================================\n";
            $propertyInfo .= "AI-EXTRACTED FEATURES (Structured Data)\n";
            $propertyInfo .= "========================================\n";

            if ($features->confidence_score !== null) {
                $confidence = round($features->confidence_score * 100);
                $propertyInfo .= "Feature Extraction Confidence: {$confidence}%\n";
            }

            $propertyInfo .= "\n--- HIGH IMPORTANCE FEATURES ---\n";

            if ($features->near_subway !== null) {
                $value = $features->near_subway ? 'YES (within 5-10 min walk)' : 'NO';
                $propertyInfo .= "Near Subway/Transit: {$value}\n";
            } else {
                $propertyInfo .= "Near Subway/Transit: UNKNOWN\n";
            }

            if ($features->recommended_use !== null) {
                $propertyInfo .= 'Recommended Use: ' . strtoupper($features->recommended_use) . "\n";
            } else {
                $propertyInfo .= "Recommended Use: UNKNOWN\n";
            }

            if ($features->estimated_capacity_people !== null) {
                $propertyInfo .= "Estimated Capacity: {$features->estimated_capacity_people} people\n";
            } else {
                $propertyInfo .= "Estimated Capacity: UNKNOWN\n";
            }

            $propertyInfo .= "\n--- MEDIUM IMPORTANCE FEATURES ---\n";

            if ($features->condition_rating !== null) {
                $rating = $features->condition_rating;
                $ratingDesc = [
                    1 => 'Poor/Uninhabitable',
                    2 => 'Fair/Needs Work',
                    3 => 'Good/Move-in Ready',
                    4 => 'Very Good/Recently Updated',
                    5 => 'Excellent/Newly Built',
                ];
                $desc = $ratingDesc[$rating] ?? 'Unknown';
                $propertyInfo .= "Condition Rating: {$rating}/5 ({$desc})\n";
            } else {
                $propertyInfo .= "Condition Rating: UNKNOWN\n";
            }

            if ($features->needs_renovation !== null) {
                $value = $features->needs_renovation ? 'YES (requires significant work)' : 'NO (ready to use)';
                $propertyInfo .= "Needs Renovation: {$value}\n";
            } else {
                $propertyInfo .= "Needs Renovation: UNKNOWN\n";
            }

            if ($features->parking_available !== null) {
                $value = $features->parking_available ? 'AVAILABLE' : 'NOT AVAILABLE';
                $propertyInfo .= "Parking: {$value}\n";
            } else {
                $propertyInfo .= "Parking: UNKNOWN\n";
            }

            if ($features->has_elevator !== null) {
                $value = $features->has_elevator ? 'YES' : 'NO';
                $propertyInfo .= "Elevator: {$value}\n";
            } else {
                $propertyInfo .= "Elevator: UNKNOWN\n";
            }

            if ($features->amenities !== null && !empty($features->amenities)) {
                $amenitiesList = implode(', ', array_map('ucfirst', $features->amenities));
                $amenitiesCount = count($features->amenities);
                $propertyInfo .= "Amenities ({$amenitiesCount}): {$amenitiesList}\n";
            } else {
                $propertyInfo .= "Amenities: NONE LISTED\n";
            }

            $propertyInfo .= "\n--- LOWER IMPORTANCE FEATURES ---\n";

            if ($features->floor_level !== null) {
                $floor = $features->floor_level;
                $floorDesc = $floor == 0 ? 'Ground Floor' : "Floor {$floor}";
                $propertyInfo .= "Floor Level: {$floorDesc}\n";
            } else {
                $propertyInfo .= "Floor Level: UNKNOWN\n";
            }

            if ($features->source_notes_count !== null) {
                $propertyInfo .= "\nExtracted from {$features->source_notes_count} property note(s)\n";
            }

            $propertyInfo .= "========================================\n";
        } else {
            $propertyInfo .= "\n========================================\n";
            $propertyInfo .= "NO EXTRACTED FEATURES AVAILABLE\n";
            $propertyInfo .= "========================================\n";
            $propertyInfo .= "Scoring will be based on property name and address only.\n";
            $propertyInfo .= "Confidence will be lower. Run feature extraction for better results.\n";
            $propertyInfo .= "========================================\n";
        }

        return <<<PROMPT
========================================
PROPERTY DETAILS
========================================
{$propertyInfo}

========================================
CLIENT REQUIREMENTS
========================================
{$clientRequirements}

========================================
SCORING TASK
========================================
Analyze the property features against the client requirements and provide a scored assessment.

Key Instructions:
1. If features are available, weight them according to importance (High/Medium/Low)
2. Match specific features to specific requirements
3. Consider feature extraction confidence in your assessment
4. Be specific in your explanations - cite actual features
5. If no features available, score conservatively (4-6 range) with lower confidence

Return your analysis in JSON format as specified in the system prompt.
PROMPT;
    }

    /**
     * Parse AI score response.
     */
    private function parseScoreResponse(array $data, Property $property, ?PropertyFeature $features = null): array
    {
        $score = isset($data['score']) && is_numeric($data['score'])
            ? (float) $data['score']
            : 5.0;

        $score = min(10.0, max(0.0, $score));

        $explanation = isset($data['explanation']) && is_string($data['explanation'])
            ? $data['explanation']
            : 'No explanation provided';

        $strengths = isset($data['strengths']) && is_array($data['strengths'])
            ? $data['strengths']
            : [];

        $weaknesses = isset($data['weaknesses']) && is_array($data['weaknesses'])
            ? $data['weaknesses']
            : [];

        $confidence = isset($data['confidence']) && is_numeric($data['confidence'])
            ? min(1.0, max(0.0, (float) $data['confidence']))
            : 0.7;

        // Calculate feature completeness
        $featureCompleteness = $this->calculateFeatureCompleteness($features);

        if ($featureCompleteness < 0.3) {
            $confidence = min($confidence, 0.6);
        }

        $result = [
            'property_id' => $property->id,
            'property_name' => $property->name,
            'address' => $property->address,
            'score' => round($score, 1),
            'explanation' => $explanation,
            'strengths' => $strengths,
            'weaknesses' => $weaknesses,
            'confidence' => round($confidence, 2),
            'latitude' => $property->latitude,
            'longitude' => $property->longitude,
            'feature_completeness' => $featureCompleteness,
        ];

        $featureSummary = $this->generateFeatureSummary($features);
        if ($featureSummary !== null) {
            $result['features'] = $featureSummary;
        }

        return $result;
    }

    /**
     * Calculate feature completeness score.
     */
    private function calculateFeatureCompleteness(?PropertyFeature $features): float
    {
        if (!$features) {
            return 0.0;
        }

        $totalFields = 9;
        $filledFields = 0;

        if ($features->near_subway !== null) $filledFields++;
        if ($features->needs_renovation !== null) $filledFields++;
        if ($features->parking_available !== null) $filledFields++;
        if ($features->has_elevator !== null) $filledFields++;
        if ($features->estimated_capacity_people !== null) $filledFields++;
        if ($features->floor_level !== null) $filledFields++;
        if ($features->condition_rating !== null) $filledFields++;
        if ($features->recommended_use !== null) $filledFields++;
        if ($features->amenities !== null && !empty($features->amenities)) $filledFields++;

        return round($filledFields / $totalFields, 2);
    }

    /**
     * Generate feature summary for response.
     */
    private function generateFeatureSummary(?PropertyFeature $features): ?array
    {
        if (!$features) {
            return null;
        }

        $summary = [];

        if ($features->near_subway !== null) {
            $summary['near_subway'] = $features->near_subway;
        }
        if ($features->recommended_use !== null) {
            $summary['recommended_use'] = $features->recommended_use;
        }
        if ($features->estimated_capacity_people !== null) {
            $summary['capacity_people'] = $features->estimated_capacity_people;
        }
        if ($features->condition_rating !== null) {
            $summary['condition_rating'] = $features->condition_rating;
        }
        if ($features->parking_available !== null) {
            $summary['parking'] = $features->parking_available;
        }
        if ($features->amenities !== null && !empty($features->amenities)) {
            $summary['amenities_count'] = count($features->amenities);
        }
        if ($features->confidence_score !== null) {
            $summary['extraction_confidence'] = round($features->confidence_score, 2);
        }

        return $summary;
    }
}
