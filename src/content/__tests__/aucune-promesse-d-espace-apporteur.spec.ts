/**
 * aucune-promesse-d-espace-apporteur.spec.ts
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * La copy publique de `/devenir-commercial-ia` répondait ceci à la question
 * « Comment suis-je sûr de toucher mes commissions ? » :
 *
 *   « Chaque entreprise démarchée est enregistrée sur VOTRE DASHBOARD à votre nom.
 *     Toute vente signée [...] déclenche votre commission, tracée de bout en bout. »
 *
 * Et ailleurs : « Vous renseignez sur votre dashboard les entreprises démarchées
 * [...] — c'est ce qui SÉCURISE et déclenche vos commissions. »
 *
 * Ce tableau de bord n'existe pas. Il est le projet **Axion Partners**, dépôt
 * séparé : au 2026-09-07 la zone « espace » y compte 43 tâches pour 38,25 jours,
 * TOUTES `a_faire`. Les deux écrans exactement promis ici sont `UX-P1-05`
 * (« Mes entreprises ») et `UX-P2-01` (« Mes commissions »).
 *
 * 🔑 CE N'ÉTAIT PAS UN ORNEMENT. Le dashboard était présenté comme LE MÉCANISME
 * qui protège l'apporteur, en réponse directe à sa question sur la sécurité de sa
 * rémunération. Un candidat lisait que sa protection existait ; elle n'existait
 * nulle part — et le bouton « Postuler » était ouvert.
 *
 * Ce que cette garde tient : tant que l'espace n'est pas EN LIGNE, la copy décrit
 * le processus réel (une déclaration à l'équipe) et n'annonce aucun outil en
 * libre-service. Le jour où `UX-P1-05` et `UX-P2-01` sont déployées, cette garde
 * se RETIRE — elle n'est pas une interdiction permanente, elle est un cliquet
 * contre l'annonce d'un outil au présent avant qu'il n'existe.
 *
 * ⚠️ Elle ne remplace pas `JUR-T29` (« copy publique de rémunération en formulation
 * indicative »), qui traite un défaut DIFFÉRENT — la fermeté des montants — et qui
 * reste à faire.
 */
import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_FAQ_FIXED,
  COMMERCIAL_HERO,
  COMMERCIAL_HERO_NODES,
  COMMERCIAL_OPPORTUNITY,
  COMMERCIAL_STEPS,
} from "@/content/recrutement/commercial-offer";

/** Tout le texte lisible par un candidat, aplati depuis les SSOT du module. */
function copyApporteur(): string {
  return JSON.stringify([
    COMMERCIAL_HERO_NODES,
    COMMERCIAL_HERO,
    COMMERCIAL_OPPORTUNITY,
    COMMERCIAL_STEPS,
    COMMERCIAL_FAQ_FIXED,
  ]);
}

/**
 * Les tournures qui annoncent un outil en libre-service APPARTENANT à l'apporteur.
 * On vise la POSSESSION (« votre dashboard »), pas le mot seul : Axion-IA vend par
 * ailleurs des tableaux de bord à ses clients, et ces pages-là sont légitimes.
 */
const PROMESSES_D_OUTIL = [
  /votre dashboard/i,
  /sur votre (?:tableau de bord|espace)/i,
  /votre espace (?:apporteur|personnel|commercial)/i,
  /\byour dashboard\b/i,
] as const;

describe("la copy apporteur n'annonce aucun espace en libre-service tant qu'il n'existe pas", () => {
  it("ne promet aucun outil possédé par l'apporteur", () => {
    const texte = copyApporteur();
    const trouvees = PROMESSES_D_OUTIL.filter((m) => m.test(texte)).map(String);
    expect(
      trouvees,
      "Axion Partners n'est pas déployé : `UX-P1-05` (« Mes entreprises ») et " +
        "`UX-P2-01` (« Mes commissions ») sont `a_faire`. Décrire le processus réel " +
        "— l'apporteur DÉCLARE ses entreprises, l'équipe les enregistre — ou déployer " +
        "l'espace avant de l'annoncer.",
    ).toEqual([]);
  });

  it("ne présente pas la traçabilité comme automatique de bout en bout", () => {
    expect(copyApporteur()).not.toMatch(/trac[ée]e? de bout en bout/i);
  });

  /**
   * 🔑 TÉMOIN POSITIF — sans lui, les deux tests ci-dessus verdiraient aussi bien
   * sur un module VIDE, renommé ou mal importé. « Je n'ai rien trouvé » et « je n'ai
   * rien lu » sont deux phrases différentes, et une seule autorise à conclure.
   */
  it("lit bien la copy réelle, et elle décrit le processus qui existe", () => {
    const texte = copyApporteur();
    expect(texte.length).toBeGreaterThan(2000);
    expect(texte).toMatch(/vous nous déclarez les entreprises démarchées/i);
    expect(texte).toMatch(/enregistrée à votre nom par notre équipe/i);
    expect(texte).toMatch(/cette déclaration fait foi/i);
  });
});
