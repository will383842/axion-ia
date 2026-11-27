import { beforeEach, describe, expect, it, vi } from "vitest";

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
}));
vi.mock("@/server/notifications", () => ({ notify: notifyMock }));
vi.mock("@/lib/redis", () => ({
  redis: { set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) },
}));

import { __resetAlerteBlogClaudeMemoire, alerterBlogClaude } from "../anthropic-credit-alert";

describe("libellés des alertes Claude", () => {
  beforeEach(() => {
    notifyMock.mockClear();
    __resetAlerteBlogClaudeMemoire();
  });

  it.each(["credit_refuse", "plafond_jour", "plafond_mois", "seuil_80", "suspendu"] as const)(
    "%s parle de contenu via Claude, pas du blog seul",
    async (type) => {
      await alerterBlogClaude(type);
      const arg = notifyMock.mock.calls[0]?.[0] as { payload: { details: { legacyBody: string } } };
      expect(arg.payload.details.legacyBody).toContain("Contenu via Claude");
      expect(arg.payload.details.legacyBody).not.toContain("Texte du blog");
    },
  );
});
