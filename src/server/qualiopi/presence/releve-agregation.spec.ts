/**
 * 🔴 `DIST-03` — le relevé remis à l'OPCO comptait des CRÉNEAUX, pas des gens.
 *
 * Une session sur deux demi-journées imprimait **deux lignes par stagiaire**, et
 * concluait « Stagiaires conformes : 8 / 8 » pour **quatre** personnes.
 *
 * Ce document remplace la feuille d'émargement pour le distanciel et part au
 * financeur : il déclarait un effectif double.
 *
 * ## Ce que ce fichier garde
 *
 * 1. une ligne par personne, quel que soit le nombre de créneaux ;
 * 2. les bornes horaires sont les VRAIES (première connexion, dernière
 *    déconnexion), pas celles d'un créneau au hasard ;
 * 3. la durée est la SOMME — c'est ce que l'OPCO finance ;
 * 4. la conformité se juge sur le **seuil annoncé par le document**, pas sur le
 *    seuil fixe de 50 % par créneau qui était appliqué en douce ;
 * 5. sans durée prévue, on n'affirme RIEN.
 */

import { describe, it, expect } from "vitest";
import { agregerReleveParStagiaire, type CreneauReleve } from "./releve-agregation";

const FORMATS = {
  // Formats volontairement lisibles : le test porte sur l'AGRÉGATION, pas sur
  // le fuseau — la conversion Europe/Paris est déjà couverte par `time.spec.ts`.
  formatHeure: (d: Date) => d.toISOString().slice(11, 16),
  formatDuree: (m: number) => `${m}min`,
};

const ALICE = "enr-alice";
const BOB = "enr-bob";

function creneau(p: Partial<CreneauReleve> & { enrollmentId: string }): CreneauReleve {
  return {
    nomPrenom: p.enrollmentId === ALICE ? "Alice Martin" : "Bob Durand",
    heureConnexion: null,
    heureDeconnexion: null,
    dureeRealiseeMinutes: 0,
    dureePrevueMinutes: 0,
    ...p,
  };
}

describe("🔴 DIST-03 — une ligne par STAGIAIRE", () => {
  it("🔴 deux demi-journées ne font PAS deux stagiaires", () => {
    // LE défaut : 2 personnes × 2 créneaux = 4 lignes, et « 4/4 conformes ».
    const lignes = agregerReleveParStagiaire(
      [
        creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 180, dureePrevueMinutes: 180 }),
        creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 180, dureePrevueMinutes: 180 }),
        creneau({ enrollmentId: BOB, dureeRealiseeMinutes: 180, dureePrevueMinutes: 180 }),
        creneau({ enrollmentId: BOB, dureeRealiseeMinutes: 180, dureePrevueMinutes: 180 }),
      ],
      80,
      FORMATS,
    );

    expect(lignes, "le relevé compte encore des créneaux").toHaveLength(2);
    expect(lignes.map((l) => l.nomPrenom)).toEqual(["Alice Martin", "Bob Durand"]);
  });

  it("les bornes horaires sont la PREMIÈRE connexion et la DERNIÈRE déconnexion", () => {
    // Une ligne par créneau affichait la plage d'une demi-journée en la
    // présentant comme celle de la séance.
    const lignes = agregerReleveParStagiaire(
      [
        creneau({
          enrollmentId: ALICE,
          heureConnexion: new Date("2026-06-01T13:00:00Z"),
          heureDeconnexion: new Date("2026-06-01T16:00:00Z"),
        }),
        creneau({
          enrollmentId: ALICE,
          heureConnexion: new Date("2026-06-01T08:00:00Z"),
          heureDeconnexion: new Date("2026-06-01T11:30:00Z"),
        }),
      ],
      80,
      FORMATS,
    );

    expect(lignes[0]?.heureConnexion).toBe("08:00");
    expect(lignes[0]?.heureDeconnexion).toBe("16:00");
  });

  it("la durée effective est la SOMME — c'est ce que l'OPCO finance", () => {
    const lignes = agregerReleveParStagiaire(
      [
        creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 175, dureePrevueMinutes: 180 }),
        creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 170, dureePrevueMinutes: 180 }),
      ],
      80,
      FORMATS,
    );
    expect(lignes[0]?.dureeEffective).toBe("345min");
  });

  it("🔴 la conformité suit le SEUIL ANNONCÉ sur le document", () => {
    // 300 / 360 = 83,3 %. Conforme à 80 %, non conforme à 90 % : c'est le seuil
    // imprimé en en-tête qui décide, et c'est lui qui engage l'organisme devant
    // le financeur. L'ancien code jugeait sur un seuil FIXE de 50 % par créneau,
    // sans rapport avec ce que le document affichait.
    const creneaux = [
      creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 150, dureePrevueMinutes: 180 }),
      creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 150, dureePrevueMinutes: 180 }),
    ];
    expect(agregerReleveParStagiaire(creneaux, 80, FORMATS)[0]?.presenceValidee).toBe(true);
    expect(agregerReleveParStagiaire(creneaux, 90, FORMATS)[0]?.presenceValidee).toBe(false);
  });

  it("🔴 sans durée PRÉVUE, on n'affirme pas la conformité", () => {
    // Cas d'une session dont les journées n'ont pas été déclarées. Rendre
    // « conforme » par commodité fabriquerait la preuve que le document est
    // censé porter.
    const lignes = agregerReleveParStagiaire(
      [creneau({ enrollmentId: ALICE, dureeRealiseeMinutes: 300, dureePrevueMinutes: 0 })],
      80,
      FORMATS,
    );
    expect(lignes[0]?.presenceValidee).toBe(false);
  });

  it("un stagiaire absent à tout reste présent au relevé, marqué non conforme", () => {
    // Témoin inverse : l'agrégation ne doit pas faire DISPARAÎTRE quelqu'un.
    // Une feuille d'émargement qui omet un inscrit est aussi fausse qu'une qui
    // le compte deux fois.
    const lignes = agregerReleveParStagiaire(
      [creneau({ enrollmentId: BOB, dureeRealiseeMinutes: 0, dureePrevueMinutes: 360 })],
      80,
      FORMATS,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.presenceValidee).toBe(false);
    expect(lignes[0]?.heureConnexion).toBe("—");
  });

  it("aucun créneau → aucune ligne, pas une ligne vide", () => {
    expect(agregerReleveParStagiaire([], 80, FORMATS)).toEqual([]);
  });
});
