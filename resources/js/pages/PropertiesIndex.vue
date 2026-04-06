<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-800">Properties</h1>
        <p class="text-sm text-gray-400 mt-1">
          <span v-if="!store.loading">{{ filtered.length }} propert{{ filtered.length === 1 ? 'y' : 'ies' }}</span>
          <span v-else>Loading...</span>
        </p>
      </div>
      <router-link
        to="/properties/create"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] self-start"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Property
      </router-link>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <input
        v-model="search"
        type="text"
        placeholder="Search properties by name or address..."
        class="w-full max-w-md px-4 py-2.5 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
      />
    </div>

    <!-- Loading skeleton -->
    <div v-if="store.loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="i in 6"
        :key="i"
        class="bg-white/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-blue-500/5 animate-pulse"
      >
        <div class="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div class="h-4 bg-gray-100 rounded w-full mb-2"></div>
        <div class="h-4 bg-gray-100 rounded w-1/2 mb-4"></div>
        <div class="flex gap-2">
          <div class="h-5 bg-gray-100 rounded-full w-16"></div>
          <div class="h-5 bg-gray-100 rounded-full w-14"></div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="backdrop-blur-xl bg-rose-50/70 border border-rose-200 rounded-2xl p-6 text-center">
      <p class="text-sm text-rose-600 mb-3">{{ store.error }}</p>
      <button
        @click="store.fetchProperties()"
        class="text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        Try again
      </button>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!filtered.length && !search"
      title="No properties yet"
      description="Get started by adding your first property to the system."
      action-label="Add Property"
      action-to="/properties/create"
    />

    <!-- No search results -->
    <EmptyState
      v-else-if="!filtered.length && search"
      title="No matches found"
      :description="`No properties matching '${search}'. Try a different search term.`"
    />

    <!-- Properties grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <PropertyCard v-for="property in filtered" :key="property.id" :property="property" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePropertyStore } from '../stores/propertyStore.js';
import PropertyCard from '../components/PropertyCard.vue';
import EmptyState from '../components/EmptyState.vue';

const store = usePropertyStore();
const search = ref('');

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (!q) return store.properties;
  return store.properties.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q),
  );
});

onMounted(() => {
  if (!store.properties.length) {
    store.fetchProperties();
  }
});
</script>
