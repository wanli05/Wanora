import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const getProfileByUserId = vi.fn();
const setProfilePhotoKey = vi.fn();
const putUserObject = vi.fn();
const getUserObject = vi.fn();
const deleteUserObject = vi.fn();
const isObjectStorageConfigured = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUser(...args),
}));

vi.mock("@/db", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/data/profiles", () => ({
  getProfileByUserId: (...args: unknown[]) => getProfileByUserId(...args),
  setProfilePhotoKey: (...args: unknown[]) => setProfilePhotoKey(...args),
}));

vi.mock("@/lib/env", () => ({
  isObjectStorageConfigured: () => isObjectStorageConfigured(),
}));

vi.mock("@/lib/storage/object-storage", () => ({
  profilePhotoKey: (userId: string, variant: "original" | "print") =>
    `profiles/${userId}/photo-${variant}.jpg`,
  putUserObject: (...args: unknown[]) => putUserObject(...args),
  getUserObject: (...args: unknown[]) => getUserObject(...args),
  deleteUserObject: (...args: unknown[]) => deleteUserObject(...args),
}));

describe("POST /api/profile/photo without S3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "user-1" });
    isObjectStorageConfigured.mockReturnValue(false);
    putUserObject.mockResolvedValue(undefined);
    setProfilePhotoKey.mockResolvedValue(undefined);
  });

  it("stores original + print via local backend and does not 503", async () => {
    const { POST } = await import("./route");
    const original = new Blob([new Uint8Array([1, 2])], { type: "image/png" });
    const print = new Blob([new Uint8Array([3, 4])], { type: "image/jpeg" });
    const request = {
      formData: async () => ({
        get(key: string) {
          if (key === "original") return original;
          if (key === "print") return print;
          return null;
        },
      }),
      headers: new Headers(),
    } as unknown as Request;
    const res = await POST(request);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.backend).toBe("local");
    expect(putUserObject).toHaveBeenCalledTimes(2);
    expect(setProfilePhotoKey).toHaveBeenCalledWith(
      {},
      "user-1",
      "profiles/user-1/photo-print.jpg",
    );
  });
});
