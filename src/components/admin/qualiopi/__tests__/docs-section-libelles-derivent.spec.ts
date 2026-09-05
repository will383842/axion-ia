/**
 * 🔴 Les libellés d'attestation de `DocumentsSection` ne peuvent pas DIVERGER
 * de la source — sans que le navigateur paie la table entière.
 *
 * ## Le compromis que ce témoin rend possible
 *
 * `DOC_LABELS` doit dire la même chose que `LIBELLES_TYPE_DOCUMENT`. La manière
 * évidente est d'importer la source et d'y lire les deux entrées — c'est ce que
 * je faisais, et c'était juste au sens du code.
 *
 * Mais `DocumentsSection` est un composant CLIENT : cet import embarquait la
 * table ENTIÈRE (une trentaine de libellés) dans le paquet envoyé au navigateur,
 * pour n'en lire que DEUX. Le cliquet anti-croissance du bundle l'a fait payer.
 *
 * 🔑 La propriété qu'on veut n'est pas « le code lit la source à l'exécution ».
 * C'est « ces deux chaînes ne peuvent pas dériver ». Un TÉMOIN garantit
 * exactement cela, et il coûte **zéro octet au navigateur** : il s'exécute au
 * test, là où l'on peut importer ce qu'on veut.
 *
 * ⚠️ Ce n'est PAS un retour à la recopie aveugle. La recopie sans garde est ce
 * qui a rendu `outbox-policy.spec.ts` rouge pendant vingt-quatre heures. Ce qui
 * change ici, c'est qu'une divergence rougit — immédiatement, et en nommant les
 * deux valeurs.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { LIBELLES_TYPE_DOCUMENT } from "@/server/qualiopi/documents/libelles-type-document";

const SOURCE = fs.readFileSync(
  path.join(process.cwd(), "src/components/admin/qualiopi/DocumentsSection.tsx"),
  "utf-8",
);

/** Lit une entrée littérale de `DOC_LABELS` dans la source du composant. */
function libelleEcritDansLeComposant(cle: string): string | null {
  const m = new RegExp(`\\n\\s*${cle}:\\s*"([^"]+)"`).exec(SOURCE);
  return m?.[1] ?? null;
}

describe("🔴 les libellés d'attestation du composant ne dérivent pas de la source", () => {
  it("le témoin LIT bien quelque chose — sinon il ne compare rien", () => {
    // Témoin de prémisse. Une regex qui ne trouve plus rien rendrait `null` des
    // deux côtés d'une comparaison mal écrite, et passerait pour l'éternité.
    expect(libelleEcritDansLeComposant("attestation")).not.toBeNull();
    expect(libelleEcritDansLeComposant("attestation_partielle")).not.toBeNull();
  });

  it("`attestation` dit EXACTEMENT ce que dit la source", () => {
    expect(libelleEcritDansLeComposant("attestation")).toBe(LIBELLES_TYPE_DOCUMENT.attestation);
  });

  it("`attestation_partielle` dit EXACTEMENT ce que dit la source", () => {
    expect(libelleEcritDansLeComposant("attestation_partielle")).toBe(
      LIBELLES_TYPE_DOCUMENT.attestation_partielle,
    );
  });

  it("🔴 aucun des deux ne porte le mot du CERTIFICAT", () => {
    // Le défaut d'origine : « Attestation de réalisation » est le vocabulaire du
    // certificat, dû au FINANCEUR, alors que l'attestation est due au STAGIAIRE.
    // Un auditeur confondait les deux pièces. La comparaison ci-dessus le
    // couvrirait déjà — mais seulement si la SOURCE reste juste. Ce témoin-ci
    // tient même si quelqu'un dérive la source elle-même.
    for (const cle of ["attestation", "attestation_partielle"] as const) {
      expect(LIBELLES_TYPE_DOCUMENT[cle]).not.toMatch(/réalisation/i);
      expect(libelleEcritDansLeComposant(cle)).not.toMatch(/réalisation/i);
    }
  });

  it("le composant n'IMPORTE PLUS la table entière — c'est ce qu'on paie en octets", () => {
    // Sans cette ligne, quelqu'un « simplifierait » en réimportant la source, et
    // le poids reviendrait sans que personne ne relie la cause à l'effet.
    expect(SOURCE).not.toContain('from "@/server/qualiopi/documents/libelles-type-document"');
  });
});
