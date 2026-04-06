<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyFeature;
use App\Models\Note;
use Illuminate\Support\Facades\Log;
use Exception;

/**
 * Feature Extraction Service
 * Uses AI to extract structured features from unstructured property notes.
 */
class FeatureExtractionService
{
    private OpenRouterService $llmService;

    public function __construct(OpenRouterService $llmService)
    {
        $this->llmService = $llmService;
    }

    /**
     * Extract features from all notes for a property.
     *
     * @throws Exception
     */
    public function extractFeaturesFromProperty(int $propertyId, bool $forceRefresh = false): PropertyFeature
    {
        $property = Property::find($propertyId);
        if (!$property) {
            throw new Exception("Property with ID {$propertyId} not found");
        }

        // Check if features already exist and not forcing refresh
        if (!$forceRefresh) {
            $existing = PropertyFeature::where('property_id', $propertyId)->first();
            if ($existing) {
                return $existing;
            }
        }

        // Get all notes for the property
        $notes = Note::where('property_id', $propertyId)->orderByDesc('created_at')->get();

        if ($notes->isEmpty()) {
            throw new Exception('No notes found for property. Add some notes before extracting features.');
        }

        if (!$this->llmService->isConfigured()) {
            throw new Exception('LLM API key is not configured. Please add LLM_API_KEY to your .env file.');
        }

        $systemPrompt = $this->buildSystemPrompt();
        $userPrompt = $this->buildUserPrompt($property, $notes);

        try {
            $result = $this->llmService->extractStructuredData(
                $systemPrompt,
                $userPrompt,
                ['temperature' => 0.3, 'max_tokens' => 800]
            );

            $data = $result['data'];
            if (isset($data[0]) && is_array($data[0])) {
                $data = $data[0];
            }

            $featureData = $this->parseAIResponse($data, $property, $notes);
            $featureData['raw_ai_response'] = $data;

            // Upsert: update or create
            $feature = PropertyFeature::updateOrCreate(
                ['property_id' => $propertyId],
                $featureData
            );

            return $feature;
        } catch (Exception $e) {
            Log::error("Feature extraction error for property {$propertyId}: " . $e->getMessage());
            throw new Exception('Failed to extract features: ' . $e->getMessage());
        }
    }

    /**
     * Get extracted features for a property (without extraction).
     */
    public function getFeatures(int $propertyId): ?PropertyFeature
    {
        return PropertyFeature::where('property_id', $propertyId)->first();
    }

    /**
     * Build system prompt for feature extraction.
     */
    private function buildSystemPrompt(): string
    {
        return <<<'PROMPT'
## ROLE
You are an expert commercial real estate analyst with deep expertise in property evaluation, feature analysis, and market assessment. You specialize in extracting structured insights from unstructured property research notes.

## TASK
Analyze the provided property research notes and extract structured information about key property features, amenities, and characteristics. Your goal is to transform unstructured observations into standardized, actionable data that can be used for property scoring and comparison.

## OUTPUT FORMAT
Return a valid JSON object with the following structure (no additional text or markdown):

{
  "near_subway": boolean or null,
  "needs_renovation": boolean or null,
  "parking_available": boolean or null,
  "has_elevator": boolean or null,
  "estimated_capacity_people": integer or null,
  "floor_level": integer or null,
  "condition_rating": integer or null,
  "recommended_use": string or null,
  "amenities": array or null,
  "confidence_score": float,
  "summary": string
}

## FIELD DEFINITIONS
- near_subway: Property is within 5-10 minutes walking distance to subway/metro/public transit
- needs_renovation: Property requires significant repairs or updates before use
- parking_available: On-site or dedicated parking spaces are available
- has_elevator: Building has a working elevator (relevant for multi-story buildings)
- estimated_capacity_people: Maximum comfortable occupancy (employees, customers, etc.)
- floor_level: Floor number the property is located on (ground floor = 0 or 1)
- condition_rating: Overall property condition (1=poor/uninhabitable, 2=fair/needs work, 3=good/move-in ready, 4=very good/recently updated, 5=excellent/newly built)
- recommended_use: Best business use case ("office", "retail", "warehouse", "logistics", "mixed", "restaurant", "medical", "industrial", etc.)
- amenities: List of features mentioned (e.g., ["kitchen", "conference room", "gym", "security", "wifi", "air conditioning"])
- confidence_score: Your confidence in the overall extraction quality (0.0 = low confidence, 1.0 = high confidence)
- summary: Concise 2-3 sentence overview of the property's key characteristics

## CONSTRAINTS
1. Evidence-based extraction: Only set a field if there is clear, explicit evidence in the notes
2. Use null for missing data: If information is uncertain, ambiguous, or not mentioned, use null
3. Conservative boolean logic: Only set true/false when explicitly stated or strongly implied
4. No assumptions: Don't infer information that isn't present in the notes
5. JSON only: Return pure JSON without markdown formatting, explanations, or additional text
6. Reasonable ranges: Ensure numeric values are realistic (e.g., capacity 1-1000, floors 0-100, rating 1-5)

## EXTRACTION GUIDELINES
- **near_subway**: Look for phrases like "close to metro", "2 blocks from subway", "good transit access"
- **needs_renovation**: Keywords like "needs repair", "outdated", "requires updates", "fixer-upper"
- **parking_available**: Mentions of "parking lot", "X spaces", "garage", "street parking"
- **capacity**: Phrases like "fits 20 people", "suitable for 15-30 employees", "desk space for 40"
- **condition_rating**: Assess based on descriptions like "pristine", "well-maintained", "needs work", "poor state"
- **amenities**: Extract all facilities, features, and equipment mentioned explicitly
- **confidence_score**: Base on clarity of notes (clear & detailed = 0.8-1.0, vague = 0.3-0.6, minimal = 0.1-0.3)

## EXAMPLES

Example 1 - Clear, detailed notes:
Input: "Prime office space on 3rd floor with elevator. Recently renovated, excellent condition. 2 blocks from Red Line station. Has full kitchen, 2 conference rooms, and parking for 10 cars. Can accommodate 25-30 employees comfortably."
Output:
{
  "near_subway": true,
  "needs_renovation": false,
  "parking_available": true,
  "has_elevator": true,
  "estimated_capacity_people": 30,
  "floor_level": 3,
  "condition_rating": 5,
  "recommended_use": "office",
  "amenities": ["elevator", "kitchen", "conference room", "parking"],
  "confidence_score": 0.95,
  "summary": "Excellent condition office space on 3rd floor with elevator access and convenient transit location. Features full amenities including kitchen, meeting rooms, and parking. Suitable for 25-30 employees."
}

Example 2 - Vague notes:
Input: "Checked out the warehouse. Pretty big space. Might need some work. Not sure about parking."
Output:
{
  "near_subway": null,
  "needs_renovation": null,
  "parking_available": null,
  "has_elevator": null,
  "estimated_capacity_people": null,
  "floor_level": null,
  "condition_rating": null,
  "recommended_use": "warehouse",
  "amenities": null,
  "confidence_score": 0.2,
  "summary": "Large warehouse space evaluated. Limited information available about condition, amenities, or specific features. Additional site visit recommended for detailed assessment."
}

Example 3 - Mixed information:
Input: "Ground floor retail space, about 1200 sqft. Busy street with metro station 10 min walk. No parking but bike racks outside. Needs new flooring and paint, otherwise decent. Could work for cafe or small shop."
Output:
{
  "near_subway": true,
  "needs_renovation": true,
  "parking_available": false,
  "has_elevator": null,
  "estimated_capacity_people": null,
  "floor_level": 0,
  "condition_rating": 3,
  "recommended_use": "retail",
  "amenities": ["bike racks"],
  "confidence_score": 0.75,
  "summary": "Ground floor retail space on busy street with good metro access. Requires cosmetic updates including flooring and paint. Suitable for cafe or small retail operation."
}

PROMPT;
    }

