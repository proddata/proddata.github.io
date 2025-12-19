<script setup>
import { computed, ref } from "vue";
import { theme } from "ant-design-vue";
import { ApiOutlined, DatabaseOutlined, KeyOutlined, TagsOutlined } from "@ant-design/icons-vue";

const query = ref("");
const groupBy = ref("namespace");
const expression = ref("{{ inputs.customer_id }}");
const renderedExpression = ref("");

const initialInventory = [
  {
    category: "Variables",
    items: [
      {
        key: "warehouse_destination",
        value: "SNOWFLAKE_PROD",
        namespace: "prod.analytics"
      },
      {
        key: "default_timezone",
        value: "Europe/Vienna",
        namespace: "prod.analytics.ingest"
      }
    ]
  },
  {
    category: "Secrets",
    items: [
      {
        key: "snowflake_password",
        value: "super-secret-password",
        namespace: "prod"
      },
      {
        key: "slack.webhook_url",
        value: "https://hooks.slack.com/services/T000/B000/XXXX",
        namespace: "prod.analytics"
      }
    ]
  },
  {
    category: "KV Pairs",
    items: [
      {
        key: "dataset_owner",
        value: "peter",
        namespace: "prod.analytics"
      },
      {
        key: "feature.new-ui",
        value: "true",
        namespace: "prod"
      }
    ]
  }
];

const inventoryJson = ref(JSON.stringify(initialInventory, null, 2));
const inventoryError = ref("");
const inventoryModel = ref(JSON.parse(JSON.stringify(initialInventory)));

const typeOptions = computed(() => inventoryModel.value.map((g) => g.category));

function iconForType(type) {
  if (type === "Secrets") return KeyOutlined;
  if (type === "Variables") return ApiOutlined;
  if (type === "KV Pairs") return DatabaseOutlined;
  return TagsOutlined;
}

function valueClassForType(type) {
  if (type === "Secrets") return "value value--secret";
  if (type === "Variables") return "value value--variable";
  if (type === "KV Pairs") return "value value--kv";
  return "value";
}

