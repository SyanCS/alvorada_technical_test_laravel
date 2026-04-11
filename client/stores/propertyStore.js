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
        // Drizzle returns camelCase relation/field names; Vue components expect snake_case
        const raw = p.propertyFeature ?? p.property_feature ?? null;
        if (raw && !p.features) {
            p.features = normalizeFeatures(raw);
        }
        // Normalize top-level property keys for components that expect snake_case
        if (p.extraField !== undefined && p.extra_field === undefined) p.extra_field = p.extraField;
        if (p.createdAt !== undefined && p.created_at === undefined) p.created_at = p.createdAt;
        if (p.updatedAt !== undefined && p.updated_at === undefined) p.updated_at = p.updatedAt;
        return p;
    }

    function normalizeFeatures(f) {
        if (!f) return null;
        return {
            ...f,
            near_subway: f.nearSubway ?? f.near_subway ?? null,
            needs_renovation: f.needsRenovation ?? f.needs_renovation ?? null,
            parking_available: f.parkingAvailable ?? f.parking_available ?? null,
            has_elevator: f.hasElevator ?? f.has_elevator ?? null,
            estimated_capacity_people: f.estimatedCapacityPeople ?? f.estimated_capacity_people ?? null,
            floor_level: f.floorLevel ?? f.floor_level ?? null,
            condition_rating: f.conditionRating ?? f.condition_rating ?? null,
            recommended_use: f.recommendedUse ?? f.recommended_use ?? null,
            amenities: f.amenities ?? null,
            confidence_score: f.confidenceScore ?? f.confidence_score ?? null,
        };
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
        const payload = data.data ?? data;
        const features = normalizeFeatures(payload.features ?? payload);
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            currentProperty.value.features = features;
        }
        return features;
    }

    async function fetchFeatures(propertyId) {
        const { data } = await api.get(`/properties/${propertyId}/features`);
        const payload = data.data ?? data;
        const features = normalizeFeatures(payload.features ?? payload);
        if (currentProperty.value && currentProperty.value.id === propertyId) {
            currentProperty.value.features = features;
        }
        return features;
    }

    const similarProperties = ref([]);
    const loadingSimilar = ref(false);
    const similarPipelineNodes = ref([]);
    const similarCompletedNodes = ref([]);
    const similarCurrentNode = ref(null);

    async function findSimilar(propertyId, limit = 5) {
        loadingSimilar.value = true;
        similarProperties.value = [];
        similarPipelineNodes.value = [];
        similarCompletedNodes.value = [];
        similarCurrentNode.value = null;
        let result = null;

        try {
            const response = await fetch('/api/ai/similar/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ property_id: propertyId, limit }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let eventType = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && eventType) {
                        const data = JSON.parse(line.slice(6));

                        if (eventType === 'nodes') {
                            similarPipelineNodes.value = data;
                            if (data.length > 0) similarCurrentNode.value = data[0].id;
                        } else if (eventType === 'node_complete') {
                            similarCompletedNodes.value.push(data.node);
                            const next = similarPipelineNodes.value.find(
                                (n) => !similarCompletedNodes.value.includes(n.id),
                            );
                            similarCurrentNode.value = next?.id || null;
                        } else if (eventType === 'result') {
                            similarProperties.value = data.similar_properties ?? [];
                            result = data;
                        } else if (eventType === 'error') {
                            error.value = data.message || 'Unknown error';
                        }

                        eventType = null;
                    }
                }
            }

            return result;
        } catch (err) {
            error.value = err.response?.data?.message || err.message;
            throw err;
        } finally {
            loadingSimilar.value = false;
            similarCurrentNode.value = null;
        }
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
        similarProperties,
        loadingSimilar,
        similarPipelineNodes,
        similarCompletedNodes,
        similarCurrentNode,
        findSimilar,
    };
});
