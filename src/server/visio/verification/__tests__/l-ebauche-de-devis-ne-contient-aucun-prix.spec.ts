/**
 * ⛔ G14 — L'ÉBAUCHE DE DEVIS NE CONTIENT AUCUN PRIX, ET LE SITE N'EN CALCULE AUCUN.
 *
 * L'IA n'écrit aucun prix : une ébauche qui écrit « € », « euros », « TVA »,
 * « HT » est rejetée ENTIÈRE (nouvel essai). Le catalogue envoyé à l'IA ne
 * contient aucun montant.
 *
 * Et depuis la décision de Will du 29/09 (DEVIS = OPTION A : « aucune ligne
 * proposée, aucun prix », Williams compose le devis lui-même), le SITE non
 * plus ne chiffre rien : l'ancien C4 (`chiffrerEbauche`, un second calcul de
 * devis hors du module devis, sans TVA ni frais de déplacement) est retiré. Le
 * compte rendu ne montre que les références évoquées, sans prix, et V2 (G9)
 * n'admet plus aucun montant « calculé » dans la rubrique des offres.
 *
 * Mutations qui rougissent : retirer le contrôle `contientUnPrix` de
 * `controlerEbauche` → l'ébauche passe ; rétablir un champ de prix
 * (`prixHtEur`, `prixUnitaireHtCents`, `totalHtCents`) dans le catalogue,
 * l'état ou le document du compte rendu, ou un « Total HT » dans la vue ;
 * rendre à G9 une liste de montants admis pour les offres.
 * Contre-témoin : une ébauche sans montant passe, et ses références sont
 * rapportées au catalogue avec leur intitulé. Angle mort : un prix écrit en
 * toutes lettres sans « euros » (« mille neuf cents ») n'est pas vu par G14 —
 * G9 le retire s'il n'est dans aucun fait, seulement s'il est écrit en chiffres.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import * as catalogueIa from "../../catalogue-ia";
import { controlerEbauche } from "../../consolider";
import type { CompteRenduV1, EbaucheV1 } from "../../schemas/autres";
import { RUBRIQUES_COUVERTURE } from "../../schemas/communs";
import type { Couverture } from "../g06-couverture";
import { verifierCompteRendu, type FaitPourRedaction } from "../g09-redaction";
import { catalogueDeTest } from "../../../../../tests/outils/faux-circuit-visio";

const lire = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

function ebauche(p: Partial<EbaucheV1> = {}): EbaucheV1 {
  return {
    lignes: [
      {
        ref_catalogue: "OFF:AXI-OFF-001",
        quantite: 1,
        unite: "groupes",
        faits_refs: ["F01"],
        justification: "12 personnes, un groupe",
      },
    ],
    sans_reference: [],
    activite: "formation",
    financement_suggere: null,
    nb_participants: 12,
    duree_heures: 7,
    modalite_opco: null,
    ref_client: null,
    hypotheses: [],
    alternatives: [],
    manquant_pour_chiffrer: [],
    personnalisation_formation: null,
    ...p,
  };
}

describe("l'ébauche de devis ne contient aucun prix", () => {
  it.each([
    [
      "€ dans une justification",
      {
        lignes: [
          {
            ref_catalogue: "OFF:AXI-OFF-001",
            quantite: 1,
            unite: "groupes" as const,
            faits_refs: [],
            justification: "soit 1 900 € la journée",
          },
        ],
      },
    ],
    ["TVA dans une hypothèse", { hypotheses: ["TVA à 20 % en sus"] }],
    ["euros dans une alternative", { alternatives: ["deux jours pour 3800 euros"] }],
  ])("%s → rejetée entière", (_n, p) => {
    expect(controlerEbauche(ebauche(p), catalogueDeTest().refs).ok).toBe(false);
  });

  it("le catalogue envoyé à l'IA ne porte aucun montant", () => {
    const c = catalogueDeTest();
    expect(c.texte).not.toMatch(/€|\beuros?\b|1900|1 900/);
  });

  it("le site ne calcule aucun prix : pas de chiffrage, aucun champ de prix gardé ni affiché", () => {
    expect(Object.keys(catalogueIa)).not.toContain("chiffrerEbauche");
    for (const f of [
      "src/server/visio/catalogue-ia.ts",
      "src/server/visio/etat-compte-rendu.ts",
      "src/server/visio/passes-ia.ts",
      "src/features/dossier-client/compte-rendu.ts",
      "src/components/admin/visio/CompteRenduVisio.tsx",
    ]) {
      expect(lire(f), f).not.toMatch(
        /prixHtEur:|prixUnitaireHtCents|totalHtCents|chiffrerEbauche|Total HT|resolveOffrePriceEur/,
      );
    }
  });

  it("V2 : un prix du catalogue écrit dans la rubrique des offres est retiré", () => {
    const faits = new Map<string, FaitPourRedaction>([
      ["F01", { ref: "F01", enonce: "Former 12 commerciaux.", citation: null, valeurs: ["12"] }],
    ]);
    const redaction = {
      en_bref: [],
      ce_qui_a_change: [],
      rubriques: Object.fromEntries(
        RUBRIQUES_COUVERTURE.map((r) => [
          r,
          {
            statut: "aborde",
            paragraphes:
              r === "offres"
                ? [{ texte: "Une journée pour 12 personnes, 1 900 € HT.", faits_refs: ["F01"] }]
                : [],
          },
        ]),
      ),
      besoins_detectes: [],
      prochaine_etape_texte: { texte: "Rappeler.", faits_refs: ["F01"] },
    } as unknown as CompteRenduV1;
    const couverture = Object.fromEntries(
      RUBRIQUES_COUVERTURE.map((r) => [
        r,
        { statut: "aborde", faits_refs: ["F01"], remarque: null },
      ]),
    ) as unknown as Couverture;
    const b = verifierCompteRendu(redaction, couverture, faits);
    expect(b.compteRendu.rubriques.offres.paragraphes).toEqual([]);
    expect(b.motifs.join()).toMatch(/nombre absent/);
  });

  it("contre-témoin : sans montant, l'ébauche passe et ses références gardent leur intitulé", () => {
    const r = controlerEbauche(ebauche(), catalogueDeTest().refs);
    expect(r.ok).toBe(true);
    const lignes = catalogueIa.referencerEbauche(
      [
        ...ebauche().lignes,
        { ref_catalogue: "TIER:audit-cible-standard", quantite: 1, unite: "forfait" },
        { ref_catalogue: "OFF:INCONNUE", quantite: 1, unite: "forfait" },
      ],
      catalogueDeTest(),
    );
    expect(lignes).toEqual([
      {
        ref: "OFF:AXI-OFF-001",
        intitule: "Formation générale IA — 1 jour",
        quantite: 1,
        unite: "groupes",
      },
      { ref: "TIER:audit-cible-standard", intitule: "Audit ciblé", quantite: 1, unite: "forfait" },
    ]);
  });
});
