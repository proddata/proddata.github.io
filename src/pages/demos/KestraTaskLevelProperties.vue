<script setup>
import { computed, ref } from "vue";
import { theme } from "ant-design-vue";
import { InfoCircleOutlined } from "@ant-design/icons-vue";

const initialProperties = [
  {
    id: "id",
    type: "string",
    required: true,
    description: "Unique task identifier used in the flow.",
    group: "Required properties",
    value: "hello"
  },
  {
    id: "type",
    type: "string",
    required: true,
    description: "Plugin task class for execution.",
    group: "Required properties",
    value: "io.kestra.plugin.core.log.Log"
  },
  {
    id: "message",
    type: "string",
    required: true,
    description: "Message to send to the logs.",
    group: "Required properties",
    value: "Hello from Kestra"
  },
  {
    id: "level",
    type: "enum",
    required: false,
    description: "Log level to apply for the message.",
    group: "Optional properties",
    options: ["INFO", "WARN", "ERROR", "DEBUG"],
    value: "INFO"
  },
  {
    id: "logToFile",
    type: "boolean",
    required: false,
    description: "Toggle file logging for this task.",
    group: "Optional properties",
    value: false
  },
  {
    id: "description",
    type: "string",
    required: false,
    description: "Human readable task description.",
    group: "Optional properties",
    value: ""
  },
  {
    id: "retry",
    type: "complex",
    required: false,
    description: "Retry strategy for this task.",
    group: "Optional properties",
    value: "{\\n  \\\"type\\\": \\\"constant\\\",\\n  \\\"interval\\\": \\\"PT30S\\\"\\n}"
  },
  {
    id: "timeout",
    type: "string",
    required: false,
    description: "Maximum runtime for this task.",
    group: "Optional properties",
    value: "PT10M"
  },
  {
    id: "allowFailure",
    type: "boolean",
    required: false,
    description: "Whether this task can fail without failing the flow.",
    group: "Optional properties",
    value: false
  },
  {
    id: "disabled",
    type: "boolean",
    required: false,
    description: "Skip execution for this task.",
    group: "Optional properties",
    value: false
  },
  {
    id: "store",
    type: "boolean",
    required: false,
    description: "Deprecated: do not use in new flows.",
    group: "Deprecated properties",
    value: false
  }
];

const propertiesJson = ref(JSON.stringify(initialProperties, null, 2));
const propertiesError = ref("");
const propertiesModel = ref(initialProperties.map((item) => ({ ...item })));

const query = ref("");

function applyProperties() {
  try {
    const parsed = JSON.parse(propertiesJson.value);
    if (!Array.isArray(parsed)) throw new Error("Root must be an array.");

    for (const item of parsed) {
      if (!item || typeof item !== "object") throw new Error("Each item must be an object.");
      if (typeof item.id !== "string" || !item.id.trim()) {
        throw new Error("Each item needs a non-empty string id.");
      }
      if (typeof item.type !== "string" || !item.type.trim()) {
        throw new Error("Each item needs a non-empty string type.");
      }
      if (typeof item.required !== "boolean") {
        throw new Error("Each item needs a boolean required flag.");
      }
      if (item.group != null && typeof item.group !== "string") {
        throw new Error("Group must be a string when provided.");
      }
      if (item.description != null && typeof item.description !== "string") {
        throw new Error("Description must be a string when provided.");
      }
      if (item.options != null && !Array.isArray(item.options)) {
        throw new Error("Options must be an array when provided.");
      }
    }

    propertiesModel.value = parsed;
    propertiesError.value = "";
  } catch (err) {
    propertiesError.value = err instanceof Error ? err.message : String(err);
  }
}

function matchesQuery(item) {
  const q = query.value.trim().toLowerCase();
  if (!q) return true;
  const group = item.group ?? "";
  return (
    item.id.toLowerCase().includes(q) ||
    item.type.toLowerCase().includes(q) ||
    group.toLowerCase().includes(q)
  );
}

const filteredProperties = computed(() =>
  propertiesModel.value.filter((item) => {
    return matchesQuery(item);
  })
);

const groupedProperties = computed(() => {
  const groups = new Map();
  const order = [];

  for (const item of filteredProperties.value) {
    const name = item.group?.trim() || "Ungrouped";
    if (!groups.has(name)) {
      groups.set(name, []);
      order.push(name);
    }
    groups.get(name).push({
      ...item,
      options: Array.isArray(item.options)
        ? item.options.map((option) => String(option))
        : undefined
    });
  }

  return order.map((name) => {
    const items = groups.get(name);
    return {
      name,
      items
    };
  });
});

const closedGroups = ref(new Set());

function isGroupOpen(name) {
  return !closedGroups.value.has(name);
}

function toggleGroup(name) {
  const next = new Set(closedGroups.value);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  closedGroups.value = next;
}

</script>

