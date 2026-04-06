<template>
  <div class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-6 sm:p-8 shadow-lg shadow-blue-500/5">
    <h2 class="text-xl font-bold tracking-tight text-gray-800 mb-1">Add New Property</h2>
    <p class="text-sm text-gray-400 leading-relaxed mb-6">Enter the property details below. Coordinates will be geocoded automatically.</p>

    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Name -->
      <div>
        <label for="name" class="block text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
          Property Name
        </label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          placeholder="e.g., Downtown Office Building"
          required
          minlength="2"
          maxlength="255"
          class="w-full px-4 py-2.5 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
          :class="{ 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-400': errors.name }"
        />
        <p v-if="errors.name" class="mt-1 text-xs text-rose-500">{{ errors.name }}</p>
      </div>

      <!-- Address -->
      <div>
        <label for="address" class="block text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1.5">
          Address
        </label>
        <input
          id="address"
          v-model="form.address"
          type="text"
          placeholder="e.g., 123 Main St, New York, NY 10001"
          required
          minlength="5"
          maxlength="500"
          class="w-full px-4 py-2.5 rounded-xl bg-white/50 border border-gray-200 text-gray-800 text-sm placeholder-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 outline-none"
          :class="{ 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-400': errors.address }"
        />
        <p v-if="errors.address" class="mt-1 text-xs text-rose-500">{{ errors.address }}</p>
        <p class="mt-1 text-xs text-gray-400">Be as specific as possible for better geocoding results.</p>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        :disabled="submitting"
        class="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ease-in-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
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
        {{ submitting ? 'Creating...' : 'Add Property' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { usePropertyStore } from '../stores/propertyStore.js';
import { useToast } from '../composables/useToast.js';

const emit = defineEmits(['created']);

const store = usePropertyStore();
const toast = useToast();

const form = reactive({ name: '', address: '' });
const errors = reactive({ name: '', address: '' });
const submitting = ref(false);

function validate() {
  errors.name = '';
  errors.address = '';
  let valid = true;
  if (form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
    valid = false;
  }
  if (form.address.trim().length < 5) {
    errors.address = 'Address must be at least 5 characters.';
    valid = false;
  }
  return valid;
}

async function handleSubmit() {
  if (!validate()) return;
  submitting.value = true;
  try {
    const created = await store.createProperty({
      name: form.name.trim(),
      address: form.address.trim(),
    });
    toast.success('Property created successfully!');
    form.name = '';
    form.address = '';
    emit('created', created);
  } catch (err) {
    // Handle validation errors from backend
    if (err.response?.status === 422 && err.response.data?.errors) {
      const fieldErrors = err.response.data.errors;
      if (fieldErrors.name) errors.name = fieldErrors.name[0];
      if (fieldErrors.address) errors.address = fieldErrors.address[0];
    } else {
      toast.error(store.error || 'Failed to create property.');
    }
  } finally {
    submitting.value = false;
  }
}
</script>
