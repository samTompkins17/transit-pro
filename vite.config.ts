import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Le proxy doit pointer vers le même port que l'API (PORT, défaut 3001)
const apiPort = process.env.PORT || 3001;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/uploads": `http://localhost:${apiPort}`,
    },
  },
});
