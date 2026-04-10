import { ref } from 'vue';

const toasts = ref([]);
let nextId = 0;

/**
 * Simple toast notification system.
 * Import in any component — state is shared (module-level singleton).
 */
export function useToast() {
    function addToast(message, type = 'info', duration = 4000) {
        const id = nextId++;
        toasts.value.push({ id, message, type });
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }

    function removeToast(id) {
        toasts.value = toasts.value.filter((t) => t.id !== id);
    }

    const success = (msg, dur) => addToast(msg, 'success', dur);
    const error = (msg, dur) => addToast(msg, 'error', dur);
    const warning = (msg, dur) => addToast(msg, 'warning', dur);
    const info = (msg, dur) => addToast(msg, 'info', dur);

    return { toasts, addToast, removeToast, success, error, warning, info };
}
