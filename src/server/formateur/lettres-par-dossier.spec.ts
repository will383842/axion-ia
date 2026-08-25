/**
 * Tests — lettres-par-dossier.ts
 *
 * Ce module décide de ce qu'un formateur VOIT sur l'accueil de son espace, donc
 * de ce qu'il peut signer. Deux invariants, et rater l'un des deux ne se voit
 * pas en revue de diff :
 *
 *  1. **Le mandat se vérifie AVANT la déduplication.** Une lettre qui nomme
 *     quelqu'un d'autre ne doit pas consommer la clé du dossier, sinon elle
 *     efface celle du lecteur — silencieusement, et jusqu'à la prochaine
 *     réémission.
 *  2. **Deux dossiers ne se confondent jamais.** Deux sessions, deux clients,
 *     une session et une lettre-cadre : chacun garde sa lettre.
 */

import { describe, it, expect } from "vitest";

import { dossierDeLaLettre, retenirUneLettreParDossier } from "./lettres-par-dossier";

const MOI = "22222222-2222-4222-8222-222222222222";
const AUTRE = "44444444-4444-4444-8444-444444444444";

const SESSION_ALPHA = "11111111-1111-4111-8111-111111111111";
const SESSION_BETA = "33333333-3333-4333-8333-333333333333";

/** Une candidate nommée, pour que les assertions se lisent. */
function lettre(nom: string, dossier: string, mandataireId: string | null) {
  return { nom, dossier, mandataireId };
}

describe("dossierDeLaLettre", () => {
  it("range une lettre de session sous SA session", () => {
    const dossier = dossierDeLaLettre({
      sessionId: SESSION_ALPHA,
      clePeriodeCadre: null,
      pieceId: "piece-1",
    });
    expect(dossier).toContain(SESSION_ALPHA);
  });

  it("range une lettre-cadre sous SA période", () => {
    const dossier = dossierDeLaLettre({
      sessionId: null,
      clePeriodeCadre: "2026-09-01:2026-12-31",
      pieceId: "piece-1",
    });
    expect(dossier).toContain("2026-09-01");
  });

  it("laisse seule dans son dossier une lettre-cadre dont la période est illisible", () => {
    // `metadata` est une colonne Json : sa forme n'est pas garantie. Une pièce
    // dont la période ne se lit pas reste VISIBLE — la replier sur une clé
    // commune la ferait disparaître derrière une autre lettre-cadre.
    const a = dossierDeLaLettre({ sessionId: null, clePeriodeCadre: null, pieceId: "piece-a" });
    const b = dossierDeLaLettre({ sessionId: null, clePeriodeCadre: null, pieceId: "piece-b" });
    expect(a).not.toBe(b);
  });

  it("🔴 une période de lettre-cadre ne peut PAS valoir la clé d'une session", () => {
    // Les deux familles sont préfixées. Sans cela, une période dont la chaîne
    // vaudrait par accident un identifiant de session ferait disparaître l'une
    // des deux pièces — un mandat effacé de l'écran par une collision de
    // chaînes, sans trace ni message.
    const session = dossierDeLaLettre({
      sessionId: SESSION_ALPHA,
      clePeriodeCadre: null,
      pieceId: "piece-1",
    });
    const cadre = dossierDeLaLettre({
      sessionId: null,
      clePeriodeCadre: SESSION_ALPHA,
      pieceId: "piece-2",
    });
    expect(session).not.toBe(cadre);
  });
});

describe("retenirUneLettreParDossier — le mandat", () => {
  it("retient la lettre qui me nomme", () => {
    const retenues = retenirUneLettreParDossier([lettre("mienne", "session:a", MOI)], MOI);
    expect(retenues.map((l) => l.nom)).toStrictEqual(["mienne"]);
  });

  it("écarte la lettre qui nomme quelqu'un d'autre", () => {
    const retenues = retenirUneLettreParDossier([lettre("autre", "session:a", AUTRE)], MOI);
    expect(retenues).toStrictEqual([]);
  });

  it("écarte la lettre qui ne nomme personne d'identifiable", () => {
    // Le générateur a alors imprimé la raison sociale de l'organisme à la place
    // d'un nom : la pièce est à régénérer, pas à signer.
    const retenues = retenirUneLettreParDossier([lettre("orpheline", "session:a", null)], MOI);
    expect(retenues).toStrictEqual([]);
  });
});

