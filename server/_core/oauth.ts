import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REQUEST_TIMEOUT_MS = 15_000;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getRedirectUri() {
  return `${ENV.appBaseUrl.replace(/\/+$/, "")}/api/oauth/callback`;
}

type GoogleUserInfo = { sub?: string; email?: string; email_verified?: boolean; name?: string };

export function registerOAuthRoutes(app: Express) {
  // Step 1: bind the login to this browser with a one-time nonce cookie, then go to Google.
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      res.status(503).json({ error: "Google sign-in is not configured" });
      return;
    }
    const state = randomBytes(24).toString("base64url");
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: getSessionCookieOptions(req).secure,
      maxAge: 10 * 60 * 1000,
    });
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", getRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  // Step 2: Google redirects back here.
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: `state` must match the one-time cookie set when this browser started the login.
    const expectedState = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!expectedState || state !== expectedState) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    try {
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: getRedirectUri(),
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!tokenResponse.ok) {
        console.error("[OAuth] Google token exchange failed", tokenResponse.status);
        res.status(502).json({ error: "Google sign-in failed" });
        return;
      }
      const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
      if (!accessToken) {
        res.status(502).json({ error: "Google sign-in failed" });
        return;
      }

      const infoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!infoResponse.ok) {
        res.status(502).json({ error: "Google sign-in failed" });
        return;
      }
      const info = (await infoResponse.json()) as GoogleUserInfo;
      if (!info.sub || !info.email || info.email_verified !== true) {
        res.status(403).json({ error: "A verified Google email is required" });
        return;
      }

      const user = await db.findOrCreateGoogleUser({ sub: info.sub, email: info.email, name: info.name });
      try {
        await db.recordAccountSecurityEvent(user.id, "signed_in", "已透過 Google 登入");
      } catch (activityError) {
        console.warn("[OAuth] Unable to record sign-in activity", activityError);
      }

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
