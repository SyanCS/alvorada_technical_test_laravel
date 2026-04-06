<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PropertyFeature extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'near_subway',
        'needs_renovation',
        'parking_available',
        'has_elevator',
        'estimated_capacity_people',
        'floor_level',
        'condition_rating',
        'recommended_use',
        'amenities',
        'confidence_score',
        'source_notes_count',
        'raw_ai_response',
        'extracted_at',
    ];

    protected $casts = [
        'near_subway' => 'boolean',
        'needs_renovation' => 'boolean',
        'parking_available' => 'boolean',
        'has_elevator' => 'boolean',
        'estimated_capacity_people' => 'integer',
        'floor_level' => 'integer',
        'condition_rating' => 'integer',
        'confidence_score' => 'float',
        'source_notes_count' => 'integer',
        'amenities' => 'array',
        'raw_ai_response' => 'array',
        'extracted_at' => 'datetime',
    ];

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Get a readable summary of features.
     */
    public function getSummary(): array
    {
        $features = [];

        if ($this->near_subway !== null) {
            $features[] = $this->near_subway ? 'Near subway' : 'Not near subway';
        }
        if ($this->needs_renovation !== null) {
            $features[] = $this->needs_renovation ? 'Needs renovation' : 'No renovation needed';
        }
        if ($this->parking_available !== null) {
            $features[] = $this->parking_available ? 'Parking available' : 'No parking';
        }
        if ($this->has_elevator !== null) {
            $features[] = $this->has_elevator ? 'Has elevator' : 'No elevator';
        }
        if ($this->estimated_capacity_people !== null) {
            $features[] = "Capacity: {$this->estimated_capacity_people} people";
        }
        if ($this->recommended_use !== null) {
            $features[] = "Best for: {$this->recommended_use}";
        }
        if ($this->condition_rating !== null) {
            $features[] = "Condition: {$this->condition_rating}/5";
        }

        return $features;
    }
}
