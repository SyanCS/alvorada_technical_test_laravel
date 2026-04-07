<?php

return [
    /*
    |--------------------------------------------------------------------------
    | AI microservice (LangGraph / RAG)
    |--------------------------------------------------------------------------
    |
    | When set, POST /api/ai/score proxies to this URL's /search endpoint.
    | Example: http://localhost:3001 or http://ai-service:3001 (Docker)
    |
    */
    'service_url' => env('AI_SERVICE_URL'),
];
