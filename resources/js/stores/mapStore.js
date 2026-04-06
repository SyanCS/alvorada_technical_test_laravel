import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMapStore = defineStore('map', () => {
    const center = ref([39.8283, -98.5795]); // center of USA
    const zoom = ref(4);
    const selectedPropertyId = ref(null);

    function setCenter(lat, lng) {
        center.value = [lat, lng];
    }

    function setZoom(level) {
        zoom.value = level;
    }

    function selectProperty(id) {
        selectedPropertyId.value = id;
    }

    return { center, zoom, selectedPropertyId, setCenter, setZoom, selectProperty };
});
