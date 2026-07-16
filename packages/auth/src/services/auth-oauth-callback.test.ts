import { beforeEach, describe, expect, it, vi } from "vitest";

let emailAuthEnabled = false;
let edition = "community";
let claimsResult: { data: unknown; error: unknown };
let userResult: { data: unknown; error: unknown };
let membershipResult: { data: unknown[]; error: unknown };
let inviteResult: { data: unknown[]; error: unknown };

vi.mock("../config/env", () => ({
  get CarbonEdition() {
    return edition;
  },
  REFRESH_ACCESS_TOKEN_THRESHOLD: 60,
  STRIPE_BYPASS_COMPANY_IDS: [],
  VERCEL_URL: "",
  isAuthProviderEnabled: (provider: string) =>
    provider === "email" && emailAuthEnabled
}));

vi.mock("../lib/supabase", () => ({
  getCarbon: () => ({
    auth: {
      getClaims: vi.fn(() => claimsResult)
    }
  })
}));

vi.mock("../lib/supabase/client", () => ({
  getCarbonAPIKeyClient: vi.fn()
}));

vi.mock("../lib/supabase/client.server", () => ({
  getCarbonServiceRole: () => ({
    from: (table: string) => {
      if (table === "user") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => userResult })
          })
        };
      }

      if (table === "userToCompany") {
        return {
          select: () => ({ eq: () => ({ limit: () => membershipResult }) })
        };
      }

      return {
        select: () => ({
          eq: () => ({
            is: () => ({ is: () => ({ limit: () => inviteResult }) })
          })
        })
      };
    }
  })
}));

vi.mock("./company.server", () => ({
  isCarbonOwnedCompany: vi.fn()
}));

vi.mock("./session.server", () => ({
  destroyAuthSession: vi.fn(),
  flash: vi.fn(),
  requireAuthSession: vi.fn()
}));

vi.mock("./users", () => ({ getCompaniesForUser: vi.fn() }));
vi.mock("./users.server", () => ({ getUserClaims: vi.fn() }));

import { validateOAuthCallback } from "./auth.server";

const authSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  userId: "user-1",
  email: "user@example.com",
  companyId: "",
  companyGroupId: "",
  expiresIn: 3600,
  expiresAt: 9_999_999_999
};

beforeEach(() => {
  emailAuthEnabled = false;
  edition = "community";
  claimsResult = {
    data: {
      claims: { sub: "user-1", amr: [{ method: "oauth" }] }
    },
    error: null
  };
  userResult = {
    data: { id: "user-1", email: "user@example.com", active: true },
    error: null
  };
  membershipResult = { data: [], error: null };
  inviteResult = { data: [], error: null };
});

describe("validateOAuthCallback", () => {
  it("allows a verified OAuth session for a Community user", async () => {
    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: true
    });
  });

  it("rejects a non-OAuth session while email auth is disabled", async () => {
    claimsResult = {
      data: {
        claims: { sub: "user-1", amr: [{ method: "password" }] }
      },
      error: null
    };

    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: false,
      reason: "non_oauth"
    });
  });

  it("rejects invalid verified claims before looking up authorization", async () => {
    claimsResult = { data: { claims: null }, error: new Error("expired") };

    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: false,
      reason: "invalid_claims"
    });
  });

  it("denies an unprovisioned Enterprise user", async () => {
    edition = "enterprise";

    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: false,
      reason: "enterprise_unprovisioned"
    });
  });

  it("allows an Enterprise user with a pending invite", async () => {
    edition = "enterprise";
    inviteResult = { data: [{ id: "invite-1" }], error: null };

    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: true
    });
  });

  it("allows a non-OAuth callback again when email rollback is enabled", async () => {
    emailAuthEnabled = true;
    claimsResult = {
      data: {
        claims: { sub: "user-1", amr: [{ method: "magiclink" }] }
      },
      error: null
    };

    await expect(validateOAuthCallback(authSession)).resolves.toEqual({
      allowed: true
    });
  });
});
