// @vitest-environment node
// I3-1 : chargeur des réponses écrites à la main (demandes et candidatures).
// Données de personnes : droits par source, jamais de corps dans une liste, jamais de
// recherche SQL sur une adresse chiffrée, HTML toujours masqué à la lecture.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  subFindMany: vi.fn(),
  subFindUnique: vi.fn(),
  subCount: vi.fn(),
  jobFindMany: vi.fn(),
  jobFindUnique: vi.fn(),
  jobCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionReply: {
      findMany: h.subFindMany,
      findUnique: h.subFindUnique,
      count: h.subCount,
    },
    jobApplicationReply: {
      findMany: h.jobFindMany,
      findUnique: h.jobFindUnique,
      count: h.jobCount,
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v === null ? v : v.replace(/^chiffre:/, "")),
}));

import {
  lireReponseManuelle,
  listerReponsesManuelles,
} from "@/features/admin-emails/reponses-manuelles";

const ligneDemande = (id: string, quand: string) => ({
  id,
  submissionId: "11111111-1111-4111-8111-111111111111",
  repliedAt: new Date(quand),
  repliedByName: "Le fondateur",
  toEmail: "chiffre:alice@example.invalid",
  subject: `Objet ${id}`,
  deliveryStatus: "sent",
  sentAt: new Date(quand),
  failedAt: null,
  errorMsg: null,
});
const ligneCandidat = (id: string, quand: string) => ({
  id,
  applicationId: "22222222-2222-4222-8222-222222222222",
  repliedAt: new Date(quand),
  repliedByName: "Le fondateur",
  toEmail: "chiffre:bob@example.invalid",
  subject: `Objet ${id}`,
  deliveryStatus: "pending",
  sentAt: null,
  failedAt: null,
  errorMsg: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  h.subFindMany.mockResolvedValue([]);
  h.jobFindMany.mockResolvedValue([]);
  h.subCount.mockResolvedValue(0);
  h.jobCount.mockResolvedValue(0);
});

describe("1) droits par source", () => {
  it("reader : réponses aux demandes oui, réponses aux candidats non, jobApplicationReply jamais lu", async () => {
    h.subFindMany.mockResolvedValue([ligneDemande("a", "2026-11-10T10:00:00Z")]);
    const r = await listerReponsesManuelles({}, "reader");
    expect(h.subFindMany).toHaveBeenCalled();
    expect(h.jobFindMany).not.toHaveBeenCalled();
    expect(h.jobCount).not.toHaveBeenCalled();
    expect(r.lignes.map((l) => l.source)).toEqual(["demande"]);
  });

  it("rôle absent ou inconnu : aucune lecture du tout", async () => {
    for (const role of [null, undefined, "inconnu"]) {
      const r = await listerReponsesManuelles({}, role);
      expect(r.lignes).toEqual([]);
    }
    expect(h.subFindMany).not.toHaveBeenCalled();
    expect(h.jobFindMany).not.toHaveBeenCalled();
  });

  it("admin : les deux sources", async () => {
    await listerReponsesManuelles({}, "admin");
    expect(h.subFindMany).toHaveBeenCalled();
    expect(h.jobFindMany).toHaveBeenCalled();
  });

  it("lecture d'une réponse de candidat par reader : null, base jamais lue", async () => {
    expect(await lireReponseManuelle("candidature", "x1", "reader")).toBeNull();
    expect(h.jobFindUnique).not.toHaveBeenCalled();
  });
});

describe("2) la liste ne sélectionne jamais le corps", () => {
  it("ni bodyHtml ni bodyText dans les arguments simulés", async () => {
    await listerReponsesManuelles({}, "admin");
    for (const m of [h.subFindMany, h.jobFindMany]) {
      const arg = m.mock.calls[0]![0] as { select: Record<string, unknown> };
      expect(arg.select).toBeDefined();
      expect(arg.select).not.toHaveProperty("bodyHtml");
      expect(arg.select).not.toHaveProperty("bodyText");
    }
  });

  it("l'adresse est déchiffrée côté serveur pour l'affichage", async () => {
    h.subFindMany.mockResolvedValue([ligneDemande("a", "2026-11-10T10:00:00Z")]);
    const r = await listerReponsesManuelles({}, "admin");
    expect(r.lignes[0]!.destinataire).toBe("alice@example.invalid");
  });
});

