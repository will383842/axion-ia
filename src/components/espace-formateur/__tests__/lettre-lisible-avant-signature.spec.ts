/**
 * `D4-1-A` — on ne signe pas une pièce qu'on ne peut pas ouvrir.
 *
 * Le formateur signait une lettre de mission **qu'il ne pouvait ni lire ni
 * recevoir** : le composant de signature ne recevait aucune URL de pièce, et la
 * seule route de lecture du dépôt est réservée aux administrateurs.
 *
 * La mention qu'il scelle affirme pourtant, mot pour mot :
 *
 * > « J'ai pu prendre connaissance de la pièce dans son intégralité avant de
 * > signer, et j'en recevrai un exemplaire. »
 *
 * 🔑 Une attestation fausse ne fragilise pas seulement la pièce qui la porte :
 * elle fragilise **toutes** les signatures recueillies par le même procédé,
 * puisque c'est le procédé qui l'affirme. C'est ce qui distingue ce constat
 * d'un simple manque d'ergonomie.
 *
 * ## Pourquoi une lecture de source
 *
 * Ce qu'il faut garder est un CÂBLAGE : la page passe une URL, le composant
 * l'affiche, la route existe. Le rendu React ne le prouverait qu'à moitié — un
 * composant peut recevoir la prop et ne jamais la rendre — et un test de rendu
 * complet sur un Server Component `async` demanderait de monter la moitié de
 * l'espace formateur. Les trois maillons se vérifient là où ils vivent.
 *
 * ⚠️ Les commentaires sont retirés avant analyse : ce fichier et les sources
 * parlent abondamment d'`urlPiece` en prose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function lire(...segments: string[]): string {
  return sansCommentaires(readFileSync(join(RACINE, ...segments), "utf-8"));
}

describe("`D4-1-A` — la lettre est lisible avant d'être signée", () => {
  it("🔴 la page de l'espace formateur transmet l'URL de la pièce", () => {
    const page = lire("src", "app", "[locale]", "espace-formateur", "page.tsx");
    expect(page, "le composant de signature doit recevoir `urlPiece`").toMatch(/urlPiece=\{/);
    expect(page).toMatch(/api\/formateur\/lettre-mission/);
  });

  it("🔴 le composant REND le lien, il ne se contente pas de recevoir la prop", () => {
    const composant = lire("src", "components", "espace-formateur", "SignatureDocument.tsx");
    // La prop existe…
    expect(composant).toMatch(/urlPiece\??:/);
    // …et elle atterrit dans un `href`. Une prop reçue et jamais rendue serait
    // le même défaut, avec l'apparence d'un correctif.
    expect(composant).toMatch(/href=\{urlPiece\}/);
  });

  it("🔴 quand la pièce n'est PAS consultable, le composant le DIT", () => {
    // 🔑 Le témoin qui empêche la fausse correction. Masquer le lien quand
    // l'URL manque laisserait croire qu'il n'y avait rien à lire — et le
    // signataire attesterait quand même l'avoir lue. Un blanc n'est pas une
    // information.
    const composant = lire("src", "components", "espace-formateur", "SignatureDocument.tsx");
    expect(composant).toMatch(/pas consultable en ligne/);
  });

  it("🔴 la route de lecture existe et vérifie le MÊME mandat que la signature", () => {
    const chemin = join(
      RACINE,
      "src",
      "app",
      "api",
      "formateur",
      "lettre-mission",
      "[id]",
      "route.ts",
    );
    expect(existsSync(chemin), "la route de lecture doit exister").toBe(true);
    const route = sansCommentaires(readFileSync(chemin, "utf-8"));

    // L'habilitation : session formateur ET mandat sur CETTE lettre.
    expect(route).toMatch(/getFormateurSession/);
    expect(route).toMatch(/estMandataireDeLaLettre/);
    // 🔑 La fonction PARTAGÉE, pas une règle qui lui ressemble. Une route qui
    // se contenterait de comparer `trainerId` à la main raterait les lettres
    // legacy sans ancre — et refuserait la lecture à qui peut signer.
    expect(route).toMatch(/mandat-lettre-mission/);
  });

  it("🔴 la route refuse : pas de session, mauvais mandataire, autre type de pièce", () => {
    const route = lire("src", "app", "api", "formateur", "lettre-mission", "[id]", "route.ts");
    expect(route, "401 sans session formateur").toMatch(/status: 401/);
    expect(route, "403 hors mandat").toMatch(/status: 403/);
    // ⚠️ 404 et non 403 sur un autre type : le formateur n'a pas à apprendre
    // qu'un identifiant existe s'il désigne autre chose que sa lettre.
    expect(route).toMatch(/piece\.type !== "lettre_mission"/);
  });

  it("après signature, la route rend l'EXEMPLAIRE — ce que la mention promet", () => {
    // La mention dit deux choses : « j'ai pu prendre connaissance » ET « j'en
    // recevrai un exemplaire ». Le premier test garde la première moitié ;
    // celui-ci garde la seconde.
    const route = lire("src", "app", "api", "formateur", "lettre-mission", "[id]", "route.ts");
    expect(route).toMatch(/statutSignature === "signee"/);
    expect(route).toMatch(/rendreExemplaireSigne/);
  });
});
