import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Attach CSRF token from meta tag
api.interceptors.request.use((config) => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (token) {
        config.headers['X-CSRF-TOKEN'] = token;
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message =
            error.response?.data?.message ||
            error.response?.statusText ||
            'An unexpected error occurred';

        const status = error.response?.status;

        if (status === 422) {
            // Validation errors — pass through so callers can handle field errors
            return Promise.reject(error);
        }

        if (status === 404) {
            console.warn('[API] Resource not found:', error.config?.url);
        } else if (status === 500) {
            console.error('[API] Server error:', message);
        }

        return Promise.reject(error);
    },
);

export default api;
