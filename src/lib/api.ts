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

export async function apiFetch<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect = false, headers = {}, ...rest } = options;

  const defaultHeaders: Record<string, string> = {
    "Accept": "application/json"
  };

  if (rest.body && typeof rest.body === "string" && !("Content-Type" in (headers as Record<string, string>))) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...(headers as Record<string, string>)
    }
  });

  if (response.status === 401) {
    if (!skipAuthRedirect && !url.includes("/api/auth/login") && !url.includes("/api/auth/me")) {
      notifyUnauthorized();
    }
  }

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } else {
        const text = await response.text();
        if (text) errorMessage = text;
      }
    } catch {
      // ignore parse error
    }
    const err = new Error(errorMessage);
    (err as any).status = response.status;
    throw err;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export const api = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    apiFetch<T>(url, { method: "GET", ...options }),
  post: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    apiFetch<T>(url, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options
    }),
  put: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    apiFetch<T>(url, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options
    }),
  patch: <T = any>(url: string, data?: any, options?: RequestOptions) =>
    apiFetch<T>(url, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options
    }),
  delete: <T = any>(url: string, options?: RequestOptions) =>
    apiFetch<T>(url, { method: "DELETE", ...options })
};
