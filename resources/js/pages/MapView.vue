<template>
  <div class="max-w-7xl mx-auto -mt-2">
    <!-- Controls -->
    <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-4 shadow-lg shadow-blue-500/5 mb-4">
      <!-- Stats row -->
      <div class="grid grid-cols-3 gap-3 mb-3">
        <div class="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-3 text-center text-white">
          <p class="text-xs opacity-80">Total Properties</p>
          <p class="text-xl font-bold">{{ propertyStore.properties.length }}</p>
        </div>
        <div class="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-3 text-center text-white">
          <p class="text-xs opacity-80">Visible on Map</p>
          <p class="text-xl font-bold">{{ visibleCount }}</p>
        </div>
        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-center text-white">
          <p class="text-xs opacity-80">Zoom Level</p>
          <p class="text-xl font-bold">{{ mapStore.zoom }}</p>
        </div>
      </div>

      <!-- Filter controls -->
      <div class="flex flex-wrap gap-2">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search properties..."
          class="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
        />
        <button
          @click="resetView"
          class="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
        >
          Reset View
        </button>
        <button
          @click="fitAllMarkers"
          class="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
        >
          Fit All
        </button>
        <button
          @click="refreshData"
          class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02]"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="propertyStore.loading && !mapReady" text="Loading properties..." />

    <!-- Map container -->
    <div
      ref="mapContainer"
      class="w-full rounded-2xl shadow-lg shadow-blue-500/10 overflow-hidden border border-white/20"
      :style="{ height: mapHeight + 'px' }"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import { usePropertyStore } from '../stores/propertyStore.js';
import { useMapStore } from '../stores/mapStore.js';
import LoadingSpinner from '../components/LoadingSpinner.vue';

const router = useRouter();
const propertyStore = usePropertyStore();
const mapStore = useMapStore();

const mapContainer = ref(null);
const searchQuery = ref('');
const visibleCount = ref(0);
const mapReady = ref(false);

let map = null;
let markerClusterGroup = null;
let markersData = [];

// Dynamic map height
const mapHeight = computed(() => Math.max(400, window.innerHeight - 320));

const filteredProperties = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return propertyStore.properties;
  return propertyStore.properties.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q),
  );
});

function initMap() {
  if (!mapContainer.value || map) return;

  map = L.map(mapContainer.value).setView(mapStore.center, mapStore.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Marker cluster group — use plain L.layerGroup as fallback if markerCluster not loaded
  if (L.markerClusterGroup) {
    markerClusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
  } else {
    markerClusterGroup = L.layerGroup();
  }
  map.addLayer(markerClusterGroup);

  map.on('zoomend', () => {
    mapStore.setZoom(map.getZoom());
  });
  map.on('moveend', updateVisibleCount);

  setTimeout(() => map?.invalidateSize(), 100);
  mapReady.value = true;
}

function renderMarkers(properties) {
  if (!markerClusterGroup) return;
  markerClusterGroup.clearLayers();
  markersData = [];

  properties.forEach((property) => {
    if (!property.latitude || !property.longitude) return;

    const marker = L.marker([property.latitude, property.longitude]);
    const popupContent = `
      <div style="min-width:200px;max-width:280px;font-family:Inter,sans-serif">
        <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 6px">${escapeHtml(property.name)}</h3>
        <p style="font-size:13px;color:#64748b;margin:0 0 4px">${escapeHtml(property.address)}</p>
        <p style="font-size:11px;color:#94a3b8;font-family:monospace;margin:0 0 10px">${Number(property.latitude).toFixed(6)}, ${Number(property.longitude).toFixed(6)}</p>
        <a href="/properties/${property.id}" style="display:inline-block;padding:5px 12px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;text-decoration:none;border-radius:8px;font-size:12px;font-weight:600">View Details</a>
      </div>
    `;
    marker.bindPopup(popupContent);

    // Navigate on popup link click
    marker.on('popupopen', () => {
      const link = marker.getPopup().getElement()?.querySelector('a');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          router.push(`/properties/${property.id}`);
        });
      }
    });

    markersData.push({ marker, property });
    markerClusterGroup.addLayer(marker);
  });

  updateVisibleCount();
}

function updateVisibleCount() {
  if (!map) { visibleCount.value = 0; return; }
  const bounds = map.getBounds();
  visibleCount.value = markersData.filter(({ property }) =>
    bounds.contains([property.latitude, property.longitude]),
  ).length;
}

function fitAllMarkers() {
  if (!markersData.length || !map) return;
  const group = L.featureGroup(markersData.map((m) => m.marker));
  map.fitBounds(group.getBounds().pad(0.1));
}

function resetView() {
  if (!map) return;
  map.setView([39.8283, -98.5795], 4);
}

function refreshData() {
  propertyStore.fetchProperties();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Watch filtered properties to update markers
watch(filteredProperties, (props) => {
  renderMarkers(props);
}, { immediate: false });

// Load markercluster dynamically
async function loadMarkerCluster() {
  if (L.markerClusterGroup) return;
  try {
    // Load CSS
    const css1 = document.createElement('link');
    css1.rel = 'stylesheet';
    css1.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    document.head.appendChild(css1);
    const css2 = document.createElement('link');
    css2.rel = 'stylesheet';
    css2.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    document.head.appendChild(css2);

    // Load JS
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  } catch {
    console.warn('MarkerCluster plugin could not be loaded. Falling back to simple layer group.');
  }
}

onMounted(async () => {
  await loadMarkerCluster();
  initMap();
  if (!propertyStore.properties.length) {
    await propertyStore.fetchProperties();
  }
  renderMarkers(filteredProperties.value);
  if (markersData.length) fitAllMarkers();

  // Focus on a specific property if stored
  if (mapStore.selectedPropertyId) {
    const md = markersData.find((m) => m.property.id === mapStore.selectedPropertyId);
    if (md) {
      map.setView([md.property.latitude, md.property.longitude], 15);
      setTimeout(() => md.marker.openPopup(), 500);
    }
    mapStore.selectProperty(null);
  }
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>
