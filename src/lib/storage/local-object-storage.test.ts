import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("local-object-storage", () => {
  let tmp: string;

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  it("round-trips put/get/delete under a temp root", async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "wanora-obj-"));
    vi.stubEnv("PWD", tmp);
    // Force cwd for this process when module resolves localObjectRoot
    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmp);

    const {
      putLocalObject,
      getLocalObject,
      deleteLocalObject,
    } = await import("./local-object-storage");

    const key = "profiles/user-1/photo-print.jpg";
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    await putLocalObject(key, body, "image/jpeg");
    const got = await getLocalObject(key);
    expect(got?.contentType).toBe("image/jpeg");
    expect(got?.body.equals(body)).toBe(true);

    await deleteLocalObject(key);
    expect(await getLocalObject(key)).toBeNull();
    cwdSpy.mockRestore();
  });

  it("rejects path traversal keys", async () => {
    const { putLocalObject } = await import("./local-object-storage");
    await expect(
      putLocalObject("../escape.jpg", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/unsafe/);
  });
});
