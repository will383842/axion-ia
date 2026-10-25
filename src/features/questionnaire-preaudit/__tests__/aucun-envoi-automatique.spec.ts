/**
 * CLIQUET NOMINATIF — « rien ne part sans clic de Will » (ordre du 2026-10-24).
 *
 *   · seul `features/questionnaire-preaudit/envoyer.ts` met le gabarit en file ;
 *   · seule l'action « Envoyer » de la console appelle `envoyerQuestionnaire` ;
 *   · seuls `serveur.ts` (et l'effacement RGPD) écrivent dans les trois tables (`brouillon.ts` pour les brouillons) : si quelqu'un ajoute
 *     un autre chemin d'écriture, ce test rougit et dit lequel.
 *
 * Étendu SCIEMMENT le 2026-10-26 (relances, confirmations, Telegram) :
 *   · les relances et confirmations ne partent que de `suivi.ts` (le balayage du worker), qui ne
 *     fait rien sans le suivi écrit par le clic « Envoyer » de Will ;
 *   · le worker de balayage est le SEUL fichier de la file qui connaît le questionnaire ;
 *   · seuls `suivi.ts` (worker), `suivi-console.ts` (clics de Will, lien d'arrêt du destinataire)
 *     et l'effacement RGPD écrivent le suivi et les courriers ;
 *   · l'arrêt des rappels n'est appelé que par la console et le POST de la page d'arrêt ;
 *   · la case « informations par e-mail » n'est lue que par une liste nominative (jamais par
 *     un expéditeur).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");

function sources(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === ".next" || nom === "generated") continue;
    const p = path.join(dossier, nom);
    if (statSync(p).isDirectory()) sources(p, sortie);
    else if (/\.(ts|tsx)$/.test(nom) && !/\.spec\.tsx?$/.test(nom)) sortie.push(p);
  }
  return sortie;
}

const FICHIERS = sources(path.join(RACINE, "src")).map((p) => ({
  rel: path.relative(RACINE, p).replace(/\\/g, "/"),
  src: readFileSync(p, "utf8"),
}));

describe("le questionnaire de pré-audit ne part que par un clic de Will", () => {
  it("un seul fichier met le gabarit en file", () => {
    const appelants = FICHIERS.filter((f) =>
      /enqueueEmail\(\s*"questionnaire-avant-audit"/.test(f.src),
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/features/questionnaire-preaudit/envoyer.ts"]);
  });

  it("seule l'action de la console appelle l'envoi", () => {
    const appelants = FICHIERS.filter(
      (f) =>
        /\benvoyerQuestionnaire\(/.test(f.src) &&
        f.rel !== "src/features/questionnaire-preaudit/envoyer.ts",
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/features/questionnaire-preaudit/actions.ts"]);
  });

  it("ni la file, ni le circuit visio, ni Calendly ne connaissent le questionnaire", () => {
    const intrus = FICHIERS.filter(
      (f) =>
        /^src\/server\/(queue|visio|calendly)\//.test(f.rel) &&
        /questionnaire-avant-audit|questionnaire-preaudit|questionnaireAvantAudit/i.test(f.src) &&
        f.rel !== "src/server/queue/types.ts" &&
        f.rel !== "src/server/queue/workers/visio-balayage-worker.ts" &&
        f.rel !== "src/server/visio/questionnaire-en-ligne/jeton.ts",
    ).map((f) => f.rel);
    expect(intrus).toEqual([]);
  });

  it("les écrivains des deux tables sont connus", () => {
    const ecrivains = FICHIERS.filter((f) =>
      /\.questionnaireAvantAudit(Envoi|Brouillon)?\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(
        f.src,
      ),
    ).map((f) => f.rel);
    expect(ecrivains.sort()).toEqual([
      // Suppression MANUELLE depuis la console (Will, 25/10/2026) : super-admin + mot EFFACER.
      "src/features/dossier-client/suppression-manuelle.ts",
      "src/features/questionnaire-preaudit/brouillon.ts",
      "src/features/questionnaire-preaudit/serveur.ts",
      "src/lib/rgpd-erase.ts",
    ]);
  });

  it("relances et confirmations : seul le suivi les nomme (hors gabarits et registres)", () => {
    const REGISTRES = [
      "src/lib/email/templates/index.tsx",
      "src/server/email/apercu/catalogue.ts",
      "src/server/email/outbox-policy.ts",
      "src/server/email/verdict-envoi.ts",
      "src/server/queue/types.ts",
    ];
    const appelants = FICHIERS.filter(
      (f) =>
        /["']questionnaire-avant-audit-(relance|confirmation)["']/.test(f.src) &&
        !REGISTRES.includes(f.rel) &&
        !f.rel.startsWith("src/lib/email/templates/questionnaire-avant-audit"),
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/features/questionnaire-preaudit/suivi.ts"]);
  });

  it("le suivi n'est appelé que par le balayage du worker", () => {
    const appelants = FICHIERS.filter(
      (f) =>
        /\bpasserSuiviQuestionnaires\(/.test(f.src) &&
        f.rel !== "src/features/questionnaire-preaudit/suivi.ts",
    ).map((f) => f.rel);
    expect(appelants).toEqual(["src/server/queue/workers/visio-balayage-worker.ts"]);
  });

  it("les écrivains du suivi et des courriers sont connus", () => {
    const ecrivains = FICHIERS.filter((f) =>
      /\.questionnaireAvantAudit(Suivi|Courrier)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/.test(
        f.src,
      ),
    ).map((f) => f.rel);
    expect(ecrivains.sort()).toEqual([
      // Suppression MANUELLE depuis la console (Will, 25/10/2026) : super-admin + mot EFFACER.
      "src/features/dossier-client/suppression-manuelle.ts",
      "src/features/questionnaire-preaudit/suivi-console.ts",
      "src/features/questionnaire-preaudit/suivi.ts",
      "src/lib/rgpd-erase.ts",
    ]);
  });

  it("la case « informations par e-mail » n'est lue que par une liste nominative", () => {
    const lecteurs = FICHIERS.filter((f) => /\binfosEmail\b/.test(f.src)).map((f) => f.rel);
    expect(lecteurs.sort()).toEqual([
      "src/components/admin/dossier-client/ReponsePreaudit.tsx",
      "src/features/questionnaire-preaudit/donnees.ts",
      "src/features/questionnaire-preaudit/serveur.ts",
      "src/lib/rgpd-dossier-client.ts",
    ]);
  });

  it("l'arrêt des rappels et les essais ne sont appelés que par la console et la page d'arrêt", () => {
    const appel = (motif: RegExp) =>
      FICHIERS.filter(
        (f) =>
          motif.test(f.src) &&
          // Un homonyme d'un autre domaine (dépôt OPCO…) n'est pas concerné : seuls les fichiers
          // qui importent ce module comptent.
          /suivi-console["']/.test(f.src) &&
          f.rel !== "src/features/questionnaire-preaudit/suivi-console.ts",
      )
        .map((f) => f.rel)
        .sort();
    expect(appel(/\barreterRelances\(/)).toEqual([
      "src/app/questionnaire/rappels/[id]/[jeton]/actions.ts",
      "src/features/questionnaire-preaudit/actions.ts",
    ]);
    expect(appel(/\bdemanderEssai\(/)).toEqual(["src/features/questionnaire-preaudit/actions.ts"]);
    expect(appel(/\bnoterEnvoi\(/)).toEqual(["src/features/questionnaire-preaudit/actions.ts"]);
  });
});
