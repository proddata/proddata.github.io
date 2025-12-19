import { createRouter, createWebHashHistory } from "vue-router";

import Home from "./pages/Home.vue";
import KestraNamespaceContext from "./pages/demos/KestraNamespaceContext.vue";

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
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

