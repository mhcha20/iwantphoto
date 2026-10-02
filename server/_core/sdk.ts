import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

// Identifies tokens issued by this app; also keeps pre-migration tokens working
// only while JWT_SECRET is unchanged.
const SESSION_APP_ID = "iwantphoto";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /** Create a signed session token for an account's `openId`. */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession({ openId, appId: SESSION_APP_ID, name: options.name || "" }, options);
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      // `name` may legitimately be empty for accounts without a display name.
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const session = await this.verifySession(cookies[COOKIE_NAME]);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    // `lastSignedIn` is written by the OAuth callback, not on every authenticated
    // request. This keeps the account panel's login timestamp meaningful.
    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    return user;
  }
}

export const sdk = new SDKServer();
