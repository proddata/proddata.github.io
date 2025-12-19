<script setup>
import { theme } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

function goHome() {
  router.push({ name: "home" });
}
</script>

<template>
  <a-config-provider
    :theme="{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#4f7cff',
        borderRadius: 6
      }
    }"
  >
    <a-layout class="app">
      <a-layout-header class="header">
        <a-space class="brand" :size="10" @click="goHome">
          <div class="logo" />
          <div class="titles">
            <div class="title">proddata</div>
            <div class="subtitle">PoCs & demos</div>
          </div>
        </a-space>

        <a-space>
          <a-button v-if="route.name !== 'home'" @click="goHome">Home</a-button>
          <a-button type="primary" href="https://github.com/proddata/proddata.github.io" target="_blank">
            GitHub
          </a-button>
        </a-space>
      </a-layout-header>

      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<style scoped>
.app {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(11, 11, 16, 0.55);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.brand {
  cursor: pointer;
  user-select: none;
}

.logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(79, 124, 255, 1), rgba(107, 226, 255, 1));
  box-shadow: 0 8px 22px rgba(79, 124, 255, 0.22);
}

.titles {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.title {
  font-weight: 700;
  letter-spacing: -0.01em;
}

.subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.content {
  width: 100%;
  padding: 0;
}
</style>
