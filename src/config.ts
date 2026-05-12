import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-watch-party-sync",
  description: "Synced YouTube playback across friends in different homes",
  accentHex: "#ff3b3b",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
