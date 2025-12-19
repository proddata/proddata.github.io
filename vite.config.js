import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

function getBase() {
  const repo = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
  if (!repo) return "/";

  const isUserOrOrgPages = repo.endsWith(".github.io");
  return isUserOrOrgPages ? "/" : `/${repo}/`;
}

export default defineConfig({
  plugins: [vue()],
  base: getBase()
});

