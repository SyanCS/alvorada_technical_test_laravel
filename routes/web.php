<?php

use Illuminate\Support\Facades\Route;

// SPA catch-all — Vue Router handles all frontend routes
Route::get('/{any?}', fn () => view('spa'))->where('any', '.*');
