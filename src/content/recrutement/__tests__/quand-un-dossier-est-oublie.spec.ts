/**
 * LA RÈGLE DE L'OUBLI — un témoin PAR BRANCHE, et des contre-témoins.
 *
 * 🔴 Pourquoi les contre-témoins comptent autant que les témoins. Une règle qui
 * rend « oublié » pour tout le monde passerait la moitié de ces tests. Ce qui
 * la prouve, ce sont les cas qui doivent rendre `null` : le dossier refermé, le
 * dossier récent, le dossier suivi. Sans eux, l'écran de rattrapage se
 * remplirait de dossiers normaux — et un écran d'alerte plein de faux positifs
 * cesse d'être regardé, ce qui est pire que pas d'écran.
 *
 * Toutes les dates sont FIXES. Une règle qui se teste contre « maintenant »
 * devient verte ou rouge selon l'heure à laquelle la CI tourne.
 */

import { describe, it, expect } from "vitest";

import {
  motifDOubli,
  joursDepuis,
  SEUIL_SANS_ACTIVITE_JOURS,
  SEUIL_SANS_REPONSE_JOURS,
  SEUIL_LE_PLUS_COURT_JOURS,
  type DossierAExaminer,
} from "../oubli";
import { STATUTS_CANDIDATURE, estOuvert } from "../statuts";
import type { JobApplicationStatus } from "../../../../prisma/generated/client";

const MAINTENANT = new Date("2026-09-03T12:00:00.000Z");

function ilYA(jours: number): Date {
  return new Date(MAINTENANT.getTime() - jours * 24 * 60 * 60 * 1000);
}

function dossier(p: Partial<DossierAExaminer> = {}): DossierAExaminer {
  return {
    status: "reviewing",
    submittedAt: ilYA(1),
    firstResponseAt: null,
    lastActivityAt: null,
    ...p,
  };
}

describe("un candidat qui n'a jamais eu de réponse", () => {
  it("est signalé au-delà du seuil", () => {
    const d = dossier({ submittedAt: ilYA(SEUIL_SANS_REPONSE_JOURS + 1) });
    expect(motifDOubli(d, MAINTENANT)).toBe("jamais_repondu");
  });

  it("ne l'est PAS avant le seuil — le recrutement a le droit de prendre trois jours", () => {
    const d = dossier({ submittedAt: ilYA(SEUIL_SANS_REPONSE_JOURS - 1) });
    expect(motifDOubli(d, MAINTENANT)).toBeNull();
  });

  it("ne l'est plus dès qu'une réponse est partie, même ancienne", () => {
    // 🔑 Le dossier reste « sans activité » plus bas ; ce test isole la
    // première branche : `firstResponseAt` renseigné la ferme, point.
    const d = dossier({
      submittedAt: ilYA(SEUIL_SANS_REPONSE_JOURS + 5),
      firstResponseAt: ilYA(SEUIL_SANS_REPONSE_JOURS + 4),
      lastActivityAt: ilYA(1),
    });
    expect(motifDOubli(d, MAINTENANT)).toBeNull();
  });

  it("l'emporte sur « sans activité » quand les deux sont vrais", () => {
    // Une note interne d'avant-hier rend le dossier actif de NOTRE point de
    // vue et ne change rien pour le candidat, qui n'a toujours rien reçu.
    // Annoncer le motif le plus doux mentirait sur ce qui reste à faire.
    const d = dossier({
      submittedAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 10),
      firstResponseAt: null,
      lastActivityAt: ilYA(2),
    });
    expect(motifDOubli(d, MAINTENANT)).toBe("jamais_repondu");
  });
});

describe("un dossier que plus rien ne fait avancer", () => {
  it("est signalé au-delà du seuil d'activité", () => {
    const d = dossier({
      submittedAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 30),
      firstResponseAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 29),
      lastActivityAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 1),
    });
    expect(motifDOubli(d, MAINTENANT)).toBe("sans_activite");
  });

  it("ne l'est pas quand une ligne a été consignée récemment", () => {
    const d = dossier({
      submittedAt: ilYA(120),
      firstResponseAt: ilYA(119),
      lastActivityAt: ilYA(2),
    });
    expect(motifDOubli(d, MAINTENANT)).toBeNull();
  });

  it("retombe sur la date de dépôt quand le journal est VIDE", () => {
    // 🔴 Un dossier sans la moindre ligne de journal n'est pas « sans date donc
    // sans problème » : c'est le cas le plus abandonné qui soit. Avec une ancre
    // à `null` traitée comme « récente », il serait devenu invisible.
    const d = dossier({
      submittedAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 2),
      firstResponseAt: ilYA(SEUIL_SANS_ACTIVITE_JOURS + 1),
      lastActivityAt: null,
    });
    expect(motifDOubli(d, MAINTENANT)).toBe("sans_activite");
  });
});

describe("un dossier refermé n'est jamais oublié", () => {
  // Dérivé de l'enum, pas d'une liste recopiée : un statut ajouté au schéma
  // entre dans ce test tout seul, du bon côté.
  const fermes = STATUTS_CANDIDATURE.filter((s) => !estOuvert(s));

  it.each(fermes)("%s — même très vieux et sans la moindre réponse", (statut) => {
    const d = dossier({
      status: statut as JobApplicationStatus,
      submittedAt: ilYA(400),
      firstResponseAt: null,
      lastActivityAt: null,
    });
    expect(motifDOubli(d, MAINTENANT)).toBeNull();
  });

  it("couvre bien les quatre états refermés — sinon la boucle ci-dessus ne prouve rien", () => {
    // Le témoin qui distingue « rien à signaler » de « je n'ai rien parcouru ».
    expect([...fermes].sort()).toEqual(["archived", "hired", "rejected", "withdrawn"]);
  });
});

describe("les seuils tiennent ensemble", () => {
  it("le plus court des deux borne la requête sans jamais trancher", () => {
    // 🔑 C'est l'invariant qui rend correct le pré-filtre SQL de
    // `listerDossiersEnSommeil` : un dossier déposé APRÈS cette borne ne peut
    // être oublié par AUCUNE des deux branches, puisque les deux ancres sont
    // ≥ `submittedAt`.
    expect(SEUIL_LE_PLUS_COURT_JOURS).toBe(
      Math.min(SEUIL_SANS_REPONSE_JOURS, SEUIL_SANS_ACTIVITE_JOURS),
    );
    const juste = dossier({
      submittedAt: ilYA(SEUIL_LE_PLUS_COURT_JOURS - 1),
      lastActivityAt: null,
      firstResponseAt: null,
    });
    expect(motifDOubli(juste, MAINTENANT)).toBeNull();
  });
});

describe("l'âge affiché", () => {
  it("compte des jours PLEINS — 23 h ne font pas encore un jour", () => {
    expect(joursDepuis(new Date(MAINTENANT.getTime() - 23 * 3_600_000), MAINTENANT)).toBe(0);
    expect(joursDepuis(new Date(MAINTENANT.getTime() - 25 * 3_600_000), MAINTENANT)).toBe(1);
  });
});
