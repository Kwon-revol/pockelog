import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

function pngSize(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("PWA icon assets", () => {
  it.each([
    ["public/icons/pockelog-192.png", 192],
    ["public/icons/pockelog-512.png", 512],
    ["public/icons/pockelog-maskable-192.png", 192],
    ["public/icons/pockelog-maskable-512.png", 512],
    ["src/app/apple-icon.png", 180],
  ])("provides %s at %d pixels", async (path, size) => {
    expect(pngSize(await readFile(path))).toEqual({
      width: size,
      height: size,
    });
  });

  it("provides a branded ICO favicon", async () => {
    const favicon = await readFile("src/app/favicon.ico");

    expect([...favicon.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
    expect(favicon.length).toBeGreaterThan(100);
  });
});
