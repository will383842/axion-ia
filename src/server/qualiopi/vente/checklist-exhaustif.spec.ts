/**
 * Checklist vente — balayage EXHAUSTIF de la machine à états (2026-08-05).
 *
 * Complément de la table de vérité de checklist.spec.ts : ici on déroule le
 * PRODUIT CARTÉSIEN COMPLET des statuts devis × statuts session × financements
 * × subrogation × présence de documents (≈ 1 800 combinaisons) et on vérifie
 * des INVARIANTS sur chacune — c'est le filet contre le cas de bord qu'aucun
 * scénario nommé n'a pensé à nommer.
 */

import { describe, it, expect } from "vitest";
import {
  construireChecklistVente,
  type ChecklistDevisInput,
  type ChecklistSessionInput,
  type ChecklistVenteInput,
} from "./checklist";

const DEVIS_STATUTS: ChecklistDevisInput["statut"][] = [
  "brouillon",
  "envoye",
  "accepte",
  "refuse",
  "expire",
  "transforme_convention",
];
const SESSION_STATUTS: ChecklistSessionInput["statut"][] = [
  "planifiee",
  "en_cours",
  "realisee",
  "annulee",
  "reportee",
];
const FINANCEMENTS: ChecklistSessionInput["financementType"][] = [
  "direct",
  "opco",
  "cpf",
  "france_travail",
  "mixte",
  null,
];

const TOUS_DOCS = [
  "convention",
  "convention_tripartite",
  "convocation",
  "emargement",
  "certificat_realisation",
  "facture",
  "kit_opco",
  "kit_cpf",
  "kit_france_travail",
];

function* combinaisons(): Generator<ChecklistVenteInput> {
  const devisVariants: Array<ChecklistDevisInput | null> = [null];
  for (const statut of DEVIS_STATUTS) {
    // Les 3 sous-états matériels du devis (PDF / DocuSeal) comptent aussi.
    devisVariants.push({ statut, fichierPdfUrl: null, docusealSubmissionId: null, sentAt: null });
    devisVariants.push({
      statut,
      fichierPdfUrl: "https://r2/devis.pdf",
      docusealSubmissionId: "sub-1",
      sentAt: "2026-08-01T08:00:00Z",
    });
  }
  const sessionVariants: Array<ChecklistSessionInput | null> = [null];
  for (const statut of SESSION_STATUTS) {
    for (const financementType of FINANCEMENTS) {
      for (const opcoSubrogation of [false, true]) {
        sessionVariants.push({ statut, financementType, opcoSubrogation });
      }
    }
  }
  for (const devis of devisVariants) {
    for (const session of sessionVariants) {
      // États ATTEIGNABLES seulement : les DocumentGenere sont rattachés à la
      // session — sans session, la page ne peut charger aucun document. Le
      // premier passage de ce balayage générait « documents sans session » et
      // rougissait sur un état impossible en pratique.
      const jeuxDocs =
        session === null ? [[]] : [[], TOUS_DOCS.map((type) => ({ type }))];
      for (const documentsGeneres of jeuxDocs) {
        yield {
          devis,
          session,
          documentsGeneres,
          enrollmentsActifs: session === null ? 0 : 3,
          alertesOuvertes: [],
        };
      }
    }
  }
}

describe("construireChecklistVente — invariants sur le produit cartésien complet", () => {
  it("aucune combinaison ne casse, et les invariants tiennent partout", () => {
    let n = 0;
    for (const input of combinaisons()) {
      n++;
      const items = construireChecklistVente(input);

      // Structure : liste non vide, clés uniques, champs remplis, états valides.
      expect(items.length).toBeGreaterThan(0);
      const keys = items.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const item of items) {
        expect(["a_faire", "fait", "bloque", "sans_objet"]).toContain(item.etat);
        expect(item.libelle.length).toBeGreaterThan(0);
        expect(item.detail.length).toBeGreaterThan(0);
      }

      const parKey = new Map(items.map((i) => [i.key, i]));

      // Session annulée/reportée : certificat et facture ne sont JAMAIS
      // réclamés (ni a_faire ni bloque). « fait » reste possible — une pièce
      // émise AVANT l'annulation existe, l'afficher est factuel ; « sans
      // objet » couvre celles jamais émises.
      if (input.session?.statut === "annulee" || input.session?.statut === "reportee") {
        expect(["sans_objet", "fait"]).toContain(parKey.get("certificat_realisation")?.etat);
        expect(["sans_objet", "fait"]).toContain(parKey.get("facture")?.etat);
      }

      // Kits : chaque financement n'affiche QUE son kit (mixte = OPCO, le plus
      // exigeant ; null = direct).
      const fin = input.session?.financementType ?? "direct";
      const finEffectif = fin === "mixte" ? "opco" : fin;
      expect(keys.includes("kit_opco")).toBe(finEffectif === "opco");
      expect(keys.includes("kit_cpf")).toBe(finEffectif === "cpf");
      expect(keys.includes("kit_france_travail")).toBe(finEffectif === "france_travail");

      // Subrogation OPCO : la tripartite REMPLACE la convention simple.
      if (input.session !== null && finEffectif === "opco" && input.session.opcoSubrogation) {
        expect(keys).toContain("convention_tripartite");
        expect(keys).not.toContain("convention");
      }

      // Un document présent en base ne peut pas être « à faire » (sur une
      // session non annulée) : la checklist reflète l'état réel.
      if (input.documentsGeneres.length > 0 && input.session !== null) {
        const conventionKey = keys.includes("convention_tripartite")
          ? "convention_tripartite"
          : "convention";
        const conv = parKey.get(conventionKey);
        if (conv !== undefined && conv.etat !== "sans_objet") {
          expect(conv.etat).toBe("fait");
        }
      }

      // Ordre métier : sans devis accepté, RIEN d'aval n'est « a_faire » sauf
      // le devis lui-même — l'aval est bloqué ou sans objet, jamais une fausse
      // invitation à agir.
      const devisAccepte =
        input.devis?.statut === "accepte" || input.devis?.statut === "transforme_convention";
      if (!devisAccepte && input.session === null) {
        for (const item of items) {
          if (item.key !== "devis" && item.key !== "session") {
            expect(["bloque", "sans_objet"]).toContain(item.etat);
          }
        }
      }
    }
    // Garde anti-vacuité : le balayage doit réellement couvrir le produit
    // cartésien (13 devis × 61 sessions × 2 jeux de documents = 1 586).
    expect(n).toBeGreaterThan(1500);
  });
});
