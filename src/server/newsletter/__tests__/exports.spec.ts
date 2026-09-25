// @vitest-environment node
//
// Les deux fichiers de l'outil de lettres (lot L3) : l'import MailWizz des
// confirmés éligibles, et la liste de suppression — sans aucune adresse.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  subFindMany: vi.fn(),
  oppositions: vi.fn(),
  emailLogs: vi.fn(),
  guides: vi.fn(),
  activity: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: { findMany: (...a: unknown[]) => d.subFindMany(...a) },
    emailOpposition: { findMany: (...a: unknown[]) => d.oppositions(...a) },
    emailLog: { findMany: (...a: unknown[]) => d.emailLogs(...a) },
    guideRequest: { findMany: (...a: unknown[]) => d.guides(...a) },
    activityLog: { findMany: (...a: unknown[]) => d.activity(...a) },
  },
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  COLONNES_MAILWIZZ,
  celluleCsv,
  empreinteSha256,
  exporterAbonnesMailwizz,
  exporterListeSuppression,
} from "../exports";

const SITE = "https://site.example.invalid";
const CONFIRMEE = {
  email: "confirmee@example.invalid",
  locale: "fr",
  source: "guide-ia",
  confirmedAt: new Date("2026-09-01T08:00:00Z"),
  consentVersion: "lettre-guide-v1",
  unsubscribeToken: "a".repeat(64),
};

beforeEach(() => {
  vi.clearAllMocks();
  d.subFindMany.mockResolvedValue([CONFIRMEE]);
  d.oppositions.mockResolvedValue([]);
  d.emailLogs.mockResolvedValue([]);
  d.guides.mockResolvedValue([]);
  d.activity.mockResolvedValue([]);
});

describe("export MailWizz", () => {
  it("en-têtes = étiquettes MailWizz, dans l'ordre du contrat", async () => {
    const r = await exporterAbonnesMailwizz({}, SITE);
    expect(r.csv.split("\r\n")[0]).toBe(
      "EMAIL,LOCALE,SOURCE,OPTIN_AT,OPTIN_VERSION,UNSUB_URL,GUIDE",
    );
    expect(COLONNES_MAILWIZZ).toHaveLength(7);
  });

  it("une ligne complète : adresse, preuve, lien de désinscription public, guide oui/non", async () => {
    d.guides.mockResolvedValue([{ emailKey: hashEmailForLookup(CONFIRMEE.email) }]);
    const r = await exporterAbonnesMailwizz({}, SITE);
    expect(r.lignes).toBe(1);
    expect(r.csv.split("\r\n")[1]).toBe(
      [
        CONFIRMEE.email,
        "fr",
        "guide-ia",
        "2026-09-01T08:00:00.000Z",
        "lettre-guide-v1",
        `${SITE}/api/unsubscribe?token=${"a".repeat(64)}`,
        "oui",
      ].join(","),
    );
  });

  it("🔴 un `pending` n'est jamais exporté : le statut `confirmed` est posé en dur", async () => {
    await exporterAbonnesMailwizz({ locale: "fr", source: "guide-ia", search: "conf" }, SITE);
    const where = (d.subFindMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where["status"]).toBe("confirmed");
    // Les filtres de l'écran s'appliquent aussi (le fichier = ce que l'écran montre).
    expect(where).toMatchObject({ locale: "fr", source: "guide-ia" });
    expect(where["email"]).toMatchObject({ contains: "conf" });
  });

  it("un confirmé OPPOSÉ ou en REBOND DUR est écarté, et le compte le dit", async () => {
    const opposee = { ...CONFIRMEE, email: "opposee@example.invalid" };
    const morte = { ...CONFIRMEE, email: "morte@example.invalid" };
    d.subFindMany.mockResolvedValue([CONFIRMEE, opposee, morte]);
    d.oppositions.mockResolvedValue([{ emailHash: hashEmailForLookup(opposee.email) }]);
    d.emailLogs.mockResolvedValue([{ recipient: morte.email }]);

    const r = await exporterAbonnesMailwizz({}, SITE);
    expect(r.lignes).toBe(1);
    expect(r.ecartes).toBe(2);
    expect(r.csv).toContain(CONFIRMEE.email);
    expect(r.csv).not.toContain(opposee.email);
    expect(r.csv).not.toContain(morte.email);
  });

  it("sans jeton de désabonnement, aucune lettre ne pourrait porter de lien : écarté", async () => {
    d.subFindMany.mockResolvedValue([{ ...CONFIRMEE, unsubscribeToken: null }]);
    const r = await exporterAbonnesMailwizz({}, SITE);
    expect(r.lignes).toBe(0);
    expect(r.ecartes).toBe(1);
  });

  it("inscription antérieure sans version : repli sur la version historique", async () => {
    d.subFindMany.mockResolvedValue([{ ...CONFIRMEE, consentVersion: null }]);
    const r = await exporterAbonnesMailwizz({}, SITE);
    expect(r.csv).toContain("newsletter-v1-2026-08-13");
  });
});

