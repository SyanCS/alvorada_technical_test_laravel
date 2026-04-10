import { ref } from 'vue';
import api from '../api/index.js';

/**
 * Composable wrapper around the axios API client.
 * Provides reactive loading / error / data state for any request.
 */
export function useApi() {
    const data = ref(null);
    const error = ref(null);
    const loading = ref(false);

    async function request(method, url, payload = null) {
        loading.value = true;
        error.value = null;
        data.value = null;

        try {
            const config = { method, url };
            if (payload && ['post', 'put', 'patch'].includes(method)) {
                config.data = payload;
            } else if (payload) {
                config.params = payload;
            }
            const response = await api(config);
            data.value = response.data;
            return response.data;
        } catch (err) {
            error.value =
                err.response?.data?.message ||
                err.message ||
                'An unexpected error occurred';
            throw err;
        } finally {
            loading.value = false;
        }
    }

    const get = (url, params) => request('get', url, params);
    const post = (url, body) => request('post', url, body);
    const put = (url, body) => request('put', url, body);
    const del = (url) => request('delete', url);

    return { data, error, loading, get, post, put, del, request };
}
