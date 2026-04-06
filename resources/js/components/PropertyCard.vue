<template>
  <router-link
    :to="`/properties/${property.id}`"
    class="block backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-blue-500/5 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer group"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex-1 min-w-0">
        <h3 class="text-base font-bold tracking-tight text-gray-800 truncate group-hover:text-blue-600 transition-colors duration-200">
          {{ property.name }}
        </h3>
        <p class="text-sm text-gray-500 leading-relaxed mt-1 line-clamp-2">
          {{ property.address }}
        </p>
      </div>
      <div v-if="conditionRating" class="ml-3 shrink-0">
        <div class="flex items-center gap-0.5">
          <svg
            v-for="star in 5"
            :key="star"
            class="w-3.5 h-3.5"
            :class="star <= conditionRating ? 'text-amber-400' : 'text-gray-200'"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Feature badges -->
    <div v-if="hasBadges" class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-if="features?.near_subway"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/50"
      >
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        Subway
      </span>
      <span
        v-if="features?.parking_available"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-600 border border-blue-200/50"
      >
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
        Parking
      </span>
      <span
        v-if="features?.has_elevator"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-violet-50 text-violet-600 border border-violet-200/50"
      >
        Elevator
      </span>
      <span
        v-if="features?.recommended_use"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200/50"
      >
        {{ capitalize(features.recommended_use) }}
      </span>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between pt-3 border-t border-gray-100">
      <span v-if="property.latitude && property.longitude" class="text-xs text-gray-400 font-mono">
        {{ Number(property.latitude).toFixed(4) }}, {{ Number(property.longitude).toFixed(4) }}
      </span>
      <span v-if="noteCount > 0" class="text-xs text-gray-400">
        {{ noteCount }} note{{ noteCount !== 1 ? 's' : '' }}
      </span>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  property: { type: Object, required: true },
});

const features = computed(() => props.property.features || null);
const conditionRating = computed(() => features.value?.condition_rating || 0);
const noteCount = computed(() => props.property.notes?.length ?? props.property.notes_count ?? 0);

const hasBadges = computed(
  () =>
    features.value &&
    (features.value.near_subway ||
      features.value.parking_available ||
      features.value.has_elevator ||
      features.value.recommended_use),
);

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
</script>
