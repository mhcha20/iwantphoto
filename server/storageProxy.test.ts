import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const mocks = vi.hoisted(() => ({ storageGetSignedUrl: vi.fn(), storageGetBytes: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl, storageGetBytes: mocks.storageGetBytes }));

import { registerStorageProxy } from "./_core/storageProxy";

function call(key: string, query: Record<string, string> = {}) {
  let handler: (req: any, res: any) => Promise<void> = async () => undefined;
  registerStorageProxy({ get: (_path: string, h: typeof handler) => (handler = h) } as unknown as Express);
  const res: any = { statusCode: 200, headers: {} as Record<string, string> };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.send = (body: unknown) => ((res.body = body), res);
  res.set = (name: string, value: string) => ((res.headers[name] = value), res);
  res.redirect = (code: number, url: string) => ((res.statusCode = code), (res.location = url), res);
  return handler({ params: { 0: key }, query }, res).then(() => res);
}

describe("storage proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageGetSignedUrl.mockResolvedValue("https://bucket.example/signed");
  });

  it("redirects a stored key to a short-lived signed URL without re-decoding it", async () => {
    const res = await call("iwantphoto/uploads/100%25 real photo.jpg");
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("iwantphoto/uploads/100%25 real photo.jpg");
    expect(res.statusCode).toBe(307);
    expect(res.location).toBe("https://bucket.example/signed");
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it.each(["../secret", "a/../../b", "/abs", "a\\b", ""])("rejects unsafe key %j", async key => {
    const res = await call(key);
    expect(res.statusCode).toBe(400);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("serves the bytes from this origin when asked inline (for in-browser editing)", async () => {
    mocks.storageGetBytes.mockResolvedValue({ bytes: new Uint8Array([137, 80, 78, 71]), contentType: "image/png" });
    const res = await call("generated/cutout.png", { inline: "1" });
    expect(mocks.storageGetBytes).toHaveBeenCalledWith("generated/cutout.png");
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/png");
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(Buffer.isBuffer(res.body) && res.body.length).toBe(4);
  });

  it("rejects an unsafe key before reading it inline", async () => {
    const res = await call("../secret", { inline: "1" });
    expect(res.statusCode).toBe(400);
    expect(mocks.storageGetBytes).not.toHaveBeenCalled();
  });
});
