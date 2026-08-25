/**
 * CLIQUET — aucun code machine ne s'affiche à l'écran de la salle de presse.
 *
 * ## Le défaut (2026-08-25, cahier D7-3)
 *
 * Les écrans presse rendaient `` `Erreur : ${state.error}` `` et les actions
 * renvoient des identifiants machine. Le rédacteur lisait **« Erreur :
 * file_required »**, **« Erreur : unsupported_mime »**, **« Erreur :
 * not_found »**.
 *
 * ## Ce que ce fichier verrouille, et pourquoi de cette façon
 *
 * Il **dérive la liste des codes DU CODE RÉEL** — il ne la recopie pas. Un
 * huitième code ajouté demain à une action presse fera rougir ce test sans que
 * personne ait à penser à ce fichier.
 *
 * *Une liste énumérée à la main prend du retard ; ce dépôt l'a payé quatre fois.*
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { MESSAGES_ERREUR_PRESSE, messageErreurPresse } from "../message-erreur";

const ACTIONS = join(process.cwd(), "src", "server", "actions", "press");

/** Le code seul — sinon la garde trouve les codes cités dans les commentaires. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("//") ? "" : l))
    .join("\n");
}

/** Les codes littéraux `error: "…"` renvoyés par les actions presse. */
function codesRenvoyes(): string[] {
  const codes = new Set<string>();
  for (const fichier of readdirSync(ACTIONS)) {
    if (!fichier.endsWith(".ts") || /\.(spec|test)\.ts$/.test(fichier)) continue;
    const source = codeSeul(join(ACTIONS, fichier));
    for (const m of source.matchAll(/\berror:\s*"([a-z0-9_]+)"/g)) {
      if (m[1] !== undefined) codes.add(m[1]);
    }
  }
  return [...codes].sort();
}

describe("les erreurs presse sont dites en français", () => {
  it("🔑 CONTRE-TÉMOIN : l'extracteur trouve réellement des codes", () => {
    // Sans ceci, un renommage de dossier rendrait une liste vide et le test
    // central passerait au vert sans avoir examiné un seul code.
    expect(
      codesRenvoyes().length,
      "aucun code d'erreur trouvé dans les actions presse : le motif est cassé.",
    ).toBeGreaterThanOrEqual(5);
  });

  it("chaque code renvoyé par une action presse a sa phrase française", () => {
    const sansTraduction = codesRenvoyes().filter(
      (code) => MESSAGES_ERREUR_PRESSE[code] === undefined,
    );

    expect(
      sansTraduction,
      "ces codes machine seraient affichés tels quels au rédacteur. Ajouter leur " +
        "phrase dans `MESSAGES_ERREUR_PRESSE` — un code n'est pas un message " +
        "d'erreur : il ne dit ni ce qui s'est passé, ni quoi faire.",
    ).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : la traduction ne peut pas abîmer un message déjà lisible", () => {
    // C'est ce qui rend la fonction sûre à poser partout : les messages Zod sont
    // déjà rédigés en français, et les `err.message` remontent d'exceptions.
    const dejaLisible = "Le titre doit faire au moins 3 caractères.";
    expect(messageErreurPresse(dejaLisible)).toBe(dejaLisible);
    expect(messageErreurPresse("Date attendue au format AAAA-MM-JJ.")).toBe(
      "Date attendue au format AAAA-MM-JJ.",
    );
  });

  it("un code INCONNU rend une phrase, et garde le code pour le support", () => {
    // Ni le code seul (illisible), ni rien (incident irracontable).
    const rendu = messageErreurPresse("un_code_tout_neuf");
    expect(rendu).toContain("Une erreur est survenue");
    expect(rendu, "le code doit rester visible pour que l'incident soit racontable").toContain(
      "un_code_tout_neuf",
    );
  });

  it("un code connu ne rend jamais le code lui-même", () => {
    for (const code of Object.keys(MESSAGES_ERREUR_PRESSE)) {
      const rendu = messageErreurPresse(code);
      expect(rendu, `« ${code} » est rendu tel quel`).not.toContain(code);
      expect(
        rendu.length,
        `la phrase de « ${code} » est trop courte pour dire quoi que ce soit`,
      ).toBeGreaterThan(20);
    }
  });

  it("les deux écrans presse passent par la traduction, jamais par le code brut", () => {
    const ECRANS = [
      join(
        process.cwd(),
        "src",
        "app",
        "[locale]",
        "(admin)",
        "[adminPrefix]",
        "presse",
        "communiques",
        "nouveau",
        "NewPressReleaseForm.tsx",
      ),
      join(
        process.cwd(),
        "src",
        "app",
        "[locale]",
        "(admin)",
        "[adminPrefix]",
        "presse",
        "communiques",
        "import",
        "page.tsx",
      ),
    ];

    for (const ecran of ECRANS) {
      const source = codeSeul(ecran);
      expect(
        source.includes("messageErreurPresse"),
        `${ecran.split(sepPortable()).slice(-2).join("/")} rend encore l'erreur brute`,
      ).toBe(true);
    }
  });
});

/** Séparateur de chemin, pour un message d'erreur lisible sur les deux OS. */
function sepPortable(): string {
  return process.platform === "win32" ? "\\" : "/";
}
