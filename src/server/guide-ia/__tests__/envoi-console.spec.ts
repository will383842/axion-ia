// @vitest-environment node
//
// « Envoyer le guide » / « Renvoyer le guide » depuis la console (lot L3).
//
// La base est SIMULÉE avec son état (une table `guide_requests` en mémoire, un
// `updateMany` conditionnel qui se comporte comme en SQL) : l'idempotence se
// joue dans l'écriture conditionnelle de `queued_at`, et un simple espion qui
// rendrait toujours `count: 1` ne prouverait rien.

import { describe, it, expect, vi, beforeEach } from "vitest";

interface Ligne {
  id: string;
  email: string;
  emailKey: string;
  aimant: string;
  origine: "formulaire" | "admin";
  source: string | null;
  locale: "fr" | "en";
  version: string;
  downloadToken: string;
  queuedAt: Date | null;
  sentAt: Date | null;
}

const d = vi.hoisted(() => ({
  lignes: [] as Ligne[],
  abonne: null as null | { id: string; email: string; locale: "fr" | "en"; status: string },
  mettreEnFile: vi.fn(),
  activityCreate: vi.fn(),
  lettre: vi.fn(),
  prochainId: 1,
}));

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  if (where["id"] !== undefined && l.id !== where["id"]) return false;
  if ("sentAt" in where && where["sentAt"] === null && l.sentAt !== null) return false;
  if ("queuedAt" in where) {
    const q = where["queuedAt"];
    if (q === null ? l.queuedAt !== null : (l.queuedAt?.getTime() ?? -1) !== (q as Date).getTime())
      return false;
  }
  const ou = where["OR"] as Array<Record<string, unknown>> | undefined;
  if (ou) {
    const ok = ou.some((c) => {
      const q = c["queuedAt"];
      if (q === null) return l.queuedAt === null;
      const lt = (q as { lt: Date }).lt;
      return l.queuedAt !== null && l.queuedAt < lt;
    });
    if (!ok) return false;
  }
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
        if (!d.abonne) return null;
        if (where.id && where.id !== d.abonne.id) return null;
        if (where.email && where.email !== d.abonne.email) return null;
        return d.abonne;
      },
    },
    guideRequest: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const cle = where["emailKey_aimant"] as { emailKey: string; aimant: string } | undefined;
        const l = d.lignes.find((x) =>
          cle ? x.emailKey === cle.emailKey && x.aimant === cle.aimant : x.id === where["id"],
        );
        // Une COPIE, comme Prisma : la ligne lue ne bouge pas quand la base change.
        return l ? { ...l } : null;
      },
      findUniqueOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
        const cle = where["emailKey_aimant"] as { emailKey: string; aimant: string };
        const l = d.lignes.find((x) => x.emailKey === cle.emailKey && x.aimant === cle.aimant);
        if (!l) throw new Error("introuvable");
        return { ...l };
      },
      create: async ({ data }: { data: Omit<Ligne, "id" | "queuedAt" | "sentAt"> }) => {
        if (d.lignes.some((l) => l.emailKey === data.emailKey && l.aimant === data.aimant)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const l: Ligne = { ...data, id: `demande-${d.prochainId++}`, queuedAt: null, sentAt: null };
        d.lignes.push(l);
        return { ...l };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Ligne>;
      }) => {
        let count = 0;
        for (const l of d.lignes) {
          if (correspond(l, where)) {
            Object.assign(l, data);
            count++;
          }
        }
        return { count };
      },
    },
    activityLog: { create: (...a: unknown[]) => d.activityCreate(...a) },
  },
}));
vi.mock("../envoi", () => ({
  mettreEnFileGuide: (...a: unknown[]) => d.mettreEnFile(...a),
}));
vi.mock("../lettre", () => ({ lettreDansLEmail: (...a: unknown[]) => d.lettre(...a) }));

import {
  envoyerGuideAAbonne,
  renvoyerGuide,
  FENETRE_ANTI_DOUBLON_CONSOLE_MS,
} from "../envoi-console";

const ABONNE = {
  id: "00000000-0000-4000-8000-0000000000b1",
  email: "abonne-historique@example.invalid",
  locale: "fr" as const,
  status: "confirmed",
};
const T0 = new Date("2026-09-25T09:00:00Z");
const OPTIONS = { adminUserId: "admin-1", maintenant: T0 };

beforeEach(() => {
  d.lignes = [];
  d.prochainId = 1;
  d.abonne = { ...ABONNE };
  d.activityCreate.mockReset().mockResolvedValue({});
  d.lettre.mockReset().mockResolvedValue({ unsubscribeToken: "u".repeat(64) });
  // Le vrai `mettreEnFileGuide` pose `queued_at` après la mise en file.
  d.mettreEnFile
    .mockReset()
    .mockImplementation(async (demande: { id: string }, o: { maintenant: Date }) => {
      const l = d.lignes.find((x) => x.id === demande.id);
      if (l) l.queuedAt = o.maintenant;
      return "en-file";
    });
});

