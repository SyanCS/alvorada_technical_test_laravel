<template>
  <div class="max-w-5xl mx-auto">
    <!-- Scoring input panel -->
    <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-6 shadow-lg shadow-blue-500/5 mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-gray-800 mb-1">Property Scoring</h1>
      <p class="text-sm text-gray-400 leading-relaxed mb-5">
        Enter your client's requirements and our AI will score all properties from 0 to 10.
      </p>

      <!-- Quick examples -->
      <div class="bg-gray-50/60 rounded-xl p-4 mb-5">
        <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Quick Examples</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex.label"
            @click="requirements = ex.text"
            class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
          >
            {{ ex.label }}
          </button>
        </div>
      </div>

      <!-- Requirements textarea -->
      <div class="mb-4">
        <label class="block text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
          Client Requirements
        </label>
        <textarea
          v-model="requirements"
          placeholder="Example: Client is looking for an office near the subway, budget up to $50k/month, for 15-20 people, preferably in a central area with parking and modern amenities."
          rows="4"
          class="w-full px-4 py-3 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none resize-y"
          @keydown.enter.exact.prevent="doScore"
        ></textarea>
      </div>

      <!-- Controls -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-400 font-medium">Limit</label>
          <input
            v-model.number="limit"
            type="number"
            min="1"
            max="100"
            class="w-20 px-3 py-2 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
          />
        </div>
        <button
          @click="doScore"
          :disabled="store.loading || !requirements.trim()"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <svg v-if="store.loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ store.loading ? 'Scoring...' : 'Score All Properties' }}
        </button>
        <button
          v-if="store.results.length"
          @click="store.clearResults()"
          class="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Pipeline progress -->
    <div v-if="store.loading" class="backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-6 shadow-lg shadow-blue-500/5 mb-6">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-5">LangGraph Pipeline</h2>
      <div class="space-y-0">
        <div
          v-for="(node, i) in store.pipelineNodes"
          :key="node.id"
          class="relative flex items-start gap-4 pb-6 last:pb-0"
        >
          <!-- Connector line -->
          <div v-if="i < store.pipelineNodes.length - 1" class="absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-20px)]" :class="store.completedNodes.includes(node.id) ? 'bg-emerald-300' : 'bg-gray-200'"></div>

          <!-- Step icon -->
          <div class="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500"
            :class="{
              'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30': store.completedNodes.includes(node.id),
              'bg-blue-500 text-white shadow-lg shadow-blue-500/40 animate-pulse': store.currentNode === node.id && !store.completedNodes.includes(node.id),
              'bg-gray-200 text-gray-400': store.currentNode !== node.id && !store.completedNodes.includes(node.id),
            }"
          >
            <!-- Completed check -->
            <svg v-if="store.completedNodes.includes(node.id)" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Running spinner -->
            <svg v-else-if="store.currentNode === node.id" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <!-- Pending number -->
            <span v-else class="text-xs font-bold">{{ i + 1 }}</span>
          </div>

          <!-- Label -->
          <div class="pt-1">
            <p class="text-sm font-semibold transition-colors duration-300"
              :class="{
                'text-emerald-700': store.completedNodes.includes(node.id),
                'text-blue-700': store.currentNode === node.id && !store.completedNodes.includes(node.id),
                'text-gray-400': store.currentNode !== node.id && !store.completedNodes.includes(node.id),
              }"
            >
              {{ node.label }}
            </p>
            <p class="text-xs text-gray-400 font-mono">{{ node.id }}</p>
          </div>
        </div>
      </div>

      <!-- Fallback if nodes haven't arrived yet -->
      <div v-if="!store.pipelineNodes.length" class="text-center py-4">
        <LoadingSpinner text="Connecting to AI service..." />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="backdrop-blur-xl bg-rose-50/70 border border-rose-200 rounded-2xl p-6 text-center mb-6">
      <p class="text-sm text-rose-600 mb-3">{{ store.error }}</p>
      <button @click="doScore" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Try again</button>
    </div>

    <!-- Results -->
    <template v-if="store.results.length">
      <!-- Results header -->
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 class="text-lg font-bold tracking-tight text-gray-800">Scored Properties</h2>
        <div class="flex gap-3 text-xs text-gray-400">
          <span class="bg-gray-100 px-3 py-1.5 rounded-lg font-medium">{{ store.results.length }} properties scored</span>
          <span v-if="elapsedTime" class="bg-gray-100 px-3 py-1.5 rounded-lg font-medium">{{ elapsedTime }}s</span>
        </div>
      </div>

      <!-- Score cards -->
      <div class="space-y-4">
        <ScoreCard
          v-for="(result, index) in sortedResults"
          :key="result.property_id || index"
          :result="result"
          :rank="index + 1"
        />
      </div>
    </template>

    <!-- Empty state (only shown after scoring with no results) -->
    <EmptyState
      v-else-if="hasScored && !store.loading"
      title="No Properties Found"
      description="No properties available to score. Add some properties first!"
      action-label="Add Property"
      action-to="/properties/create"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useScoringStore } from '../stores/scoringStore.js';
import { useToast } from '../composables/useToast.js';
import ScoreCard from '../components/ScoreCard.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import EmptyState from '../components/EmptyState.vue';

const store = useScoringStore();
const toast = useToast();

const requirements = ref(store.requirements || '');
const limit = ref(10);
const hasScored = ref(false);
const elapsedTime = ref('');

const examples = [
  { label: 'Office space', text: 'Office space for 20-30 people near subway, parking needed, modern condition, $40-50k/month budget' },
  { label: 'Retail storefront', text: 'Retail location in high-traffic area, ground floor, 1500-2000 sqft, large display windows, central shopping district, budget $15-25k/month' },
  { label: 'Warehouse', text: 'Warehouse for e-commerce fulfillment, minimum 10,000 sqft, loading dock required, 20ft ceiling clearance, near highway access, budget $8-12k/month' },
  { label: 'Tech startup', text: 'Office for tech startup, 25-30 people, near public transit, parking for 10 cars, high-speed internet required, modern open floor plan with natural light, budget $40-60k/month' },
];

const sortedResults = computed(() =>
  [...store.results].sort((a, b) => b.score - a.score),
);

async function doScore() {
  if (!requirements.value.trim()) {
    toast.warning('Please enter client requirements.');
    return;
  }
  const start = Date.now();
  try {
    await store.scoreProperties(requirements.value.trim(), limit.value);
    elapsedTime.value = ((Date.now() - start) / 1000).toFixed(1);
    hasScored.value = true;
  } catch {
    toast.error(store.error || 'Scoring failed.');
  }
}
</script>