describe("retenirUneLettreParDossier — un dossier, une lettre", () => {
  it("garde la PLUS RÉCENTE d'un même dossier (l'ordre d'entrée fait foi)", () => {
    const retenues = retenirUneLettreParDossier(
      [lettre("recente", "session:a", MOI), lettre("ancienne", "session:a", MOI)],
      MOI,
    );
    expect(retenues.map((l) => l.nom)).toStrictEqual(["recente"]);
  });

  it("🔴 deux dossiers coexistent — deux sessions, deux clients", () => {
    // L'espace d'un formateur qui anime pour deux clients porte deux mandats
    // distincts. Les replier l'un sur l'autre en cacherait un.
    const retenues = retenirUneLettreParDossier(
      [
        lettre("client-alpha", `session:${SESSION_ALPHA}`, MOI),
        lettre("client-beta", `session:${SESSION_BETA}`, MOI),
      ],
      MOI,
    );
    expect(retenues.map((l) => l.nom)).toStrictEqual(["client-alpha", "client-beta"]);
  });

  it("une lettre-cadre et une lettre de session ne se remplacent pas", () => {
    const retenues = retenirUneLettreParDossier(
      [
        lettre("cadre", "cadre:2026-09-01:2026-12-31", MOI),
        lettre("session", `session:${SESSION_ALPHA}`, MOI),
      ],
      MOI,
    );
    expect(retenues).toHaveLength(2);
  });
});

describe("🔴 la lettre d'un autre mandataire n'efface pas la mienne", () => {
  it("garde ma lettre même quand une lettre plus récente du même dossier nomme un autre", () => {
    // LE défaut corrigé. Un remplacement de formateur principal réémet la lettre
    // de la session au nom du remplaçant ; le remplacé reste souvent
    // co-animateur, donc membre de la session, donc la pièce du remplaçant lui
    // parvenait — et consommait la clé du dossier avant que le mandat ne soit
    // vérifié. Sa propre lettre, plus ancienne, disparaissait alors comme un
    // doublon : il ne la signait plus, et n'était plus payé, pendant que la
    // console continuait de la compter en attente de sa signature.
    const retenues = retenirUneLettreParDossier(
      [
        lettre("reemise-au-nom-du-remplacant", `session:${SESSION_ALPHA}`, AUTRE),
        lettre("la-mienne", `session:${SESSION_ALPHA}`, MOI),
      ],
      MOI,
    );
    expect(retenues.map((l) => l.nom)).toStrictEqual(["la-mienne"]);
  });

  it("ne laisse pas la lettre d'un autre client masquer la mienne", () => {
    // Même mécanique, vue du cloisonnement : rien de ce qui appartient au
    // dossier d'un autre ne doit peser sur ce que je vois du mien.
    const retenues = retenirUneLettreParDossier(
      [
        lettre("client-beta-autre-formateur", `session:${SESSION_BETA}`, AUTRE),
        lettre("client-alpha-la-mienne", `session:${SESSION_ALPHA}`, MOI),
        lettre("client-beta-la-mienne", `session:${SESSION_BETA}`, MOI),
      ],
      MOI,
    );
    expect(retenues.map((l) => l.nom)).toStrictEqual([
      "client-alpha-la-mienne",
      "client-beta-la-mienne",
    ]);
  });
});

describe("retenirUneLettreParDossier — contrat d'appel", () => {
  it("ne mute ni ne réordonne l'entrée", () => {
    const entree = [
      lettre("b", `session:${SESSION_BETA}`, MOI),
      lettre("a", `session:${SESSION_ALPHA}`, MOI),
    ];
    const copie = [...entree];
    retenirUneLettreParDossier(entree, MOI);
    expect(entree).toStrictEqual(copie);
  });

  it("rend une liste VIDE plutôt que de lever — cas normal d'un salarié permanent", () => {
    expect(retenirUneLettreParDossier([], MOI)).toStrictEqual([]);
  });
});
