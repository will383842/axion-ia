// Hub notifications — channel Sentry breadcrumb (Sprint Notif Infra 2026-05-26).
//
// Pour severity ≥ error, on ajoute un breadcrumb + capture exception si critical.
// Aucune dépendance dure (import dynamique pour éviter d'alourdir le bundle
// edge / build avec Sentry quand non utilisé).

import type { NotificationCategory, NotificationSeverity } from "../types";

type SentryModule = {
  addBreadcrumb: (b: {
    category?: string;
    message?: string;
    level?: "info" | "warning" | "error" | "fatal";
    data?: Record<string, unknown>;
  }) => void;
  captureMessage: (
    message: string,
    options: { level: "info" | "warning" | "error" | "fatal" },
  ) => void;
};

let sentryCache: SentryModule | null | undefined;

async function loadSentry(): Promise<SentryModule | null> {
  if (sentryCache !== undefined) return sentryCache;
  try {
    const mod = (await import("@sentry/nextjs")) as unknown as SentryModule;
    sentryCache = mod;
    return mod;
  } catch {
    sentryCache = null;
    return null;
  }
}

function sentryLevel(severity: NotificationSeverity): "info" | "warning" | "error" | "fatal" {
  switch (severity) {
    case "info":
      return "info";
    case "warn":
      return "warning";
    case "error":
      return "error";
    case "critical":
      return "fatal";
  }
}

export async function sendSentryBreadcrumb(
  category: NotificationCategory,
  severity: NotificationSeverity,
  message: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  const sentry = await loadSentry();
  if (!sentry) return false;
  const level = sentryLevel(severity);
  try {
    sentry.addBreadcrumb({
      category: `notif:${category}`,
      message,
      level,
      ...(data ? { data } : {}),
    });
    if (severity === "error" || severity === "critical") {
      sentry.captureMessage(`[${category}] ${message}`, { level });
    }
    return true;
  } catch {
    return false;
  }
}
