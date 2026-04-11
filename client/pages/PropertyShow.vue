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
        <!-- Features tab -->
        <div v-if="activeTab === 'features'" key="features">
          <FeatureCard :property-id="property.id" :features="property.features" @extracted="onFeaturesExtracted" />
        </div>

        <!-- Notes tab -->
        <div v-else-if="activeTab === 'notes'" key="notes" class="space-y-4">
          <NoteForm :property-id="property.id" @added="onNoteAdded" />
          <NoteList :notes="notes" />
        </div>

        <!-- Similar tab -->
        <div v-else-if="activeTab === 'similar'" key="similar">
          <!-- Header card -->
          <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-6 shadow-lg shadow-indigo-500/5 mb-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <div>
                <h3 class="text-base font-bold text-gray-800 dark:text-white">Knowledge Graph Similarity</h3>
                <p class="text-xs text-gray-400">Discover related properties through shared neighborhoods, landmarks, amenities, and use types.</p>
              </div>
            </div>
            <div class="flex items-center justify-end">
              <button
                @click="loadSimilar"
                :disabled="store.loadingSimilar"
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <svg v-if="store.loadingSimilar" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {{ store.loadingSimilar ? 'Searching...' : 'Find Similar Properties' }}
              </button>
            </div>
          </div>

          <!-- Pipeline progress -->
          <div v-if="store.loadingSimilar && store.similarPipelineNodes.length" class="backdrop-blur-xl bg-white/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-indigo-500/5 mb-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Similarity Pipeline</h3>
            <div class="space-y-0">
              <div
                v-for="(node, i) in store.similarPipelineNodes"
                :key="node.id"
                class="relative flex items-start gap-3 pb-5 last:pb-0"
              >
                <div v-if="i < store.similarPipelineNodes.length - 1" class="absolute left-[13px] top-[28px] w-0.5 h-[calc(100%-16px)]" :class="isNodeCompleted(node.id) ? 'bg-indigo-300' : 'bg-gray-200'"></div>
                <div class="relative z-10 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500"
                  :class="{
                    'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30': isNodeCompleted(node.id),
                    'bg-indigo-400 text-white shadow-lg shadow-indigo-400/40 animate-pulse': store.similarCurrentNode === node.id && !isNodeCompleted(node.id),
                    'bg-gray-200 text-gray-400': store.similarCurrentNode !== node.id && !isNodeCompleted(node.id),
                  }"
                >
                  <svg v-if="isNodeCompleted(node.id)" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <svg v-else-if="store.similarCurrentNode === node.id" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  <span v-else class="text-xs font-bold">{{ i + 1 }}</span>
                </div>
                <div class="pt-0.5">
                  <p class="text-sm font-semibold transition-colors duration-300"
                    :class="{
                      'text-indigo-700': isNodeCompleted(node.id),
                      'text-indigo-500': store.similarCurrentNode === node.id && !isNodeCompleted(node.id),
                      'text-gray-400': store.similarCurrentNode !== node.id && !isNodeCompleted(node.id),
                    }"
                  >{{ node.label }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div v-if="similarSummary" class="backdrop-blur-xl bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 mb-4">
            <p class="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed italic">{{ similarSummary }}</p>
          </div>

          <!-- Results -->
          <div v-if="store.similarProperties.length > 0">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-400">{{ store.similarProperties.length }} Similar Properties</h3>
            </div>
            <div class="space-y-3">
            <router-link
              v-for="prop in store.similarProperties"
              :key="prop.property_id"
              :to="`/properties/${prop.property_id}`"
              class="block p-5 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl shadow-lg shadow-indigo-500/5 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 ease-in-out no-underline"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-indigo-600 dark:text-indigo-400 truncate block">
                    {{ prop.property_name }}
                  </span>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ prop.address }}</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300 mt-2">{{ prop.explanation }}</p>
                  <div v-if="prop.shared_concepts && prop.shared_concepts.length" class="flex flex-wrap gap-1 mt-2">
                    <span
                      v-for="concept in prop.shared_concepts"
                      :key="concept"
                      class="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full"
                    >
                      {{ concept }}
                    </span>
                  </div>
                </div>
                <div class="ml-4 flex-shrink-0 text-center">
                  <div class="text-2xl font-bold" :class="scoreColor(prop.similarity_score)">
                    {{ prop.similarity_score }}%
                  </div>
                  <div class="text-xs text-gray-400">similar</div>
                </div>
              </div>
            </router-link>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-else-if="!store.loadingSimilar && similarSearched"
            class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-8 shadow-lg text-center"
          >
            <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">No similar properties found</p>
            <p class="text-xs text-gray-400">Make sure Neo4j is seeded with <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">npm run neo4j:seed</code></p>
          </div>
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

const activeTab = ref('features');
const miniMapEl = ref(null);
let miniMap = null;

const tabs = [
  { id: 'features', label: 'Features' },
  { id: 'similar', label: 'Similar' },
  { id: 'notes', label: 'Notes' },
];

const property = computed(() => store.currentProperty);
const notes = computed(() => property.value?.notes ?? []);

function isNodeCompleted(nodeId) {
  return store.similarCompletedNodes.indexOf(nodeId) !== -1;
}

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

const similarSummary = ref('');
const similarSearched = ref(false);

async function loadSimilar() {
  try {
    const result = await store.findSimilar(property.value.id, 5);
    similarSummary.value = result?.summary ?? '';
    similarSearched.value = true;
  } catch {
    similarSearched.value = true;
  }
}

function scoreColor(score) {
  if (score >= 75) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-500 dark:text-gray-400';
}

function resetSimilarState() {
  similarSummary.value = '';
  similarSearched.value = false;
  store.similarProperties = [];
  store.similarPipelineNodes = [];
  store.similarCompletedNodes = [];
  store.similarCurrentNode = null;
}

onMounted(loadProperty);

onUnmounted(() => {
  if (miniMap) {
    miniMap.remove();
    miniMap = null;
  }
});

// Reload property + reset tabs when navigating between properties
watch(() => route.params.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    activeTab.value = 'features';
    resetSimilarState();
    loadProperty();
  }
});

// Re-init minimap when tab switches might re-render
watch(activeTab, async () => {
  await nextTick();
  if (miniMap) miniMap.invalidateSize();
});
</script>
