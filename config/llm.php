<?php

return [
    'api_base_url' => env('LLM_API_BASE_URL', 'https://openrouter.ai/api/v1'),
    'api_key' => env('LLM_API_KEY'),
    'model' => env('LLM_MODEL', 'google/gemini-2.0-flash-001'),
    'temperature' => env('LLM_TEMPERATURE', 0.7),
    'max_tokens' => env('LLM_MAX_TOKENS', 1000),
    'timeout' => env('LLM_TIMEOUT', 30),
    'max_retries' => env('LLM_MAX_RETRIES', 3),
];
