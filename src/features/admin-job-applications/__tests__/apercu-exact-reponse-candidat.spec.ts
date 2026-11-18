/**
 * Lot I2-2 — l'aperçu exact d'une réponse à un candidat.
 *
 * Aperçu et envoi appellent la MÊME fonction de rendu (`rendreReponseCandidat`) avec les
 * mêmes arguments, dont le vrai destinataire (adresse déchiffrée côté serveur). Ce qui part
 * vers le navigateur est masqué (aucun jeton) et inerte (aucun `href`).
 *
 * Seuls le rendu (`renderEmailTemplate`), la base, la session et la file sont simulés :
 * aucun e-mail ne part. Valeurs factices uniquement.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const JETON = "JETONMARQUEURabcdef0123456789ZZ";
const HTML = `<html><body><div data-skip-in-text="true">Pré-entête test</div><p>Bonjour</p><a href="https://axion-ia.com/fr/candidature/supprimer?token=${JETON}">Supprimer</a><a href="https://axion-ia.com/api/unsubscribe?token=${JETON}">Se désabonner</a></body></html>`;
const TEXTE = `Bonjour\nSupprimer : https://axion-ia.com/fr/candidature/supprimer?token=${JETON}`;
const ID = "11111111-1111-1111-1111-111111111111";

const d = vi.hoisted(() => ({
  auth: vi.fn(),
  render: vi.fn(),
  enqueue: vi.fn(),
  decrypt: vi.fn(),
  usable: vi.fn(),
  findCandidature: vi.fn(),
  masquerEntrees: [] as string[],
  creations: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => d.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: async () => 1,
    jobApplicationReply: {
      findMany: async () => [],
      create: async (a: unknown) => {
        d.creations(a);
        return { id: "r1" };
      },
    },
    jobApplicationEvent: { findFirst: async () => null },
    jobApplication: { update: async () => ({}) },
  };
  return {
    prisma: {
      jobApplication: { findUnique: (...a: unknown[]) => d.findCandidature(...a) },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      jobApplicationReply: { update: vi.fn() },
    },
  };
});
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (...a: unknown[]) => d.decrypt(...a),
  isDecryptedEmailUsable: (...a: unknown[]) => d.usable(...a),
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => d.render(...a),
}));
vi.mock("@/lib/email/masquer-secrets", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/lib/email/masquer-secrets")>();
  return {
    ...vrai,
    masquerSecretsEmail: (e: { html: string; subject: string; text: string }) => {
      d.masquerEntrees.push(e.html);
      return vrai.masquerSecretsEmail(e);
    },
  };
});
vi.mock("@/server/careers/lien-suppression-candidature", () => ({
  lienSuppressionCandidature: async () => "https://axion-ia.com/fr/candidature/supprimer?t=x",
}));
vi.mock("@/features/admin-job-applications/journal", () => ({
  consignerEvenement: async () => {},
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => d.enqueue(...a) }));
vi.mock("@/features/job-application/complement", () => ({
  CHEMIN_COMPLEMENT: "/complement",
  lienComplement: async () => "https://axion-ia.com/complement/LIENCOMPLEMENT",
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ modeles_composeur: false }),
}));

import { apercuReponseCandidatAction, repondreAuCandidatAction } from "../reply-actions";

const CANDIDATURE = {
  id: ID,
  email: "chiffre",
  locale: "fr",
  status: "reviewing",
  offerTitleSnap: "Monteur",
  firstName: "x",
  lastName: "y",
  offer: null,
};
const SAISIE = { applicationId: ID, subject: "Votre candidature", bodyMarkdown: "Bonjour" };

beforeEach(() => {
  d.auth.mockReset().mockResolvedValue({ user: { id: "u1", role: "admin", name: "Admin" } });
  d.render.mockReset().mockResolvedValue({ subject: "Votre candidature", html: HTML, text: TEXTE });
  d.enqueue.mockReset().mockResolvedValue({ enqueued: true });
  d.decrypt.mockReset().mockReturnValue("candidat@exemple.test");
  d.usable.mockReset().mockReturnValue(true);
  d.findCandidature.mockReset().mockResolvedValue(CANDIDATURE);
  d.masquerEntrees.length = 0;
  d.creations.mockReset();
});

describe("I2-2 · l'aperçu et l'envoi rendent par la même fonction, mêmes arguments", () => {
  it("🔴 [test 2] mêmes arguments de rendu ; le HTML d'avant masquage = le bodyHtml stocké", async () => {
    const apercu = await apercuReponseCandidatAction(SAISIE);
    expect(apercu.ok).toBe(true);
    const envoi = await repondreAuCandidatAction(SAISIE);
    expect(envoi.ok).toBe(true);

    expect(d.render).toHaveBeenCalledTimes(2);
    expect(d.render.mock.calls[0]).toEqual(d.render.mock.calls[1]);
    // Le vrai destinataire (adresse déchiffrée) est passé au rendu.
    expect(d.render.mock.calls[0]?.[3]).toEqual({ destinataire: "candidat@exemple.test" });

    const stocke = (d.creations.mock.calls[0]?.[0] as { data: { bodyHtml: string } }).data.bodyHtml;
    expect(d.masquerEntrees[0]).toBe(stocke);
  });

  it("🔴 [test 3] le HTML renvoyé ne contient ni jeton, ni href ; le texte non plus", async () => {
    const r = await apercuReponseCandidatAction(SAISIE);
    if (!r.ok) throw new Error("aperçu attendu");
    expect(r.apercu.html).not.toContain(JETON);
    expect(r.apercu.html).not.toMatch(/\bhref\s*=/i);
    expect(r.apercu.texte ?? "").not.toContain(JETON);
    expect(JSON.stringify(r)).not.toContain(JETON);
    expect(r.apercu.a).toBe("candidat@exemple.test");
    expect(r.apercu.objet).toBe("Votre candidature");
    expect(r.apercu.preEntete).toBe("Pré-entête test");
  });

  it("l'aperçu n'écrit rien et ne met rien en file", async () => {
    await apercuReponseCandidatAction(SAISIE);
    expect(d.creations).not.toHaveBeenCalled();
    expect(d.enqueue).not.toHaveBeenCalled();
  });
});

describe("I2-2 · refus sans rendu", () => {
  it("🔴 [test 4] un rôle sans droit sur le dossier : refus, rendu jamais appelé", async () => {
    d.auth.mockResolvedValue({ user: { id: "u1", role: "editor", name: "Éditeur" } });
    const r = await apercuReponseCandidatAction(SAISIE);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(d.render).not.toHaveBeenCalled();
    expect(d.findCandidature).not.toHaveBeenCalled();
  });

  it("🔴 [test 4] pas de session : refus, rendu jamais appelé", async () => {
    d.auth.mockResolvedValue(null);
    const r = await apercuReponseCandidatAction(SAISIE);
    expect(r).toEqual({ ok: false, error: "unauthorized" });
    expect(d.render).not.toHaveBeenCalled();
  });

  it("🔴 [test 4] adresse illisible : refus, rendu jamais appelé", async () => {
    d.usable.mockReturnValue(false);
    const r = await apercuReponseCandidatAction(SAISIE);
    expect(r.ok).toBe(false);
    expect(d.render).not.toHaveBeenCalled();
  });
});

describe("I2-2 · [test 5] garde de source : aucun journal, aucune trace, aucun cache", () => {
  const racine = join(__dirname, "..");
  // Fichier absent = chaîne vide : les assertions rougissent une à une, sans planter la collecte.
  const lire = (f: string): string => {
    try {
      return readFileSync(join(racine, f), "utf8");
    } catch {
      return "";
    }
  };
  const rendu = lire("rendu-reponse.ts");
  const actions = lire("reply-actions.ts");
  const repere = "// === APERCU-AVANT-ENVOI ===";
  const apercu = actions.slice(actions.indexOf(repere));

  it("le repère de l'aperçu existe dans reply-actions.ts", () => {
    expect(actions.includes(repere)).toBe(true);
    expect(apercu).toContain("apercuReponseCandidatAction");
  });

  for (const [nom, source] of [
    ["rendu-reponse.ts", rendu],
    ["l'action d'aperçu", apercu],
  ] as const) {
    it(`${nom} : ni console., ni Sentry.capture*, ni cache`, () => {
      const code = source
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      expect(code).not.toMatch(/console\./);
      expect(code).not.toMatch(/Sentry\.capture/);
      expect(code).not.toMatch(/use cache/);
      expect(code).not.toMatch(/unstable_cache/);
    });
  }

  it("rendu-reponse.ts existe", () => {
    expect(rendu.length).toBeGreaterThan(0);
  });

  it("rendu-reponse.ts n'importe pas `server-only` (il est atteint par le worker)", () => {
    expect(rendu).not.toMatch(/^import\s+["']server-only["']/m);
  });
});
