// Tests routing.ts — table channels/severity par catégorie (Sprint Notif Infra 2026-05-26).

import { describe, it, expect } from "vitest";
import { getRouting, shouldDispatchAsync } from "../routing";

describe("getRouting", () => {
  it("CONTACT_FORM_SUBMITTED → telegram info", () => {
    const r = getRouting("CONTACT_FORM_SUBMITTED");
    expect(r.channels).toEqual(["telegram"]);
    expect(r.severity).toBe("info");
  });

  it("BACKUP_FAILED → telegram + sentry, critical", () => {
    const r = getRouting("BACKUP_FAILED");
    expect(r.channels).toContain("telegram");
    expect(r.channels).toContain("sentry");
    expect(r.severity).toBe("critical");
  });

  it("ADMIN_REPLIED_TO_SUBMISSION → aucun canal (décision Will figée)", () => {
    const r = getRouting("ADMIN_REPLIED_TO_SUBMISSION");
    expect(r.channels).toEqual([]);
  });

  it("SECURITY_ALERT applique rate-limit horaire", () => {
    const r = getRouting("SECURITY_ALERT");
    expect(r.rateLimitPerHour).toBeGreaterThan(0);
  });
});

describe("shouldDispatchAsync", () => {
  it("dispatche sync pour info/warn", () => {
    expect(shouldDispatchAsync("info")).toBe(false);
    expect(shouldDispatchAsync("warn")).toBe(false);
  });
  it("dispatche async pour error/critical", () => {
    expect(shouldDispatchAsync("error")).toBe(true);
    expect(shouldDispatchAsync("critical")).toBe(true);
  });
});
