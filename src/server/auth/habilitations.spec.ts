/**
 * Tests NÉGATIFS de la matrice d'habilitation.
 *
 * 🔴 Le principe qui gouverne ce fichier : « une garde ne vaut que si elle
 * rougit ». Un test qui vérifie qu'un `admin` peut attester ne prouve rien —
 * l'ancien code le permettait déjà. Ce qui doit être verrouillé, c'est le REFUS.
 *
 * Chaque interdit de la matrice a donc son test négatif, et le test
 * d'exhaustivité (`ACTES_ENGAGEANTS`) empêche qu'un acte ajouté demain échappe
 * silencieusement à la vérification : ajouter une clé à `HABILITATIONS` sans
 * l'inscrire ici fait rougir la suite.
 */

import { describe, it, expect } from "vitest";
import {
  ACTES_ENGAGEANTS,
  HABILITATIONS,
  MOTIF_REFUS,
  actesAutorises,
  peutEcrire,
  peutEngager,
  type ActeEngageant,
} from "./habilitations";

/** Rôles qui ne doivent JAMAIS engager l'organisme, quel que soit l'acte. */
const ROLES_NON_ENGAGEANTS = ["secretaire", "editor", "reader"] as const;

describe("matrice d'habilitation — tests négatifs", () => {
  it.each(ROLES_NON_ENGAGEANTS)("le rôle « %s » ne peut poser AUCUN acte engageant", (role) => {
    for (const acte of ACTES_ENGAGEANTS) {
      expect(peutEngager(role, acte), `${role} ne doit pas pouvoir « ${acte} »`).toBe(false);
    }
    expect(actesAutorises(role)).toEqual([]);
  });

  it("le responsable qualité n'engage jamais l'organisme sur le contractuel ni le financier", () => {
    // Le RNQ lui confie la qualité de l'action (ind. 11/21/22), pas le contrat.
    expect(peutEngager("responsable_qualite", "conclure_devis")).toBe(false);
    expect(peutEngager("responsable_qualite", "facturer")).toBe(false);
    expect(peutEngager("responsable_qualite", "contresigner")).toBe(false);
    expect(peutEngager("responsable_qualite", "deposer_demande_financeur")).toBe(false);
  });

  it("un rôle inconnu, vide, nul ou indéfini est refusé — jamais autorisé par défaut", () => {
    for (const acte of ACTES_ENGAGEANTS) {
      expect(peutEngager(undefined, acte)).toBe(false);
      expect(peutEngager(null, acte)).toBe(false);
      expect(peutEngager("", acte)).toBe(false);
      expect(peutEngager("Admin", acte)).toBe(false); // casse différente = rôle inconnu
      expect(peutEngager("responsable-qualite", acte)).toBe(false); // tiret ≠ underscore
    }
  });

  it("aucun acte n'est ouvert à tous : chaque acte a au moins un rôle exclu", () => {
    const TOUS_LES_ROLES = [
      "super_admin",
      "admin",
      "responsable_qualite",
      "secretaire",
      "editor",
      "reader",
    ];
    for (const acte of ACTES_ENGAGEANTS) {
      const exclus = TOUS_LES_ROLES.filter((r) => !peutEngager(r, acte));
      expect(
        exclus.length,
        `« ${acte} » n'exclut personne — ce n'est pas un acte engageant`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("matrice d'habilitation — invariants de structure", () => {
  it("la direction (super_admin, admin) peut poser TOUS les actes", () => {
    for (const acte of ACTES_ENGAGEANTS) {
      expect(peutEngager("super_admin", acte), `super_admin bloqué sur « ${acte} »`).toBe(true);
      expect(peutEngager("admin", acte), `admin bloqué sur « ${acte} »`).toBe(true);
    }
  });

  it("chaque acte porte un motif de refus non vide — un bouton absent doit s'expliquer", () => {
    for (const acte of ACTES_ENGAGEANTS) {
      const motif = MOTIF_REFUS[acte];
      expect(motif, `« ${acte} » sans motif de refus`).toBeTruthy();
      expect(motif.trim().length).toBeGreaterThan(30);
    }
  });

  it("MOTIF_REFUS et HABILITATIONS couvrent exactement les mêmes actes", () => {
    expect(Object.keys(MOTIF_REFUS).sort()).toEqual(Object.keys(HABILITATIONS).sort());
  });

  it("les sept actes engageants attendus sont présents — un retrait doit rougir", () => {
    // Verrou d'exhaustivité : retirer un acte de la matrice retire une garde du
    // serveur. Ce test rend ce retrait visible en revue, au lieu de le laisser
    // passer dans un diff de 40 fichiers.
    const attendus: ActeEngageant[] = [
      "attester",
      "conclure_devis",
      "contresigner",
      "deposer_demande_financeur",
      "facturer",
      "habiliter_formateur",
      "valider_evaluation",
    ];
    expect([...ACTES_ENGAGEANTS].sort()).toEqual(attendus.sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LES DEUX MOITIÉS DE LA FRONTIÈRE DOIVENT RESTER D'ACCORD
//
// Trouvé le 2026-08-17 : `requireAdminWrite` portait SA propre liste de rôles,
// écrite en dur, et `responsable_qualite` / `secretaire` n'y figuraient pas.
// Les deux rôles créés le 15/08 étaient donc INERTES — des comptes en lecture
// déguisés — pendant que le commentaire du SSOT affirmait l'inverse.
//
// Ce que ces tests interdisent : que la matrice des actes ENGAGEANTS et la
// liste des rôles qui peuvent ÉCRIRE puissent se contredire.
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 qui engage doit d'abord pouvoir écrire", () => {
  it.each([...new Set(Object.values(HABILITATIONS).flatMap((r) => [...r]))].sort())(
    "%s : porte un acte engageant, donc il peut écrire",
    (role) => {
      // 🔴 L'absurdité que ce test rend impossible : un rôle autorisé à ATTESTER
      // mais incapable de CRÉER UNE SESSION. C'est exactement l'état dans lequel
      // `responsable_qualite` a vécu deux jours — habilité à attester par la
      // matrice, refusé par la garde d'écriture.
      expect(
        peutEcrire(role),
        `« ${role} » peut poser un acte qui ENGAGE l'organisme mais ne peut pas ` +
          `poser un acte qui n'engage rien. Un rôle qui peut attester et ne peut ` +
          `pas créer de session ne sert à personne.`,
      ).toBe(true);
    },
  );
});

describe("🔴 la liste d'écriture dit ce qu'elle doit dire", () => {
  it("les deux rôles du Lot 10 peuvent écrire", () => {
    // Le cas exact du défaut. Sans eux, « n'importe quelle secrétaire gère le
    // système » — l'objectif écrit en tête du SSOT — est faux.
    expect(peutEcrire("secretaire")).toBe(true);
    expect(peutEcrire("responsable_qualite")).toBe(true);
  });

  it("`reader` ne peut PAS écrire", () => {
    // Le seul rôle qui doit rester dehors : c'est le compte de consultation.
    // L'y faire entrer transformerait une lecture en écriture silencieuse.
    expect(peutEcrire("reader")).toBe(false);
  });

  it("un rôle inconnu ne peut pas écrire", () => {
    // Défaut fermé : un rôle absent de l'énum (session forgée, migration
    // partielle) ne doit pas hériter du droit d'écrire.
    expect(peutEcrire("un_role_qui_nexiste_pas")).toBe(false);
    expect(peutEcrire(null)).toBe(false);
    expect(peutEcrire(undefined)).toBe(false);
  });

  it("`secretaire` écrit, mais n'engage RIEN", () => {
    // La frontière du Lot 10, dans les deux sens : le rôle est plein côté
    // délégable, vide côté engageant. C'est ce qui le rend utilisable sans
    // qu'il puisse conclure un contrat.
    expect(peutEcrire("secretaire")).toBe(true);
    expect(actesAutorises("secretaire")).toEqual([]);
  });

  it("`responsable_qualite` engage sur le domaine QUALITÉ, jamais sur le contractuel", () => {
    const actes = actesAutorises("responsable_qualite");
    expect(actes).toContain("attester");
    expect(actes).toContain("valider_evaluation");
    expect(actes).toContain("habiliter_formateur");
    expect(actes).not.toContain("facturer");
    expect(actes).not.toContain("conclure_devis");
    expect(actes).not.toContain("contresigner");
  });
});
