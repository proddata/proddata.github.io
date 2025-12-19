<script setup>
import { computed, ref } from "vue";
import { message, theme } from "ant-design-vue";
import {
  ApiOutlined,
  CopyOutlined,
  DatabaseOutlined,
  KeyOutlined,
  PlayCircleOutlined,
  TagsOutlined
} from "@ant-design/icons-vue";
import { parse as parseYaml } from "yaml";

const query = ref("");
const groupBy = ref("namespace");
const expression = ref("{{ inputs.customer_id }}");
const renderedExpression = ref("");

const initialInventory = [
  {
    category: "Variables",
    items: [
      {
        key: "postgres",
        value: {
          hostname: "my-postgres-prod-hostname",
          port: 5432,
          username: "my-postgres-prod-username"
        },
        namespace: "prod"
      },
      {
        key: "dataLake",
        value: {
          s3BucketName: "my-datalake-s3-bucket-name",
          region: "us-east-1"
        },
        namespace: "prod.analytics"
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

const flowYaml = ref(`id: guanaco_434139
namespace: prod.analytics

inputs:
  - id: my_input
    type: STRING
    default: Hello

variables:
  my_flow_var: 123
  my_flow_object:
    complex: Hello

tasks:
  - id: hello
    type: io.kestra.plugin.core.log.Log
    message: "Hello World! 🚀 {{ namespace.test_var }}"`);
const flowError = ref("");
const flowModel = ref(null);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function applyFlowYaml() {
  try {
    const parsed = parseYaml(flowYaml.value);
    if (!parsed || typeof parsed !== "object") throw new Error("Flow must be a YAML object.");
    flowModel.value = parsed;
    flowError.value = "";
  } catch (err) {
    flowError.value = err instanceof Error ? err.message : String(err);
    flowModel.value = null;
  }
}

const flowGroups = computed(() => {
  if (!flowModel.value) return [];

  const inputs = Array.isArray(flowModel.value.inputs) ? flowModel.value.inputs : [];
  const variables = isPlainObject(flowModel.value.variables) ? flowModel.value.variables : {};

  const flowVariableItems = Object.entries(variables).map(([key, value]) => ({
    key,
    value,
    namespace: "flow.variables",
    source: "flow"
  }));

  return [
    {
      category: "Flow Inputs",
      items: inputs
        .filter((i) => i && typeof i === "object" && typeof i.id === "string")
        .map((i) => ({
          key: i.id,
          value: i.default ?? "",
          namespace: "flow.inputs"
        }))
    },
    {
      category: "Variables",
      items: flowVariableItems
    }
  ];
});

const combinedModel = computed(() => {
  const base = inventoryModel.value.map((g) => ({ ...g, items: [...g.items] }));
  const extraGroups = flowGroups.value;

  const byCategory = new Map(base.map((g) => [g.category, g]));
  for (const g of extraGroups) {
    if (!byCategory.has(g.category)) {
      byCategory.set(g.category, { category: g.category, items: [] });
      base.push(byCategory.get(g.category));
    }
    byCategory.get(g.category).items.push(...g.items);
  }

  return base;
});

const typeOptions = computed(() => {
  const preferred = ["Flow Inputs", "Variables", "KV Pairs", "Secrets"];
  const all = new Set(combinedModel.value.map((g) => g.category));
  const ordered = preferred.filter((t) => all.has(t));
  for (const t of Array.from(all).sort((a, b) => a.localeCompare(b))) {
    if (!ordered.includes(t)) ordered.push(t);
  }
  return ordered;
});

const enabledTypes = ref(["Flow Inputs", "Variables", "KV Pairs", "Secrets"]);

function iconForType(type) {
  if (type === "Secrets") return KeyOutlined;
  if (type === "Variables") return ApiOutlined;
  if (type === "KV Pairs") return DatabaseOutlined;
  if (type === "Flow Inputs") return TagsOutlined;
  return TagsOutlined;
}

const legend = [
  { type: "Flow Inputs", label: "Flow inputs" },
  { type: "Variables", label: "Variables" },
  { type: "KV Pairs", label: "KV pairs" },
  { type: "Secrets", label: "Secrets" }
];

function isTypeEnabled(type) {
  return enabledTypes.value.includes(type);
}

function toggleType(type) {
  const current = enabledTypes.value;
  if (current.includes(type)) {
    enabledTypes.value = current.filter((t) => t !== type);
  } else {
    enabledTypes.value = [...current, type];
  }
}

function valueClassForType(type) {
  if (type === "Secrets") return "value value--secret";
  if (type === "Variables") return "value value--variable";
  if (type === "KV Pairs") return "value value--kv";
  if (type === "Flow Inputs") return "value value--flow-input";
  return "value";
}

function maskedSecret(value) {
  const s = String(value ?? "");
  if (!s) return "••••••";
  if (s.length <= 6) return "••••••";
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

function pebbleExpressionForItem(item) {
  const key = item.name;
  const ns = item.namespace;

  if (item.type === "KV Pairs") {
    return `{{ kv('${key}', '${ns}') }}`;
  }

  if (item.type === "Variables") {
    if (item.source === "flow") {
      return `{{ vars.${item.path ?? key} }}`;
    }
    return `{{ namespace.${item.path ?? key} }}`;
  }

  if (item.type === "Secrets") {
    return `{{ secret('${key}') }}`;
  }

  if (item.type === "Flow Inputs") {
    return `{{ inputs.${key} }}`;
  }

  return `{{ ${ns}.${key} }}`;
}

async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

async function onClickItem(item) {
  try {
    const expr = pebbleExpressionForItem(item);
    await copyToClipboard(expr);
    message.success("Copied to clipboard", 1.2);
  } catch {
    message.error("Failed to copy", 1.5);
  }
}

function setExpressionFromItem(item) {
  expression.value = pebbleExpressionForItem(item);
}

function matches(item) {
  const q = query.value.trim().toLowerCase();
  if (!q) return true;
  const valueText =
    typeof item.value === "string"
      ? item.value
      : item.value == null
        ? ""
        : JSON.stringify(item.value);
  return (
    String(item.key).toLowerCase().includes(q) ||
    String(item.namespace).toLowerCase().includes(q) ||
    String(valueText).toLowerCase().includes(q)
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

function buildVariableNodes(it, keyPrefix, parentPath = "") {
  const basePath = parentPath ? `${parentPath}.${it.key}` : it.key;
  const nodeKey = `${keyPrefix}var:${it.namespace}:${basePath}`;

  if (!isPlainObject(it.value)) {
    return [
      {
        key: nodeKey,
        isLeaf: true,
        nodeType: "item",
        type: it.type,
        source: it.source,
        namespace: it.namespace,
        name: it.key,
        path: basePath,
        value: String(it.value ?? "")
      }
    ];
  }

  const children = [];
  for (const [childKey, childValue] of Object.entries(it.value)) {
    const childPath = `${basePath}.${childKey}`;
    if (isPlainObject(childValue)) {
      children.push(
        ...buildVariableNodes(
          { ...it, key: childKey, value: childValue },
          keyPrefix,
          basePath
        )
      );
    } else {
      children.push({
        key: `${keyPrefix}var:${it.namespace}:${childPath}`,
        isLeaf: true,
        nodeType: "item",
        type: it.type,
        source: it.source,
        namespace: it.namespace,
        name: childKey,
        path: childPath,
        value: String(childValue)
      });
    }
  }
  children.sort((a, b) => a.name.localeCompare(b.name));

  return [
    {
      key: nodeKey,
      nodeType: "item",
      type: it.type,
      source: it.source,
      namespace: it.namespace,
      name: it.key,
      path: basePath,
      selectable: false,
      isLeaf: false,
      children
    }
  ];
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

      const itemNodes = [];
      const sortedItems = child.items.slice().sort((a, b) => a.key.localeCompare(b.key));
      for (const it of sortedItems) {
        if (it.type === "Variables") {
          itemNodes.push(...buildVariableNodes(it, `${keyPrefix}item:`));
          continue;
        }

        itemNodes.push({
          key: `${keyPrefix}item:${it.type}:${it.namespace}:${it.key}`,
          title: it.key,
          isLeaf: true,
          nodeType: "item",
          type: it.type,
          source: it.source,
          namespace: it.namespace,
          name: it.key,
          value: it.type === "Secrets" ? maskedSecret(it.value) : String(it.value ?? "")
        });
      }

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
  const enriched = combinedModel.value.flatMap((g) =>
    g.items.map((it) => ({ ...it, type: g.category }))
  );
  const filtered = enriched.filter((it) => enabledTypes.value.includes(it.type) && matches(it));
  return groupBy.value === "type"
    ? buildTypeThenNamespaceTree(filtered)
    : buildNamespaceTree(filtered);
});

applyFlowYaml();
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
              :auto-size="{ minRows: 18, maxRows: 18 }"
              spellcheck="false"
            />

            <a-alert v-if="inventoryError" type="error" show-icon :message="inventoryError" />

            <a-divider class="divider" />

            <div class="panel-header">
              <a-typography-text style="color: rgba(255, 255, 255, 0.82)">
                Flow (YAML)
              </a-typography-text>
              <a-button @click="applyFlowYaml">Apply</a-button>
            </div>

            <a-textarea
              v-model:value="flowYaml"
              class="code"
              :auto-size="{ minRows: 14, maxRows: 22 }"
              spellcheck="false"
            />

            <a-alert v-if="flowError" type="error" show-icon :message="flowError" />
          </a-space>
        </section>

        <section class="panel content">
          <a-space direction="vertical" size="small" style="width: 100%">
            <a-typography-title :level="5" style="margin: 0; color: rgba(255, 255, 255, 0.9)">
              New Namespace Context Tab
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

            <div class="legend">
              <a-space :size="10" wrap>
                <button
                  v-for="item in legend"
                  :key="item.type"
                  type="button"
                  class="legend-item"
                  :class="{ 'legend-item--off': !isTypeEnabled(item.type) }"
                  @click="toggleType(item.type)"
                >
                  <component :is="iconForType(item.type)" class="legend-icon" />
                  <span>{{ item.label }}</span>
                </button>
              </a-space>
            </div>

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
                    <span class="node-name item" @click.stop="onClickItem(dataRef)">
                      <component :is="iconForType(dataRef.type)" class="type-icon" />
                      <span>{{ dataRef.name }}</span>
                      <span v-if="dataRef.value" :class="valueClassForType(dataRef.type)">
                        {{ dataRef.value }}
                      </span>
                      <button type="button" class="node-copy" @click.stop="onClickItem(dataRef)">
                        <CopyOutlined />
                      </button>
                    </span>
                    <span class="node-actions">
                      <button
                        type="button"
                        class="node-action node-action--render"
                        @click.stop="setExpressionFromItem(dataRef)"
                      >
                        <PlayCircleOutlined />
                        <span>Render</span>
                      </button>
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

.legend {
  margin-top: 6px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
}

.legend-icon {
  font-size: 14px;
  color: rgba(143, 170, 255, 1);
}

.legend-item--off {
  opacity: 0.45;
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

.node-name.item {
  cursor: pointer;
}

.node-name.item:hover {
  color: rgba(255, 255, 255, 0.95);
}

.node-copy {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  padding: 2px;
  margin-left: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
  pointer-events: none;
}

.node-row:hover .node-copy {
  opacity: 1;
  pointer-events: auto;
}

.node-copy:hover {
  color: rgba(255, 255, 255, 0.95);
}

.node-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.node-row:hover .node-actions {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.node-action {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(15, 20, 36, 0.6);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0px 8px;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.node-action:hover {
  border-color: rgba(255, 255, 255, 0.35);
  color: rgba(255, 255, 255, 0.95);
  background: rgba(30, 38, 60, 0.7);
}

.node-action--render {
  color: rgba(177, 197, 255, 0.95);
  border-color: rgba(143, 170, 255, 0.5);
  background: rgba(37, 47, 80, 0.7);
}

.node-action--render:hover {
  border-color: rgba(143, 170, 255, 0.85);
  color: rgba(205, 218, 255, 0.98);
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
