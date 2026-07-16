import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByEmail, sendMagicLink, sendVerificationCode } = vi.hoisted(
  () => ({
    getUserByEmail: vi.fn(),
    sendMagicLink: vi.fn(),
    sendVerificationCode: vi.fn()
  })
);

vi.mock("@carbon/auth", () => ({
  assertIsPost: vi.fn(),
  CarbonEdition: "community",
  CLOUDFLARE_TURNSTILE_SECRET_KEY: undefined,
  CLOUDFLARE_TURNSTILE_SITE_KEY: undefined,
  CONTROLLED_ENVIRONMENT: false,
  carbonClient: { auth: { signInWithOAuth: vi.fn() } },
  error: vi.fn((value: unknown, message: string) => ({ value, message })),
  isAuthProviderEnabled: vi.fn(() => false),
  magicLinkValidator: {},
  RATE_LIMIT: 5,
  SUPABASE_AUTH_EXTERNAL_AZURE_CLIENT_ID: undefined,
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: undefined
}));

vi.mock("@carbon/auth/auth.server", () => ({
  sendMagicLink,
  signInWithBypassEmail: vi.fn(),
  verifyAuthSession: vi.fn()
}));

vi.mock("@carbon/auth/session.server", () => ({
  clearAuthCookies: vi.fn(),
  flash: vi.fn(),
  getAuthSession: vi.fn(),
  setAuthSession: vi.fn()
}));

vi.mock("@carbon/auth/users.server", () => ({ getUserByEmail }));
vi.mock("@carbon/auth/verification.server", () => ({ sendVerificationCode }));
vi.mock("@carbon/form", () => ({
  Hidden: () => null,
  Input: () => null,
  Submit: () => null,
  ValidatedForm: () => null,
  validator: vi.fn()
}));
vi.mock("@carbon/kv", () => ({ Ratelimit: vi.fn(), redis: {} }));
vi.mock("@carbon/react", () => ({
  Alert: () => null,
  AlertDescription: () => null,
  AlertTitle: () => null,
  Button: () => null,
  Heading: () => null,
  ItarLoginDisclaimer: () => null,
  Separator: () => null,
  toast: { error: vi.fn() },
  useMode: vi.fn(),
  useMount: vi.fn(),
  VStack: () => null
}));
vi.mock("@carbon/utils", () => ({ Edition: { Cloud: "cloud" } }));
vi.mock("@lingui/react/macro", () => ({
  Trans: () => null,
  useLingui: vi.fn()
}));
vi.mock("@marsidev/react-turnstile", () => ({ Turnstile: () => null }));
vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: vi.fn(),
  startAuthentication: vi.fn()
}));
vi.mock("react", () => ({
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useState: vi.fn()
}));
vi.mock("react-icons/lu", () => ({
  LuCircleAlert: () => null,
  LuFingerprint: () => null
}));
vi.mock("react-router", () => ({
  data: (value: Record<string, unknown>, init?: { status?: number }) => ({
    ...value,
    ...init
  }),
  redirect: vi.fn(),
  useFetcher: vi.fn(),
  useLoaderData: vi.fn(),
  useSearchParams: vi.fn()
}));
vi.mock("~/utils/path", () => ({ path: { to: { authenticatedRoot: "/x" } } }));

import { action } from "./login";

describe("ERP email login gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEV_BYPASS_EMAIL;
  });

  it("rejects a direct email POST before any user lookup or email delivery", async () => {
    const response = await action({
      request: new Request("http://localhost/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=user%40example.com"
      })
    } as any);

    expect(response).toMatchObject({ status: 403 });
    expect(getUserByEmail).not.toHaveBeenCalled();
    expect(sendMagicLink).not.toHaveBeenCalled();
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });
});
