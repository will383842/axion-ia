// @vitest-environment node

/**
 * JOINDRE DES FICHIERS À UNE RÉPONSE = UN LIEN, JAMAIS UNE PIÈCE JOINTE (Candidatures unifiées L5).
 *
 *  - seuls se joignent des fichiers prêts (disponibles, non infectés, non
 *    archivés), d'une catégorie proposée au monde « emploi » ;
 *  - un lien de rushs vit 7 jours, les autres 30 ;
 *  - le message reçoit un paragraphe « Fichiers à télécharger (jusqu'au …) »
 *    avec l'adresse du lien et la phrase « Ce lien est personnel ; … » ;
 *  - le lien est créé DANS la transaction de la réponse (même `reponseId`), et
 *    rien de ce qui part à la file d'envoi ne ressemble à une pièce jointe ;
 *  - fonction éteinte → refus, rien d'écrit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { etat } = vi.hoisted(() => ({
  etat: {
    fichiers: [] as Array<Record<string, unknown>>,
    creations: [] as Array<{ modele: string; data: Record<string, unknown> }>,
    rendus: [] as Array<Record<string, unknown>>,
    files: [] as Array<unknown[]>,
  },
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    jobApplicationReply: {
      create: async (a: { data: Record<string, unknown> }) => {
        etat.creations.push({ modele: "reponse", data: a.data });
        return { id: "rep-1" };
      },
      update: async () => ({}),
    },
    jobApplication: { update: async () => ({}), updateMany: async () => ({ count: 1 }) },
    jobApplicationEvent: {
      create: async (a: { data: Record<string, unknown> }) => {
        etat.creations.push({ modele: "evenement", data: a.data });
        return { id: "ev-1" };
      },
    },
    lienPartage: {
      create: async (a: { data: Record<string, unknown> }) => {
        etat.creations.push({ modele: "lien", data: a.data });
        return { id: a.data.id };
      },
    },
  };
  return {
    prisma: {
      ...tx,
      fichierPartage: {
        findMany: async (a: { where: { id: { in: string[] } } }) =>
          etat.fichiers.filter((f) => a.where.id.in.includes(f.id as string)),
      },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: () => "candidat@example.org",
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: async (_n: string, _l: string, donnees: Record<string, unknown>) => {
    etat.rendus.push(donnees);
    return {
      subject: "s",
      html: `<p>${String(donnees.bodyMarkdown)}</p>`,
      text: String(donnees.bodyMarkdown),
    };
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...args: unknown[]) => {
    etat.files.push(args);
    return { enqueued: true };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { ecrireEtEnfilerReponse } from "@/features/admin-job-applications/envoyer-reponse";

import { preparerLienFichiers, verifierFichiersJoignables } from "../attacher-a-une-reponse";
import { jetonLienValide } from "../jeton";

const ENV = {
  R2_ACCOUNT_ID: "compte",
  R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
  R2_PARTAGES_ACCESS_KEY_ID: "cle",
  R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
  PARTAGES_SECRET: "s".repeat(40),
  NEXT_PUBLIC_SITE_URL: "https://axion-ia.com",
};
const MAINTENANT = new Date("2026-10-08T10:00:00Z");
const F1 = "33333333-3333-4333-8333-333333333333";
const F2 = "44444444-4444-4444-8444-444444444444";

function ligne(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    nature: "fichier",
    categorie: "lut",
    etatDepot: "disponible",
    analyse: "sain",
    archiveLe: null,
    ...extra,
  };
}

beforeEach(() => {
  etat.fichiers = [ligne(F1, { categorie: "rushs", analyse: "hors_limite" }), ligne(F2)];
  etat.creations = [];
  etat.rendus = [];
  etat.files = [];
});

describe("ce qui se joint", () => {
  it("refuse un fichier infecté, en cours d'envoi, archivé, inconnu ou d'une catégorie hors monde emploi", () => {
    const ok = verifierFichiersJoignables([F2], [ligne(F2)]);
    expect(ok.ok).toBe(true);
    for (const mauvais of [
      ligne(F2, { analyse: "infecte", archiveLe: new Date() }),
      ligne(F2, { etatDepot: "en_cours" }),
      ligne(F2, { archiveLe: new Date() }),
      ligne(F2, { categorie: "kit_apporteur" }),
      ligne(F2, { categorie: "essai_rendu" }),
    ]) {
      expect(verifierFichiersJoignables([F2], [mauvais]).ok).toBe(false);
    }
    expect(verifierFichiersJoignables([F2], []).ok).toBe(false);
    expect(verifierFichiersJoignables([], []).ok).toBe(false);
  });

  it("accepte un fichier encore en analyse (la page dira « en cours de vérification ») et un lien externe", () => {
    expect(verifierFichiersJoignables([F2], [ligne(F2, { analyse: "en_attente" })]).ok).toBe(true);
    expect(
      verifierFichiersJoignables(
        [F2],
        [ligne(F2, { nature: "lien_externe", etatDepot: "disponible", analyse: null })],
      ).ok,
    ).toBe(true);
  });
});

describe("le lien préparé", () => {
  it("fonction éteinte : refus", async () => {
    const r = await preparerLienFichiers([F2], { maintenant: MAINTENANT, env: {} });
    expect(r.ok).toBe(false);
  });

  it("rushs → 7 jours ; sinon 30 jours ; adresse signée et phrase d'information", async () => {
    const avecRushs = await preparerLienFichiers([F1, F2], { maintenant: MAINTENANT, env: ENV });
    if (!avecRushs.ok) throw new Error(avecRushs.erreur);
    expect(avecRushs.lien.expireLe.toISOString()).toBe("2026-10-15T10:00:00.000Z");
    const sans = await preparerLienFichiers([F2], { maintenant: MAINTENANT, env: ENV });
    if (!sans.ok) throw new Error(sans.erreur);
    expect(sans.lien.expireLe.toISOString()).toBe("2026-11-07T10:00:00.000Z");

    const m = /https:\/\/axion-ia\.com\/api\/partage\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{43})/.exec(
      sans.lien.paragraphe,
    );
    expect(m).not.toBeNull();
    expect(m![1]).toBe(sans.lien.lienId);
    expect(jetonLienValide(m![1]!, m![2]!, ENV)).toBe(true);
    expect(sans.lien.paragraphe).toContain("Fichiers à télécharger (jusqu'au 07/11/2026)");
    expect(sans.lien.paragraphe).toContain(
      "Ce lien est personnel ; nous voyons quand les fichiers sont téléchargés.",
    );
  });
});

describe("la réponse et son lien partent ensemble", () => {
  it("le lien est créé dans la transaction de la réponse, et le message porte le lien", async () => {
    const r = await preparerLienFichiers([F1, F2], { maintenant: MAINTENANT, env: ENV });
    if (!r.ok) throw new Error(r.erreur);
    const issue = await ecrireEtEnfilerReponse(
      {
        id: "app-1",
        email: "chiffre",
        locale: "fr",
        status: "reviewing",
        offerTitleSnap: "Monteur vidéo freelance",
      },
      { userId: "77777777-7777-4777-8777-777777777777", nom: "Will" },
      { subject: "Votre essai", bodyMarkdown: "Bonjour,", modele: "libre", lienFichiers: r.lien },
    );
    expect(issue).toEqual({ ecrit: true, enfile: true, replyId: "rep-1" });

    const lien = etat.creations.find((c) => c.modele === "lien")!;
    expect(lien.data).toMatchObject({
      id: r.lien.lienId,
      applicationId: "app-1",
      reponseId: "rep-1",
      expireLe: r.lien.expireLe,
      creeParNom: "Will",
      fichiers: { create: [{ fichierId: F1 }, { fichierId: F2 }] },
    });
    // Ordre : la réponse, puis son lien (même transaction).
    expect(etat.creations.map((c) => c.modele).slice(0, 2)).toEqual(["reponse", "lien"]);

    expect(String(etat.rendus[0]!.bodyMarkdown)).toContain(r.lien.adresse);
    expect(String(etat.rendus[0]!.bodyMarkdown)).toMatch(/^Bonjour,\n\n\*\*Fichiers à télécharger/);
    // Rien qui ressemble à une pièce jointe, ni dans le rendu, ni dans la file.
    expect(JSON.stringify(etat.rendus)).not.toMatch(/attachment|piece_?jointe/i);
    expect(JSON.stringify(etat.files)).not.toMatch(/attachment|piece_?jointe/i);
  });
});
