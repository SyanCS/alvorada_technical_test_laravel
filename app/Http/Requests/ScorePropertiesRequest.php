<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ScorePropertiesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'requirements' => 'required|string|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
        ];
    }

    public function messages(): array
    {
        return [
            'requirements.required' => 'Client requirements are required.',
            'requirements.string' => 'Requirements must be a string.',
        ];
    }
}
