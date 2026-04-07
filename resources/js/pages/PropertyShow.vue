<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back link -->
    <router-link
      to="/"
      class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors duration-200 mb-4"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Properties
    </router-link>

    <!-- Loading -->
    <LoadingSpinner v-if="store.loadingOne" text="Loading property..." />

    <!-- Error -->
    <div v-else-if="store.error" class="bg-rose-50/70 border border-rose-200 rounded-2xl p-6 text-center">
      <p class="text-sm text-rose-600 mb-3">{{ store.error }}</p>
      <button @click="loadProperty" class="text-sm font-semibold text-blue-600 hover:text-blue-700">Try again</button>
    </div>

    <!-- Property loaded -->
    <template v-else-if="property">
      <!-- Header card -->
      <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-6 shadow-lg shadow-blue-500/5 mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-gray-800 mb-1">{{ property.name }}</h1>
        <p class="text-sm text-gray-500 leading-relaxed mb-4">{{ property.address }}</p>

        <!-- Meta grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white/50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Latitude</p>
            <p class="text-sm font-semibold text-gray-700 font-mono">{{ formatCoord(property.latitude) }}</p>
          </div>
          <div class="bg-white/50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Longitude</p>
            <p class="text-sm font-semibold text-gray-700 font-mono">{{ formatCoord(property.longitude) }}</p>
          </div>
          <div class="bg-white/50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Notes</p>
            <p class="text-sm font-semibold text-gray-700">{{ notes.length }}</p>
          </div>
          <div class="bg-white/50 rounded-xl p-3 border border-gray-100 text-center">
            <p class="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Created</p>
            <p class="text-sm font-semibold text-gray-700">{{ formatDate(property.created_at) }}</p>
          </div>
        </div>

        <!-- Mini map -->
        <div
          v-if="property.latitude && property.longitude"
          ref="miniMapEl"
          class="mt-4 h-48 rounded-xl overflow-hidden border border-gray-200"
        ></div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-4 bg-white/40 rounded-xl p-1 border border-white/20 backdrop-blur-sm w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          :class="activeTab === tab.id
            ? 'bg-white shadow-sm text-blue-600'
            : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab content -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        mode="out-in"
      >
        <!-- Notes tab -->
        <div v-if="activeTab === 'notes'" key="notes" class="space-y-4">
          <NoteForm :property-id="property.id" @added="onNoteAdded" />
          <NoteList :notes="notes" />
        </div>

        <!-- Features tab -->
        <div v-else-if="activeTab === 'features'" key="features">
          <FeatureCard :property-id="property.id" :features="property.features" @extracted="onFeaturesExtracted" />
        </div>

      </Transition>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import L from 'leaflet';
import { usePropertyStore } from '../stores/propertyStore.js';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import NoteForm from '../components/NoteForm.vue';
import NoteList from '../components/NoteList.vue';
import FeatureCard from '../components/FeatureCard.vue';

const route = useRoute();
const store = usePropertyStore();

const activeTab = ref('notes');
const miniMapEl = ref(null);
let miniMap = null;

const tabs = [
  { id: 'notes', label: 'Notes' },
  { id: 'features', label: 'Features' },
];

const property = computed(() => store.currentProperty);
const notes = computed(() => property.value?.notes ?? []);

function formatCoord(val) {
  if (val == null) return '-';
  return Number(val).toFixed(6);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function loadProperty() {
  await store.fetchProperty(route.params.id);
  await nextTick();
  initMiniMap();
}

function initMiniMap() {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
  if (!miniMapEl.value || !property.value?.latitude || !property.value?.longitude) return;

  miniMap = L.map(miniMapEl.value, { zoomControl: false, attributionControl: false }).setView(
    [property.value.latitude, property.value.longitude],
    15,
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
  L.marker([property.value.latitude, property.value.longitude]).addTo(miniMap);
  setTimeout(() => miniMap?.invalidateSize(), 100);
}

function onNoteAdded() {
  // Notes already appended via store
}

function onFeaturesExtracted(features) {
  if (property.value) property.value.features = features;
}


onMounted(loadProperty);

onUnmounted(() => {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
});

// Re-init minimap when tab switches might re-render
watch(activeTab, async () => {
  await nextTick();
  if (miniMap) miniMap.invalidateSize();
});
</script>
