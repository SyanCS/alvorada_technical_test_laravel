<template>
  <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-5 shadow-lg shadow-blue-500/5">
    <form @submit.prevent="handleSubmit" class="space-y-3">
      <div class="relative">
        <textarea
          v-model="note"
          placeholder="Write a note about this property..."
          required
          minlength="3"
          rows="3"
          class="w-full px-4 py-3 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none resize-y"
        ></textarea>
        <span class="absolute bottom-2 right-3 text-xs text-gray-300">{{ note.length }}</span>
      </div>
      <div class="flex items-center justify-between">
        <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
        <span v-else></span>
        <button
          type="submit"
          :disabled="submitting || note.trim().length < 3"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <svg
            v-if="submitting"
            class="animate-spin w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ submitting ? 'Adding...' : 'Add Note' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { usePropertyStore } from '../stores/propertyStore.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  propertyId: { type: [Number, String], required: true },
});

const emit = defineEmits(['added']);
const store = usePropertyStore();
const toast = useToast();

const note = ref('');
const submitting = ref(false);
const error = ref('');

async function handleSubmit() {
  if (note.value.trim().length < 3) {
    error.value = 'Note must be at least 3 characters.';
    return;
  }
  error.value = '';
  submitting.value = true;
  try {
    const created = await store.addNote(Number(props.propertyId), note.value.trim());
    toast.success('Note added!');
    note.value = '';
    emit('added', created);
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to add note.';
    toast.error(error.value);
  } finally {
    submitting.value = false;
  }
}
</script>
