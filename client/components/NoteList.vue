<template>
  <div class="space-y-3">
    <div
      v-for="note in sortedNotes"
      :key="note.id"
      class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border border-white/20 rounded-2xl p-4 shadow-lg shadow-blue-500/5 border-l-4 border-l-blue-500 transition-all duration-300 ease-in-out hover:shadow-md"
    >
      <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{{ note.note }}</p>
      <p class="mt-2 text-xs text-gray-400">{{ relativeTime(note.created_at) }}</p>
    </div>
    <div v-if="!sortedNotes.length" class="text-center py-8 text-sm text-gray-400">
      No notes yet. Add your first note above!
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  notes: { type: Array, default: () => [] },
});

const sortedNotes = computed(() =>
  [...props.notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
);

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>
