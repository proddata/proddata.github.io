<script setup>
import { computed } from "vue";

const demos = [
  {
    key: "kestra-namespace-context",
    title: "Kestra Flow Editor — Namespace Context tab (mockup)",
    description:
      "Shows variables, KV pairs, and secrets accessible to a flow for a given namespace.",
    tags: ["kestra", "editor", "mockup"],
    to: { name: "kestra-namespace-context" }
  }
];

const sortedDemos = computed(() =>
  [...demos].sort((a, b) => a.title.localeCompare(b.title))
);
</script>

<template>
  <div class="page">
    <a-row :gutter="[16, 16]">
      <a-col :span="24">
        <a-card class="hero" :bordered="false">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="2" style="margin: 0">
              Demo hub
            </a-typography-title>
            <a-typography-paragraph style="margin: 0">
              This repo hosts small PoCs and demo UIs. Each entry below is a
              self-contained page.
            </a-typography-paragraph>
          </a-space>
        </a-card>
      </a-col>

      <a-col :span="24">
        <a-card title="Demos" class="card">
          <a-list :data-source="sortedDemos" :split="false">
            <template #renderItem="{ item }">
              <a-list-item class="demo-item">
                <a-list-item-meta :title="item.title" :description="item.description" />
                <template #actions>
                  <router-link :to="item.to" custom v-slot="{ navigate }">
                    <a-button type="primary" @click="navigate">Open</a-button>
                  </router-link>
                </template>
                <template #extra>
                  <a-space size="small" wrap>
                    <a-tag v-for="tag in item.tags" :key="tag">{{ tag }}</a-tag>
                  </a-space>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.page {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 26px 18px 46px;
}

.hero {
  background: rgba(11, 11, 16, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.demo-item :deep(.ant-list-item-action) {
  margin-left: 16px;
}
</style>
