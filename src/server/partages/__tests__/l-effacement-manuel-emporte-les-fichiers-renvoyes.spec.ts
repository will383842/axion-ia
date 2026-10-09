// @vitest-environment node

/**
 * L'EFFACEMENT MANUEL D'UN DOSSIER EMPORTE LES FICHIERS QUE LE CANDIDAT A RENVOYÉS (L5b).
 *
 * Le fichier renvoyé par un candidat (`origine = personne`) est rattaché à son
 * lien SANS clé étrangère : la cascade de l'effacement du dossier ne l'atteint
 * pas. Sans ce geste, son montage survivrait — orphelin — à l'effacement
 * demandé par la personne ou décidé par Will.
 *
 * Ce n'est PAS une purge automatique : seuls les deux chemins d'effacement
 * MANUEL l'appellent (suppression console, demande art. 17).
 *
 *  - objet du stockage effacé, PUIS ligne supprimée sous le drapeau
 *    d'effacement (le seul qui lève le trigger AXP01) ;
 *  - un envoi en cours est arrêté dans le stockage ;
 *  - stockage injoignable → la ligne RESTE (l'objet resterait sinon introuvable),
 *    et l'effacement est déclaré INCOMPLET (`ok: false`) : l'appelant ne
 *    supprime pas le dossier (relecture sécurité, 2026-10-08) ;
 *  - les fichiers envoyés PAR L'ÉQUIPE ne sont pas touchés ;
 *  - bibliothèque éteinte : sans fichier renvoyé, rien ; AVEC des fichiers
 *    renvoyés, refus — ils ne peuvent pas être effacés du stockage.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { etat, r2 } = vi.hoisted(() => ({
  etat: {
    lignes: [] as Array<Record<string, unknown>>,
    supprimees: [] as string[],
    drapeau: 0,
    whereFichiers: null as unknown,
  },
  r2: {
    supprimerObjetCibleR2: vi.fn(async () => undefined),
    arreterEnvoiR2: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lienPartage: {
      findMany: async () => [{ id: "lien-1" }, { id: "lien-2" }],
    },
    fichierPartage: {
      findMany: async (a: { where: unknown }) => {
        etat.whereFichiers = a.where;
        return etat.lignes;
      },
    },
  },
}));
vi.mock("@/lib/r2-storage", () => r2);
vi.mock("@/lib/rgpd-erase", () => ({
  executerSousDrapeauEffacement: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    etat.drapeau++;
    return fn({
      fichierPartage: {
        deleteMany: async (a: { where: { id: { in: string[] } } }) => {
          etat.supprimees.push(...a.where.id.in);
          return { count: a.where.id.in.length };
        },
      },
    });
  },
}));

import {
  MSG_FICHIERS_NON_EFFACES,
  effacerFichiersRenvoyesCandidature,
} from "../effacement-candidat";

const APP = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  etat.lignes = [
    { id: "f-ok", r2Cle: "partages/f-ok/v.mp4", r2UploadId: null, etatDepot: "disponible" },
    { id: "f-cours", r2Cle: "partages/f-cours/v.mp4", r2UploadId: "up-1", etatDepot: "en_cours" },
  ];
  etat.supprimees = [];
  etat.drapeau = 0;
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "compte",
    R2_PARTAGES_BUCKET_NAME: "axion-ia-partages",
    R2_PARTAGES_ACCESS_KEY_ID: "cle",
    R2_PARTAGES_SECRET_ACCESS_KEY: "secret-cle",
    PARTAGES_SECRET: "x".repeat(32),
  });
});

describe("effacerFichiersRenvoyesCandidature", () => {
  it("efface les objets puis les lignes, sous le drapeau d'effacement, fichiers de la personne seulement", async () => {
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.whereFichiers).toEqual({
      origine: "personne",
      lienDepotId: { in: ["lien-1", "lien-2"] },
    });
    expect(r2.arreterEnvoiR2).toHaveBeenCalledWith(
      expect.anything(),
      "partages/f-cours/v.mp4",
      "up-1",
    );
    expect(r2.supprimerObjetCibleR2).toHaveBeenCalledTimes(2);
    expect(etat.drapeau).toBe(1);
    expect(etat.supprimees.sort()).toEqual(["f-cours", "f-ok"]);
    expect(r).toEqual({ ok: true, effaces: 2, conserves: 0 });
  });

  it("stockage injoignable → la ligne reste, et l'effacement est déclaré incomplet", async () => {
    r2.supprimerObjetCibleR2.mockImplementationOnce(async () => {
      throw new Error("R2 injoignable");
    });
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.supprimees).toEqual(["f-cours"]);
    expect(r).toEqual({ ok: false, effaces: 1, conserves: 1, erreur: MSG_FICHIERS_NON_EFFACES });
  });

  it("un envoi en cours qui ne s'arrête pas dans le stockage → conservé, effacement incomplet", async () => {
    r2.arreterEnvoiR2.mockImplementationOnce(async () => {
      throw new Error("R2 injoignable");
    });
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.supprimees).toEqual(["f-ok"]);
    expect(r.ok).toBe(false);
  });

  // 🔴 VETO relecture 2026-10-09 : un envoi déjà abandonné ou expiré chez R2
  // répond `NoSuchUpload` (ou 404). Rien n'est plus à effacer côté stockage :
  // c'est un succès, sinon l'effacement art. 17 du dossier serait bloqué
  // POUR TOUJOURS.
  const erreurR2 = (name: string, statut?: number) =>
    Object.assign(new Error(name), {
      name,
      Code: name,
      ...(statut === undefined ? {} : { $metadata: { httpStatusCode: statut } }),
    });

  it.each([
    ["NoSuchUpload", erreurR2("NoSuchUpload", 404)],
    ["NoSuchUpload sans statut", erreurR2("NoSuchUpload")],
    ["404 sans nom connu", erreurR2("UnknownError", 404)],
  ])("envoi déjà abandonné chez R2 (%s) → effacement réussi", async (_l, err) => {
    r2.arreterEnvoiR2.mockImplementationOnce(async () => {
      throw err;
    });
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.supprimees.sort()).toEqual(["f-cours", "f-ok"]);
    expect(r).toEqual({ ok: true, effaces: 2, conserves: 0 });
  });

  it.each([
    ["NoSuchKey", erreurR2("NoSuchKey", 404)],
    ["NotFound", erreurR2("NotFound")],
  ])("objet déjà absent du stockage (%s) → effacement réussi", async (_l, err) => {
    r2.supprimerObjetCibleR2.mockImplementationOnce(async () => {
      throw err;
    });
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(r).toEqual({ ok: true, effaces: 2, conserves: 0 });
  });

  it.each([
    ["réseau", new Error("getaddrinfo ENOTFOUND")],
    ["5xx", erreurR2("InternalError", 503)],
    ["accès refusé", erreurR2("AccessDenied", 403)],
  ])("vrai échec du stockage (%s) → le dossier est gardé", async (_l, err) => {
    r2.arreterEnvoiR2.mockImplementationOnce(async () => {
      throw err;
    });
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.supprimees).toEqual(["f-ok"]);
    expect(r).toEqual({ ok: false, effaces: 1, conserves: 1, erreur: MSG_FICHIERS_NON_EFFACES });
  });

  it("aucun fichier renvoyé → aucune transaction", async () => {
    etat.lignes = [];
    await effacerFichiersRenvoyesCandidature(APP);
    expect(etat.drapeau).toBe(0);
  });

  it("bibliothèque éteinte AVEC des fichiers renvoyés → refus, rien n'est effacé", async () => {
    delete process.env["R2_PARTAGES_BUCKET_NAME"];
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(r).toEqual({ ok: false, effaces: 0, conserves: 2, erreur: MSG_FICHIERS_NON_EFFACES });
    expect(r2.supprimerObjetCibleR2).not.toHaveBeenCalled();
    expect(etat.drapeau).toBe(0);
  });

  it("bibliothèque éteinte, aucun fichier renvoyé → rien à faire, effacement possible", async () => {
    delete process.env["R2_PARTAGES_BUCKET_NAME"];
    etat.lignes = [];
    const r = await effacerFichiersRenvoyesCandidature(APP);
    expect(r).toEqual({ ok: true, effaces: 0, conserves: 0 });
  });

  it("le message dit ce qui se passe, sans jamais annoncer « effacé »", () => {
    expect(MSG_FICHIERS_NON_EFFACES).toBe(
      "Les fichiers renvoyés par le candidat n'ont pas pu être effacés du stockage ; réessayez.",
    );
  });
});

describe("les deux chemins d'effacement MANUEL l'appellent, AVANT la suppression du dossier", () => {
  const lire = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it.each([
    ["suppression console", "src/features/admin-job-applications/actions.ts"],
    ["demande art. 17", "src/server/careers/candidature-rgpd.ts"],
  ])("%s", (_n, fichier) => {
    const src = lire(fichier);
    const appel = src.indexOf("await effacerFichiersRenvoyesCandidature(");
    expect(appel).toBeGreaterThan(0);
    expect(src.indexOf("prisma.jobApplication.delete(", appel)).toBeGreaterThan(appel);
  });
});
