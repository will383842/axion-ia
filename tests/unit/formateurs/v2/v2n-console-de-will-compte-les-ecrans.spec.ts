/**
 * Vérification n° 2 — le parcours de Will dans la console, compté en ÉCRANS (pages
 * distinctes) : par formateur, par mission, par virement. Consigne : signaler toute étape
 * qui demande plus de 3 écrans.
 *
 * Contrôle sans écran (lecture des pages de la console) : les liens qui relient les écrans
 * sont lus dans le code, pas supposés. Le banc missions (`v2n03`) joue, lui, les gestes.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const ADMIN = "src/app/[locale]/(admin)/[adminPrefix]";
const lire = (rel: string) => readFileSync(path.join(RACINE, ADMIN, rel), "utf8");

describe("V2-N · console — par virement", () => {
  it("« Virements à faire » : un seul écran, sélection multiple puis « Virements faits »", () => {
    const page = lire("qualiopi/remuneration/virements/page.tsx");
    expect(page).toContain("virementsFaitsFormAction");
    expect(page).toMatch(/Virements faits/);
  });

  // V2-N-15 (mineur) — texte interne visible par Will sur « Virements à faire » :
  // « taux BCE non renseigné », « décision 87 en attente ». Un numéro de décision du
  // chantier n'a pas de sens à l'écran. `virements/page.tsx` ~l. 199-204. CORRIGÉ.
  it("V2-N-15 — aucune référence interne (« décision 87 ») dans l'écran des virements", () => {
    const page = lire("qualiopi/remuneration/virements/page.tsx");
    expect(page).not.toMatch(/décision \d+/);
    expect(page).not.toMatch(/taux BCE/);
  });
});

describe("V2-N · console — par formateur", () => {
  it("la fiche d'un dossier « à vérifier » mène en un clic à « Vérifier et contresigner »", () => {
    // Lu dans le code (le cloisonnement interdit d'importer le domaine Qualiopi ici).
    const bandeau = readFileSync(
      path.join(RACINE, "src/server/qualiopi/formateurs-independants/bandeau-etape.ts"),
      "utf8",
    );
    expect(bandeau).toMatch(/onglet === "a_verifier"/);
    expect(bandeau).toContain('libelle: "Vérifier et contresigner", href: `${urlFiche}/verifier`');
    expect(existsSync(path.join(RACINE, ADMIN, "qualiopi/formateurs/[id]/verifier/page.tsx"))).toBe(
      true,
    );
  });

  // V2-N-6 (mineur, plus de 3 écrans) — du dossier reçu au contresigné : « Dossiers et
  // contrats » (onglet À vérifier) → « Ouvrir » mène à la FICHE (25 panneaux), pas à
  // l'écran de vérification → bandeau → « Vérifier et contresigner ». Depuis la
  // candidature, il faut en plus passer par « Rendez-vous » pour noter « Retenu » (la
  // fiche de candidature n'a aucun lien vers l'échange) : candidature → rendez-vous →
  // dossiers → fiche → vérifier = 5 écrans. `dossiers/page.tsx` ~l. 103-110,
  // `contacts/candidatures/[id]/page.tsx`. CORRIGÉ : « Vérifier et contresigner » dans la
  // liste, et la fiche de candidature mène à « Rendez-vous › À faire le point ».
  it("V2-N-6 — dossier « à vérifier » : « Ouvrir » mène droit à l'écran de vérification", () => {
    const page = lire("qualiopi/formateurs/dossiers/page.tsx");
    expect(page).toMatch(/href=\{`\$\{base\}\/\$\{l\.trainerId\}\/verifier`\}/);
  });

  it("V2-N-6 (suite) — la fiche de candidature relie à l'échange où noter « Retenu »", () => {
    const page = lire("contacts/candidatures/[id]/page.tsx");
    expect(page).toMatch(/rendez-vous|contacts\/appels/);
  });

  // V2-N-16 (mineur) — un écran éteint disait seulement « Cet écran n'est pas encore
  // ouvert. », sans nommer l'interrupteur ni mener à l'écran Interrupteurs. CORRIGÉ : les
  // écrans éteints du groupe passent par `EcranPasEncoreOuvert`, qui nomme l'interrupteur
  // (son libellé, lu dans le registre des interrupteurs) et mène à l'écran Interrupteurs.
  it("V2-N-16 — un écran éteint nomme ce qui l'allume", () => {
    for (const rel of [
      "qualiopi/formateurs/[id]/verifier/page.tsx",
      "qualiopi/formateurs/dossiers/page.tsx",
      "qualiopi/formateurs/a-faire/page.tsx",
      "qualiopi/formateurs/mise-a-niveau/page.tsx",
    ]) {
      const page = lire(rel);
      expect(page, rel).not.toContain("pas encore ouvert");
      expect(page, rel).toMatch(/<EcranPasEncoreOuvert[\s\S]*?interrupteurs=\{\[\s*INTERRUPTEURS/);
    }
    const ecran = readFileSync(
      path.join(RACINE, "src/components/admin/qualiopi/EcranPasEncoreOuvert.tsx"),
      "utf8",
    );
    expect(ecran).toContain("pas encore ouvert");
    expect(ecran).toMatch(/interrupteur/i);
    expect(ecran).toContain("/qualiopi/formateurs/interrupteurs");
  });
});

describe("V2-N · console — par mission", () => {
  it("proposer, émettre la lettre, contresigner : tout se fait depuis la page de la session", () => {
    const session = lire("qualiopi/sessions/[id]/page.tsx");
    expect(session).toMatch(/SectionChoixFormateur/);
    expect(session).toMatch(/contresignerLettreMissionAction|ContresignerLettre/);
  });
});
