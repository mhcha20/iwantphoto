import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";

const mocks = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("./db", () => ({
  getUserByOpenId: mocks.getUserByOpenId,
  upsertUser: mocks.upsertUser,
}));

import { sdk } from "./_core/sdk";

describe("SDK authenticated account lookup", () => {
  it("does not overwrite OAuth-recorded lastSignedIn on ordinary requests", async () => {
    const recordedSignIn = new Date("2026-09-20T00:00:00.000Z");
    mocks.getUserByOpenId.mockResolvedValue({
      id: 42,
      openId: "account-owner",
      name: "Account owner",
      displayName: "工作台名稱",
      email: "owner@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: recordedSignIn,
      updatedAt: recordedSignIn,
      lastSignedIn: recordedSignIn,
    });

    const token = await sdk.createSessionToken("account-owner", { name: "Account owner" });
    const user = await sdk.authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${token}` } } as Request);

    expect(user.lastSignedIn).toEqual(recordedSignIn);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
  });
});