describe("3) fusion des sources, page, borne", () => {
  it("ordre décroissant entre les deux sources", async () => {
    h.subFindMany.mockResolvedValue([
      ligneDemande("d1", "2026-11-10T10:00:00Z"),
      ligneDemande("d2", "2026-11-08T10:00:00Z"),
    ]);
    h.jobFindMany.mockResolvedValue([
      ligneCandidat("c1", "2026-11-09T10:00:00Z"),
      ligneCandidat("c2", "2026-11-07T10:00:00Z"),
    ]);
    const r = await listerReponsesManuelles({}, "admin");
    expect(r.lignes.map((l) => l.id)).toEqual(["d1", "c1", "d2", "c2"]);
  });

  it("page 2 : lit page × 50 lignes de chaque source puis coupe juste", async () => {
    const dem = Array.from({ length: 60 }, (_, i) =>
      ligneDemande(`d${i}`, new Date(Date.UTC(2026, 10, 1, 0, 0, 100 - i)).toISOString()),
    );
    const can = Array.from({ length: 60 }, (_, i) =>
      ligneCandidat(`c${i}`, new Date(Date.UTC(2026, 10, 1, 0, 0, 50 - i)).toISOString()),
    );
    h.subFindMany.mockResolvedValue(dem.slice(0, 100));
    h.jobFindMany.mockResolvedValue(can.slice(0, 100));
    const r = await listerReponsesManuelles({ page: 2 }, "admin");
    expect((h.subFindMany.mock.calls[0]![0] as { take: number }).take).toBe(100);
    expect(r.lignes).toHaveLength(50);
    // Tri global : d0..d49 (100→51 s) = 50 premières lignes, page 1 ; la page 2 commence à
    // la 51e ligne de la fusion (d50 à 50 s ex æquo avec c0 : d50 d'abord, ordre stable).
    const fusion = [...dem, ...can]
      .sort((a, b) => b.repliedAt.getTime() - a.repliedAt.getTime())
      .map((l) => l.id);
    expect(r.lignes.map((l) => l.id)).toEqual(fusion.slice(50, 100));
  });

  it("borne à 20 pages : au-delà, page ramenée à 20 et l'écran le sait", async () => {
    const r = await listerReponsesManuelles({ page: 99 }, "admin");
    expect((h.subFindMany.mock.calls[0]![0] as { take: number }).take).toBe(1000);
    expect(r.page).toBe(20);
    expect(r.pageBornee).toBe(true);
  });
});

describe("4) recherche par adresse", () => {
  it("adresse complète : empreinte, jamais contains sur toEmail", async () => {
    await listerReponsesManuelles({ recherche: "Alice@Example.invalid" }, "admin");
    const s = JSON.stringify(h.subFindMany.mock.calls[0]![0]);
    const j = JSON.stringify(h.jobFindMany.mock.calls[0]![0]);
    expect(s).not.toMatch(/contains/);
    expect(j).not.toMatch(/contains/);
    expect(s).toMatch(/contactEmailHash/);
    expect(j).toMatch(/emailHash/);
    expect(s).not.toMatch(/toEmail":\{/);
    expect(j).not.toMatch(/toEmail":\{/);
  });

  it("morceau d'adresse : rechercheNonApplicable, aucun filtre sur l'adresse", async () => {
    const r = await listerReponsesManuelles({ recherche: "alice" }, "admin");
    expect(r.rechercheNonApplicable).toBe(true);
    const s = JSON.stringify(h.subFindMany.mock.calls[0]![0]);
    expect(s).not.toMatch(/contains/);
    expect(s).not.toMatch(/alice/);
  });

  it("adresse complète : pas d'avis de recherche partielle", async () => {
    const r = await listerReponsesManuelles({ recherche: "alice@example.invalid" }, "admin");
    expect(r.rechercheNonApplicable).toBe(false);
  });
});

describe("5) lecture d'une réponse", () => {
  it("jeton marqueur masqué dans le HTML et le texte rendus", async () => {
    const jeton = "Zq7rT9xWm2LpV4nB8cD6fH1jK3sA5gYe0uIoPlMkNb";
    h.subFindUnique.mockResolvedValue({
      id: "r1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      repliedAt: new Date("2026-11-10T10:00:00Z"),
      repliedByName: "Le fondateur",
      toEmail: "chiffre:alice@example.invalid",
      subject: "Objet",
      bodyHtml: `<p>Salut</p><a href="https://axion-ia.com/opposition?t=${jeton}">Se désinscrire</a>`,
      bodyText: `Salut https://axion-ia.com/opposition?t=${jeton}`,
      deliveryStatus: "sent",
      sentAt: new Date("2026-11-10T10:00:00Z"),
      failedAt: null,
      errorMsg: null,
      internalNote: "à suivre",
      submission: { ficheClientId: "33333333-3333-4333-8333-333333333333" },
    });
    const r = await lireReponseManuelle("demande", "r1", "admin");
    expect(r).not.toBeNull();
    expect(r!.html).not.toContain(jeton);
    expect(r!.texte).not.toContain(jeton);
    expect(r!.html).toContain("Se désinscrire");
    expect(r!.destinataire).toBe("alice@example.invalid");
    expect(r!.noteInterne).toBe("à suivre");
    expect(r!.ficheClientId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("identifiant inconnu : null", async () => {
    h.subFindUnique.mockResolvedValue(null);
    expect(await lireReponseManuelle("demande", "inconnu", "admin")).toBeNull();
  });

  it("source inconnue : null, base jamais lue", async () => {
    expect(await lireReponseManuelle("manuel", "x", "admin")).toBeNull();
    expect(await lireReponseManuelle("constructor", "x", "admin")).toBeNull();
    expect(h.subFindUnique).not.toHaveBeenCalled();
  });
});
