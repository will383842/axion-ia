// @vitest-environment node

/**
 * Verrou — le destinataire DÉCLARÉ de la parole des rendez-vous est celui que
 * le CODE appelle (chantier visio, PR 8).
 *
 * Le circuit ne parle à un modèle que par `src/server/visio/openai/modeles.ts`
 * (constantes `MODELE_TRANSCRIPTION` et `MODELE_REDACTION`, PR 6 ; garde de la
 * PR 2 `le-circuit-visio-ne-parle-qu-a-openai-par-un-seul-module.spec.ts`). La
 * notice, elle, nomme OpenAI, et `/sous-processeurs` porte l'entrée
 * « OpenAI, LLC (comptes rendus de rendez-vous) ». Changer de fournisseur dans
 * le module sans changer l'entrée ni la notice ferait mentir les deux : rouge.
 *
 * Trois règles :
 *   1. si le module existe, ses deux modèles sont des modèles OpenAI ;
 *   2. si l'entrée existe, son état est l'interrupteur de la notice
 *      (`ETAT_COMPTES_RENDUS_VISIO`) — l'un ne bascule pas sans l'autre ;
 *   3. sans module, rien ne peut être annoncé : le circuit n'existe pas.
 *
 * Contre-témoin : un module fictif qui appellerait un autre fournisseur est
 * refusé par la même fonction. Angle mort : la règle 1 lit la VALEUR des
 * constantes dans le source ; un modèle choisi dynamiquement lui échapperait
 * (la PR 6 l'interdit : « constante unique, jamais une variable d'environnement »).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SUBPROCESSORS } from "../subprocessors";
import {
  ANNONCE_VISIO_ACTIVE,
  ETAT_COMPTES_RENDUS_VISIO,
  NOM_ENTREE_COMPTES_RENDUS_VISIO,
  sectionRendezVousDecouverte,
} from "../visio-annonce";

const MODULE = "src/server/visio/openai/modeles.ts";
const MODELES_OPENAI = /^(gpt-|whisper-|o\d)/;

/** Les valeurs des deux constantes, lues dans le source. */
function modelesDu(source: string): string[] {
  return ["MODELE_TRANSCRIPTION", "MODELE_REDACTION"].map(
    (nom) => new RegExp(`${nom}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(source)?.[1] ?? "",
  );
}

function horsOpenAI(source: string): string[] {
  return modelesDu(source).filter((m) => !MODELES_OPENAI.test(m));
}

const ENTREE = SUBPROCESSORS.find((s) => s.name === NOM_ENTREE_COMPTES_RENDUS_VISIO);

describe("le destinataire des comptes rendus suit le module OpenAI", () => {
  it("🔴 les modèles appelés par le circuit sont des modèles OpenAI", () => {
    const chemin = join(process.cwd(), MODULE);
    if (!existsSync(chemin)) {
      // Règle 3 : sans module, le circuit n'appelle personne — rien à annoncer.
      expect(ANNONCE_VISIO_ACTIVE, `${MODULE} absent : aucune annonce ne peut être active`).toBe(
        false,
      );
      return;
    }
    expect(
      horsOpenAI(readFileSync(chemin, "utf8")),
      "le circuit appelle un autre fournisseur qu'OpenAI : changer l'entrée de " +
        "subprocessors.ts ET la notice (src/content/visio-annonce.ts) dans la même PR",
    ).toEqual([]);
  });

  it("🔴 l'entrée « comptes rendus » a exactement l'état de l'interrupteur de la notice", () => {
    if (!ENTREE) {
      expect(ETAT_COMPTES_RENDUS_VISIO, "entrée absente : l'annonce ne peut pas être active").toBe(
        "pending_activation",
      );
      return;
    }
    expect(ENTREE.activationStatus).toBe(ETAT_COMPTES_RENDUS_VISIO);
    expect(ENTREE.name).toContain("OpenAI");
    expect(ENTREE.legalBasis).toBe("6.1.a_consent");
  });

  it("🔴 la notice publiée à la bascule nomme le même fournisseur", () => {
    expect(sectionRendezVousDecouverte("fr", true)).toContain("OpenAI");
    expect(sectionRendezVousDecouverte("en", true)).toContain("OpenAI");
  });

  it("🔑 CONTRE-TÉMOIN : un module qui appellerait un autre fournisseur est refusé", () => {
    const fictif =
      'export const MODELE_TRANSCRIPTION = "voxtral-mini";\nexport const MODELE_REDACTION = "gpt-6-sol";';
    expect(horsOpenAI(fictif)).toEqual(["voxtral-mini"]);
    const conforme =
      'export const MODELE_TRANSCRIPTION = "gpt-4o-transcribe-diarize";\nexport const MODELE_REDACTION = "gpt-6-sol";';
    expect(horsOpenAI(conforme)).toEqual([]);
  });
});
