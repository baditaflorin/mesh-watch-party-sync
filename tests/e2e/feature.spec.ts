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
