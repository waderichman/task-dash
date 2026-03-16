function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getApiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return value ? trimTrailingSlash(value) : null;
}

export function requireApiBaseUrl() {
  const value = getApiBaseUrl();
  if (!value) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL.");
  }

  return value;
}

export async function postJson<TResponse>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${requireApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as
    | TResponse
    | {
        error?: string;
      };

  if (!response.ok) {
    throw new Error(
      typeof payload === "object" && payload && "error" in payload && payload.error
        ? payload.error
        : "Request failed"
    );
  }

  return payload as TResponse;
}
