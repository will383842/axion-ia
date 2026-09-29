/**
 * ⛔ LE CIRCUIT NE CHIFFRE QU'AVEC `chiffrer-parole` (chantier visio, PR 2 ;
 * plan §3.10, PA-11).
 *
 * `encryptPii` et `decryptPii` sont tolérants (clair sans clé, clair rendu
 * tel quel, texte de remplacement) : justes pour un formulaire, fautifs pour
 * une conversation. Le circuit n'appelle donc QUE `src/lib/chiffrer-parole.ts`,
 * qui lève dans les trois cas.
 *
 * Contre-témoin : un fichier fictif qui appelle `decryptPii` est reconnu.
 * Angle mort avoué : un module HORS du circuit qui lirait une colonne `(enc)`
 * avec `decryptPii` n'est pas vu — c'est pourquoi les exports et effacements
 * RGPD du dossier client passent eux aussi par `chiffrer-parole`
 * (`src/lib/rgpd-dossier-client.ts`).
 */

import { describe, expect, it } from "vitest";
import {
  DOSSIERS_DU_CIRCUIT,
  lire,
  sansCommentaires,
  sourcesSous,
} from "./sources-du-circuit-visio";

const APPEL_TOLERANT = /\b(encryptPii|decryptPii|encryptPiiObject|decryptPiiObject)\b/;

/**
 * Exemptions NOMINATIVES : modules rangés sous le circuit qui ne touchent
 * AUCUNE parole, mais lisent une colonne EXISTANTE chiffrée par `encryptPii`
 * (formulaire, clair possible sur les fiches anciennes). `chiffrer-parole` y
 * lèverait à tort sur une valeur en clair. Chaque entrée porte son motif ; un
 * nouveau fichier qui appelle `decryptPii` sous le circuit rougit.
 */
const EXEMPTIONS: ReadonlyArray<{ readonly fichier: string; readonly motif: string }> = [
  {
    fichier: "src/server/visio/preavis-destinataires.ts",
    motif:
      "lit `clients.contact_email` (adresse saisie au formulaire, chiffrée par encryptPii) " +
      "pour le préavis de la PR 1 ; aucune parole",
  },
];

/** Les modules qui lisent le dossier client hors du circuit. */
const LECTEURS_DU_DOSSIER = ["src/lib/rgpd-dossier-client.ts"] as const;

describe("le circuit ne chiffre qu'avec chiffrer-parole", () => {
  it("contre-témoin : un appel tolérant est reconnu, un commentaire ne l'est pas", () => {
    expect(APPEL_TOLERANT.test(sansCommentaires(`const t = decryptPii(ligne.texte);`))).toBe(true);
    expect(APPEL_TOLERANT.test(sansCommentaires(`// jamais decryptPii ici`))).toBe(false);
  });

  it("aucun fichier du circuit n'appelle encryptPii ni decryptPii", () => {
    const exemptes = new Set(EXEMPTIONS.map((e) => e.fichier));
    const fautifs = [...sourcesSous(DOSSIERS_DU_CIRCUIT), ...LECTEURS_DU_DOSSIER]
      .filter((f) => !exemptes.has(f))
      .filter((f) => APPEL_TOLERANT.test(sansCommentaires(lire(f))));
    expect(fautifs, "le circuit chiffre sa parole par src/lib/chiffrer-parole.ts, seul :").toEqual(
      [],
    );
  });

  it("chaque exemption existe encore et n'importe pas de module de parole", () => {
    // Une exemption périmée (fichier supprimé ou renommé) se retire de la liste.
    for (const { fichier } of EXEMPTIONS) {
      const code = lire(fichier);
      expect(code, fichier).not.toMatch(/Transcription|transcriptionSegment|citation/);
    }
  });

  it("le lecteur RGPD du dossier est bien lu (sinon la garde serait verte pour rien)", () => {
    for (const f of LECTEURS_DU_DOSSIER) expect(lire(f)).toContain("chiffrer-parole");
  });
});
