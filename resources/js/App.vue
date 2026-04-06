<template>
  <div id="alvorada-app" class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
    <AppNavbar />
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <router-view v-slot="{ Component }">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
          mode="out-in"
        >
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>
    <ToastContainer />
  </div>
</template>

<script setup>
import AppNavbar from './components/AppNavbar.vue';
import ToastContainer from './components/ToastContainer.vue';
</script>
