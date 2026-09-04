// Le tunnel apporteurs ne doit JAMAIS nommer un statut de mandataire.
//
// ── Pourquoi cette garde, et pourquoi elle est étroite ────────────────────
// Le 2026-09-04, la page publique `/apporteur-affaires` répondait, à la
// question « Il faut un statut ? » : « micro-entreprise, AGENT COMMERCIAL ou
// société ». Elle est restée en ligne ainsi.
//
// Ce n'était pas un mot maladroit. « Agent commercial » est un statut défini
// par les articles L.134-1 et suivants du code de commerce, et son critère est
// l'existence d'un MANDAT de négocier au nom du mandant. Or :
//
//   · l'article 1.2 du contrat d'apporteur repose sur l'inverse exact —
//     « L'Apporteur n'est investi d'AUCUN mandat » ;
//   · l'article 8.2 lui interdit de se présenter comme « mandataire, agent ou
//     représentant de la Société » ;
//   · le registre des risques du contrat écrit, à propos de la seule mention
//     de ce statut : « aveu que la qualification d'agent commercial était
//     envisagée : elle DÉTRUIRAIT la portée des articles 1 et 2 ».
//
// La page publique invitait donc les candidats à s'immatriculer sous le statut
// que tout le contrat existe pour écarter — statut qui ouvre en outre un droit
// à indemnité de fin de contrat (L.134-12) auquel on ne peut pas renoncer
// (L.134-16).
//
// ── Ce que cette garde NE fait PAS, délibérément ──────────────────────────
// Elle ne balaie pas tout le lexique de `ANTI-REQUALIFICATION.md`. Ce lexique
// interdit « objectif », « quota », « salaire » — mais le tunnel les emploie
// tous les trois EN LES NIANT : « Aucun objectif, aucun quota », « Pas de
// salaire fixe ». Ces phrases sont PROTECTRICES : elles affirment l'absence de
// ce que la règle proscrit. Une garde qui les compterait comme fautes
// obligerait à les retirer, c'est-à-dire à supprimer la défense pour satisfaire
// le contrôle. C'est le mode de défaillance qu'on veut éviter le plus.
//
// Elle vise donc uniquement les termes qui NOMMENT UN STATUT DE MANDATAIRE, et
// pour lesquels aucune négation n'a de sens dans une page d'acquisition.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Surfaces LUES ou REÇUES par un candidat apporteur. */
const SURFACES = [
  "src/content/recrutement/tunnel-facebook.ts",
  "src/components/recrutement/FacebookLandingPage.tsx",
  "src/components/recrutement/LeadApporteurForm.tsx",
  "src/components/recrutement/TunnelFacebookShell.tsx",
  "src/lib/email/templates/lead-apporteur-recu.tsx",
  "src/lib/email/templates/lead-apporteur-relance.tsx",
];

/**
 * Statuts et qualités de MANDATAIRE. Chacun contredit l'article 1.2 du contrat
 * (« aucun mandat ») et l'article 8.2 (« ne se présente pas comme mandataire,
 * agent ou représentant »).
 */
const TERMES_DE_MANDAT = [
  /agents?\s+commerciaux?/i,
  /agent\s+commercial/i,
  /mandataire/i,
  /VRP\b/,
  /notre\s+force\s+de\s+vente/i,
  /nos\s+commerciaux/i,
  /nos\s+vendeurs/i,
  /votre\s+manager/i,
  /votre\s+responsable/i,
];

/** Retire commentaires de ligne et de bloc : un commentaire n'est pas lu par un candidat. */
function texteVisible(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("le tunnel apporteurs ne nomme jamais un statut de mandataire", () => {
  it("les surfaces auditées existent — sinon la garde ne regarde rien", () => {
    // Un renommage qui sortirait un fichier de cette liste rendrait la garde
    // verte en cessant de le lire. C'est le pire mode de défaillance.
    for (const f of SURFACES) {
      expect(() => readFileSync(path.join(RACINE, f), "utf8"), `${f} introuvable`).not.toThrow();
    }
  });

  it("aucune surface ne nomme un statut ou une qualité de mandataire", () => {
    const fautes: string[] = [];
    for (const f of SURFACES) {
      const visible = texteVisible(readFileSync(path.join(RACINE, f), "utf8"));
      visible.split("\n").forEach((ligne, i) => {
        for (const motif of TERMES_DE_MANDAT) {
          if (motif.test(ligne)) fautes.push(`${f}:${i + 1} — ${ligne.trim().slice(0, 100)}`);
        }
      });
    }
    expect(
      fautes,
      "terme de MANDAT dans une surface vue par un candidat apporteur. L'article 1.2 du contrat " +
        "(« aucun mandat ») et l'article 8.2 (« ni mandataire, ni agent, ni représentant ») en " +
        "dépendent, et le registre des risques du contrat dit qu'une telle mention « détruirait la " +
        "portée des articles 1 et 2 ». Écrire « micro-entreprise ou société »",
    ).toEqual([]);
  });

  it("TÉMOIN — le détecteur voit la faute qui était en ligne, et ignore les négations protectrices", () => {
    const fauteReelle =
      'answer: "Pour facturer ta commission, oui : micro-entreprise, agent commercial ou société."';
    const negationProtectrice = '{ t: "Aucun objectif, aucun quota", d: "Pas de reporting." }';
    const enCommentaire = '// on n\'écrit jamais "agent commercial" ici';

    const voitUneFaute = (s: string) => TERMES_DE_MANDAT.some((m) => m.test(texteVisible(s)));

    expect(voitUneFaute(fauteReelle)).toBe(true);
    // 🔑 Les négations doivent PASSER : les interdire reviendrait à supprimer
    // la défense pour satisfaire le contrôle.
    expect(voitUneFaute(negationProtectrice)).toBe(false);
    expect(voitUneFaute(enCommentaire)).toBe(false);
  });
});
