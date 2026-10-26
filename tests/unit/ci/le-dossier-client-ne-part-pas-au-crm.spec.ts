/**
 * ⛔ LE DOSSIER CLIENT NE PART PAS AU CRM (chantier visio, PR 2 ; plan PA-12 ;
 * modèle : `les-candidatures-ne-partent-pas-au-crm.spec.ts`).
 *
 * Ordre permanent de Will : rien ne part au CRM Pro sans sa validation. Le
 * dossier client (paroles, faits, comptes rendus) n'a aucune raison d'y
 * aller. Deux fermetures :
 *   1. aucun module du circuit visio n'importe `@/server/crm-sync` ;
 *   2. aucun module de `src/server/crm-sync/**` ne lit une table du dossier
 *      (liste DÉRIVÉE du schéma : annotation `rgpd: dossier-client`).
 *
 * Contre-témoin : les deux formes de faute sont reconnues ; et l'opposition au
 * vivier, qui importe légitimement la synchro, sert de témoin positif du motif.
 * Angle mort avoué : un module hors des deux zones qui lirait le dossier puis
 * appellerait la synchro n'est pas vu.
 */

import { describe, expect, it } from "vitest";
import {
  DOSSIERS_DU_CIRCUIT_ELARGI,
  lire,
  lireModeles,
  sansCommentaires,
  sourcesSous,
} from "./sources-du-circuit-visio";

/**
 * EXCEPTION UNIQUE, voulue par Will (25/10/2026) : la synchro AUTOMATIQUE du
 * dossier client envoie au CRM des champs OBJECTIFS (identité, adresse,
 * contacts, statut, état du questionnaire) — jamais une parole, un fait, un
 * compte rendu, une réponse ni un montant. Elle vit dans UN fichier, qui ne
 * peut lire que ces deux tables en `find*` ; tout autre accès, ou la lecture
 * d'une colonne de contenu, fait échouer la garde ci-dessous.
 */
const FICHIER_DE_LA_SYNCHRO_DU_DOSSIER = "src/server/crm-sync/dossier-client.ts";
const TABLES_LISIBLES_PAR_CE_FICHIER = ["clientContact", "questionnaireAvantAudit"];
const COLONNES_DE_CONTENU = /\b(donnees|texte|reponse|reponses|notes|html|destinataire)\s*:\s*true/;

const IMPORT_CRM =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'`][^"'`]*server\/crm-sync(?:\/[^"'`]*)?["'`]/;

function lectureDuDossier(): RegExp {
  const accesseurs = lireModeles()
    .filter((m) => m.annotation === "dossier-client")
    .map((m) => m.accesseur);
  return new RegExp(`\\.(${accesseurs.join("|")})\\.(find|count|aggregate|groupBy)\\w*\\b`);
}

describe("le dossier client ne part pas au CRM", () => {
  it("témoin positif : le motif reconnaît un import réel de la synchro", () => {
    expect(IMPORT_CRM.test(lire("src/server/vivier/opposition.ts"))).toBe(true);
    expect(IMPORT_CRM.test(`const m = await import("@/server/crm-sync/enqueue");`)).toBe(true);
  });

  it("contre-témoin : une lecture du dossier dans la synchro est reconnue", () => {
    expect(lectureDuDossier().test(`await prisma.compteRendu.findFirst({})`)).toBe(true);
    expect(lectureDuDossier().test(`await prisma.client.findFirst({})`)).toBe(false);
  });

  it("aucun module du circuit visio n'importe @/server/crm-sync", () => {
    const fautifs = sourcesSous(DOSSIERS_DU_CIRCUIT_ELARGI).filter((f) =>
      IMPORT_CRM.test(sansCommentaires(lire(f))),
    );
    expect(fautifs, "le dossier client ne part pas au CRM (PA-12) :").toEqual([]);
  });

  it("aucun module de la synchro CRM ne lit le dossier client", () => {
    const fichiers = sourcesSous(["src/server/crm-sync"]);
    expect(fichiers).toContain("src/server/crm-sync/enqueue.ts");
    const motif = lectureDuDossier();
    const fautifs = fichiers
      .filter((f) => f !== FICHIER_DE_LA_SYNCHRO_DU_DOSSIER)
      .filter((f) => motif.test(sansCommentaires(lire(f))));
    expect(fautifs, "la synchro CRM lit le dossier client (PA-12) :").toEqual([]);
  });

  it("l'exception : un seul fichier, deux tables, aucune colonne de contenu", () => {
    const source = sansCommentaires(lire(FICHIER_DE_LA_SYNCHRO_DU_DOSSIER));
    const lues = [...source.matchAll(new RegExp(lectureDuDossier().source, "g"))].map((m) => m[1]);
    for (const table of lues) expect(TABLES_LISIBLES_PAR_CE_FICHIER).toContain(table);
    expect(lues.length).toBeGreaterThan(0);
    expect(COLONNES_DE_CONTENU.test(source)).toBe(false);
    // Contre-témoin : la colonne qui contient les réponses est reconnue.
    expect(COLONNES_DE_CONTENU.test("select: { donnees: true }")).toBe(true);
  });
});
