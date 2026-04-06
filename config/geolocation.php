<?php

return [
    'base_url' => env('GEO_BASE_URL', 'https://nominatim.openstreetmap.org/search'),
    'reverse_url' => env('GEO_REVERSE_URL', 'https://nominatim.openstreetmap.org/reverse'),
    'user_agent' => env('GEO_USER_AGENT', 'AlvoradaPropertyResearch/1.0'),
    'timeout' => env('GEO_TIMEOUT', 10),
];
