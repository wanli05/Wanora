import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUser(...args),
}));

describe("GET /api/profile/postal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue({ id: "user-1" });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionUser.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/postal?zip=3300072"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for incomplete zip", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/postal?zip=330"),
    );
    expect(res.status).toBe(400);
  });

  it("proxies zipcloud and returns address + kana", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 200,
        message: null,
        results: [
          {
            address1: "埼玉県",
            address2: "さいたま市浦和区",
            address3: "領家",
            kana1: "ｻｲﾀﾏｹﾝ",
            kana2: "ｻｲﾀﾏｼｳﾗﾜｸ",
            kana3: "ﾘｮｳｹ",
            zipcode: "3300072",
          },
        ],
      }),
    });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/postal?zip=330-0072"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.addressJa).toBe("埼玉県さいたま市浦和区領家");
    expect(body.postalCode).toBe("330-0072");
    expect(body.addressKana).toMatch(/さいたま/);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://zipcloud.ibsnet.co.jp/api/search?zipcode=3300072",
      expect.any(Object),
    );
  });

  it("returns 404 when zipcloud has no results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, message: null, results: null }),
    });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/profile/postal?zip=0000000"),
    );
    expect(res.status).toBe(404);
  });
});
