<template>
  <div id="alvorada-app" class="min-h-screen bg-gray-50">
    <AppNavbar />
    <main class="container mx-auto px-4 py-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import AppNavbar from './components/AppNavbar.vue';
</script>
