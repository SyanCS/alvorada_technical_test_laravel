<template>
  <div class="flex flex-col items-center justify-center py-12" :class="$attrs.class">
    <div
      class="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"
    ></div>
    <p v-if="text" class="mt-4 text-sm text-gray-400 leading-relaxed">{{ text }}</p>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
});
</script>
