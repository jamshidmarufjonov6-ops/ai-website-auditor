import type { Audit, AuditListItem, DashboardStats, SubscriptionInfo, User } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        message = data.detail;
      } else if (data && typeof data.detail === "object" && data.detail !== null) {
        message = data.detail.message || message;
        code = data.detail.code;
      }
    } catch {
      // keep default message
    }
    throw new ApiError(message, code, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createAudit: (url: string, language: string = "en") =>
    request<Audit>("/api/audits", {
      method: "POST",
      body: JSON.stringify({ url, language }),
    }),

  getAudit: (publicId: string) => request<Audit>(`/api/audits/${publicId}`),

  listAudits: () => request<AuditListItem[]>("/api/audits"),

  getDashboardStats: () => request<DashboardStats>("/api/audits/stats"),

  deleteAudit: (publicId: string) =>
    request<{ ok: boolean }>(`/api/audits/${publicId}`, { method: "DELETE" }),

  register: (email: string, password: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  me: () => request<User>("/api/auth/me"),

  getSubscription: () => request<SubscriptionInfo>("/api/billing/subscription"),

  checkout: () =>
    request<{ url: string }>("/api/billing/checkout", { method: "POST" }),

  portal: () =>
    request<{ url: string }>("/api/billing/portal", { method: "POST" }),
};
