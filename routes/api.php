<?php

use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\AIController;
use Illuminate\Support\Facades\Route;

// Properties
Route::get('/properties', [PropertyController::class, 'index']);
Route::post('/properties', [PropertyController::class, 'store']);
Route::get('/properties/{id}', [PropertyController::class, 'show']);

// Notes
Route::get('/notes', [NoteController::class, 'index']);
Route::post('/notes', [NoteController::class, 'store']);

// AI endpoints
Route::post('/ai/extract-features', [AIController::class, 'extractFeatures']);
Route::post('/ai/score', [AIController::class, 'scoreProperties']);

// Property features
Route::get('/properties/{id}/features', [AIController::class, 'getPropertyFeatures']);
