const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Request failed");
  }

  return data as T;
}

export interface User {
  id: string;
  email: string;
  totpEnabled: boolean;
  createdAt: string;
}

export type LoginResult =
  | { twoFactorRequired: true; twoFactorToken: string }
  | { twoFactorRequired?: false; accessToken: string };

export function register(email: string, password: string) {
  return request<{ accessToken: string }>("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export function login(email: string, password: string) {
  return request<LoginResult>("/auth/login", { method: "POST", body: { email, password } });
}

export function verifyTwoFactor(twoFactorToken: string, code: string) {
  return request<{ accessToken: string }>("/auth/2fa/verify", {
    method: "POST",
    body: { twoFactorToken, code },
  });
}

export function refresh() {
  return request<{ accessToken: string }>("/auth/refresh", { method: "POST" });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

export function me(accessToken: string) {
  return request<User>("/auth/me", { accessToken });
}

export function setupTwoFactor(accessToken: string) {
  return request<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup", {
    method: "POST",
    accessToken,
  });
}

export function enableTwoFactor(accessToken: string, code: string) {
  return request<void>("/auth/2fa/enable", { method: "POST", accessToken, body: { code } });
}

export function disableTwoFactor(accessToken: string, code: string) {
  return request<void>("/auth/2fa/disable", { method: "POST", accessToken, body: { code } });
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>("/auth/password-reset/request", {
    method: "POST",
    body: { email },
  });
}

export function confirmPasswordReset(token: string, password: string) {
  return request<{ message: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: { token, password },
  });
}
