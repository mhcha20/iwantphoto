import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const mocks = vi.hoisted(() => ({ storageGetSignedUrl: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl }));

import { registerStorageProxy } from "./_core/storageProxy";

function call(key: string) {
  let handler: (req: any, res: any) => Promise<void> = async () => undefined;
  registerStorageProxy({ get: (_path: string, h: typeof handler) => (handler = h) } as unknown as Express);
  const res: any = { statusCode: 200, headers: {} as Record<string, string> };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.send = () => res;
  res.set = (name: string, value: string) => ((res.headers[name] = value), res);
  res.redirect = (code: number, url: string) => ((res.statusCode = code), (res.location = url), res);
  return handler({ params: { 0: key } }, res).then(() => res);
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
});
