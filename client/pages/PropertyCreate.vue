<template>
  <div class="max-w-lg mx-auto">
    <router-link
      to="/"
      class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600 transition-colors duration-200 mb-4"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Properties
    </router-link>
    <PropertyForm @created="onCreated" />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import PropertyForm from '../components/PropertyForm.vue';

const router = useRouter();

function onCreated(property) {
  router.push(`/properties/${property.id}`);
}
</script>
