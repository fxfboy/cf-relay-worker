import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        // 集成测试用小上限，避免在 workerd 里分配 32 MiB。
        // 生产默认值由 protocol.ts / wrangler.toml 保持为 33554432。
        miniflare: {
          bindings: { MAX_MESSAGE_BYTES: "1024" },
        },
      },
    },
  },
});
