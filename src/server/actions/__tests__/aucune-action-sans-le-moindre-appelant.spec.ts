/**
 * 🔴 `D7-3-02` — dix-huit Server Actions que **rien**, nulle part, ne référence.
 *
 * ## Pourquoi ce fichier existe À CÔTÉ de `toute-action-a-une-surface.spec.ts`
 *
 * Le cliquet voisin raisonne **par FICHIER**, et c'est un choix délibéré qu'il
 * documente : une action peut légitimement n'être appelée que par sa jumelle
 * formulaire du même module — `revoquerSignatureEmargementAction` est
 * exactement ce cas.
 *
 * 🔑 **Mais ce choix a un COÛT, et personne ne l'avait mesuré.** Un fichier
 * passe au vert dès qu'**UNE** de ses actions atteint un écran. Les autres se
 * cachent derrière leurs sœurs. `financements.ts` exporte huit actions : six
 * ont un écran, et les deux dernières — `setMoyensFormationAction` et
 * `verifierSousTraitantAction` — n'en avaient aucun. Le fichier était vert.
 *
 * ## Le défaut que ça a laissé passer, et il portait deux indicateurs étoilés
 *
 * `setMoyensFormationAction` met à jour les **moyens techniques** d'une
 * formation. Ces moyens s'impriment sur le **programme de formation remis au
 * client** (`programme-formation.tsx:231`), et ils étaient posés une fois pour
 * toutes par une constante figée appliquée à TOUT le catalogue à l'import
 * (`catalog-import.ts:83`).
 *
 * L'action existait, gardée, versionnée, journalisée, **et testée**. Il lui
 * manquait un écran. Résultat : chaque formation du catalogue déclarait les
 * mêmes moyens, et **personne ne pouvait les corriger**. Or les indicateurs
 * **17 ⭐ et 18 ⭐** du RNQ demandent des moyens *adaptés à la prestation* —
 * une phrase identique partout est précisément ce qu'un auditeur relève.
 *
 * ⚠️ **Les tests ne protégeaient pas : ils masquaient.** Une suite verte sur une
 * action inatteignable certifie qu'elle fonctionnerait *si* on l'appelait. Elle
 * ne dit rien de son accessibilité — et elle donne l'apparence contraire.
 *
 * ## Ce que ce fichier garde
 *
 * Le grain est l'**ACTION**, et le critère est le plus strict possible :
 * **zéro référence hors de son propre fichier de définition, et pas même un
 * appel interne**. Une action qui ne passe pas ce filtre n'est appelée par
 * absolument rien — ni écran, ni sœur, ni service.
 *
 * ⚠️ Les fichiers de test sont **exclus du corpus**, délibérément : une action
 * référencée uniquement par sa suite de tests est le cas que ce fichier
 * cherche, pas une exception à lui accorder.
 *
 * 🔑 Chaque `"use server"` est un **point d'entrée HTTP**. Une action orpheline
 * n'est pas du code mort inerte : c'est une surface exposée que le produit
 * n'utilise pas.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const DOSSIER_ACTIONS = join(SRC, "server", "actions");

/**
 * DETTE DÉCLARÉE au 2026-08-25 — mesurée, pas recopiée.
 *
 * ⚠️ Ce n'est pas une liste d'exemptions : c'est l'inventaire de ce qui est
 * inatteignable **aujourd'hui**. Il doit RÉTRÉCIR. Le second test refuse qu'une
 * ligne y reste une fois l'action raccordée — sans quoi la liste cesserait de
 * décrire quoi que ce soit.
 *
 * Les plus lourdes de conséquence, nommées pour qu'on ne les traite pas comme
 * du décor :
 * - `setPresenceCreneauManualAction` — **corriger un créneau à la main**.
 *   L'émargement et l'import de relevé ont leur écran ; la correction ponctuelle
 *   n'en a pas (indicateur 12, suivi de l'assiduité).
 * - `updateEnrollmentPresenceAction` — taux de présence d'une inscription.
 * - `reviseDevisAction` — créer une nouvelle version d'un devis.
 * - `verifierSousTraitantAction` — horodatage de la vérification data.gouv.fr
 *   d'un sous-traitant (indicateur 27).
 */
