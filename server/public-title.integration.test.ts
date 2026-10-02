import { describe, expect, it } from "vitest";

const AUTH_ME_ENDPOINT =
  "http://127.0.0.1:3000/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%7D%7D";

describe("public Iwantphoto application title", () => {
  it("uses Iwantphoto while the public authentication endpoint remains available", async () => {
    expect(process.env.VITE_APP_TITLE).toBe("Iwantphoto");

    const response = await fetch(AUTH_ME_ENDPOINT);
    expect(response.ok).toBe(true);
  });
});