<template>
  <a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
    <div class="page-shell">
      <section class="hero">
        <h1>Task Level Properties</h1>
        <p>POC for rendering task property inputs by type, required flag, and group.</p>
      </section>

      <div class="panels">
        <section class="panel editor">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="5" style="margin: 0; color: rgba(255, 255, 255, 0.9)">
              Demo Input
            </a-typography-title>

            <div class="panel-header">
              <a-typography-text style="color: rgba(255, 255, 255, 0.82)">
                Properties (JSON)
              </a-typography-text>
              <a-button @click="applyProperties">Apply</a-button>
            </div>

            <a-textarea
              v-model:value="propertiesJson"
              class="code"
              :auto-size="{ minRows: 18, maxRows: 22 }"
              spellcheck="false"
            />

            <a-alert v-if="propertiesError" type="error" show-icon :message="propertiesError" />
          </a-space>
        </section>

        <section class="panel content">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="5" style="margin: 0; color: rgba(255, 255, 255, 0.9)">
              Task properties
            </a-typography-title>

            <div class="filter-row">
              <a-input
                v-model:value="query"
                placeholder="Filter by id, type, or group"
                allow-clear
                size="large"
              />
            </div>

            <div class="group-list">
              <div v-if="!groupedProperties.length" class="empty">No properties match.</div>
              <div v-for="group in groupedProperties" :key="group.name" class="group-card">
                <div class="group-header">
                  <button
                    type="button"
                    class="group-toggle"
                    :aria-expanded="isGroupOpen(group.name)"
                    @click="toggleGroup(group.name)"
                  >
                    <span class="group-title">{{ group.name }}</span>
                    <span class="group-chevron" :class="{ 'group-chevron--open': isGroupOpen(group.name) }">
                      ▾
                    </span>
                  </button>
                </div>

                <div v-if="isGroupOpen(group.name)" class="property-list">
                  <div v-for="item in group.items" :key="item.id" class="property-row">
                    <div class="property-main">
                    <div class="property-label">
                      <span class="property-id">
                        <span v-if="item.required" class="required">*</span>
                        {{ item.id }}
                      </span>
                      <span class="property-meta">
                        <span class="property-meta-text">{{ item.type }}</span>
                      </span>
                      <a-tooltip v-if="item.description" :title="item.description">
                        <button type="button" class="info-button" aria-label="Property description">
                          <InfoCircleOutlined />
                        </button>
                      </a-tooltip>
                    </div>
                    <div v-if="item.type !== 'boolean'" class="property-input property-input--stacked">
                      <a-input
                        v-if="item.type === 'string'"
                        v-model:value="item.value"
                        :placeholder="`Enter ${item.id}`"
                        allow-clear
                      />
                      <a-select
                        v-else-if="item.type === 'enum' && item.options?.length"
                        v-model:value="item.value"
                        :options="item.options.map((option) => ({ label: option, value: option }))"
                        placeholder="Select value"
                        allow-clear
                      />
                      <a-input
                        v-else-if="item.type === 'enum'"
                        v-model:value="item.value"
                        placeholder="Select value"
                        allow-clear
                      />
                      <a-textarea
                        v-else
                        v-model:value="item.value"
                        :auto-size="{ minRows: 2, maxRows: 4 }"
                        placeholder="Enter value"
                      />
                    </div>
                  </div>
                  <div v-if="item.type === 'boolean'" class="property-input">
                    <a-switch v-model:checked="item.value" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </a-space>
        </section>
      </div>
    </div>
  </a-config-provider>
</template>

<style scoped>
.page-shell {
  min-height: 100vh;
  padding: 24px 24px 64px;
}

.hero {
  max-width: 1060px;
  margin: 0 auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
}

.hero h1 {
  font-size: 40px;
  margin: 12px 0 8px;
}

.hero p {
  font-size: 16px;
  opacity: 0.85;
  margin: 0;
}

.panels {
  max-width: 1060px;
  margin: 28px auto 0;
  display: flex;
  gap: 32px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: nowrap;
}

.panel {
  width: 480px;
  background: #2f3342;
  padding: 24px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0px 25px 60px rgba(15, 21, 46, 0.3);
}

.panel.editor {
  background: #3c3f4d;
}

.panel.content {
  box-shadow: 0px 25px 60px rgba(255, 255, 255, 0.12);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-card {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  padding: 14px;
}

.group-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.group-toggle {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 0;
  cursor: pointer;
}

.group-title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
}

.group-chevron {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  transition: transform 0.15s ease, color 0.15s ease;
}

.group-chevron--open {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, 0.85);
}

.property-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.property-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.property-row:last-child {
  border-bottom: none;
}

.property-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-label {
  display: flex;
  align-items: center;
  gap: 10px;
}

.property-id {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.required {
  color: #ff6b6b;
  margin-right: 4px;
}

.property-meta {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.55);
}

.property-meta-text {
  color: inherit;
}

.info-button {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}

.info-button:hover {
  color: rgba(255, 255, 255, 0.85);
}

.property-input {
  flex: 0 0 200px;
  display: flex;
  justify-content: flex-end;
}

.property-input--stacked {
  flex: 1 1 auto;
  width: 100%;
  margin-top: 6px;
}

.property-input :deep(.ant-input),
.property-input :deep(.ant-select),
.property-input :deep(.ant-input-affix-wrapper),
.property-input :deep(.ant-select-selector),
.property-input :deep(.ant-textarea) {
  width: 100%;
}

.empty {
  text-align: center;
  padding: 18px 0 8px;
  color: rgba(255, 255, 255, 0.6);
}

@media (max-width: 1040px) {
  .panel {
    width: 100%;
    max-width: 520px;
  }

  .panels {
    flex-wrap: wrap;
  }

  .group-header {
    margin-bottom: 6px;
  }

  .property-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .property-input {
    width: 100%;
  }
}
</style>
