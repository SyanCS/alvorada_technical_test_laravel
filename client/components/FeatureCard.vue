<template>
  <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-blue-500/5">
    <div class="flex items-center justify-between mb-5">
      <h3 class="text-base font-bold tracking-tight text-gray-800 flex items-center gap-2">
        <svg class="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        AI-Extracted Features
      </h3>
      <button
        @click="handleExtract"
        :disabled="extracting"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        <svg
          v-if="extracting"
          class="animate-spin w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ extracting ? 'Extracting...' : (hasFeatures ? 'Re-extract' : 'Extract Features') }}
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="extracting" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <div v-for="i in 6" :key="i" class="bg-gray-100 rounded-xl p-3 animate-pulse">
        <div class="h-3 bg-gray-200 rounded w-16 mb-2"></div>
        <div class="h-5 bg-gray-200 rounded w-12"></div>
      </div>
    </div>

    <!-- Features grid -->
    <div v-else-if="hasFeatures">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        <!-- Boolean features -->
        <div v-for="feat in booleanFeatures" :key="feat.key" class="bg-white/50 rounded-xl p-3 border border-gray-100">
          <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">{{ feat.label }}</p>
          <p class="text-sm font-semibold flex items-center gap-1" :class="feat.colorClass">
            <span v-html="feat.icon"></span>
            {{ feat.displayValue }}
          </p>
        </div>

        <!-- Numeric features -->
        <div v-for="feat in numericFeatures" :key="feat.key" class="bg-white/50 rounded-xl p-3 border border-gray-100">
          <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">{{ feat.label }}</p>
          <p class="text-sm font-semibold text-gray-800">{{ feat.displayValue }}</p>
        </div>
      </div>

      <!-- Amenities -->
      <div v-if="features.amenities && features.amenities.length" class="mb-4">
        <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Amenities</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="amenity in features.amenities"
            :key="amenity"
            class="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-50 text-violet-600 border border-violet-200/50"
          >
            {{ capitalize(amenity) }}
          </span>
        </div>
      </div>

      <!-- Confidence bar -->
      <div v-if="features.confidence_score != null" class="pt-3 border-t border-gray-100">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs text-gray-400">AI Confidence</span>
          <span class="text-xs font-semibold text-gray-600">{{ confidencePercent }}%</span>
        </div>
        <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            :class="confidenceBarColor"
            :style="{ width: confidencePercent + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8">
      <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-violet-50 flex items-center justify-center">
        <svg class="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <p class="text-sm text-gray-500">Click "Extract Features" to analyze notes with AI.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { usePropertyStore } from '../stores/propertyStore.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  propertyId: { type: [Number, String], required: true },
  features: { type: Object, default: null },
});

const emit = defineEmits(['extracted']);
const store = usePropertyStore();
const toast = useToast();
const extracting = ref(false);

const hasFeatures = computed(() => props.features && Object.keys(props.features).length > 0);

const booleanFields = [
  { key: 'near_subway', label: 'Near Subway' },
  { key: 'parking_available', label: 'Parking' },
  { key: 'has_elevator', label: 'Elevator' },
  { key: 'needs_renovation', label: 'Needs Renovation' },
];

const booleanFeatures = computed(() => {
  if (!props.features) return [];
  return booleanFields
    .filter((f) => props.features[f.key] !== null && props.features[f.key] !== undefined)
    .map((f) => {
      const val = props.features[f.key];
      return {
        ...f,
        displayValue: val ? 'Yes' : 'No',
        colorClass: val ? 'text-emerald-600' : 'text-rose-500',
        icon: val
          ? '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
          : '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
      };
    });
});

const numericFields = [
  { key: 'estimated_capacity_people', label: 'Capacity', suffix: ' people' },
  { key: 'floor_level', label: 'Floor Level', prefix: 'Floor ' },
  { key: 'condition_rating', label: 'Condition', suffix: '/5' },
  { key: 'recommended_use', label: 'Best For' },
];

const numericFeatures = computed(() => {
  if (!props.features) return [];
  return numericFields
    .filter((f) => props.features[f.key])
    .map((f) => {
      let val = props.features[f.key];
      if (f.key === 'recommended_use') val = capitalize(val);
      return {
        ...f,
        displayValue: `${f.prefix || ''}${val}${f.suffix || ''}`,
      };
    });
});

const confidencePercent = computed(() => {
  const s = parseFloat(props.features?.confidence_score ?? 0);
  return Math.round(s * 100);
});

const confidenceBarColor = computed(() => {
  const p = confidencePercent.value;
  if (p >= 80) return 'bg-emerald-500';
  if (p >= 60) return 'bg-amber-400';
  return 'bg-rose-500';
});

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function handleExtract() {
  extracting.value = true;
  try {
    const features = await store.extractFeatures(Number(props.propertyId), true);
    toast.success('Features extracted successfully!');
    emit('extracted', features);
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to extract features.');
  } finally {
    extracting.value = false;
  }
}
</script>
