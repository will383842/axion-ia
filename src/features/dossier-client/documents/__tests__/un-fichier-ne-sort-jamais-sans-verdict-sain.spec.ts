// @vitest-environment node

/**
 * R8 — UN FICHIER NE SORT JAMAIS SANS VERDICT « SAIN » (ADR 0063, D8).
 *
 * « Indisponible » n'est PAS un verdict (`src/server/careers/clamav.ts`).
 *
 * À l'AJOUT (consigne du chef de projet, 01/10, et recommandation UX §6.2) :
 *   · `infecte` → refus, rien d'écrit, message qui dit de ne pas l'ouvrir ;
 *   · `indisponible` → refus, rien d'écrit, « réessayez dans quelques minutes » ;
 *   · `sain` → enregistré `sain`, daté.
 * Au TÉLÉCHARGEMENT, pour un fichier resté `non_analyse` (la base l'admet) :
 *   · `indisponible` → 503, rien de servi, verdict inchangé ;
 *   · puis `sain` → servi, verdict écrit (une fois) ;
 *   · `infecte` → verdict écrit, document ARCHIVÉ, jamais servi (409).
 *
 * Mutations qui rougissent : traiter `indisponible` comme `sain` à l'ajout ou
 * au téléchargement ; servir un `non_analyse` sans analyser ; oublier
 * d'archiver un infecté (la base refuserait — CHECK `infecte_archive`).
 */

import { describe, expect, it } from "vitest";

import type { VerdictAntivirus } from "@/server/careers/clamav";
import { ajouterFichier, ErreurDocument } from "../ajouter";
import { telechargerDocument } from "../telecharger";
import { baseEnMemoire } from "./_base-en-memoire";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PROJET = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const PDF = new TextEncoder().encode("%PDF-1.7 contenu");

const verdict = (v: VerdictAntivirus) => async (): Promise<VerdictAntivirus> => v;

function entree() {
  return {
    clientId: CLIENT,
    projetId: PROJET,
    cote: "envoye_au_client" as const,
    nature: null,
    titre: "Présentation jointe à l'e-mail",
    envoyeLe: "2026-09-30",
    parAdminId: ADMIN,
    nom: "Presentation.pdf",
    octets: PDF,
  };
}

describe("à l'ajout : rien n'est enregistré sans verdict sain", () => {
  it("infecté → refus, rien d'écrit, la signature est gardée pour le journal technique", async () => {
    const { db, compteurs } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const e = await ajouterFichier(
      db as never,
      entree(),
      verdict({ issue: "infecte", signature: "Eicar-Signature" }),
    ).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurDocument);
    expect((e as Error).message).toBe(
      "L'antivirus a trouvé un risque dans ce fichier : il n'a pas été enregistré. " +
        "Ne l'ouvrez pas et ne l'envoyez à personne.",
    );
    expect((e as ErreurDocument).signature).toBe("Eicar-Signature");
    expect(compteurs.ecritures).toBe(0);
  });

  it("indisponible → refus, rien d'écrit (« indisponible » n'est pas « sain »)", async () => {
    const { db, compteurs } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    await expect(
      ajouterFichier(db as never, entree(), verdict({ issue: "indisponible", raison: "délai" })),
    ).rejects.toThrow(
      "La vérification antivirus ne répond pas pour l'instant : le fichier n'a pas été " +
        "enregistré. Réessayez dans quelques minutes.",
    );
    expect(compteurs.ecritures).toBe(0);
  });

  it("sain → enregistré sain et daté, avec ses octets, sa taille et son empreinte", async () => {
    const { db, etat } = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const maintenant = new Date("2026-10-01T08:00:00Z");
    await ajouterFichier(db as never, { ...entree(), maintenant }, verdict({ issue: "sain" }));
    const doc = etat.documents[0]!;
    expect(doc).toMatchObject({
      analyseAntivirus: "sain",
      analyseLe: maintenant,
      fichierTailleOctets: PDF.length,
      fichierNom: "Presentation.pdf",
      nature: "pdf",
    });
    expect(doc.fichierSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.from(etat.contenus.get(doc.id) ?? [])).toEqual(Array.from(PDF));
  });
});

describe("au téléchargement : un `non_analyse` est analysé avant de sortir", () => {
  function sceneNonAnalyse() {
    const s = baseEnMemoire([{ id: PROJET, clientId: CLIENT }]);
    const doc = s.poser(
      {
        clientId: CLIENT,
        projetId: PROJET,
        fichierNom: "Presentation.pdf",
        fichierFormat: "pdf",
        fichierTailleOctets: PDF.length,
        analyseAntivirus: "non_analyse",
      },
      PDF,
    );
    const t = { id: doc.id, projetId: PROJET, clientId: CLIENT, parAdminId: ADMIN };
    return { ...s, doc, t };
  }

  it("indisponible → 503, rien de servi, verdict inchangé ; puis sain → servi et verdict écrit", async () => {
    const { db, doc, t } = sceneNonAnalyse();
    const r1 = await telechargerDocument(
      db as never,
      t,
      verdict({ issue: "indisponible", raison: "connexion refusée" }),
    );
    expect(r1).toEqual({ issue: "antivirus_indisponible" });
    expect(doc.analyseAntivirus).toBe("non_analyse");

    const r2 = await telechargerDocument(db as never, t, verdict({ issue: "sain" }));
    expect(r2.issue).toBe("servi");
    expect(doc.analyseAntivirus).toBe("sain");
    expect(doc.analyseLe).toBeInstanceOf(Date);
  });

  it("infecté → verdict écrit, document archivé par la machine, jamais servi (409)", async () => {
    const { db, doc, t } = sceneNonAnalyse();
    const r = await telechargerDocument(
      db as never,
      t,
      verdict({ issue: "infecte", signature: "Win.Test.EICAR_HDB-1" }),
    );
    expect(r).toEqual({ issue: "infecte" });
    expect(doc).toMatchObject({
      analyseAntivirus: "infecte",
      analyseSignature: "Win.Test.EICAR_HDB-1",
      archiveParId: null,
    });
    expect(doc.archiveLe).toBeInstanceOf(Date);
    // Et il ne sort plus jamais, même si l'antivirus disait « sain » ensuite.
    const r2 = await telechargerDocument(db as never, t, verdict({ issue: "sain" }));
    expect(r2).toEqual({ issue: "infecte" });
  });

  it("un `sain` n'est pas réanalysé (le verdict rendu ne change plus)", async () => {
    const { db, doc, t } = sceneNonAnalyse();
    doc.analyseAntivirus = "sain";
    doc.analyseLe = new Date();
    let appels = 0;
    const r = await telechargerDocument(db as never, t, async () => {
      appels += 1;
      return { issue: "infecte", signature: "x" };
    });
    expect(r.issue).toBe("servi");
    expect(appels).toBe(0);
  });
});