    /**
     * Build user prompt with property and notes data.
     */
    private function buildUserPrompt(Property $property, $notes): string
    {
        $notesText = '';
        foreach ($notes as $index => $note) {
            $noteNumber = $index + 1;
            $notesText .= "Note {$noteNumber}: {$note->note}\n";
        }

        $notesCount = $notes->count();
        $propertyName = $property->name;
        $propertyAddress = $property->address;

        return <<<PROMPT
Property Information:
- Name: {$propertyName}
- Address: {$propertyAddress}
- Total Notes: {$notesCount}

Research Notes:
{$notesText}

Please analyze these notes and extract structured features in JSON format.
PROMPT;
    }

    /**
     * Parse AI response into feature data array.
     */
    private function parseAIResponse(array $data, Property $property, $notes): array
    {
        $featureData = [
            'property_id' => $property->id,
            'source_notes_count' => $notes->count(),
            'extracted_at' => now(),
        ];

        // Boolean fields
        if (isset($data['near_subway']) && is_bool($data['near_subway'])) {
            $featureData['near_subway'] = $data['near_subway'];
        }
        if (isset($data['needs_renovation']) && is_bool($data['needs_renovation'])) {
            $featureData['needs_renovation'] = $data['needs_renovation'];
        }
        if (isset($data['parking_available']) && is_bool($data['parking_available'])) {
            $featureData['parking_available'] = $data['parking_available'];
        }
        if (isset($data['has_elevator']) && is_bool($data['has_elevator'])) {
            $featureData['has_elevator'] = $data['has_elevator'];
        }

        // Numeric fields
        if (isset($data['estimated_capacity_people']) && is_numeric($data['estimated_capacity_people'])) {
            $featureData['estimated_capacity_people'] = (int) $data['estimated_capacity_people'];
        }
        if (isset($data['floor_level']) && is_numeric($data['floor_level'])) {
            $featureData['floor_level'] = (int) $data['floor_level'];
        }
        if (isset($data['condition_rating']) && is_numeric($data['condition_rating'])) {
            $rating = (int) $data['condition_rating'];
            if ($rating >= 1 && $rating <= 5) {
                $featureData['condition_rating'] = $rating;
            }
        }

        // Text fields
        if (isset($data['recommended_use']) && is_string($data['recommended_use'])) {
            $featureData['recommended_use'] = $data['recommended_use'];
        }

        // Array fields
        if (isset($data['amenities']) && is_array($data['amenities'])) {
            $featureData['amenities'] = $data['amenities'];
        }

        // Confidence score
        if (isset($data['confidence_score']) && is_numeric($data['confidence_score'])) {
            $featureData['confidence_score'] = min(1.0, max(0.0, (float) $data['confidence_score']));
        }

        return $featureData;
    }
}
