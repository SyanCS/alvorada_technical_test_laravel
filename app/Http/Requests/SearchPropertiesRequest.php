<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SearchPropertiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'criteria' => 'nullable|array',
            'criteria.recommended_use' => 'nullable|string|max:100',
            'criteria.near_subway' => 'nullable|boolean',
            'criteria.parking_required' => 'nullable|boolean',
            'criteria.min_capacity' => 'nullable|integer|min:1',
            'criteria.max_capacity' => 'nullable|integer|min:1',
            'criteria.min_condition' => 'nullable|integer|min:1|max:5',
            'criteria.needs_renovation' => 'nullable|boolean',
            'limit' => 'nullable|integer|min:1|max:200',
        ];
    }
}
