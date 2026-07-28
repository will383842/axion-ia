/**
 * Le gate d'attestation AFEST lit-il une PREUVE, et l'action admin a-t-elle
 * cessé d'en fabriquer une ?
 *
 * Ce fichier verrouille les deux moitiés d'un même changement, et c'est
 * volontaire : `signerSeance1to1Action` posait `beneficiaireSigneAt`,
 * `formateurSigneAt` et `tuteurSigneAt` au simple clic d'un administrateur,
 * pendant que `checkAfestEnforcement` autorisait l'émission d'une attestation
 * sur la foi de la colonne de présence ainsi posée. Retirer l'un sans repointer
 * l'autre donne soit un gate qui lit une colonne que plus personne n'écrit, soit
 * une attestation adossée à un booléen que personne n'a signé.
 *
 * 🔴 Les tests de comportement ne voient pas cette classe de défaut : chaque
 * moitié, prise isolément, se comporte parfaitement. Seul un test de PROPRIÉTÉ
 * sur la source échoue quand quelqu'un ne rétablit qu'une des deux.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { estNeutralisee, presenceProuvee, type SeancePourHeures } from "./heures";

const ACTION = readFileSync(
  join(process.cwd(), "src", "server", "actions", "qualiopi", "coaching-afest.ts"),
  "utf8",
);

const seance = (o: Partial<SeancePourHeures> = {}): SeancePourHeures => ({
  dureeMinutes: 120,
  statut: "realisee",
  presenceSigneeAt: null,
  beneficiairePresent: false,
  signaturesBeneficiaire: [],
  ...o,
});

describe("presenceProuvee — la preuve de présence dépend du régime", () => {
  it("signature_reelle : seule la ligne de signature du bénéficiaire fait foi", () => {
    expect(presenceProuvee(seance({ signaturesBeneficiaire: [{}] }), "signature_reelle")).toBe(true);
  });

  it("signature_reelle : le cache `presenceSigneeAt` seul ne prouve RIEN", () => {
    // C'est très exactement le faux positif que ce chantier retire : un
    // horodatage posé côté organisme, sans signataire ni empreinte derrière.
    const cachePose = seance({ presenceSigneeAt: new Date("2026-01-01"), beneficiairePresent: true });
    expect(presenceProuvee(cachePose, "signature_reelle")).toBe(false);
  });

  it("legacy_boolean : comportement historique préservé au caractère près", () => {
    expect(presenceProuvee(seance({ presenceSigneeAt: new Date("2026-01-01") }), "legacy_boolean")).toBe(
      true,
    );
    expect(presenceProuvee(seance(), "legacy_boolean")).toBe(false);
  });

  it("legacy_boolean : insensible aux lignes de signature — zéro delta sur l'existant", () => {
    // Une signature réelle posée sur un parcours resté en legacy ne doit pas
    // changer le verdict du gate : la bascule de régime est un geste explicite.
    expect(presenceProuvee(seance({ signaturesBeneficiaire: [{}] }), "legacy_boolean")).toBe(false);
  });

  it("le mode dégradé prouve la présence — le critère est indépendant de la modalité", () => {
    // Une confirmation accessible ou un papier scanné n'ont pas de tracé.
    // Exiger une image exclurait les signataires au lecteur d'écran (ind. 26)
    // et les salles sans réseau, en bloquant leur attestation.
    const degrade = seance({ signaturesBeneficiaire: [{ methode: "confirmation_accessible" }] });
    expect(presenceProuvee(degrade, "signature_reelle")).toBe(true);
  });
});

describe("estNeutralisee — une absence légitime ne bloque pas l'attestation à vie", () => {
  it("neutralise `annulee` et `absence_justifiee`", () => {
    expect(estNeutralisee(seance({ statut: "annulee" }))).toBe(true);
    expect(estNeutralisee(seance({ statut: "absence_justifiee" }))).toBe(true);
  });

  it("ne neutralise ni `realisee`, ni `planifiee`, ni une lecture legacy sans statut", () => {
    expect(estNeutralisee(seance({ statut: "realisee" }))).toBe(false);
    expect(estNeutralisee(seance({ statut: "planifiee" }))).toBe(false);
    expect(estNeutralisee(seance({ statut: null }))).toBe(false);
  });
});

describe("atomicité H.1 + H.2 — les deux moitiés du même changement", () => {
  it("H.1 — aucun chemin admin ne pose plus un `*SigneAt`", () => {
    // On cherche l'AFFECTATION, pas la mention : les commentaires qui expliquent
    // pourquoi ces colonnes ne sont plus écrites ici doivent rester autorisés.
    expect(ACTION).not.toMatch(/\bbeneficiaireSigneAt\s*[:=][^=]/);
    expect(ACTION).not.toMatch(/\bformateurSigneAt\s*[:=][^=]/);
    expect(ACTION).not.toMatch(/\btuteurSigneAt\s*[:=][^=]/);
  });

  it("H.1 — l'action admin ne s'appelle plus « signer »", () => {
    // Le nom faisait partie du mensonge : un administrateur ne signe pas à la
    // place du bénéficiaire, du formateur et du tuteur.
    expect(ACTION).not.toMatch(/export async function signerSeance1to1Action/);
    expect(ACTION).toMatch(/export async function acterPresenceSeance1to1Action/);
  });

  it("H.2 — le gate passe par `presenceProuvee`, pas par la colonne de cache", () => {
    expect(ACTION).toMatch(/presenceProuvee\s*\(/);
    // Lire `presenceSigneeAt != null` ici, c'est rouvrir le faux positif : la
    // colonne redevient un critère alors qu'elle n'est plus qu'un cache.
    expect(ACTION).not.toMatch(/presenceSigneeAt\s*!=\s*null/);
  });

  it("H.2 — le gate neutralise les séances annulées et lit le régime du parcours", () => {
    expect(ACTION).toMatch(/estNeutralisee\s*\(/);
    expect(ACTION).toMatch(/regimePreuve: true/);
    // Un select recopié à la main est la cause racine de la divergence
    // d'origine : il oubliait `statut` et la relation de signature.
    expect(ACTION).toMatch(/\.\.\.SEANCE_HEURES_SELECT/);
  });

  it("H.2 — aucun critère du gate ne balaie la liste NON neutralisée", () => {
    // Le critère d'alternance est un `some()` : le laisser lire
    // `cs.comptesRendus` permettait à une séance ANNULÉE, dont le compte-rendu
    // avait été rempli avant l'annulation, d'attester à elle seule l'alternance
    // d'un parcours où elle n'a jamais eu lieu. Neutraliser la présence sans
    // neutraliser l'alternance déplace le trou au lieu de le fermer.
    expect(ACTION).not.toMatch(/cs\.comptesRendus\.(some|every)\s*\(/);
  });
});
