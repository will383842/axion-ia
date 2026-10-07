// @vitest-environment node

/**
 * Verrou — la politique de confidentialité décrit le tunnel des apporteurs
 * d'affaires, et dit ce que le code fait (2026-09-19).
 *
 * Jusqu'à cette date, `src/content/legal.ts` ne disait RIEN du réseau
 * d'apporteurs : ni les pages qui collectent, ni les e-mails automatiques
 * (kit à 30 minutes, relances à J+2 et J+7), ni la durée de conservation. Or
 * l'invitation envoyée à une personne recommandée renvoie désormais vers cette
 * section : le lien ne peut pas pointer sur un texte absent.
 *
 * Même méthode que `la-notice-dit-vrai-sur-les-candidatures.spec.ts`. Depuis le
 * 2026-10-07 (Will : « je ne veux surtout pas d'effacement »), aucun dossier
 * d'apporteur n'est supprimé automatiquement : la notice le dit, le worker ne
 * supprime plus les fiches archivées, et les deux moitiés sont couplées. Garde
 * de forme, pas de rédaction.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { FORMULAIRE } from "../recrutement/tunnel-facebook";
import { VSL_CONSENT_TEXTE } from "@/lib/commercial-application/vsl-apporteur";

const WORKER = join(process.cwd(), "src/server/queue/workers/retention-purge-worker.ts");

function section(locale: "fr" | "en", titre: RegExp): string | undefined {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.[locale].sections.find((s) => titre.test(s.title))?.body;
}

const FR = () => section("fr", /^Réseau d'apporteurs d'affaires$/);
const EN = () => section("en", /^Business introducer network$/);

/** Le worker supprime-t-il des fiches (`submissions`) ? Commentaires retirés. */
function workerSupprimeDesFiches(): boolean {
  const code = readFileSync(WORKER, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
  return /\.submission\s*\.\s*delete/.test(code);
}

describe("la notice dit vrai sur le réseau d'apporteurs", () => {
  it("🔴 la section existe en français ET en anglais", () => {
    expect(FR(), "section FR « Réseau d'apporteurs d'affaires » absente").toBeDefined();
    expect(EN(), "section EN « Business introducer network » absente").toBeDefined();
  });

  it("🔴 aucune suppression automatique : la notice le dit, et le worker n'en fait pas", () => {
    // Les deux moitiés sont COUPLÉES : rétablir la purge des fiches archivées
    // sans changer la notice rougit, et inversement.
    expect(
      workerSupprimeDesFiches(),
      "le worker supprime de nouveau des fiches : interdit par décision du " +
        "responsable de traitement (2026-10-07), et la notice dit le contraire.",
    ).toBe(false);
    expect(FR()).not.toMatch(/suppression automatique/i);
    expect(FR()).not.toMatch(/24 mois/);
    expect(FR()).toMatch(/il n'est pas supprimé automatiquement/);
    expect(EN()).not.toMatch(/automatic deletion/i);
    expect(EN()).not.toMatch(/24 months/);
    expect(EN()).toMatch(/it is not deleted automatically/);
  });

  it("🔴 les cases de consentement ne promettent plus de durée de suppression", () => {
    // Le texte coché est une promesse faite à la personne : il dit la même
    // chose que la notice (formulaire court et page vidéo).
    for (const texte of [FORMULAIRE.consent, VSL_CONSENT_TEXTE]) {
      expect(texte).not.toMatch(/\d+\s*mois/);
      expect(texte).toMatch(/conservées pour garder la trace de nos échanges/);
    }
  });

  it("annonce les relances automatiques à J+2 et J+7, et le kit à 30 minutes", () => {
    expect(FR()).toContain("J+2");
    expect(FR()).toContain("J+7");
    expect(FR()).toContain("30 minutes");
    expect(EN()).toMatch(/2 days/);
    expect(EN()).toMatch(/7 days/);
    expect(EN()).toContain("30 minutes");
  });

  it("annonce les deux rappels de l'invitation à l'échange (J+3, J+7), comme le passage quotidien", () => {
    // Source : `lib/commercial-application/relance-invitation.ts` (DELAI_J3_MS,
    // DELAI_J7_MS, RELANCES_MAX = 2).
    expect(FR()).toMatch(
      /deux rappels au plus vous sont adressés trois et sept jours après l'invitation/,
    );
    expect(EN()).toMatch(/at most two reminders follow, 3 days and 7 days after the invitation/);
  });

  it("annonce qu'une réponse par e-mail arrête les rappels, et ce qui en est gardé (relevé Zoho)", () => {
    // Source : `features/commercial-application/reponses-entrantes-apporteur.ts`
    // (objet ≤ 500, extrait ≤ 300 chiffré, jamais le corps ni les pièces jointes).
    expect(FR()).toMatch(
      /votre réponse, reçue dans notre messagerie Zoho Mail, arrête ces rappels/,
    );
    expect(FR()).toMatch(/la date, l'objet et un court extrait/);
    expect(FR()).toMatch(/jamais le message entier ni ses pièces jointes/);
    expect(EN()).toMatch(/your reply, received in our Zoho Mail mailbox, stops these reminders/);
    expect(EN()).toMatch(/never the whole message or its attachments/);
  });

  it("ne promet pas « jamais transmises » : des destinataires existent, ils sont nommés", () => {
    expect(FR()).not.toMatch(/jamais transmises/i);
    expect(FR()).toContain("ZeptoMail");
    expect(FR()).toContain("Telegram");
    expect(FR()).toMatch(/ni vendues ni cédées/);
  });

  it("vouvoie : aucun tutoiement dans une page légale", () => {
    const texte = ` ${FR() ?? ""} `;
    expect(texte).not.toMatch(/[\s(«'’](tu|ta|ton|tes|te|toi)[\s,.;:)»]/i);
  });
});
