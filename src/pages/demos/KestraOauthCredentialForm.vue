<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { message, theme } from "ant-design-vue";
import { CopyOutlined, DeleteOutlined } from "@ant-design/icons-vue";

const preset = ref(null);

const form = ref({
  name: "",
  namespace: "",
  description: "",
  oauth2: {
    grantType: "client_credentials",
    tokenUrl: "",
    clientId: "",
    clientAuthMethod: "client_secret_post",
    clientSecret: "",
    privateKey: "",
    certificate: "",
    scopesText: "",
    params: [],
    safetyWindowSeconds: 30,
    jwt: {
      issuer: "",
      subject: "",
      audience: "",
      lifetimeSeconds: 60,
      claims: [],
      privateKey: ""
    }
  }
});

function blankParam() {
  return { key: "", value: "" };
}

function normalizeScopes(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeParams(params) {
  const out = {};
  for (const entry of params ?? []) {
    const key = String(entry?.key ?? "").trim();
    const value = String(entry?.value ?? "").trim();
    if (!key || !value) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeJwtClaims(params) {
  const out = {};
  for (const entry of params ?? []) {
    const key = String(entry?.key ?? "").trim();
    const rawValue = String(entry?.value ?? "").trim();
    if (!key || !rawValue) continue;

    const shouldParseJson = rawValue.startsWith("{") || rawValue.startsWith("[");
    if (shouldParseJson) {
      try {
        out[key] = JSON.parse(rawValue);
      } catch {
        out[key] = "__INVALID_JSON__";
      }
    } else {
      out[key] = rawValue;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const isClientCredentials = computed(() => form.value.oauth2.grantType === "client_credentials");
const isJwtBearer = computed(() => form.value.oauth2.grantType === "jwt_bearer");

const showClientAuthMethod = computed(() => isClientCredentials.value);
const needsClientSecret = computed(() => {
  if (!isClientCredentials.value) return false;
  const method = form.value.oauth2.clientAuthMethod;
  return method === "client_secret_basic" || method === "client_secret_post";
});
const needsPkJwt = computed(() => {
  if (!isClientCredentials.value) return false;
  return form.value.oauth2.clientAuthMethod === "private_key_jwt";
});
const showJwtBlock = computed(() => isJwtBearer.value || needsPkJwt.value);

watch(
  () => form.value.oauth2.grantType,
  (next) => {
    if (next === "client_credentials" && form.value.oauth2.clientAuthMethod === "none") {
      form.value.oauth2.clientAuthMethod = "client_secret_post";
    }
    if (next === "jwt_bearer") {
      form.value.oauth2.clientAuthMethod = "none";
    }
  }
);

const validationErrors = computed(() => {
  const errors = [];
  const o = form.value.oauth2;

  if (!form.value.name.trim()) errors.push("Credential name is required.");
  if (!o.tokenUrl.trim()) errors.push("Token endpoint URL is required.");

  if (isClientCredentials.value) {
    if (!o.clientId.trim()) errors.push("Client ID is required for client_credentials.");
    if (needsClientSecret.value && !o.clientSecret.trim()) {
      errors.push("Client secret is required for client_secret_* methods.");
    }
    if (needsPkJwt.value) {
      const key = o.privateKey.trim() || o.jwt.privateKey.trim();
      if (!key) errors.push("Private key is required for private_key_jwt.");
    }
  }

  if (isJwtBearer.value) {
    if (!o.jwt.issuer.trim()) errors.push("JWT issuer (iss) is required for jwt_bearer.");
    if (!o.jwt.subject.trim()) errors.push("JWT subject (sub) is required for jwt_bearer.");
    if (!o.jwt.audience.trim()) errors.push("JWT audience (aud) is required for jwt_bearer.");
    if (!o.jwt.privateKey.trim()) errors.push("JWT signing private key is required for jwt_bearer.");
  }

  const claims = normalizeJwtClaims(o.jwt.claims);
  if (claims) {
    for (const [key, value] of Object.entries(claims)) {
      if (value === "__INVALID_JSON__") errors.push(`JWT claim "${key}" must be valid JSON.`);
    }
  }

  const lifetime = Number(o.jwt.lifetimeSeconds);
  if (!Number.isFinite(lifetime) || lifetime < 10) errors.push("JWT lifetime must be at least 10 seconds.");

  const safety = Number(o.safetyWindowSeconds);
  if (!Number.isFinite(safety) || safety < 0) errors.push("Safety window must be 0 seconds or more.");

  return errors;
});

const credentialModel = computed(() => {
  const o = form.value.oauth2;
  const params = normalizeParams(o.params);
  const scopes = normalizeScopes(o.scopesText);
  const claims = normalizeJwtClaims(o.jwt.claims);

  const model = {
    name: form.value.name.trim() || undefined,
    namespace: form.value.namespace.trim() || undefined,
    description: form.value.description.trim() || undefined,
    type: "oauth2",
    endpoints: [{ name: "token", url: o.tokenUrl.trim() || "" }],
    grant: { type: o.grantType },
    client: {
      id: o.clientId.trim() || undefined,
      auth: {
        method: isJwtBearer.value ? "none" : o.clientAuthMethod
      }
    },
    scopes: scopes.length ? scopes : undefined,
    params,
    safetyWindowSeconds: Number(o.safetyWindowSeconds)
  };

  if (needsClientSecret.value) {
    model.client.auth.clientSecret = o.clientSecret.trim() || undefined;
  }

  if (needsPkJwt.value) {
    model.client.auth.privateKey = o.privateKey.trim() || undefined;
    model.client.auth.certificate = o.certificate.trim() || undefined;
  }

  if (showJwtBlock.value) {
    const jwt = {
      issuer: o.jwt.issuer.trim() || undefined,
      subject: o.jwt.subject.trim() || undefined,
      audience: o.jwt.audience.trim() || undefined,
      lifetimeSeconds: Number(o.jwt.lifetimeSeconds),
      claims:
        claims && Object.values(claims).every((value) => value !== "__INVALID_JSON__") ? claims : undefined,
      privateKey: o.jwt.privateKey.trim() || undefined
    };

    if (needsPkJwt.value) {
      jwt.issuer = jwt.issuer || model.client.id || undefined;
      jwt.subject = jwt.subject || model.client.id || undefined;
      jwt.audience = jwt.audience || model.endpoints?.[0]?.url || undefined;
      jwt.privateKey = jwt.privateKey || model.client.auth.privateKey || undefined;
    }

    model.jwt = jwt;
  }

  function prune(value) {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (v === undefined) delete value[key];
      else prune(v);
    }
  }
  prune(model);

  return model;
});

const modelJson = computed(() => JSON.stringify(credentialModel.value, null, 2));

function shQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
}

const jwtValuesJson = computed(() => {
  if (!showJwtBlock.value) return "";
  const jwt = credentialModel.value?.jwt;
  if (!jwt) return "";
  return JSON.stringify(jwt, null, 2);
});

const curlPreview = computed(() => {
  const o = form.value.oauth2;
  const tokenUrl = String(o.tokenUrl ?? "").trim();
  if (!tokenUrl) return "Enter a token endpoint URL to see the curl request.";

  const scopes = normalizeScopes(o.scopesText).join(" ");
  const paramsObj = normalizeParams(o.params) ?? {};

  const lines = [`curl -X POST ${shQuote(tokenUrl)} \\`, "  -H 'Content-Type: application/x-www-form-urlencoded' \\"];

  if (isClientCredentials.value) {
    if (o.clientAuthMethod === "client_secret_basic") {
      lines.push(`  -u ${shQuote(`${String(o.clientId ?? "").trim()}:${String(o.clientSecret ?? "").trim()}`)} \\`);
      lines.push(`  --data-urlencode ${shQuote("grant_type=client_credentials")} \\`);
    } else if (o.clientAuthMethod === "private_key_jwt") {
      lines.push(`  --data-urlencode ${shQuote("grant_type=client_credentials")} \\`);
      if (String(o.clientId ?? "").trim()) {
        lines.push(`  --data-urlencode ${shQuote(`client_id=${String(o.clientId ?? "").trim()}`)} \\`);
      }
      lines.push(
        `  --data-urlencode ${shQuote(
          "client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        )} \\`
      );
      lines.push(`  --data-urlencode ${shQuote("client_assertion=<SIGNED_JWT>")} \\`);
    } else {
      lines.push(`  --data-urlencode ${shQuote("grant_type=client_credentials")} \\`);
      if (String(o.clientId ?? "").trim()) {
        lines.push(`  --data-urlencode ${shQuote(`client_id=${String(o.clientId ?? "").trim()}`)} \\`);
      }
      if (String(o.clientSecret ?? "").trim()) {
        lines.push(`  --data-urlencode ${shQuote(`client_secret=${String(o.clientSecret ?? "").trim()}`)} \\`);
      }
    }

    if (scopes) lines.push(`  --data-urlencode ${shQuote(`scope=${scopes}`)} \\`);
    for (const [key, value] of Object.entries(paramsObj)) {
      lines.push(`  --data-urlencode ${shQuote(`${key}=${value}`)} \\`);
    }
  } else if (isJwtBearer.value) {
    lines.push(
      `  --data-urlencode ${shQuote("grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer")} \\`
    );
    if (String(o.clientId ?? "").trim()) {
      lines.push(`  --data-urlencode ${shQuote(`client_id=${String(o.clientId ?? "").trim()}`)} \\`);
    }
    lines.push(`  --data-urlencode ${shQuote("assertion=<SIGNED_JWT>")} \\`);

    for (const [key, value] of Object.entries(paramsObj)) {
      lines.push(`  --data-urlencode ${shQuote(`${key}=${value}`)} \\`);
    }
  }

  lines[lines.length - 1] = lines[lines.length - 1].replace(/\\$/, "");
  return lines.join("\n");
});

function resetForm() {
  preset.value = null;
  form.value = {
    name: "",
    namespace: "",
    description: "",
    oauth2: {
      grantType: "client_credentials",
      tokenUrl: "",
      clientId: "",
      clientAuthMethod: "client_secret_post",
      clientSecret: "",
      privateKey: "",
      certificate: "",
      scopesText: "",
      params: [blankParam()],
      safetyWindowSeconds: 30,
      jwt: {
        issuer: "",
        subject: "",
        audience: "",
        lifetimeSeconds: 60,
        claims: [],
        privateKey: ""
      }
    }
  };
}

function applyPreset(key) {
  resetForm();
  preset.value = key;

  if (key === "entra_client_secret_post") {
    form.value.name = "entra_graph";
    form.value.oauth2.grantType = "client_credentials";
    form.value.oauth2.clientAuthMethod = "client_secret_post";
    form.value.oauth2.tokenUrl = "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token";
    form.value.oauth2.clientId = "<CLIENT_ID>";
    form.value.oauth2.clientSecret = "{{ secret('ENTRA_CLIENT_SECRET') }}";
    form.value.oauth2.scopesText = "https://graph.microsoft.com/.default";
  }

  if (key === "entra_private_key_jwt") {
    form.value.name = "entra_graph_pkjwt";
    form.value.oauth2.grantType = "client_credentials";
    form.value.oauth2.clientAuthMethod = "private_key_jwt";
    form.value.oauth2.tokenUrl = "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token";
    form.value.oauth2.clientId = "<CLIENT_ID>";
    form.value.oauth2.privateKey = "{{ secret('ENTRA_PRIVATE_KEY_PEM') }}";
    form.value.oauth2.certificate = "{{ secret('ENTRA_CERT_PEM') }}";
    form.value.oauth2.scopesText = "https://graph.microsoft.com/.default";
  }

  if (key === "salesforce_jwt_bearer") {
    form.value.name = "salesforce";
    form.value.oauth2.grantType = "jwt_bearer";
    form.value.oauth2.clientAuthMethod = "none";
    form.value.oauth2.tokenUrl = "https://login.salesforce.com/services/oauth2/token";
    form.value.oauth2.clientId = "<CONNECTED_APP_CLIENT_ID>";
    form.value.oauth2.jwt.issuer = "<CONNECTED_APP_CLIENT_ID>";
    form.value.oauth2.jwt.subject = "<INTEGRATION_USER_USERNAME>";
    form.value.oauth2.jwt.audience = "https://login.salesforce.com";
    form.value.oauth2.jwt.lifetimeSeconds = 180;
    form.value.oauth2.jwt.privateKey = "{{ secret('SALESFORCE_PRIVATE_KEY_PEM') }}";
  }

  if (key === "mongo_client_secret_basic") {
    form.value.name = "mongo_atlas";
    form.value.oauth2.grantType = "client_credentials";
    form.value.oauth2.clientAuthMethod = "client_secret_basic";
    form.value.oauth2.tokenUrl = "https://cloud.mongodb.com/api/oauth/token";
    form.value.oauth2.clientId = "<MONGO_CLIENT_ID>";
    form.value.oauth2.clientSecret = "{{ secret('MONGO_CLIENT_SECRET') }}";
    form.value.oauth2.params = [{ key: "audience", value: "https://cloud.mongodb.com" }];
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(modelJson.value);
    message.success("Copied JSON.");
  } catch {
    message.error("Copy failed (clipboard permissions).");
  }
}

async function copyCurl() {
  try {
    await navigator.clipboard.writeText(curlPreview.value);
    message.success("Copied curl.");
  } catch {
    message.error("Copy failed (clipboard permissions).");
  }
}

onMounted(() => {
  if (form.value.oauth2.params.length === 0) form.value.oauth2.params = [blankParam()];
});
</script>

<template>
  <a-config-provider :theme="{ algorithm: theme.darkAlgorithm }">
    <div class="page-shell">
      <section class="hero">
        <h1>OAuth Credential Form</h1>
        <p>POC for creating an OAuth2 credential (client credentials + JWT bearer).</p>
      </section>

      <div class="layout">
        <section class="panel">
          <a-space direction="vertical" size="middle" style="width: 100%">
            <a-card class="card" :bordered="false" title="Create / Edit Credential">
              <a-space direction="vertical" size="middle" style="width: 100%">
                <a-space wrap>
                  <a-select
                    v-model:value="preset"
                    placeholder="Load preset…"
                    style="min-width: 260px"
                    @change="applyPreset"
                  >
                    <a-select-option value="entra_client_secret_post">Entra (client_secret_post)</a-select-option>
                    <a-select-option value="entra_private_key_jwt">Entra (private_key_jwt)</a-select-option>
                    <a-select-option value="salesforce_jwt_bearer">Salesforce (jwt_bearer)</a-select-option>
                    <a-select-option value="mongo_client_secret_basic">Mongo Atlas (client_secret_basic)</a-select-option>
                  </a-select>

                  <a-button @click="resetForm">Reset</a-button>
                </a-space>

                <a-divider />

                <a-form layout="vertical">
                  <a-row :gutter="[16, 0]">
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Credential name" required>
                        <a-input v-model:value="form.name" placeholder="e.g. mongo_atlas" />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Namespace (optional)">
                        <a-input v-model:value="form.namespace" placeholder="e.g. prod.analytics" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="24">
                      <a-form-item label="Description (optional)">
                        <a-input v-model:value="form.description" placeholder="Human readable description" />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-divider />

                  <a-row :gutter="[16, 0]">
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Grant type" required>
                        <a-select v-model:value="form.oauth2.grantType">
                          <a-select-option value="client_credentials">Client Credentials</a-select-option>
                          <a-select-option value="jwt_bearer">JWT Bearer (RFC 7523)</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>

                    <a-col v-if="showClientAuthMethod" :xs="24" :md="12">
                      <a-form-item label="Client authentication" required>
                        <a-select v-model:value="form.oauth2.clientAuthMethod">
                          <a-select-option value="client_secret_basic">Client Secret (Basic)</a-select-option>
                          <a-select-option value="client_secret_post">Client Secret (POST)</a-select-option>
                          <a-select-option value="private_key_jwt">Private Key JWT</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>

                    <a-col :span="24">
                      <a-form-item label="Token endpoint URL" required>
                        <a-input
                          v-model:value="form.oauth2.tokenUrl"
                          placeholder="https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token"
                        />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :md="12">
                      <a-form-item label="Client ID" :required="isClientCredentials">
                        <a-input v-model:value="form.oauth2.clientId" placeholder="Application (client) ID" />
                      </a-form-item>
                    </a-col>

                    <a-col v-if="needsClientSecret" :xs="24" :md="12">
                      <a-form-item label="Client secret (secret reference)" required>
                        <a-input
                          v-model:value="form.oauth2.clientSecret"
                          placeholder="{{ secret('MY_CLIENT_SECRET') }}"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-row v-if="needsPkJwt" :gutter="[16, 0]">
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Private key (secret reference)" required>
                        <a-input v-model:value="form.oauth2.privateKey" placeholder="{{ secret('MY_PRIVATE_KEY_PEM') }}" />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Certificate (optional, secret reference)">
                        <a-input v-model:value="form.oauth2.certificate" placeholder="{{ secret('MY_CERT_PEM') }}" />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-row :gutter="[16, 0]">
                    <a-col :xs="24" :md="12">
                      <a-form-item label="Safety window (seconds)">
                        <a-input-number v-model:value="form.oauth2.safetyWindowSeconds" :min="0" style="width: 100%" />
                      </a-form-item>
                    </a-col>

                    <a-col :span="24">
                      <a-form-item label="Scopes (one per line)">
                        <a-textarea
                          v-model:value="form.oauth2.scopesText"
                          :auto-size="{ minRows: 3, maxRows: 8 }"
                          placeholder="https://graph.microsoft.com/.default"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-divider />

                  <a-form-item label="Extra token params">
                    <a-space direction="vertical" size="small" style="width: 100%">
                      <div v-for="(p, idx) in form.oauth2.params" :key="idx" class="params-row">
                        <a-input v-model:value="p.key" placeholder="key" />
                        <a-input v-model:value="p.value" placeholder="value" />
                        <a-button @click="form.oauth2.params.splice(idx, 1)">
                          <template #icon><DeleteOutlined /></template>
                        </a-button>
                      </div>
                      <a-button type="dashed" @click="form.oauth2.params.push(blankParam())">
                        + Add param
                      </a-button>
                    </a-space>
                  </a-form-item>

                  <a-divider v-if="showJwtBlock" />

                  <template v-if="showJwtBlock">
                    <a-typography-title :level="5" style="margin: 0">JWT settings</a-typography-title>

                    <a-row :gutter="[16, 0]" style="margin-top: 12px">
                      <a-col :xs="24" :md="12">
                        <a-form-item label="JWT issuer (iss)" :required="isJwtBearer">
                          <a-input v-model:value="form.oauth2.jwt.issuer" placeholder="defaults often = clientId" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="JWT subject (sub)" :required="isJwtBearer">
                          <a-input v-model:value="form.oauth2.jwt.subject" placeholder="clientId or integration user" />
                        </a-form-item>
                      </a-col>
                      <a-col :span="24">
                        <a-form-item label="JWT audience (aud)" :required="isJwtBearer">
                          <a-input v-model:value="form.oauth2.jwt.audience" placeholder="often token URL or provider base URL" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="JWT lifetime (seconds)">
                          <a-input-number v-model:value="form.oauth2.jwt.lifetimeSeconds" :min="10" style="width: 100%" />
                        </a-form-item>
                      </a-col>
                      <a-col :xs="24" :md="12">
                        <a-form-item label="Extra JWT claims">
                          <a-space direction="vertical" size="small" style="width: 100%">
                            <div v-for="(c, idx) in form.oauth2.jwt.claims" :key="idx" class="params-row">
                              <a-input v-model:value="c.key" placeholder="key (e.g. jti)" />
                              <a-input v-model:value="c.value" placeholder='value (string, or JSON like {"foo":1})' />
                              <a-button @click="form.oauth2.jwt.claims.splice(idx, 1)">
                                <template #icon><DeleteOutlined /></template>
                              </a-button>
                            </div>
                            <a-button type="dashed" @click="form.oauth2.jwt.claims.push(blankParam())">
                              + Add claim
                            </a-button>
                          </a-space>
                        </a-form-item>
                      </a-col>
                      <a-col :span="24">
                        <a-form-item label="JWT signing private key (secret reference)" :required="isJwtBearer">
                          <a-input
                            v-model:value="form.oauth2.jwt.privateKey"
                            placeholder="{{ secret('MY_JWT_PRIVATE_KEY_PEM') }}"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </template>

                  <a-alert
                    v-if="validationErrors.length"
                    type="error"
                    show-icon
                    :message="validationErrors[0]"
                  />

                  <a-divider />

                  <div class="form-actions">
                    <a-space>
                      <a-button>Cancel</a-button>
                      <a-button>Test</a-button>
                      <a-button type="primary">Save</a-button>
                    </a-space>
                  </div>
                </a-form>
              </a-space>
            </a-card>
          </a-space>
        </section>

        <section class="panel">
          <a-space direction="vertical" size="middle" style="width: 100%">
            <a-card class="card" :bordered="false" title="Output">
              <a-space wrap style="margin-bottom: 12px">
                <a-button @click="copyJson">
                  <template #icon><CopyOutlined /></template>
                  Copy JSON
                </a-button>
              </a-space>
              <pre class="code">{{ modelJson }}</pre>
            </a-card>

            <a-card class="card" :bordered="false" title="Request (curl)">
              <a-space wrap style="margin-bottom: 12px">
                <a-button @click="copyCurl">
                  <template #icon><CopyOutlined /></template>
                  Copy curl
                </a-button>
              </a-space>

              <pre class="code">{{ curlPreview }}</pre>

              <template v-if="jwtValuesJson">
                <a-divider />
                <a-typography-title :level="5" style="margin: 0 0 8px">JWT values</a-typography-title>
                <pre class="code">{{ jwtValuesJson }}</pre>
              </template>
            </a-card>
          </a-space>
        </section>
      </div>
    </div>
  </a-config-provider>
</template>

<style scoped>
.page-shell {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 26px 18px 46px;
}

.hero {
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 12px;
  background: rgba(11, 11, 16, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px);
}

.hero h1 {
  margin: 0;
  font-size: 22px;
}

.hero p {
  margin: 6px 0 0;
  opacity: 0.82;
}

.layout {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 16px;
  align-items: start;
}

.panel {
  min-width: 0;
}

.code {
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  overflow: auto;
  max-height: 480px;
}

.params-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  align-items: center;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
