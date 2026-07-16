import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateOAuthCallback,
  setAuthSession,
  destroyAuthSession,
  getCompanies,
  getEmployeeCompanies
} = vi.hoisted(() => ({
  validateOAuthCallback: vi.fn(),
  setAuthSession: vi.fn(),
  destroyAuthSession: vi.fn(),
  getCompanies: vi.fn(),
  getEmployeeCompanies: vi.fn()
}));

vi.mock("@carbon/auth", () => ({
  assertIsPost: vi.fn(),
  callbackValidator: {},
  carbonClient: { auth: { setSession: vi.fn() } },
  error: vi.fn(),
  safeRedirect: vi.fn()
}));

vi.mock("@carbon/auth/auth.server", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    userId: "user-1",
    email: "user@example.com",
    companyId: "",
    companyGroupId: "",
    expiresIn: 3600,
    expiresAt: 9_999_999_999
  }),
  validateOAuthCallback
}));

vi.mock("@carbon/auth/client.server", () => ({
  getCarbonServiceRole: vi.fn()
}));

vi.mock("@carbon/auth/company.server", () => ({
  getCompanyId: vi.fn(),
  setCompanyId: vi.fn()
}));

vi.mock("@carbon/auth/session.server", () => ({
  destroyAuthSession,
  flash: vi.fn(),
  getAuthSession: vi.fn(),
  setAuthSession
}));

vi.mock("@carbon/auth/users.server", () => ({ getUserByEmail: vi.fn() }));

vi.mock("@carbon/form", () => ({
  validator: () => ({
    validate: vi.fn().mockResolvedValue({
      data: { refreshToken: "refresh-token", redirectTo: "/x" }
    })
  })
}));

vi.mock("@carbon/react", () => ({
  Alert: () => null,
  AlertDescription: () => null,
  AlertTitle: () => null,
  LoadingBars: () => null,
  VStack: () => null
}));

vi.mock("@lingui/react/macro", () => ({ Trans: () => null }));
vi.mock("react-icons/lu", () => ({ LuTriangleAlert: () => null }));

vi.mock("react-router", () => ({
  data: vi.fn(),
  redirect: vi.fn(),
  useFetcher: vi.fn(),
  useLocation: vi.fn(),
  useSearchParams: vi.fn()
}));

vi.mock("~/modules/settings", () => ({
  getCompanies,
  getEmployeeCompanies
}));
vi.mock("~/utils/path", () => ({ path: { to: { authenticatedRoot: "/x" } } }));

import { action } from "./callback";

describe("ERP OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateOAuthCallback.mockResolvedValue({
      allowed: false,
      reason: "non_oauth"
    });
    destroyAuthSession.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it("does not resolve companies or create a Carbon session after OAuth denial", async () => {
    await expect(
      action({
        request: new Request("http://localhost/callback", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "refreshToken=refresh-token"
        })
      } as any)
    ).rejects.toMatchObject({ status: 302 });

    expect(destroyAuthSession).toHaveBeenCalledOnce();
    expect(getEmployeeCompanies).not.toHaveBeenCalled();
    expect(getCompanies).not.toHaveBeenCalled();
    expect(setAuthSession).not.toHaveBeenCalled();
  });
});
