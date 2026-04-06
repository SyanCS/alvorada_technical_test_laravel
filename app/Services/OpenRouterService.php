<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

/**
 * OpenRouter Service
 * Handles all interactions with OpenRouter API (OpenAI-compatible).
 */
class OpenRouterService
{
    private string $apiBaseUrl;
    private ?string $apiKey;
    private string $model;
    private float $temperature;
    private int $maxTokens;
    private int $timeout;
    private int $maxRetries;

    public function __construct()
    {
        $this->apiBaseUrl = config('llm.api_base_url', 'https://openrouter.ai/api/v1');
        $this->apiKey = config('llm.api_key');
        $this->model = config('llm.model', 'google/gemini-2.0-flash-001');
        $this->temperature = (float) config('llm.temperature', 0.7);
        $this->maxTokens = (int) config('llm.max_tokens', 1000);
        $this->timeout = (int) config('llm.timeout', 30);
        $this->maxRetries = (int) config('llm.max_retries', 3);
    }

    /**
     * Check if API key is configured.
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Send chat completion request via OpenRouter.
     *
     * @throws Exception
     */
    public function chat(array $messages, array $options = []): array
    {
        if (!$this->isConfigured()) {
            throw new Exception('OpenRouter API key not configured. Please set LLM_API_KEY in .env file.');
        }

        if (empty($messages)) {
            throw new Exception('Messages array cannot be empty');
        }

        $payload = [
            'model' => $options['model'] ?? $this->model,
            'messages' => $messages,
            'temperature' => $options['temperature'] ?? $this->temperature,
            'max_tokens' => $options['max_tokens'] ?? $this->maxTokens,
        ];

        // Add JSON mode if requested
        if (isset($options['response_format']) && $options['response_format'] === 'json') {
            $payload['response_format'] = ['type' => 'json_object'];
        }

        return $this->makeRequestWithRetry($payload);
    }

    /**
     * Extract structured data using JSON mode.
     *
     * @throws Exception
     */
    public function extractStructuredData(string $systemPrompt, string $userPrompt, array $options = []): array
    {
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ];

        $options['response_format'] = 'json';

        $response = $this->chat($messages, $options);

        $text = $this->extractTextFromResponse($response);

        $data = json_decode($text, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Failed to parse JSON response: ' . json_last_error_msg() . '. Response: ' . $text);
        }

        return [
            'success' => true,
            'data' => $data,
            'raw_response' => $text,
            'usage' => $response['usage'] ?? null,
        ];
    }

    /**
     * Extract text content from OpenAI-compatible response.
     */
    private function extractTextFromResponse(array $response): string
    {
        if (!isset($response['choices'][0]['message']['content'])) {
            throw new Exception('Unexpected API response format: ' . json_encode($response));
        }

        return $response['choices'][0]['message']['content'];
    }

    /**
     * Make HTTP request with automatic retry logic.
     */
    private function makeRequestWithRetry(array $payload): array
    {
        $lastException = null;
        $endpoint = rtrim($this->apiBaseUrl, '/') . '/chat/completions';

        for ($attempt = 1; $attempt <= $this->maxRetries; $attempt++) {
            try {
                $response = Http::timeout($this->timeout)
                    ->withHeaders([
                        'Authorization' => 'Bearer ' . $this->apiKey,
                        'HTTP-Referer' => 'https://alvorada-property-research.com',
                        'X-Title' => 'Alvorada Property Research System',
                    ])
                    ->acceptJson()
                    ->post($endpoint, $payload);

                $data = $response->json();

                if (isset($data['error'])) {
                    throw new Exception(
                        'API error: ' . ($data['error']['message'] ?? json_encode($data['error']))
                    );
                }

                return $data;
            } catch (Exception $e) {
                $lastException = $e;
                Log::warning("OpenRouter API attempt {$attempt}/{$this->maxRetries} failed: " . $e->getMessage());

                $errorMessage = $e->getMessage();
                if (
                    str_contains($errorMessage, 'invalid_api_key') ||
                    str_contains($errorMessage, 'authentication') ||
                    str_contains($errorMessage, 'API key') ||
                    str_contains($errorMessage, '401')
                ) {
                    throw $e;
                }

                if ($attempt < $this->maxRetries) {
                    $waitTime = pow(2, $attempt - 1);
                    sleep($waitTime);
                }
            }
        }

        throw new Exception(
            "API request failed after {$this->maxRetries} attempts. Last error: " .
            ($lastException ? $lastException->getMessage() : 'Unknown error')
        );
    }

    /**
     * Get current model name.
     */
    public function getModel(): string
    {
        return $this->model;
    }

    /**
     * Get API configuration info (for debugging).
     */
    public function getConfigInfo(): array
    {
        return [
            'configured' => $this->isConfigured(),
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'api_base_url' => $this->apiBaseUrl,
        ];
    }
}
