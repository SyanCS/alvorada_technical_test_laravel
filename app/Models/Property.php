<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Property extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'latitude',
        'longitude',
        'extra_field',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'extra_field' => 'array',
    ];

    public function notes(): HasMany
    {
        return $this->hasMany(Note::class)->orderByDesc('created_at');
    }

    public function propertyFeature(): HasOne
    {
        return $this->hasOne(PropertyFeature::class);
    }
}
