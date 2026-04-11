<template>
  <router-link :to="`/properties/${result.property_id}`" class="block no-underline">
  <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-blue-500/5 transition-all duration-300 ease-in-out hover:shadow-xl hover:scale-[1.01] cursor-pointer">
    <!-- Header: name + score circle -->
    <div class="flex items-start justify-between gap-4 mb-4">
      <div class="flex-1 min-w-0">
        <h3 class="text-base font-bold tracking-tight text-gray-800 truncate">
          <span v-if="rank" class="text-gray-400 mr-1">#{{ rank }}</span>
          {{ result.property_name }}
        </h3>
        <p class="text-sm text-gray-500 mt-0.5 truncate">{{ result.address }}</p>
      </div>
      <!-- Score Circle -->
      <div
        class="shrink-0 w-16 h-16 rounded-full flex flex-col items-center justify-center shadow-md"
        :class="scoreBgClass"
      >
        <span class="text-2xl font-bold leading-none text-white">{{ result.score }}</span>
        <span class="text-[10px] text-white/80">/ 10</span>
      </div>
    </div>

    <!-- Explanation -->
    <div class="bg-gray-50/60 rounded-xl p-3 mb-4">
      <p class="text-sm text-gray-600 leading-relaxed">{{ result.explanation }}</p>
    </div>

    <!-- Strengths / Weaknesses -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div v-if="result.strengths && result.strengths.length">
        <h4 class="text-xs uppercase tracking-wider text-emerald-600 font-semibold mb-2">Strengths</h4>
        <ul class="space-y-1.5">
          <li
            v-for="(s, i) in result.strengths"
            :key="i"
            class="flex items-start gap-1.5 text-sm text-emerald-700 leading-snug"
          >
            <svg class="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            {{ s }}
          </li>
        </ul>
      </div>
      <div v-if="result.weaknesses && result.weaknesses.length">
        <h4 class="text-xs uppercase tracking-wider text-rose-500 font-semibold mb-2">Weaknesses</h4>
        <ul class="space-y-1.5">
          <li
            v-for="(w, i) in result.weaknesses"
            :key="i"
            class="flex items-start gap-1.5 text-sm text-rose-600 leading-snug"
          >
            <svg class="w-4 h-4 mt-0.5 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            {{ w }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Confidence bar -->
    <div v-if="result.confidence != null" class="pt-3 border-t border-gray-100">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs text-gray-400">AI Confidence</span>
        <span class="text-xs font-semibold text-gray-600">{{ confidencePercent }}%</span>
      </div>
      <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
          :style="{ width: confidencePercent + '%' }"
        ></div>
      </div>
    </div>

    <!-- Feature completeness (optional) -->
    <div v-if="result.feature_completeness != null" class="mt-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-gray-400">Feature Completeness</span>
        <span class="text-xs font-semibold text-gray-600">{{ featurePercent }}%</span>
      </div>
      <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-500 ease-out"
          :style="{ width: featurePercent + '%' }"
        ></div>
      </div>
    </div>
  </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  result: { type: Object, required: true },
  rank: { type: Number, default: 0 },
});

const scoreBgClass = computed(() => {
  const s = props.result.score;
  if (s >= 7) return 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30';
  if (s >= 4) return 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-500/30';
  return 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30';
});

const confidencePercent = computed(() => Math.round((props.result.confidence ?? 0) * 100));
const featurePercent = computed(() => Math.round((props.result.feature_completeness ?? 0) * 100));
</script>
