import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { OAUTH_STATE_COOKIE } from "@shared/const";

const mocks = vi.hoisted(() => ({
  findOrCreateGoogleUser: vi.fn(),
  recordAccountSecurityEvent: vi.fn(),
}));
vi.mock("./db", () => ({
  findOrCreateGoogleUser: mocks.findOrCreateGoogleUser,
  recordAccountSecurityEvent: mocks.recordAccountSecurityEvent,
}));

import { ENV } from "./_core/env";
import { registerOAuthRoutes } from "./_core/oauth";

type Handler = (req: any, res: any) => Promise<void> | void;

function setup() {
  const routes: Record<string, Handler> = {};
  registerOAuthRoutes({ get: (path: string, handler: Handler) => (routes[path] = handler) } as unknown as Express);
  return routes;
}

function makeRes() {
  const res: any = { statusCode: 200, cookies: {} as Record<string, string>, redirectedTo: undefined as string | undefined };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  res.cookie = (name: string, value: string) => ((res.cookies[name] = value), res);
  res.clearCookie = () => res;
  res.redirect = (_code: number, url: string) => ((res.redirectedTo = url), res);
  return res;
}

describe("Google sign-in", () => {
  beforeEach(() => {
    ENV.googleClientId = "client-id";
    ENV.googleClientSecret = "client-secret";
    ENV.cookieSecret = "test-session-secret-at-least-32-bytes-long";
    ENV.appBaseUrl = "https://iwantphoto.com";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("starts login with a state cookie that matches the Google redirect", async () => {
    const res = makeRes();
    await setup()["/api/auth/google"]({ protocol: "https", headers: {} }, res);
    const url = new URL(res.redirectedTo);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://iwantphoto.com/api/oauth/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(res.cookies[OAUTH_STATE_COOKIE]);
  });

  it("rejects a callback whose state does not match the browser cookie", async () => {
    const res = makeRes();
    await setup()["/api/oauth/callback"](
      { query: { code: "c", state: "forged" }, headers: { cookie: `${OAUTH_STATE_COOKIE}=other` } },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(mocks.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it("refuses accounts whose Google email is unverified", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("oauth2.googleapis.com")
        ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
        : new Response(JSON.stringify({ sub: "1", email: "a@example.com", email_verified: false }), { status: 200 }),
    ));
    const res = makeRes();
    await setup()["/api/oauth/callback"](
      { query: { code: "c", state: "s" }, headers: { cookie: `${OAUTH_STATE_COOKIE}=s` } },
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(mocks.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it("signs in a verified Google account and sets the session cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("oauth2.googleapis.com")
        ? new Response(JSON.stringify({ access_token: "tok" }), { status: 200 })
        : new Response(JSON.stringify({ sub: "123", email: "a@example.com", email_verified: true, name: "A" }), { status: 200 }),
    ));
    mocks.findOrCreateGoogleUser.mockResolvedValue({ id: 7, openId: "google:123", name: "A" });
    const res = makeRes();
    await setup()["/api/oauth/callback"](
      { protocol: "https", query: { code: "c", state: "s" }, headers: { cookie: `${OAUTH_STATE_COOKIE}=s` } },
      res,
    );
    expect(mocks.findOrCreateGoogleUser).toHaveBeenCalledWith({ sub: "123", email: "a@example.com", name: "A" });
    expect(res.cookies.app_session_id).toBeTruthy();
    expect(res.redirectedTo).toBe("/");
  });
});
