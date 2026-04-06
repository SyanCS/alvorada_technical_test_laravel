<template>
  <Teleport to="body">
    <div class="fixed top-20 right-4 z-[9999] flex flex-col gap-3 w-80">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-8"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3 cursor-pointer"
          :class="bgClass(toast.type)"
          @click="removeToast(toast.id)"
        >
          <span class="mt-0.5 shrink-0" v-html="iconFor(toast.type)"></span>
          <p class="text-sm font-medium leading-relaxed" :class="textClass(toast.type)">{{ toast.message }}</p>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast.js';

const { toasts, removeToast } = useToast();

function bgClass(type) {
  const map = {
    success: 'bg-emerald-50/90',
    error: 'bg-rose-50/90',
    warning: 'bg-amber-50/90',
    info: 'bg-blue-50/90',
  };
  return map[type] || map.info;
}

function textClass(type) {
  const map = {
    success: 'text-emerald-700',
    error: 'text-rose-700',
    warning: 'text-amber-700',
    info: 'text-blue-700',
  };
  return map[type] || map.info;
}

function iconFor(type) {
  const icons = {
    success:
      '<svg class="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    error:
      '<svg class="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning:
      '<svg class="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info:
      '<svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  };
  return icons[type] || icons.info;
}
</script>
