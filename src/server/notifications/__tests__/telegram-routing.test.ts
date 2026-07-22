// Tests routage Telegram 3 groupes (refonte 2026-07-09).

import { describe, it, expect, afterEach } from "vitest";
import { telegramGroupFor, resolveTelegramChatId } from "../routing";
import type { NotificationCategory } from "../types";

describe("telegramGroupFor", () => {
  it("📅 RDV : booking / option / calendly", () => {
    const cats: NotificationCategory[] = [
      "BOOKING_CREATED",
      "BOOKING_CANCELLED",
      "OPTION_POSTED",
      "OPTION_CONFIRMED",
      "OPTION_REFUSED",
      "OPTION_EXPIRED",
      "CALENDLY_INVITEE_CREATED",
      "CALENDLY_INVITEE_CANCELED",
      "CALENDLY_INVITEE_RESCHEDULED",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("rdv");
  });

  it("💬 Messages : formulaires + leads entrants", () => {
    const cats: NotificationCategory[] = [
      "CONTACT_FORM_SUBMITTED",
      "AUDIT_REQUEST_SUBMITTED",
      "INTERVENTION_REQUEST_SUBMITTED",
      "IMPLEMENTATION_REQUEST_SUBMITTED",
      "QUOTE_REQUEST_RECEIVED",
      "PRESS_REQUEST_SUBMITTED",
      "RECRUITMENT_RECEIVED",
      "JOB_APPLICATION_RECEIVED",
      "SPEAKER_INVITATION_RECEIVED",
      "INVESTOR_INQUIRY_RECEIVED",
      "CUSTOMER_SUPPORT_REQUEST",
      "PODCAST_REQUEST_SUBMITTED",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("messages");
  });

  it("🔔 Système par défaut : newsletter / avis / ops", () => {
    const cats: NotificationCategory[] = [
      "NEWSLETTER_PENDING",
      "NEWSLETTER_CONFIRMED",
      "REVIEW_SUBMITTED",
      "BACKUP_FAILED",
      "INCIDENT_DETECTED",
      "SECURITY_ALERT",
      "STRIPE_EVENT",
      "MONITORING_ALERT",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("system");
  });
});

describe("resolveTelegramChatId", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("utilise le chat_id dédié du groupe si présent", () => {
    process.env.TELEGRAM_CHAT_ID_RDV = "-5593259999";
    expect(resolveTelegramChatId("rdv")).toBe("-5593259999");
  });

  it("fallback sur TELEGRAM_CHAT_ID si le groupe n'a pas de chat_id", () => {
    delete process.env.TELEGRAM_CHAT_ID_MESSAGES;
    process.env.TELEGRAM_CHAT_ID = "-999";
    expect(resolveTelegramChatId("messages")).toBe("-999");
  });
});
