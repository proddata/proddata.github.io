import { createRouter, createWebHashHistory } from "vue-router";

import Home from "./pages/Home.vue";
import KestraNamespaceContext from "./pages/demos/KestraNamespaceContext.vue";
import KestraOauthCredentialForm from "./pages/demos/KestraOauthCredentialForm.vue";
import KestraTaskLevelProperties from "./pages/demos/KestraTaskLevelProperties.vue";

export const routes = [
  {
    path: "/",
    name: "home",
    component: Home
  },
  {
    path: "/demos/kestra-namespace-context",
    name: "kestra-namespace-context",
    component: KestraNamespaceContext
  },
  {
    path: "/demos/kestra-oauth-credential-form",
    name: "kestra-oauth-credential-form",
    component: KestraOauthCredentialForm
  },
  {
    path: "/demos/kestra-task-level-properties",
    name: "kestra-task-level-properties",
    component: KestraTaskLevelProperties
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
