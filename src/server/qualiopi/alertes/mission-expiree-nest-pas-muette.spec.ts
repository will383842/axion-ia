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
    expect(corps).toContain('missionsFormateur: { where: { statut: "acceptee" }');
    expect(corps).toContain("if (m.session.missionsFormateur.length > 0) continue;");
  });

  it("une seule alerte par session, même si deux propositions ont expiré", () => {
    expect(corpsDeLaRegle()).toContain("vues.has(m.session.id)");
  });
});

/**
 * 🔴 ET ELLE DOIT POUVOIR S'ÉTEINDRE — 2026-09-06.
 *
 * La règle ci-dessus était juste, et elle produisait une critique INEFFAÇABLE.
 * Sa condition est un fait passé qui ne change plus : proposition expirée,
 * session démarrée, aucun accord tracé — et `repondreMission` refuse toute
 * réponse dès que `dateDebut <= now`. Rien ne peut faire disparaître la cause.
 *
 * La résoudre à la main ne servait à rien : `creerOuDedup` ne dédoublonne que
 * sur les alertes NON résolues, donc le balayage suivant la recrée à
 * l'identique. `resolutionAuto` ne pilote QUE la résolution automatique, pas la
 * re-création — c'est le piège, parce que son nom laisse croire l'inverse.
 * Vécu le 2026-09-06 sur AXI-SESS-2026-001 : résolue à la main, revenue dans
 * l'heure.
 *
 * 🔑 Une critique qu'aucun geste ne peut fermer apprend à ignorer les critiques.
 * Le remède n'est pas de la taire : c'est de lui donner les DEUX SORTIES que son
 * propre message prescrit — « vérifiez que la session a bien été animée, et
 * consignez un incident si elle ne l'a pas été ».
 */
describe("🔴 l'alerte a une SORTIE : elle s'éteint quand sa question a reçu sa réponse", () => {
  it("une trace de présence l'éteint — la session a bien été animée", () => {
    // Première des deux issues prescrites, et elle est établie par une signature
    // d'émargement plutôt que par un clic : une preuve opposable à un
    // certificateur, pas une déclaration.
    expect(
      corpsDeLaRegle(),
      "la règle ne regarde plus les traces de présence : elle criera même sur une " +
        "session dont l'émargement est signé, c'est-à-dire dont on SAIT qu'elle a été " +
        "animée — et plus rien ne pourra l'éteindre.",
    ).toContain("emargementSignatures: { some: { revokedAt: null } }");
  });

  it("un incident consigné l'éteint — l'organisme a instruit le cas", () => {
    // Seconde issue prescrite, pour le cas où la session n'a PAS été animée.
    expect(
      corpsDeLaRegle(),
      "la règle ne regarde plus les incidents : consigner un incident — le geste " +
        "qu'elle réclame elle-même quand la session n'a pas été animée — ne la ferme " +
        "toujours pas.",
    ).toContain("incidents: { none: {} }");
  });

  it("elle reste levée tant qu'AUCUNE des deux réponses n'existe", () => {
    // Contre-témoin : les deux sorties sont des `none`, donc la règle ne se tait
    // que si la preuve est ABSENTE. Une garde qui aurait inversé le sens
    // éteindrait l'alerte précisément quand elle doit crier.
    const corps = corpsDeLaRegle();
    expect(corps).toContain("enrollments: { none: {");
    expect(corps).not.toContain("enrollments: { some: { emargementSignatures");
  });
});