const SANS_AUCUN_APPELANT: ReadonlyArray<string> = [
  "server/actions/editorial/metriques.ts::historiqueRelevesAction",
  "server/actions/editorial/publications.ts::controlerConformiteAction",
  "server/actions/editorial/recettes.ts::chargerArbreAction",
  "server/actions/image-bank/publish.action.ts::publishTranslationAction",
  "server/actions/intervention-documents/documents.actions.ts::discardDraftAction",
  "server/actions/knowledge/add-relation.ts::addRelationAction",
  "server/actions/knowledge/add-relation.ts::removeRelationAction",
  "server/actions/knowledge/assign-reviewer.ts::assignReviewerAction",
  "server/actions/knowledge/rollback-version.ts::rollbackVersionAction",
  "server/actions/knowledge/upload-asset.ts::uploadAssetAction",
  "server/actions/qualiopi/devis.ts::reviseDevisAction",
  "server/actions/qualiopi/engine.ts::getGenerationStatusAction",
  "server/actions/qualiopi/enrollments.ts::updateEnrollmentPresenceAction",
  "server/actions/qualiopi/financements.ts::verifierSousTraitantAction",
  "server/actions/qualiopi/offres.ts::updateOffreAction",
  "server/actions/qualiopi/presence.ts::setPresenceCreneauManualAction",
  "server/actions/qualiopi/vente-brouillon.ts::getVenteBrouillonAction",
  "server/actions/qualiopi/vente-brouillon.ts::listMesBrouillonsAction",
];

function estTest(chemin: string): boolean {
  return /\.(spec|test)\.tsx?$/.test(chemin) || /[\\/]__tests__[\\/]/.test(chemin);
}

/** Tous les `.ts`/`.tsx` de `src/`, tests exclus. */
function fichiersSource(): string[] {
  const out: string[] = [];
  const pile = [SRC];
  while (pile.length > 0) {
    const dir = pile.pop() as string;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "__tests__") pile.push(p);
      } else if (/\.tsx?$/.test(e.name) && !estTest(p)) {
        out.push(p);
      }
    }
  }
  return out;
}

/** Le code seul : sans ce dépouillement, une action citée dans son propre
 *  en-tête de documentation compterait comme appelée. Ce dépôt a déjà payé
 *  « un test statique trouve ses propres commentaires ». */
function codeSeul(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Corpus {
  readonly fichiers: string[];
  readonly jetons: Map<string, Set<string>>;
  readonly code: Map<string, string>;
}

function corpus(): Corpus {
  const fichiers = fichiersSource();
  const jetons = new Map<string, Set<string>>();
  const code = new Map<string, string>();
  for (const f of fichiers) {
    const c = codeSeul(readFileSync(f, "utf-8"));
    code.set(f, c);
    jetons.set(f, new Set(c.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []));
  }
  return { fichiers, jetons, code };
}

/** Les actions que RIEN ne référence : ni un autre fichier, ni une sœur. */
function orphelines(c: Corpus): string[] {
  const out: string[] = [];
  for (const f of c.fichiers) {
    if (!f.startsWith(DOSSIER_ACTIONS)) continue;
    const source = c.code.get(f) as string;
    const rel = f.slice(SRC.length + 1).replace(/\\/g, "/");
    const noms = [
      ...source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*Action)\b/gm),
    ].map((m) => m[1] as string);

    for (const nom of noms) {
      const ailleurs = c.fichiers.some((g) => g !== f && (c.jetons.get(g) as Set<string>).has(nom));
      if (ailleurs) continue;
      // Une seule occurrence dans son propre fichier = la ligne de définition.
      const interne = (source.match(new RegExp(`\\b${nom}\\b`, "g")) ?? []).length;
      if (interne <= 1) out.push(`${rel}::${nom}`);
    }
  }
  return out.sort();
}

