<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'property_id' => 'required|integer|exists:properties,id',
            'note' => 'required|string|min:1|max:5000',
        ];
    }

    public function messages(): array
    {
        return [
            'property_id.required' => 'Property ID is required.',
            'property_id.exists' => 'Property not found.',
            'note.required' => 'Note content is required.',
            'note.min' => 'Note must be at least 1 character.',
            'note.max' => 'Note cannot exceed 5000 characters.',
        ];
    }
}
