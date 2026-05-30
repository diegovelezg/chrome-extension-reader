import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import webExtension from "vite-plugin-web-extension";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    webExtension({
      manifest: "manifest.json",
      additionalInputs: ["src/sidepanel/sidepanel.html"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
