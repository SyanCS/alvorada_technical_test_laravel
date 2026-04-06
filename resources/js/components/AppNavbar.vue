<template>
  <nav class="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-white/20 shadow-lg shadow-blue-500/5">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo + App Name -->
        <router-link to="/" class="flex items-center gap-2 group">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform duration-300 group-hover:scale-110">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span class="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Alvorada
          </span>
        </router-link>

        <!-- Desktop Nav Links -->
        <div class="hidden sm:flex items-center gap-1">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ease-in-out"
            :class="[
              $route.path === link.to || (link.activeMatch && $route.path.startsWith(link.activeMatch))
                ? 'bg-blue-600/10 text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50',
            ]"
          >
            <span class="flex items-center gap-2">
              <component :is="link.icon" class="w-4 h-4" />
              {{ link.label }}
            </span>
          </router-link>
        </div>

        <!-- Mobile Menu Toggle -->
        <button
          class="sm:hidden p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200"
          @click="mobileOpen = !mobileOpen"
          aria-label="Toggle navigation"
        >
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path v-if="!mobileOpen" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mobile Nav -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="mobileOpen" class="sm:hidden pb-4 space-y-1">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="block px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            :class="[
              $route.path === link.to || (link.activeMatch && $route.path.startsWith(link.activeMatch))
                ? 'bg-blue-600/10 text-blue-600'
                : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600',
            ]"
            @click="mobileOpen = false"
          >
            <span class="flex items-center gap-2">
              <component :is="link.icon" class="w-4 h-4" />
              {{ link.label }}
            </span>
          </router-link>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<script setup>
import { ref, h } from 'vue';

const mobileOpen = ref(false);

/* Inline SVG icon components */
const IconBuilding = (_, { attrs }) =>
  h('svg', { ...attrs, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' }),
  ]);

const IconMap = (_, { attrs }) =>
  h('svg', { ...attrs, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' }),
  ]);

const IconTarget = (_, { attrs }) =>
  h('svg', { ...attrs, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
    h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }),
  ]);

const navLinks = [
  { to: '/', label: 'Properties', icon: IconBuilding, activeMatch: '/properties' },
  { to: '/map', label: 'Map', icon: IconMap },
  { to: '/scoring', label: 'Scoring', icon: IconTarget },
];
</script>
