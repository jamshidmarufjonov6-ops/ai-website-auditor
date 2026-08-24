import type { AdminMessagesResponse, Audit, AuditListItem, CreditsInfo, DashboardStats, MessageStatus, User } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const TOKEN_KEY = "auditor_token";
const PENDING_AUDIT_URL_KEY = "pending_audit_url";

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

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return Boolean(getToken());
}

export function setPendingAuditUrl(url: string): void {
  window.localStorage.setItem(PENDING_AUDIT_URL_KEY, url);
}

export function getPendingAuditUrl(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_AUDIT_URL_KEY);
}

export function clearPendingAuditUrl(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_AUDIT_URL_KEY);
}

function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers,
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

  getAuditByShareId: (shareId: string) => request<Audit>(`/api/audits/shared/${shareId}`),

  listAudits: () => request<AuditListItem[]>("/api/audits"),

  getDashboardStats: () => request<DashboardStats>("/api/audits/stats"),

  getCredits: () => request<CreditsInfo>("/api/billing/credits"),

  checkout: () => request<{ url: string }>("/api/billing/checkout", { method: "POST" }),

  deleteAudit: (publicId: string) =>
    request<{ ok: boolean }>(`/api/audits/${publicId}`, { method: "DELETE" }),

  register: async (email: string, password: string): Promise<User> => {
    const data = await request<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
  },

  login: async (email: string, password: string): Promise<User> => {
    const data = await request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
  },

  logout: async (): Promise<void> => {
    try {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      clearToken();
    }
  },

  me: () => request<User>("/api/auth/me"),

  // ---- Contact / support ----

  contact: (payload: { name: string; email: string; subject: string; message: string }) =>
    request<{ ok: boolean; id: string; delivered: boolean }>("/api/support/contact", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listAdminMessages: () =>
    request<AdminMessagesResponse>("/api/support/admin/messages"),

  updateMessageStatus: (id: string, status: MessageStatus) =>
    request<{ ok: boolean }>(`/api/support/admin/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  deleteMessage: (id: string) =>
    request<{ ok: boolean }>(`/api/support/admin/messages/${id}`, { method: "DELETE" }),
};
