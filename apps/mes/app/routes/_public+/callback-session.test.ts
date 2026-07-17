import { describe, expect, it } from "vitest";
import { getCallbackCredentials } from "./callback-session";

describe("getCallbackCredentials", () => {
  it("returns the credentials from a completed magic-link session", () => {
    expect(
      getCallbackCredentials({
        refresh_token: "refresh-token",
        user: { id: "user-id" }
      })
    ).toEqual({ refreshToken: "refresh-token", userId: "user-id" });
  });

  it("does not authenticate from an incomplete session", () => {
    expect(getCallbackCredentials(null)).toBeNull();
    expect(getCallbackCredentials({ user: { id: "user-id" } })).toBeNull();
    expect(
      getCallbackCredentials({ refresh_token: "refresh-token" })
    ).toBeNull();
  });
});
