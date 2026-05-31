import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("loading a video on A makes the iframe appear on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder(/YouTube/).fill("dQw4w9WgXcQ");
    await a.getByRole("button", { name: "load" }).click();
    await expect(b.locator(".wp-frame iframe")).toBeVisible();
    await expect(b.locator(".wp-frame iframe")).toHaveAttribute("src", /dQw4w9WgXcQ/);
  } finally {
    await cleanup();
  }
});

test("clear video on A removes the iframe on B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder(/YouTube/).fill("dQw4w9WgXcQ");
    await a.getByRole("button", { name: "load" }).click();
    await expect(b.locator(".wp-frame iframe")).toBeVisible();
    await a.getByRole("button", { name: /clear video/ }).click();
    await expect(b.locator(".wp-frame")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});

/**
 * The advertised core action: *synced playback*. The playhead is derived on
 * every peer from a shared mesh-time anchor (anchorMs + anchorPosSec) written
 * to the Yjs doc and read against the shared clock origin. This drives the
 * advertised pause / seek controls on peer A and asserts the playhead on the
 * OPPOSITE peer B converges to the same value — proving position (not just the
 * video id) crosses the mesh. A regression that writes seek/pause to React
 * useState instead of the Yjs doc would leave B's playhead at 0:00 and fail.
 */
test("pause + seek on A move the synced playhead on B to the same position", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder(/YouTube/).fill("dQw4w9WgXcQ");
    await a.getByRole("button", { name: "load" }).click();
    await expect(b.locator(".wp-frame iframe")).toBeVisible();

    // Pause first so the playhead is frozen and deterministic across reads
    // (no wall-clock drift between A acting and B observing).
    await a.getByRole("button", { name: /pause/ }).click();
    await expect(a.getByRole("button", { name: /play/ })).toBeVisible();
    // B must also see the paused state cross the mesh.
    await expect(b.getByRole("button", { name: /play/ })).toBeVisible();

    // Seek forward 3 × 10s while paused → playhead should land at 0:30.
    const seekBtn = a.getByRole("button", { name: /10s ⏩/ });
    await seekBtn.click();
    await seekBtn.click();
    await seekBtn.click();

    // A reaches 0:30…
    await expect(a.locator(".wp-pos")).toHaveText(/0:30/);
    // …and B, reading the SAME shared anchor against the shared clock, converges.
    await expect(b.locator(".wp-pos")).toHaveText(/0:30/);

    // Rewind 10s on A → both drop to 0:20.
    await a.getByRole("button", { name: /⏪ 10s/ }).click();
    await expect(a.locator(".wp-pos")).toHaveText(/0:20/);
    await expect(b.locator(".wp-pos")).toHaveText(/0:20/);
  } finally {
    await cleanup();
  }
});