describe("« Envoyer le guide » depuis la fiche abonné", () => {
  it("crée la demande AU CLIC, origine admin, et la met en file une fois", async () => {
    expect(d.lignes).toHaveLength(0);
    const r = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);

    expect(r).toMatchObject({ resultat: "en-file", creee: true });
    expect(d.lignes).toHaveLength(1);
    expect(d.lignes[0]).toMatchObject({ origine: "admin", email: ABONNE.email, source: "console" });
    expect(d.mettreEnFile).toHaveBeenCalledTimes(1);
    // L'e-mail porte le lien de désinscription de la lettre (abonné confirmé).
    expect(d.mettreEnFile.mock.calls[0]![1]).toMatchObject({ unsubscribeToken: "u".repeat(64) });
  });

  it("🔴 deux clics → UN envoi", async () => {
    const [a, b] = await Promise.all([
      envoyerGuideAAbonne(ABONNE.id, OPTIONS),
      envoyerGuideAAbonne(ABONNE.id, OPTIONS),
    ]);
    expect(d.mettreEnFile).toHaveBeenCalledTimes(1);
    expect(d.lignes).toHaveLength(1);
    expect([a.resultat, b.resultat].sort()).toEqual(["deja-en-file", "en-file"]);

    // Un troisième clic, plus tard, sur une demande DÉJÀ partie : rien non plus.
    d.lignes[0]!.sentAt = new Date(T0.getTime() + 60_000);
    const c = await envoyerGuideAAbonne(ABONNE.id, {
      ...OPTIONS,
      maintenant: new Date(T0.getTime() + 2 * FENETRE_ANTI_DOUBLON_CONSOLE_MS),
    });
    expect(c.resultat).toBe("deja-envoye");
    expect(d.mettreEnFile).toHaveBeenCalledTimes(1);
  });

  it("chaque envoi effectif est journalisé, sans l'adresse", async () => {
    await envoyerGuideAAbonne(ABONNE.id, { ...OPTIONS, reprise: true });
    expect(d.activityCreate).toHaveBeenCalledTimes(1);
    const journal = d.activityCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(journal.data).toMatchObject({
      action: "newsletter.guide.envoyer",
      targetType: "guide_request",
      targetId: d.lignes[0]!.id,
      adminUserId: "admin-1",
    });
    expect(journal.data["changes"]).toMatchObject({ resultat: "en-file", reprise: true });
    expect(JSON.stringify(journal)).not.toContain("@");
  });

  it("la phrase de reprise voyage jusqu'à l'e-mail (envoi unique du lot L7)", async () => {
    await envoyerGuideAAbonne(ABONNE.id, { ...OPTIONS, reprise: true });
    expect(d.mettreEnFile.mock.calls[0]![1]).toMatchObject({ reprise: true });
  });

  it("réutilise la demande du formulaire si la personne en a une (pas de doublon)", async () => {
    d.lignes.push({
      id: "demande-formulaire",
      email: ABONNE.email,
      emailKey: (await import("@/lib/security/email-hash")).hashEmailForLookup(ABONNE.email)!,
      aimant: "guide-ia",
      origine: "formulaire",
      source: "guide-ia",
      locale: "fr",
      version: "v",
      downloadToken: "t".repeat(64),
      queuedAt: null,
      sentAt: null,
    });
    const r = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    expect(r).toMatchObject({ resultat: "en-file", creee: false, demandeId: "demande-formulaire" });
    expect(d.lignes).toHaveLength(1);
    expect(d.lignes[0]!.origine).toBe("formulaire");
  });

  it("rien n'est parti (plafond) : la réservation est rendue, un nouveau clic pourra envoyer", async () => {
    d.mettreEnFile.mockResolvedValueOnce("plafond");
    const r = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    expect(r.resultat).toBe("plafond");
    expect(d.lignes[0]!.queuedAt).toBeNull();

    const r2 = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    expect(r2.resultat).toBe("en-file");
    expect(d.mettreEnFile).toHaveBeenCalledTimes(2);
  });

  it("adresse rejetée (rebond dur) : aucune demande créée, rien en file", async () => {
    d.abonne = { ...ABONNE, status: "bounced" };
    const r = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    expect(r.resultat).toBe("adresse-rejetee");
    expect(d.lignes).toHaveLength(0);
    expect(d.mettreEnFile).not.toHaveBeenCalled();
  });

  it("abonné introuvable : rien", async () => {
    d.abonne = null;
    const r = await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    expect(r.resultat).toBe("introuvable");
    expect(d.mettreEnFile).not.toHaveBeenCalled();
  });
});

describe("« Renvoyer le guide » depuis l'écran des demandes", () => {
  beforeEach(async () => {
    await envoyerGuideAAbonne(ABONNE.id, OPTIONS);
    d.lignes[0]!.sentAt = T0;
    d.mettreEnFile.mockClear();
    d.activityCreate.mockClear();
  });

  it("dans la fenêtre anti-doublon : rien de plus ne part", async () => {
    const r = await renvoyerGuide(d.lignes[0]!.id, {
      ...OPTIONS,
      maintenant: new Date(T0.getTime() + 60_000),
    });
    expect(r.resultat).toBe("deja-en-file");
    expect(d.mettreEnFile).not.toHaveBeenCalled();
  });

  it("après la fenêtre : un renvoi, un seul même sur double clic, journalisé", async () => {
    const plusTard = new Date(T0.getTime() + FENETRE_ANTI_DOUBLON_CONSOLE_MS + 1);
    const [a, b] = await Promise.all([
      renvoyerGuide(d.lignes[0]!.id, { ...OPTIONS, maintenant: plusTard }),
      renvoyerGuide(d.lignes[0]!.id, { ...OPTIONS, maintenant: plusTard }),
    ]);
    expect(d.mettreEnFile).toHaveBeenCalledTimes(1);
    expect([a.resultat, b.resultat].sort()).toEqual(["deja-en-file", "en-file"]);
    expect(d.activityCreate).toHaveBeenCalledTimes(1);
    expect((d.activityCreate.mock.calls[0]![0] as { data: { action: string } }).data.action).toBe(
      "newsletter.guide.renvoyer",
    );
  });
});
