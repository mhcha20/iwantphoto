import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { getManagedStorageKey } from "./storage";

const originalAppBaseUrl = ENV.appBaseUrl;

afterEach(() => {
  ENV.appBaseUrl = originalAppBaseUrl;
  vi.restoreAllMocks();
});

describe("managed storage URL parsing", () => {
  it("accepts only managed storage paths", () => {
    expect(getManagedStorageKey("/manus-storage/iwantphoto/uploads/example%20photo.jpg")).toBe("iwantphoto/uploads/example photo.jpg");
    expect(getManagedStorageKey("https://example.com/image.jpg")).toBeUndefined();
    expect(getManagedStorageKey("https://example.com/manus-storage/external.jpg")).toBeUndefined();
    expect(getManagedStorageKey("/manus-storage/../secrets")).toBeUndefined();
  });

  it("safely rejects malformed storage values rather than leaking a URL parser exception", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getManagedStorageKey("https://[not-a-valid-host")).toBeUndefined();
    expect(getManagedStorageKey("/manus-storage/bad%ZZencoding.jpg")).toBeUndefined();
    expect(warning).toHaveBeenCalled();
  });

  it("uses the canonical origin for a relative managed path when deployment configuration is malformed", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    ENV.appBaseUrl = "iwantphoto.com";

    expect(getManagedStorageKey("/manus-storage/iwantphoto/marketplace/source.jpg")).toBe("iwantphoto/marketplace/source.jpg");
    expect(getManagedStorageKey("https://example.com/manus-storage/external.jpg")).toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("invalid app base URL"));
  });
});
