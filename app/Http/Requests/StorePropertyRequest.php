<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|min:2|max:255|unique:properties,name',
            'address' => 'required|string|min:5|max:500|unique:properties,address',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Property name is required.',
            'name.min' => 'Property name must be at least 2 characters.',
            'name.max' => 'Property name cannot exceed 255 characters.',
            'name.unique' => 'A property with this name already exists.',
            'address.required' => 'Address is required.',
            'address.min' => 'Address must be at least 5 characters.',
            'address.max' => 'Address cannot exceed 500 characters.',
            'address.unique' => 'A property with this address already exists.',
        ];
    }
}
