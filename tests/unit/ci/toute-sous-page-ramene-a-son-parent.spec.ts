/**
 * 🔴 Une sous-page de session ou de formation doit RAMENER À SON PARENT.
 *
 * ## Le défaut
 *
 * L'audit de navigation du 2026-09-05 a relevé que **4 sous-pages sur 8** ne
 * ramenaient pas à leur fiche parente, et que `sessions/[id]/emargement` — l'écran
 * où l'on passe le plus de temps sur une session en cours — ne ramenait **nulle
 * part** : une fois dedans, la seule sortie était le bouton « précédent » du
 * navigateur.
 *
 * Les autres ramenaient à la LISTE, ou à une page SŒUR. Arriver depuis une
 * session précise et en ressortir à la racine, à charge de la retrouver, n'est
 * pas une navigation : c'est un labyrinthe poli.
 *
 * ## Pourquoi cette garde vit dans `tests/unit/ci/`
 *
 * Parce qu'elle balaie l'ARBORESCENCE : elle découvre les sous-pages au lieu
 * d'en tenir la liste. Une liste écrite à la main vieillit — c'est exactement ce
 * qui a rendu `outbox-policy.spec.ts` rouge pendant vingt-quatre heures sans que
 * personne le voie. Toute sous-page AJOUTÉE demain est donc assujettie sans que
 * quiconque pense à ce fichier.
 *
 * ⚠️ Ces gardes-là ne s'exécutent PAS quand on cible un sous-ensemble de tests.
 * C'est voulu, et c'est aussi leur faiblesse : il faut lancer `tests/unit/ci/`
 * avant de pousser.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();

/** Les deux familles qui ont une FICHE parente à `[id]`. */
const FAMILLES = [
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formations/[id]",
] as const;

/** Sous-pages découvertes : un dossier sous `[id]` qui porte un `page.tsx`. */
function sousPages(): ReadonlyArray<{ chemin: string; parent: string; source: string }> {
  const trouvees: Array<{ chemin: string; parent: string; source: string }> = [];
  for (const famille of FAMILLES) {
    const abs = path.join(RACINE, famille);
    if (!fs.existsSync(abs)) continue;
    for (const entree of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entree.isDirectory()) continue;
      const page = path.join(abs, entree.name, "page.tsx");
      if (!fs.existsSync(page)) continue;
      trouvees.push({
        chemin: `${famille}/${entree.name}`,
        parent: famille.endsWith("sessions/[id]") ? "sessions" : "formations",
        source: fs.readFileSync(page, "utf-8"),
      });
    }
  }
  return trouvees;
}

/**
 * Le lien vers la fiche parente : un `href` qui se termine par `${id}`, sans
 * segment après. `.../sessions/${id}` compte ; `.../sessions/${id}/emargement`
 * est une page sœur, et `.../sessions` est la liste — ni l'un ni l'autre n'est
 * un retour au parent.
 */
function ramenAuParent(source: string, parent: string): boolean {
  // ⚠️ Comparaison par CHAÎNES, pas par expression régulière. Le motif recherché
  // est truffé de `$`, `{` et `}` — tous métacaractères — et deux tentatives
  // d'échappement successives ont produit des regex silencieusement fausses,
  // qui ne rougissaient pas : elles ne trouvaient simplement plus rien. Un
  // motif littéral se cherche littéralement.
  const chemin = "/${locale}/${adminPrefix}/qualiopi/" + parent + "/${id}";

  // Forme A — le chemin écrit directement dans le `href`.
  if (source.includes("href={`" + chemin + "`}")) return true;

  // Forme B — le chemin est mis dans une VARIABLE, puis le `href` la lit.
  //
  // 🔴 Cette branche manquait, et la garde a rougi sur TROIS pages
  // parfaitement correctes (`kit`, `programme`, `animer`) qui font exactement
  // ce qu'on leur demande, en passant par `base` / `formationBase`. Un
  // détecteur qui n'admet qu'une seule ÉCRITURE d'une bonne pratique condamne
  // ceux qui l'appliquent autrement — et se fait désarmer au premier faux
  // positif, ce qui laisserait ensuite passer les vrais.
  const decl = "= `" + chemin + "`";
  const i = source.indexOf(decl);
  if (i < 0) return false;
  const avant = source.slice(Math.max(0, i - 80), i);
  const nom = /const\s+([A-Za-z0-9_]+)\s*$/.exec(avant)?.[1];
  if (nom === undefined) return false;
  return source.includes("href={" + nom + "}");
}

describe("🔴 toute sous-page de session ou de formation ramène à son parent", () => {
  it("le recensement TROUVE des sous-pages — sinon la garde ne garde rien", () => {
    // Témoin de prémisse. Un chemin faux rend une liste vide, et une liste vide
    // passe l'assertion suivante pour l'éternité : « aucune sous-page fautive »
    // et « je ne sais pas lire l'arborescence » ont la même sortie.
    const p = sousPages();
    expect(p.length).toBeGreaterThanOrEqual(6);
    const noms = p.map((x) => x.chemin.split("/").pop());
    expect(noms).toContain("emargement");
    expect(noms).toContain("financement");
  });

  it("aucune sous-page ne laisse l'utilisateur sans retour vers sa fiche", () => {
    const orphelines = sousPages()
      .filter((p) => !ramenAuParent(p.source, p.parent))
      .map((p) => p.chemin);
    expect(orphelines).toEqual([]);
  });

  it("le détecteur DISTINGUE le parent de la liste et de la page sœur", () => {
    // Contre-épreuve du détecteur : sans elle, un motif trop permissif
    // (« l'href contient /sessions/ ») déclarerait conformes les pages qui
    // ramènent à la LISTE — c'est-à-dire précisément le défaut d'origine.
    const versParent = "href={`/${locale}/${adminPrefix}/qualiopi/sessions/${id}`}";
    const versListe = "href={`/${locale}/${adminPrefix}/qualiopi/sessions`}";
    const versSoeur = "href={`/${locale}/${adminPrefix}/qualiopi/sessions/${id}/emargement`}";
    expect(ramenAuParent(versParent, "sessions")).toBe(true);
    expect(ramenAuParent(versListe, "sessions")).toBe(false);
    expect(ramenAuParent(versSoeur, "sessions")).toBe(false);
  });
});
