<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AISimilarTest extends TestCase
{
    public function test_similar_proxies_to_ai_service_and_returns_data(): void
    {
        Http::fake([
            '*/similar' => Http::response([
                'data' => [
                    'similar_properties' => [
                        ['property_id' => 2, 'property_name' => 'Test Property', 'similarity_score' => 85],
                    ],
                    'summary' => 'Found 1 similar property.',
                    'source_property_id' => 1,
                ],
                'message' => 'Similar properties found',
            ], 200),
        ]);

        $response = $this->postJson('/api/ai/similar', [
            'property_id' => 1,
            'limit' => 5,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.source_property_id', 1)
            ->assertJsonPath('data.summary', 'Found 1 similar property.')
            ->assertJsonCount(1, 'data.similar_properties');
    }

    public function test_similar_returns_422_when_property_id_missing(): void
    {
        $response = $this->postJson('/api/ai/similar', []);

        $response->assertStatus(422);
    }

    public function test_similar_returns_503_when_ai_service_returns_error(): void
    {
        Http::fake([
            '*/similar' => Http::response([], 500),
        ]);

        $response = $this->postJson('/api/ai/similar', [
            'property_id' => 1,
        ]);

        $response->assertStatus(503)
            ->assertJsonPath('data', null);
    }
}
