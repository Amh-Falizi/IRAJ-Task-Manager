/**
 * Global HTTP client with 401 Unauthorized handling, credentials handling, and type safety
 */

type UnauthorizedCallback = () => void;
const unauthorizedListeners: Set<UnauthorizedCallback> = new Set();

export function onUnauthorized(callback: UnauthorizedCallback): () => void {
  unauthorizedListeners.add(callback);
  return () => {
    unauthorizedListeners.delete(callback);
  };
}

export function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("[API] Error in onUnauthorized listener:", err);
    }
  });
}

export interface RequestOptions extends RequestInit {
  skipAuthRedirect?: boolean;
}

export async function apiFetchRaw(url: string, options: RequestOptions = {}): Promise<Response> {
  const { skipAuthRedirect = false, headers = {}, ...rest } = options;

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(headers as Record<string, string>)
    }
  });

  if (response.status === 401) {
    if (!skipAuthRedirect && !url.includes("/api/auth/login") && !url.includes("/api/auth/me") && !url.includes("/api/auth/logout")) {
      notifyUnauthorized();
    }
  }

  return response;
}