function maskedSecret(value) {
  const s = String(value ?? "");
  if (!s) return "••••••";
  if (s.length <= 6) return "••••••";
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

function matches(item) {
  const q = query.value.trim().toLowerCase();
  if (!q) return true;
  return (
    String(item.key).toLowerCase().includes(q) ||
    String(item.namespace).toLowerCase().includes(q) ||
    String(item.value ?? "").toLowerCase().includes(q)
  );
}

function renderExpression() {
  renderedExpression.value = expression.value.trim()
    ? `This expression is rendered: ${expression.value}`
    : "This expression is rendered.";
}

function applyInventory() {
  try {
    const parsed = JSON.parse(inventoryJson.value);
    if (!Array.isArray(parsed)) throw new Error("Root must be an array.");

    for (const group of parsed) {
      if (!group || typeof group !== "object") throw new Error("Each group must be an object.");
      if (typeof group.category !== "string") throw new Error("Each group needs a string category.");
      if (!Array.isArray(group.items)) throw new Error("Each group needs an items array.");
      for (const item of group.items) {
        if (!item || typeof item !== "object") throw new Error("Each item must be an object.");
        if (typeof item.key !== "string") throw new Error("Each item needs a string key.");
        if (typeof item.namespace !== "string") throw new Error("Each item needs a string namespace.");
      }
    }

    inventoryModel.value = parsed;
    inventoryError.value = "";
  } catch (err) {
    inventoryError.value = err instanceof Error ? err.message : String(err);
  }
}

function buildNamespaceTree(items, keyPrefix = "") {
  const root = { children: new Map(), items: [] };

  for (const item of items) {
    const parts = String(item.namespace).split(".").filter(Boolean);
    let node = root;
    for (const seg of parts) {
      if (!node.children.has(seg)) node.children.set(seg, { children: new Map(), items: [] });
      node = node.children.get(seg);
    }
    node.items.push(item);
  }

  function build(node, path = "") {
    const segments = Array.from(node.children.keys()).sort((a, b) => a.localeCompare(b));
    return segments.map((seg) => {
      const child = node.children.get(seg);
      const currentPath = path ? `${path}.${seg}` : seg;

      const itemNodes = child.items
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((it) => ({
          key: `${keyPrefix}item:${it.type}:${it.namespace}:${it.key}`,
          title: it.key,
          isLeaf: true,
          nodeType: "item",
          type: it.type,
          name: it.key,
          value: it.type === "Secrets" ? maskedSecret(it.value) : it.value
        }));

      return {
        key: `${keyPrefix}ns:${currentPath}`,
        title: seg,
        nodeType: "namespace",
        label: seg,
        selectable: false,
        children: [...build(child, currentPath), ...itemNodes]
      };
    });
  }

  return build(root);
}

function buildTypeThenNamespaceTree(items) {
  const byType = new Map();
  for (const item of items) {
    if (!byType.has(item.type)) byType.set(item.type, []);
    byType.get(item.type).push(item);
  }

  const orderedTypes = typeOptions.value.filter((t) => byType.has(t));
  return orderedTypes.map((type) => ({
    key: `type:${type}`,
    nodeType: "type",
    label: type,
    selectable: false,
    children: buildNamespaceTree(byType.get(type), `type:${type}|`)
  }));
}

const treeData = computed(() => {
  const enriched = inventoryModel.value.flatMap((g) =>
    g.items.map((it) => ({ ...it, type: g.category }))
  );
  const filtered = enriched.filter((it) => matches(it));
  return groupBy.value === "type"
    ? buildTypeThenNamespaceTree(filtered)
    : buildNamespaceTree(filtered);
});
</script>

<template>
  <a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
    <div class="page-shell">
      <section class="hero">
        <h1>Namespace Context</h1>
        <p>Variables, secrets and KV pairs accessible for the current flow.</p>
      </section>

      <div class="panels">
        <section class="panel editor">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="5" style="margin: 0; color: rgba(255, 255, 255, 0.9)">
              Demo Input
            </a-typography-title>

            <div class="filters-row">
              <a-space :size="10" style="flex-wrap: wrap">
                <a-typography-text style="color: rgba(255, 255, 255, 0.82)">
                  Display Mode
                </a-typography-text>
                <a-select
                  v-model:value="groupBy"
                  style="min-width: 260px"
                  :options="[
                    { label: 'Namespace → Elements', value: 'namespace' },
                    { label: 'Type → Namespace → Elements', value: 'type' }
                  ]"
                />
              </a-space>
            </div>

            <div class="panel-header">
              <a-typography-text style="color: rgba(255, 255, 255, 0.82)">
                Inventory (JSON)
              </a-typography-text>
              <a-button @click="applyInventory">Apply</a-button>
            </div>

            <a-textarea
              v-model:value="inventoryJson"
              class="code"
              :auto-size="{ minRows: 18, maxRows: 26 }"
              spellcheck="false"
            />

            <a-alert v-if="inventoryError" type="error" show-icon :message="inventoryError" />
          </a-space>
        </section>

        <section class="panel content">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="5" style="margin: 0; color: rgba(255, 255, 255, 0.9)">
              Context
            </a-typography-title>

            <a-space direction="vertical" size="small" style="width: 100%">
              <a-input
                v-model:value="expression"
                placeholder="{{ ... }}"
                allow-clear
                size="large"
                style="width: 100%"
              />
              <a-button type="primary" block class="render-btn" @click="renderExpression">
                Render expression
              </a-button>
              <a-typography-text v-if="renderedExpression" class="rendered">
                {{ renderedExpression }}
              </a-typography-text>
              <a-divider class="divider" />
            </a-space>

            <a-input v-model:value="query" placeholder="Filter" allow-clear size="large" />

            <div class="tree-container">
              <a-tree
                :key="groupBy"
                block-node
                default-expand-all
                :show-line="{ showLeafIcon: false }"
                :selectable="false"
                :tree-data="treeData"
              >
                <template #title="{ dataRef }">
                  <div v-if="dataRef.nodeType === 'namespace'" class="node-row">
                    <span class="node-name">
                      <strong>{{ dataRef.label }}</strong>
                    </span>
                  </div>

                  <div v-else-if="dataRef.nodeType === 'type'" class="node-row">
                    <span class="node-name">
                      <strong>{{ dataRef.label }}</strong>
                    </span>
                  </div>

                  <div v-else class="node-row">
                    <span class="node-name">
                      <component :is="iconForType(dataRef.type)" class="type-icon" />
                      <span>{{ dataRef.name }}</span>
                      <span :class="valueClassForType(dataRef.type)">
                        {{ dataRef.value }}
                      </span>
                    </span>
                  </div>
                </template>
              </a-tree>
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
  padding: 48px 24px 64px;
}

.hero {
  max-width: 1040px;
  margin: 0 auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.92);
}

.hero h1 {
  font-size: 42px;
  margin: 12px 0 8px;
}

.hero p {
  font-size: 16px;
  opacity: 0.85;
  margin: 0;
}

.panels {
  max-width: 1040px;
  margin: 28px auto 0;
  display: flex;
  gap: 32px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
}

.panel {
  width: 500px;
  background: #2f3342;
  padding: 24px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0px 25px 60px rgba(15, 21, 46, 0.3);
}

.panel.editor {
  background: #4e5058ff;
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

.tree-container {
  margin-top: 2px;
  padding: 2px 4px;
  border-radius: 6px;
  --tree-bg: #2f3342;
  background: var(--tree-bg);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tree-container :deep(.ant-tree) {
  background: var(--tree-bg);
}

.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.divider {
  margin: 6px 0 2px;
  border-color: rgba(255, 255, 255, 0.12);
}

.rendered {
  color: rgba(255, 255, 255, 0.72);
}

.node-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-icon {
  flex: 0 0 auto;
  font-size: 14px;
  color: rgba(143, 170, 255, 1);
}

.value {
  color: rgba(255, 255, 255, 0.58);
  margin-left: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.render-btn {
  background: #8405ff;
  border-color: #8405ff;
}

.render-btn:hover,
.render-btn:focus {
  background: #6e00d6;
  border-color: #6e00d6;
}

@media (max-width: 1040px) {
  .panel {
    width: 100%;
    max-width: 500px;
  }
}

.value--variable {
  color: rgba(255, 255, 255, 0.58);
}

.value--kv {
  color: rgba(255, 255, 255, 0.58);
}

.value--secret {
  color: rgba(255, 255, 255, 0.58);
}
</style>
