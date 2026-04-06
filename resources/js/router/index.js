import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'properties.index',
        component: () => import('../pages/PropertiesIndex.vue'),
    },
    {
        path: '/properties/create',
        name: 'properties.create',
        component: () => import('../pages/PropertyCreate.vue'),
    },
    {
        path: '/properties/:id',
        name: 'properties.show',
        component: () => import('../pages/PropertyShow.vue'),
        props: true,
    },
    {
        path: '/map',
        name: 'map',
        component: () => import('../pages/MapView.vue'),
    },
    {
        path: '/scoring',
        name: 'scoring',
        component: () => import('../pages/ScoringView.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
