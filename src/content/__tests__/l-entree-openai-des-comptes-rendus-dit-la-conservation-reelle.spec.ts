/**
 * ⛔ L'ENTRÉE « OPENAI (COMPTES RENDUS) » DIT LA CONSERVATION RÉELLE.
 *
 * `/sous-processeurs` affiche aussi les entrées `pending_activation`. La
 * première version affirmait publiquement « les réponses ne sont pas
 * conservées par OpenAI » : c'est faux pour `/v1/responses`, qui garde le
 * texte analysé au plus 30 jours dans ses journaux de lutte contre les abus
 * (LOTS §0, lu sur `/guides/your-data` le 29/09) — seule la transcription
 * (`/v1/audio/transcriptions`) n'est pas conservée. La notice (`visio-annonce-textes.ts`)
 * le disait déjà : les deux textes publics disent désormais la même chose.
 *
 * Mutation qui rougit : remettre « ne sont pas conservées » ou retirer les
 * 30 jours. Contre-témoin : la notice publique porte les mêmes 30 jours.
 */

import { describe, expect, it } from "vitest";

import { SUBPROCESSORS } from "../subprocessors";
import {
  NOM_ENTREE_COMPTES_RENDUS_VISIO,
  sectionRendezVousDecouverte,
} from "../visio-annonce-textes";

describe("l'entrée OpenAI des comptes rendus dit la conservation réelle", () => {
  const entree = SUBPROCESSORS.find((s) => s.name === NOM_ENTREE_COMPTES_RENDUS_VISIO);

  it("les deux langues nomment les 30 jours des journaux d'abus", () => {
    expect(entree).toBeDefined();
    expect(entree!.purposeFr).toMatch(/au plus 30 jours dans les journaux/);
    expect(entree!.purposeEn).toMatch(/at most 30 days in OpenAI's abuse-monitoring logs/);
  });

  it("aucune promesse de non-conservation des réponses", () => {
    expect(entree!.purposeFr).not.toMatch(/réponses ne sont pas conservées/);
    expect(entree!.purposeEn).not.toMatch(/responses are not stored/);
  });

  it("contre-témoin : la notice publique dit les mêmes 30 jours", () => {
    expect(JSON.stringify(sectionRendezVousDecouverte("fr", true))).toMatch(
      /au plus 30 jours dans ses journaux/,
    );
  });
});
