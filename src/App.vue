<!-- src/App.vue -->
<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/DefaultLayout.vue';
import BlankLayout from './layouts/BlankLayout.vue';

const route = useRoute();
const layout = computed(() => {
  if (route.meta.layout === 'Blank') {
    return BlankLayout;
  }
  return DefaultLayout;
});
</script>

<template>
  <component :is="layout">
    <router-view />
  </component>
</template>