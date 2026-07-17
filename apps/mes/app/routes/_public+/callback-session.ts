type CallbackSession =
  | {
      refresh_token?: string | null;
      user?: { id?: string | null } | null;
    }
  | null
  | undefined;

export function getCallbackCredentials(session: CallbackSession) {
  const refreshToken = session?.refresh_token;
  const userId = session?.user?.id;

  return refreshToken && userId ? { refreshToken, userId } : null;
}
