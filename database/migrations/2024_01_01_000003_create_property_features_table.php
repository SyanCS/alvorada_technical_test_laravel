<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('property_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->unique()->constrained('properties')->cascadeOnDelete();

            // Boolean features
            $table->boolean('near_subway')->nullable();
            $table->boolean('needs_renovation')->nullable();
            $table->boolean('parking_available')->nullable();
            $table->boolean('has_elevator')->nullable();

            // Numeric features
            $table->integer('estimated_capacity_people')->nullable();
            $table->integer('floor_level')->nullable();
            $table->integer('condition_rating')->nullable(); // 1-5

            // Text features
            $table->string('recommended_use', 100)->nullable();

            // Flexible features
            $table->json('amenities')->nullable();

            // AI metadata
            $table->decimal('confidence_score', 3, 2)->nullable();
            $table->integer('source_notes_count')->nullable();
            $table->json('raw_ai_response')->nullable();
            $table->timestamp('extracted_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('property_features');
    }
};
