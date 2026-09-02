/**
 * Garde : aucun gabarit d'e-mail ne doit être ORPHELIN.
 *
 * ── LE DOUTE QUE CETTE GARDE LÈVE ───────────────────────────────────
 *
 * Le 2026-09-01, après la refonte du parc d'e-mails, **deux gabarits sur
 * quarante-quatre** avaient été observés en vrai dans une boîte de réception.
 * Les quarante-deux autres étaient prouvés par le rendu : objet borné,
 * pré-en-tête distinct, régime de famille, mentions légales. Rien ne prouvait
 * en revanche qu'un ÉVÉNEMENT les déclenche : un gabarit peut être impeccable
 * et n'être appelé par personne — du code mort qui passe toutes les gardes de
 * contenu.
 *
 * ── CE QUE CETTE GARDE PROUVE, ET CE QU'ELLE NE PROUVE PAS ──────────────
 *
 * ✅ Elle prouve que chaque nom du registre est **cité par du code de
 *    production** — hors du dossier des gabarits, hors des tests. C'est la
 *    condition nécessaire pour qu'un événement puisse l'enfiler.
 *
 * ❌ Elle ne prouve PAS que le chemin qui le cite est atteignable, ni qu'il
 *    part vraiment. Une citation dans une branche morte la satisferait. Le seul
 *    contrôle qui tranche cela reste un envoi réel observé en boîte.
 *
 * Écrire cette limite ici plutôt que de la sous-entendre : une garde dont on
 * surestime la portée est plus dangereuse que pas de garde, parce qu'elle
 * ferme la question.
 *
 * ── POURQUOI LA LISTE N'EST PAS RECOPIÉE ────────────────────────────
 *
 * Elle est lue dans `EMAIL_TEMPLATE_NAMES`, à chaque exécution. Une liste écrite
 * en dur finirait par surveiller sa copie : le gabarit ajouté demain n'y
 * figurerait pas, et la suite resterait verte en ne regardant rien.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { EMAIL_TEMPLATE_NAMES } from "./index";
import { DORMANTS } from "@/server/email/apercu/catalogue";

const RACINE_SRC = join(process.cwd(), "src");
const DOSSIER_GABARITS = join("src", "lib", "email", "templates");
/**
 * 🔴 Lot 4 (2026-09-02) — cette garde était VERTE PAR CONSTRUCTION. Le catalogue
 * d'aperçu (`src/server/email/apercu/catalogue.ts`) est un fichier de
 * production qui cite les 44 noms comme clés : chaque gabarit y était « cité »,
 * orphelin ou pas. Cinq gabarits sans aucun appelant passaient. On exclut le
 * dossier d'aperçu du balayage, et on lit les dormants DÉCLARÉS par le
 * catalogue plutôt qu'une liste recopiée ici.
 */
const DOSSIER_APERCU = join("src", "server", "email", "apercu");
/**
 * Même raison : l'union de types `EmailJobName` (`src/server/queue/types.ts`)
 * énumère les 44 noms. Un TYPE n'est pas un appelant.
 */
const FICHIER_TYPES = join("src", "server", "queue", "types.ts");

/**
 * Tous les fichiers de code de PRODUCTION : ni les gabarits eux-mêmes (qui se
 * citent forcément), ni les tests (qui citeraient un gabarit mort sans que ça
 * signifie quoi que ce soit pour un client).
 */
function fichiersDeProduction(): string[] {
  const trouves: string[] = [];
  const parcourir = (dossier: string): void => {
    for (const entree of readdirSync(dossier)) {
      const complet = join(dossier, entree);
      if (statSync(complet).isDirectory()) {
        if (entree === "__tests__" || entree === "node_modules") continue;
        parcourir(complet);
        continue;
      }
      if (!entree.endsWith(".ts") && !entree.endsWith(".tsx")) continue;
      if (entree.includes(".spec.") || entree.includes(".test.")) continue;
      if (complet.includes(DOSSIER_GABARITS)) continue;
      if (complet.includes(DOSSIER_APERCU)) continue;
      if (complet.endsWith(FICHIER_TYPES)) continue;
      trouves.push(complet);
    }
  };
  parcourir(RACINE_SRC);
  return trouves;
}

describe("registre des gabarits — aucun orphelin", () => {
  const fichiers = fichiersDeProduction();
  const sources = fichiers.map((f) => readFileSync(f, "utf8"));

  it("lit bien un corpus non vide — sinon la garde serait verte en ne regardant rien", () => {
    expect(
      fichiers.length,
      "aucun fichier de production trouvé : l'arborescence a changé ?",
    ).toBeGreaterThan(200);
    expect(EMAIL_TEMPLATE_NAMES.length).toBeGreaterThan(30);
  });

  it(`${"🔴"} chaque gabarit est cité par du code de production`, () => {
    const dormants = new Set<string>(DORMANTS);
    const orphelins = EMAIL_TEMPLATE_NAMES.filter((n) => !dormants.has(n)).filter(
      (nom) => !sources.some((source) => source.includes(nom)),
    );

    expect(
      orphelins,
      "Ces gabarits ne sont cités NULLE PART hors du dossier des gabarits et " +
        "des tests. Aucun événement ne peut donc les enfiler : ils sont rendus " +
        "impeccablement, gardés par toutes les règles du référentiel, et " +
        "n'arriveront jamais chez personne. Soit brancher l'événement qui les " +
        "déclenche, soit les retirer du registre — mais ne pas les laisser " +
        "donner l'illusion d'un parc complet.",
    ).toEqual([]);
  });
});

describe("registre des gabarits — les dormants sont vraiment dormants", () => {
  it("🔴 un gabarit déclaré dormant par le catalogue n'est cité par aucun code de production", () => {
    const sources = fichiersDeProduction().map((f) => readFileSync(f, "utf8"));
    const reveilles = DORMANTS.filter((nom) => sources.some((s) => s.includes(`"${nom}"`)));
    expect(
      reveilles,
      "ces gabarits sont cités par du code de production mais déclarés dormants dans le " +
        "catalogue d'aperçu : mettre le catalogue à jour (`source`), sinon il ment",
    ).toEqual([]);
  });

  it("la garde rougirait sur un nom fantôme — elle regarde bien du code", () => {
    const sources = fichiersDeProduction().map((f) => readFileSync(f, "utf8"));
    expect(sources.some((s) => s.includes('"gabarit-qui-n-existe-pas"'))).toBe(false);
  });
});
