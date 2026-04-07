import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../api/index.js';

export const usePropertyStore = defineStore('property', () => {
    // --- state ---
    const properties = ref([]);
    const currentProperty = ref(null);
    const loading = ref(false);
    const loadingOne = ref(false);
    const error = ref(null);

    // --- getters ---
    const propertyCount = computed(() => properties.value.length);

    // --- actions ---
    async function fetchProperties() {
        loading.value = true;
        error.value = null;
        try {
            const { data } = await api.get('/properties');
            properties.value = (data.data ?? data).map(normalizeProperty);
        } catch (err) {
            error.value = err.response?.data?.message || err.message;
        } finally {
            loading.value = false;
        }
    }

    function normalizeProperty(p) {
        if (p && p.property_feature && !p.features) {
            p.features = p.property_feature;
        }
        return p;
    }

    async function fetchProperty(id) {
        loadingOne.value = true;
        error.value = null;
        try {
            const { data } = await api.get(`/properties/${id}`);
            currentProperty.value = normalizeProperty(data.data ?? data);
            return currentProperty.value;
        } catch (err) {
            error.value = err.response?.data?.message || err.message;
            throw err;
        } finally {
            loadingOne.value = false;
        }
    }

    async function createProperty(payload) {
        loading.value = true;
        error.value = null;
        try {
            const { data } = await api.post('/properties', payload);
            const created = normalizeProperty(data.data ?? data);
            properties.value.unshift(created);
            return created;
        } catch (err) {
            error.value = err.response?.data?.message || err.message;
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function addNote(propertyId, note) {
        const { data } = await api.post('/notes', { property_id: propertyId, note });
        const newNote = data.data ?? data;
        // Append to currentProperty's notes if loaded
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            if (!currentProperty.value.notes) currentProperty.value.notes = [];
            currentProperty.value.notes.push(newNote);
        }
        return newNote;
    }

    async function fetchNotes(propertyId) {
        const { data } = await api.get('/notes', { params: { property_id: propertyId } });
        const notes = data.data ?? data;
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            currentProperty.value.notes = notes;
        }
        return notes;
    }

    async function extractFeatures(propertyId, forceRefresh = false) {
        const { data } = await api.post('/ai/extract-features', {
            property_id: propertyId,
            force_refresh: forceRefresh,
        });
        const features = data.data ?? data;
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            currentProperty.value.features = features;
        }
        return features;
    }

    async function fetchFeatures(propertyId) {
        const { data } = await api.get(`/properties/${propertyId}/features`);
        const features = data.data ?? data;
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            currentProperty.value.features = features;
        }
        return features;
    }

    return {
        properties,
        currentProperty,
        loading,
        loadingOne,
        error,
        propertyCount,
        fetchProperties,
        fetchProperty,
        createProperty,
        addNote,
        fetchNotes,
        extractFeatures,
        fetchFeatures,
    };
});
