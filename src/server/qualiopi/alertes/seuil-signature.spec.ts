/**
 * 🔴 LE SEUIL DE RÉCLAMATION D'UNE SIGNATURE ÉTAIT AVEUGLE À LA SESSION.
 *
 * On attendait sept jours après la dernière modification de la pièce, quelle
 * que soit la date de début. Une convention signée d'un seul côté pour une
 * session qui commence **dans trois jours** n'alertait pas : elle aurait
 * alerté quatre jours *après* le démarrage.
 *
 * Or la convention se conclut **avant** l'entrée en formation (L.6353-1).
 * Passé le premier jour, l'alerte ne prévient plus — elle constate.
 */

import { describe, expect, it } from "vitest";
import {
  ATTENTE_JOURS,
  MARGE_AVANT_SESSION_JOURS,
  titreReclamation,
  verdictSignature,
} from "./seuil-signature";

const MAINTENANT = new Date("2026-08-17T10:00:00Z");
const jours = (n: number) => new Date(MAINTENANT.getTime() + n * 86400000);

describe("🔴 le défaut d'origine : une session imminente n'alertait pas", () => {
  it("session dans 3 jours, pièce modifiée hier → on réclame MAINTENANT", () => {
    // C'est le cas exact que l'ancien seuil laissait passer : l'attente de
    // sept jours n'était pas écoulée, donc rien ne sortait — et la session
    // démarrait sans convention conclue.
    const v = verdictSignature({
      modifieeLe: jours(-1),
      dateDebut: jours(3),
      maintenant: MAINTENANT,
    });
    expect(v.reclamer).toBe(true);
    expect(v.motif).toBe("session_imminente");
  });

  it("session déjà commencée → motif distinct, et c'est le plus grave", () => {
    // Annoncer « imminente » sur une session démarrée ferait croire qu'il
    // reste du temps. L'écart est constitué : il ne se rattrape plus.
    const v = verdictSignature({
      modifieeLe: jours(-1),
      dateDebut: jours(-2),
      maintenant: MAINTENANT,
    });
    expect(v.motif).toBe("session_commencee");
  });

  it("la bordure exacte de la marge est INCLUSE", () => {
    expect(
      verdictSignature({
        modifieeLe: jours(-1),
        dateDebut: jours(MARGE_AVANT_SESSION_JOURS),
        maintenant: MAINTENANT,
      }).reclamer,
    ).toBe(true);
  });

  it("juste au-delà de la marge, on n'alerte pas encore", () => {
    // Le contre-test : sans lui, un seuil qui alerterait toujours passerait
    // pour correct.
    expect(
      verdictSignature({
        modifieeLe: jours(-1),
        dateDebut: jours(MARGE_AVANT_SESSION_JOURS + 1),
        maintenant: MAINTENANT,
      }).reclamer,
    ).toBe(false);
  });
});

describe("🔴 le critère « avant la session » ne REMPLACE pas l'attente", () => {
  // ⚠️ Le défaut inverse, et il est pire parce qu'il est silencieux : devis,
  // conventions de sous-traitance et lettres de mission n'ont AUCUNE session.
  // Ne garder que le critère de session les ferait disparaître de la
  // surveillance — elles attendraient indéfiniment sans que rien ne le dise.
  it("pièce sans session, en attente depuis 7 jours → réclamée", () => {
    const v = verdictSignature({
      modifieeLe: jours(-ATTENTE_JOURS),
      dateDebut: null,
      maintenant: MAINTENANT,
    });
    expect(v.reclamer).toBe(true);
    expect(v.motif).toBe("attente");
  });

  it("pièce sans session, en attente depuis 3 jours → pas encore", () => {
    expect(
      verdictSignature({ modifieeLe: jours(-3), dateDebut: null, maintenant: MAINTENANT }).reclamer,
    ).toBe(false);
  });

  it("session lointaine mais attente écoulée → réclamée pour attente", () => {
    // Les deux causes coexistent : la session dans deux mois ne dispense pas
    // de relancer une pièce qui dort depuis une semaine.
    const v = verdictSignature({
      modifieeLe: jours(-30),
      dateDebut: jours(60),
      maintenant: MAINTENANT,
    });
    expect(v.motif).toBe("attente");
  });
});

describe("🔴 le titre DIT pourquoi l'alerte sort maintenant", () => {
  // Il était figé — « Pièce signée d'un seul côté depuis +7 jours » — y compris
  // quand la vraie raison était l'imminence de la session. Un titre qui donne
  // le mauvais motif fait chercher au mauvais endroit : on regarde depuis quand
  // la pièce dort, au lieu de regarder quand la session commence.
  it("imminence : il parle de la session, pas de l'attente", () => {
    const t = titreReclamation({ motif: "session_imminente", partielle: true });
    expect(t).toContain("session");
    expect(t).not.toContain(`+${ATTENTE_JOURS} jours`);
  });

  it("session commencée : il le dit en toutes lettres", () => {
    expect(titreReclamation({ motif: "session_commencee", partielle: true })).toContain(
      "DÉJÀ commencé",
    );
  });

  it("attente : l'ancien titre reste, il était juste dans ce cas-là", () => {
    expect(titreReclamation({ motif: "attente", partielle: true })).toContain(
      `+${ATTENTE_JOURS} jours`,
    );
  });

  it("il distingue « un seul côté » de « aucune signature »", () => {
    // Deux situations, deux gestes : contresigner, ou relancer le signataire.
    expect(titreReclamation({ motif: "attente", partielle: true })).toContain("un seul côté");
    expect(titreReclamation({ motif: "attente", partielle: false })).toContain("aucune signature");
  });

  it("les trois motifs produisent trois titres DISTINCTS", () => {
    const t = (["attente", "session_imminente", "session_commencee"] as const).map((m) =>
      titreReclamation({ motif: m, partielle: true }),
    );
    expect(new Set(t).size).toBe(3);
  });
});
