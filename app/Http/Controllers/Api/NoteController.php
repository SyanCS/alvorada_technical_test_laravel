<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNoteRequest;
use App\Models\Note;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class NoteController extends Controller
{
    /**
     * List notes for a property.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $propertyId = $request->query('property_id');

            if (!$propertyId || !is_numeric($propertyId)) {
                return response()->json([
                    'data' => null,
                    'message' => 'Invalid or missing property_id parameter',
                ], 400);
            }

            $notes = Note::where('property_id', (int) $propertyId)
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'data' => $notes,
                'message' => 'Notes retrieved successfully',
                'count' => $notes->count(),
            ]);
        } catch (Exception $e) {
            Log::error('NoteController::index Error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to retrieve notes',
            ], 500);
        }
    }

    /**
     * Add a note to a property.
     */
    public function store(StoreNoteRequest $request): JsonResponse
    {
        try {
            $note = Note::create([
                'property_id' => $request->property_id,
                'note' => $request->note,
            ]);

            return response()->json([
                'data' => $note,
                'message' => 'Note added successfully',
            ], 201);
        } catch (Exception $e) {
            Log::error('NoteController::store Error: ' . $e->getMessage());

            return response()->json([
                'data' => null,
                'message' => 'Failed to add note',
            ], 500);
        }
    }
}
