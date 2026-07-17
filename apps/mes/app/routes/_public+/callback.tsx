import {
  assertIsPost,
  callbackValidator,
  carbonClient,
  error
} from "@carbon/auth";
import { refreshAccessToken } from "@carbon/auth/auth.server";
import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { setCompanyId } from "@carbon/auth/company.server";
import {
  destroyAuthSession,
  flash,
  getAuthSession,
  setAuthSession
} from "@carbon/auth/session.server";
import { getUserByEmail } from "@carbon/auth/users.server";
import { validator } from "@carbon/form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  LoadingBars,
  VStack
} from "@carbon/react";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, Link, redirect, useFetcher, useLocation } from "react-router";
import { path } from "~/utils/path";
import { getCallbackCredentials } from "./callback-session";

export async function loader({ request }: LoaderFunctionArgs) {
  const authSession = await getAuthSession(request);

  if (authSession) await destroyAuthSession(request);

  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");

  if (tokenHash && url.searchParams.get("type") === "magiclink") {
    const { data: verification, error: verificationError } =
      await getCarbonServiceRole().auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink"
      });

    if (verificationError || !verification.session) {
      return redirect(
        path.to.root,
        await flash(request, error(verificationError, "Invalid magic link"))
      );
    }

    const formData = new FormData();
    formData.append("refreshToken", verification.session.refresh_token);
    formData.append("userId", verification.session.user.id);

    return action({
      request: new Request(request, { method: "POST", body: formData })
    } as ActionFunctionArgs);
  }

  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  assertIsPost(request);

  const validation = await validator(callbackValidator).validate(
    await request.formData()
  );

  if (validation.error) {
    return data(error(validation.error, "Invalid callback form"), {
      status: 400
    });
  }

  const { refreshToken, userId } = validation.data;
  const serviceRole = getCarbonServiceRole();
  const companies = await serviceRole
    .from("userToCompany")
    .select("companyId, ...company(companyGroupId)")
    .eq("userId", userId);

  const firstCompany = companies.data?.[0] as
    | { companyId: string; companyGroupId: string | null }
    | undefined;
  const companyId = firstCompany?.companyId;
  const companyGroupId = firstCompany?.companyGroupId ?? "";

  const authSession = await refreshAccessToken(
    refreshToken,
    companyId,
    companyGroupId
  );

  if (!authSession) {
    return redirect(
      path.to.root,
      await flash(request, error(authSession, "Invalid refresh token"))
    );
  }

  const user = await getUserByEmail(authSession.email);

  if (user?.data) {
    const sessionCookie = await setAuthSession(request, {
      authSession
    });
    const companyIdCookie = setCompanyId(authSession.companyId);
    return redirect(path.to.authenticatedRoot, {
      headers: [
        ["Set-Cookie", sessionCookie],
        ["Set-Cookie", companyIdCookie]
      ]
    });
  } else {
    return redirect(
      path.to.root,
      await flash(request, error(user.error, "User not found"))
    );
  }
}

export default function AuthCallback() {
  const fetcher = useFetcher<{}>();
  const isAuthenticating = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const { hash } = useLocation();

  useEffect(() => {
    const hashParams = new URLSearchParams(hash.slice(1));
    const errorDescription = hashParams.get("error_description");
    if (errorDescription) {
      setError(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
    }
  }, [hash]);

  useEffect(() => {
    const submitSession = (
      session: Parameters<typeof getCallbackCredentials>[0]
    ) => {
      if (isAuthenticating.current) return;

      const credentials = getCallbackCredentials(session);
      if (!credentials) return;

      isAuthenticating.current = true;

      const formData = new FormData();
      formData.append("refreshToken", credentials.refreshToken);
      formData.append("userId", credentials.userId);

      fetcher.submit(formData, { method: "post" });
    };

    const {
      data: { subscription }
    } = carbonClient.auth.onAuthStateChange((event, session) => {
      if (
        ["SIGNED_IN", "INITIAL_SESSION"].includes(event) &&
        !isAuthenticating.current
      ) {
        submitSession(session);
      }
    });

    void carbonClient.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        submitSession(data.session);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetcher]);

  return (
    <div className="flex flex-col items-center justify-center">
      {error ? (
        <div className="rounded-lg md:bg-card md:border md:border-border md:shadow-lg p-8 mt-8 w-[380px]">
          <VStack spacing={4}>
            <Alert variant="destructive">
              <LuTriangleAlert className="h-4 w-4" />
              <AlertTitle>
                <Trans>Error</Trans>
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            {error.includes("expired") && (
              <>
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    But don't worry. You can use the forgot password flow to
                    request a new magic link.
                  </Trans>
                </p>
                <Button size="lg" asChild className="w-full">
                  <Link to={path.to.login}>
                    <Trans>Login</Trans>
                  </Link>
                </Button>
              </>
            )}
          </VStack>
        </div>
      ) : (
        <LoadingBars />
      )}
    </div>
  );
}
