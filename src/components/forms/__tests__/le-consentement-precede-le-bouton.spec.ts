/**
 * ON NE CLIQUE PAS « ENVOYER » AVANT D'AVOIR VU CE QU'ON ACCEPTE.
 *
 * ── Pourquoi ce fichier ──────────────────────────────────────────────────
 * Constaté à l'œil sur `/fr/guide-ia` en production le 2026-09-24 : la case
 * « J'accepte de recevoir le guide PDF et la newsletter mensuelle » était
 * rendue SOUS le bouton « Recevoir le guide ». On lit le bouton, on clique,
 * et on découvre ensuite ce qu'on devait accepter. Un consentement qu'on
 * découvre après coup n'en est pas un — et le formulaire refusait
 * effectivement l'envoi, ce qui donnait un refus incompréhensible.
 *
 * ⚠️ CE QUE CE FICHIER EXISTE POUR EMPÊCHER : que l'ordre reparte à l'envers
 *    au premier remaniement de la maquette. L'ordre du DOM est aussi l'ordre
 *    de lecture d'un lecteur d'écran et l'ordre de tabulation au clavier :
 *    ce n'est pas une question d'esthétique.
 *
 * 🔑 LE CONTRE-TÉMOIN COMPTE AUTANT QUE L'ASSERTION. Une comparaison de
 *    positions entre deux marqueurs absents rendrait `-1 < -1` — faux, donc
 *    rouge par accident, ou pire : deux marqueurs renommés et le test devient
 *    muet. On exige donc d'abord que les deux marqueurs SOIENT là.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const COMPOSANT = path.join(process.cwd(), "src/components/forms/NewsletterForm.tsx");
const source = readFileSync(COMPOSANT, "utf8");

/** Rendu du consentement dans la variante EMPILÉE (celle de `/fr/guide-ia`). */
const CONSENTEMENT_EMPILE = "{inline ? null : blocConsentement}";
/** Le bouton d'envoi, quel que soit son libellé. */
const BOUTON = 'type="submit"';

describe("ordre de lecture du formulaire de newsletter", () => {
  it("🔑 CONTRE-TÉMOIN : les deux marqueurs existent vraiment dans la source", () => {
    // Sans ceci, un renommage rendrait l'assertion suivante incapable de voir
    // quoi que ce soit, et elle passerait — ou échouerait — pour une raison
    // qui n'a rien à voir avec l'ordre qu'on garde.
    expect(source, "le rendu conditionnel du consentement a été renommé").toContain(
      CONSENTEMENT_EMPILE,
    );
    expect(source, "le bouton d'envoi a changé de forme").toContain(BOUTON);
  });

  it("🔴 en variante empilée, la case de consentement précède le bouton", () => {
    const positionConsentement = source.indexOf(CONSENTEMENT_EMPILE);
    const positionBouton = source.indexOf(BOUTON);

    expect(positionConsentement).toBeGreaterThan(-1);
    expect(positionBouton).toBeGreaterThan(-1);
    expect(
      positionConsentement,
      "le consentement doit être rendu AVANT le bouton d'envoi",
    ).toBeLessThan(positionBouton);
  });

  it("la variante en ligne garde son propre emplacement, et c'est délibéré", () => {
    // Documenté dans le composant : une rangée flex sans retour ne supporte
    // pas un bloc pleine largeur avant le bouton. Ce test ne valide pas ce
    // choix, il constate qu'il est toujours EXPLICITE — si la branche
    // disparaît, c'est que quelqu'un a tranché la question sans le dire.
    expect(source).toContain("{inline ? blocConsentement : null}");
  });
});
