import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Scoped to the account-settings feature (server actions, marketing
      // opt-in/out, and the settings UI) per the 80% coverage requirement —
      // not the whole app.
      include: [
        "src/actions/account.ts",
        "src/lib/marketing.ts",
        "src/components/account/account-settings.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
