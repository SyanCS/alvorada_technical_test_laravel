import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../api/index.js';

export const useScoringStore = defineStore('scoring', () => {
    const results = ref([]);
    const requirements = ref('');
    const totalProperties = ref(0);
    const loading = ref(false);
    const error = ref(null);

    async function scoreProperties(requirementsText, limit = 10) {
        loading.value = true;
        error.value = null;
        results.value = [];
        requirements.value = requirementsText;

        try {
            const { data } = await api.post('/ai/score', {
                requirements: requirementsText,
                limit,
            });

            const payload = data.data ?? data;
            results.value = payload.scored_properties ?? [];
            totalProperties.value = payload.total_properties ?? results.value.length;
            return payload;
        } catch (err) {
            error.value = err.response?.data?.message || err.message;
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function clearResults() {
        results.value = [];
        requirements.value = '';
        totalProperties.value = 0;
        error.value = null;
    }

    return { results, requirements, totalProperties, loading, error, scoreProperties, clearResults };
});
