/**
 * 🔴 LA SESSION A DÉMARRÉ, LE FORMATEUR N'A JAMAIS RÉPONDU, ET RIEN NE LE DISAIT.
 *
 * ## Comment le trou s'ouvrait
 *
 * Constaté en recette le 2026-09-03 sur AXI-SESS-2026-010 : session créée pour
 * le lendemain, proposition laissée sans réponse, dates ramenées au matin même,
 * cron `missions-formateur` passé. Résultat en base : la proposition est
 * `expiree`, et la table `alertes_systeme` ne porte AUCUNE ligne au sujet du
 * formateur — seulement « diaporama manquant » et « convention manquante ».
 *
 * Deux règles auraient dû l'attraper, et elles s'excluent l'une l'autre :
 *
 *   · `formateur_mission_sans_reponse` exige `statut = "en_attente"` ET
 *     `dateDebut > now`. Or le cron passe la proposition en `expiree` À
 *     L'INSTANT où la session démarre : l'alerte s'éteint exactement quand le
 *     risque cesse d'être un risque pour devenir un fait ;
 *   · `session_sans_formateur` exige `formateurPrincipalId: null`. Or expirer
 *     ne retire pas l'affectation — `relancerEtExpirerMissions` constate un
 *     silence, il ne décide pas à la place de l'organisme.
 *
 * Chacune est juste seule ; ensemble elles laissent passer le seul cas qui
 * compte pour l'auditeur : une prestation vendue, animée — ou pas — par
 * quelqu'un dont l'accord n'a jamais été tracé.
 *
 * ## Pourquoi une garde qui LIT LA SOURCE
 *
 * `evaluateur.spec.ts` ne monte pas `prisma.missionFormateur` : les quatre
 * règles du cycle de vie du formateur y tombent déjà dans le fail-soft par
 * règle, donc un test d'intégration y serait vert sans rien exercer. On dérive
 * donc du code ce qui a fermé le trou, plutôt que de recopier une attente.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ALERTE_CATALOGUE } from "./catalogue";

const SOURCE = readFileSync(
  join(process.cwd(), "src/server/qualiopi/alertes/evaluateur.ts"),
  "utf8",
);

/** Le corps de la règle, isolé de ses voisines. */
function corpsDeLaRegle(): string {
  const debut = SOURCE.indexOf("async function regleMissionFormateurExpiree");
  expect(debut, "la règle regleMissionFormateurExpiree a disparu").toBeGreaterThan(-1);
  const suivante = SOURCE.indexOf("async function ", debut + 20);
  return SOURCE.slice(debut, suivante > debut ? suivante : SOURCE.length);
}

describe("le code existe au catalogue, au bon niveau", () => {
  const entree = ALERTE_CATALOGUE["formateur_mission_expiree"];

  it("il est déclaré", () => {
    expect(entree).toBeDefined();
  });

  it("CRITIQUE — la session a déjà démarré, il n'y a plus de marge", () => {
    // « important » conviendrait à un risque ; ici le fait est acquis, et la
    // question qui reste (la session a-t-elle été animée ?) engage le dossier
    // remis à l'auditeur.
    expect(entree?.niveau).toBe("critique");
  });

  it("guichet administratif — c'est lui qui affecte et qui appelle", () => {
    expect(entree?.guichet).toBe("administratif");
  });

  it("résolution automatique : une mission acceptée l'éteint", () => {
    expect(entree?.resolutionAuto).toBe(true);
  });

  it("🔴 son titre ne se confond pas avec celui des trois voisines", () => {
    const titres = [
      "formateur_mission_refusee",
      "formateur_mission_sans_reponse",
      "formateur_indisponible_sur_session",
    ].map((c) => ALERTE_CATALOGUE[c]?.titre);
    expect(titres).not.toContain(entree?.titre);
    expect(entree?.titre).toContain("démarrée");
  });
});

describe("la règle est branchée et regarde le bon état", () => {
  it("elle figure dans le registre des règles évaluées", () => {
    // Une règle écrite mais non enregistrée ne lève jamais — et rien ne
    // rougirait : c'est le mode d'échec le plus silencieux du moteur.
    expect(SOURCE).toContain(
      '{ nom: "formateur_mission_expiree", fn: regleMissionFormateurExpiree },',
    );
  });

  it("🔴 elle sélectionne les propositions EXPIRÉES, pas « en attente »", () => {
    const corps = corpsDeLaRegle();
    expect(corps).toContain('statut: "expiree"');
    // La condition qui aveuglait la règle voisine ne doit pas revenir ici.
    expect(corps).not.toContain('statut: "en_attente"');
  });

  it("🔴 elle n'exige PAS que l'affectation ait été retirée", () => {
    // `formateurPrincipalId: null` est ce qui empêche `session_sans_formateur`
    // de prendre le relais : l'exiger ici rendrait la nouvelle règle aussi
    // aveugle que celle qu'elle complète.
    expect(corpsDeLaRegle()).not.toContain("formateurPrincipalId");
  });

  it("elle ne regarde que des sessions DÉJÀ démarrées, et pas tout l'historique", () => {
    const corps = corpsDeLaRegle();
    expect(corps).toContain("dateDebut: { lte: now, gte: daysAgo(365, now) }");
  });

  it("🔴 une mission acceptée sur la même session éteint le signal", () => {
    // Co-animation proposée à deux, un seul répond : la session a bien un
    // formateur confirmé, et crier ici ferait désarmer l'alerte.
    const corps = corpsDeLaRegle();
    // 2026-09-06 — élargi à `accord_hors_outil` : un accord consigné par
    // l'organisme éteint l'alerte au même titre qu'une acceptation cliquée,
    // sinon le geste existerait et l'alerte resterait allumée pour toujours.
    expect(corps).toMatch(
      /missionsFormateur:\s*\{\s*where:\s*\{\s*statut:\s*\{\s*in:\s*\["acceptee",\s*"accord_hors_outil"\]/,
    );
    expect(corps).toContain("if (m.session.missionsFormateur.length > 0) continue;");
  });

  it("une seule alerte par session, même si deux propositions ont expiré", () => {
    expect(corpsDeLaRegle()).toContain("vues.has(m.session.id)");
  });
});
