/**
 * 🔴 UNE QUALITE QUE LE MOTEUR NE SAIT PAS LIRE.
 *
 * `AppreciationSource` accepte quatre qualites depuis l'origine — stagiaire,
 * entreprise, financeur, formateur. Mais off.30 identifie les personnes par leur
 * ADRESSE E-MAIL, et le moteur ne savait la resoudre que dans deux cas :
 *
 *   - `stagiaire`  -> `trainee.email`
 *   - toute source portant un `clientId` -> e-mail du contact du client
 *
 * Le modele `Appreciation` n'avait ni `trainerId` ni relation vers `Trainer`.
 * Une appreciation de formateur n'avait donc AUCUN chemin : elle etait saisie
 * dans l'ecran, affichee dans la liste, puis comptee « auteur non etabli » et
 * ignoree par l'indicateur. Le formulaire proposait une qualite que le moteur
 * ne savait pas lire, et rien ne le disait.
 *
 * ## Pourquoi ce defaut comptait vraiment
 *
 * off.30 exige DEUX qualites distinctes ET DEUX personnes physiques distinctes.
 * Chez cet organisme, la stagiaire est aussi la representante du client : deux
 * qualites, une seule voix. Le formateur etait donc la SEULE seconde voix
 * atteignable sans faire intervenir un tiers — et c'est precisement celle que
 * le moteur jetait. Sans OPCO (les clients ne passent pas tous par un
 * financeur), l'indicateur devenait hors d'atteinte.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const MOTEUR = readFileSync(
  join(process.cwd(), "src/server/qualiopi/conformite/conformite-service.ts"),
  "utf8",
);

/** Le bloc du modele `Appreciation`, isole de ses voisins. */
function modeleAppreciation(): string {
  const debut = SCHEMA.indexOf("model Appreciation {");
  expect(debut, "le modele Appreciation a disparu").toBeGreaterThan(-1);
  return SCHEMA.slice(debut, SCHEMA.indexOf("\n}", debut));
}

describe("🔴 l'auteur d'une appreciation de formateur est rattachable", () => {
  it("le modele porte `trainerId` ET la relation vers Trainer", () => {
    // L'identifiant seul ne suffit pas : le moteur lit `trainer.email`, donc il
    // lui faut la relation, pas une colonne nue.
    const m = modeleAppreciation();
    expect(m).toMatch(/trainerId\s+String\?/);
    expect(m).toMatch(/trainer\s+Trainer\?\s+@relation/);
  });

  it("🔴 la colonne est NULLABLE — l'ancienne app tourne encore 50 min", () => {
    // `AGENTS.md` § « DEUX conteneurs, DEUX vitesses » : apres une fusion, le
    // worker porte le nouveau code pendant que l'app sert encore l'ancien. Une
    // colonne obligatoire ferait echouer les ecritures de la version en vol.
    expect(modeleAppreciation()).toMatch(/trainerId\s+String\?/);
  });

  it("supprimer un formateur n'efface pas les appreciations recueillies", () => {
    // `SetNull` et non `Cascade` : la voix a existe. On perd le rattachement,
    // jamais la trace — l'appreciation redevient « auteur non etabli », ce qui
    // est le comportement honnete.
    expect(modeleAppreciation()).toMatch(/trainer\s+Trainer\?.*onDelete:\s*SetNull/);
  });

  it("la migration existe et cree la colonne", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260904160000_appreciation_auteur_formateur/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toContain('ALTER TABLE "appreciations" ADD COLUMN "trainer_id" UUID');
    expect(sql).toContain("ON DELETE SET NULL");
  });
});

describe("🔴 le moteur RESOUT la qualite formateur", () => {
  it("il demande l'e-mail du formateur dans sa requete", () => {
    // Sans ce `select`, `a.trainer` serait `undefined` et la resolution
    // retomberait silencieusement sur « auteur non etabli » — le defaut d'avant.
    expect(MOTEUR).toMatch(/trainer:\s*\{\s*select:\s*\{\s*email:\s*true\s*\}\s*\}/);
  });

  it("🔴 il branche sur la qualite `formateur`", () => {
    expect(MOTEUR).toMatch(/a\.source === "formateur"/);
    expect(MOTEUR).toMatch(/a\.trainer\?\.email/);
  });

  it("il ne FABRIQUE pas d'auteur par repli", () => {
    // La regle d'origine, qu'on ne casse pas : sans rattachement on ne devine
    // rien. Un formateur sans `trainerId` reste « auteur non etabli » — on ne
    // le deduit pas de la session qu'il anime, sinon on fabriquerait une
    // seconde voix la ou il n'y en a qu'une.
    expect(MOTEUR).toContain("nbAppreciationsAuteurNonEtabli");
    expect(MOTEUR).toContain("nbAppreciationsAuteurNonEtabli += 1");
  });

  it("les DEUX conditions d'off.30 restent exigees", () => {
    // Deux qualites ET deux personnes. Relacher l'une des deux ferait repasser
    // « multi-parties » sur une seule voix, le defaut d'origine.
    expect(MOTEUR).toMatch(/nbAppreciationSourcesDistinctes >= 2 && nbPersonnesAppreciations >= 2/);
  });
});