describe("liste de suppression", () => {
  it("🔴 aucune adresse : seulement des empreintes SHA-256, un motif, une date", async () => {
    d.subFindMany.mockResolvedValue([
      {
        email: "partie@example.invalid",
        status: "unsubscribed",
        unsubscribedAt: new Date("2026-09-10T00:00:00Z"),
        updatedAt: new Date("2026-09-10T00:00:00Z"),
      },
      {
        email: "rejetee@example.invalid",
        status: "bounced",
        unsubscribedAt: null,
        updatedAt: new Date("2026-09-11T00:00:00Z"),
      },
    ]);
    d.emailLogs.mockResolvedValue([
      { recipient: "boite-morte@example.invalid", bouncedAt: new Date("2026-09-12T00:00:00Z") },
      // Déjà pseudonymisée par un effacement : ce n'est plus une adresse.
      { recipient: "erased:0123456789abcdef@erased.local", bouncedAt: null },
    ]);
    d.activity.mockResolvedValue([
      { changes: { emailHash: empreinteSha256("effacee@example.invalid") }, createdAt: new Date() },
      { changes: { emailHash: "pas-une-empreinte" }, createdAt: new Date() },
    ]);

    const r = await exporterListeSuppression();
    expect(r.csv).not.toContain("@");
    const lignes = r.csv.trim().split("\r\n");
    expect(lignes[0]).toBe("EMAIL_SHA256,MOTIF,DEPUIS");
    expect(lignes.slice(1).map((l) => l.split(",")[1])).toEqual([
      "desabonne",
      "rejete",
      "rebond_dur",
      "efface",
    ]);
    for (const l of lignes.slice(1)) expect(l.split(",")[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(lignes[1]!.split(",")[0]).toBe(empreinteSha256("partie@example.invalid"));
  });

  it("l'empreinte est celle de l'adresse NORMALISÉE (casse, espaces)", () => {
    expect(empreinteSha256("  Partie@Example.Invalid ")).toBe(
      empreinteSha256("partie@example.invalid"),
    );
  });

  it("une même personne n'apparaît qu'une fois", async () => {
    d.subFindMany.mockResolvedValue([
      {
        email: "x@example.invalid",
        status: "bounced",
        unsubscribedAt: null,
        updatedAt: new Date(),
      },
    ]);
    d.emailLogs.mockResolvedValue([{ recipient: "X@example.invalid", bouncedAt: new Date() }]);
    const r = await exporterListeSuppression();
    expect(r.lignes).toBe(1);
  });
});

describe("cellule CSV", () => {
  it("échappe virgules et guillemets, neutralise une formule de tableur", () => {
    expect(celluleCsv('a,"b"')).toBe('"a,""b"""');
    expect(celluleCsv("=SOMME(A1)")).toBe("'=SOMME(A1)");
    expect(celluleCsv(null)).toBe("");
  });
});