describe("aucune Server Action n'est inatteignable en silence", () => {
  const c = corpus();
  const mesurees = orphelines(c);

  it("🔑 CONTRE-TÉMOIN : l'inventaire mesure réellement quelque chose", () => {
    // Sans ce témoin, un renommage de dossier ou une régression d'expression
    // régulière viderait `mesurees` et TOUT ce fichier passerait au vert en
    // n'ayant rien examiné. Ce dépôt a déjà payé ce vert-là plusieurs fois.
    expect(c.fichiers.length, "le corpus est vide : le balayage est cassé").toBeGreaterThan(2000);

    const totalActions = c.fichiers
      .filter((f) => f.startsWith(DOSSIER_ACTIONS))
      .reduce(
        (n, f) =>
          n +
          ((c.code.get(f) as string).match(
            /^export\s+(?:async\s+)?function\s+[A-Za-z_][A-Za-z0-9_]*Action\b/gm,
          )?.length ?? 0),
        0,
      );
    expect(totalActions, "aucune action trouvée : le motif d'export est cassé").toBeGreaterThan(
      250,
    );
  });

  it("🔴 aucune NOUVELLE action ne naît sans le moindre appelant", () => {
    const nouvelles = mesurees.filter((a) => !SANS_AUCUN_APPELANT.includes(a));
    expect(
      nouvelles,
      "ces Server Actions ne sont appelées par RIEN — ni écran, ni sœur, ni service. " +
        "Elles sont malgré tout des points d'entrée HTTP. Raccordez-les à un écran, " +
        "ou supprimez-les : une action que seuls ses tests nomment donne l'apparence " +
        "d'une fonctionnalité livrée.",
    ).toEqual([]);
  });

  it("🔴 la dette RÉTRÉCIT : une ligne soldée se retire de la liste", () => {
    // Le contrôle marche dans les deux sens. Sans celui-ci, raccorder une action
    // laisserait sa ligne ici pour toujours et la liste cesserait de décrire
    // l'état réel — c'est ainsi qu'un inventaire devient un décor.
    const soldees = SANS_AUCUN_APPELANT.filter((a) => !mesurees.includes(a));
    expect(
      soldees,
      "ces actions ont désormais un appelant : retirez-les de `SANS_AUCUN_APPELANT`",
    ).toEqual([]);
  });

  it("🔑 le TÉMOIN du défaut fondateur : les moyens pédagogiques sont éditables", () => {
    // C'est le cas qui a motivé ce fichier. Avant le 2026-08-25,
    // `setMoyensFormationAction` n'était nommée que par sa propre définition et
    // par ses tests — et les moyens imprimés sur chaque programme de formation
    // étaient donc incorrigibles (off.17 ⭐, off.18 ⭐).
    //
    // Sans cette assertion, rien ne distinguerait « corrigé » de « ajouté à la
    // liste de dette », et le correctif pourrait être défait sans bruit.
    expect(SANS_AUCUN_APPELANT).not.toContain(
      "server/actions/qualiopi/financements.ts::setMoyensFormationAction",
    );
    expect(mesurees).not.toContain(
      "server/actions/qualiopi/financements.ts::setMoyensFormationAction",
    );

    const ecran = c.fichiers.find((f) => f.endsWith(join("qualiopi", "FormationForm.tsx")));
    expect(ecran, "l'écran d'édition de formation a disparu ou changé de nom").toBeDefined();
    expect(
      (c.jetons.get(ecran as string) as Set<string>).has("setMoyensFormationAction"),
      "FormationForm n'appelle plus l'action : les moyens redeviennent incorrigibles",
    ).toBe(true);
  });
});
