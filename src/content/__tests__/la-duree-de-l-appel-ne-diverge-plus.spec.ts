// La durée de l'appel de découverte ne diverge plus — 45 minutes partout.
//
// ## Ce que cette garde protège
//
// L'appel dure **45 minutes** (décision de Will, 2026-08-27 : le site s'aligne
// sur Calendly, jamais l'inverse). Un prospect qui lit « 30 » bloque 45 minutes
// de son agenda sans le savoir, et découvre le décalage pendant l'appel.
//
// Le chiffre était RECOPIÉ à 39 endroits. C'est ce qui rendait le défaut
// durable : chaque copie pouvait diverger seule, et l'une d'elles l'avait fait.
//
// ## 🔴 POURQUOI CETTE GARDE A ÉTÉ RÉÉCRITE LE 2026-08-28
//
// Sa première version **portait la liste** des quatorze fichiers qu'elle
// surveillait. `src/messages/*.json` n'y était pas — et c'est précisément là
// qu'un « Cadrage 30 min » a survécu à la campagne, sur la **page d'accueil**,
// avec sa description « Appel découverte gratuit » juste à côté.
//
// Le jumeau exact de cette chaîne vivait dans `AuditMethodology.tsx` — même
// titre, même description — et lui avait bien été corrigé. Un fichier changé,
// son jumeau manqué : le motif est connu, et une garde à liste explicite ne
// peut pas l'attraper, parce qu'elle ne cherche que là où on a déjà regardé.
//
// 🔑 Une garde ne doit jamais PORTER la liste de ce qu'elle surveille. Elle la
// DÉRIVE — sinon elle reste verte en ne regardant pas.
//
// ## Pourquoi un balayage large est possible, contrairement à ce qui était écrit
//
// La version précédente justifiait sa liste ainsi : « "30 min" apparaît 1 886
// fois dans `src/`, un balayage large rougirait sur les homonymes et serait
// désactivé dans la semaine. » **C'était une supposition, pas une mesure.**
//
// Mesuré le 2026-08-28 sur les 3 798 fichiers de `src/app`, `src/components`,
// `src/content` et `src/messages` :
//
//   · même ligne, sans borne de mot ........... 15 cooccurrences (13 parasites)
//   · même ligne, avec bornes de mot ...........  7 cooccurrences (5 parasites)
//   · fenêtre de 60 caractères, bornes de mot ...  2 — LES DEUX VRAIS DÉFAUTS
//
// Les parasites étaient tous des temps de trajet des pages villes (« Nîmes à
// 30 min ») sur des lignes longues où le mot de l'appel se trouvait à l'autre
// bout. Deux resserrages suffisent, et aucun n'exclut de dossier :
//
//   1. **des bornes de mot** — sans elles, « échangeur » (autoroutier) matchait
//      « échange » ;
//   2. **une fenêtre de proximité** — la durée et le mot de l'appel doivent se
//      trouver à moins de 60 caractères l'un de l'autre. Une phrase qui parle
//      vraiment de l'appel les colle ; une liste de temps de trajet les sépare.
//
// ⚠️ Exclure `src/content/villes/copy/` aurait « marché » aussi — et créé un
// angle mort de 2 159 fichiers. Le resserrage n'en crée aucun.
//
// ## Ce que cette garde ne peut pas faire
//
// Elle NE compare PAS au réglage réel de Calendly : ce test tourne sans jeton
// d'API. Le seul affichage qui suit vraiment Calendly est celui sous les
// créneaux, DÉRIVÉ de la réponse d'API (`availability.ts` → `dureeMinutes`).
// Cette garde protège le reste, qui est du texte et ne peut pas être dérivé.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Les racines balayées. Une racine disparue fait ROUGIR, jamais taire. */
const RACINES = ["src/app", "src/components", "src/content", "src/messages"] as const;

const EXTENSIONS = [".ts", ".tsx", ".json"] as const;

/**
 * Nombre plancher de fichiers à balayer.
 *
 * 🔑 C'est le témoin qui empêche cette garde de devenir verte en ne regardant
 * rien. 3 798 fichiers mesurés le 2026-08-28 ; le plancher est posé bas pour
 * absorber les suppressions normales, assez haut pour qu'un balayage cassé
 * (mauvaise racine, extension oubliée, `readdir` qui échoue) rougisse.
 */
const PLANCHER_FICHIERS = 2_000;

/** La durée fautive, sous ses formes rencontrées dans le dépôt. */
const DUREE_FAUTIVE = /\b30\s?-?\s?(min\b|minutes?\b)|30-min\b/i;

/**
 * Les mots qui signent une phrase parlant de l'appel de découverte.
 *
 * ⚠️ Les bornes de mot ne sont pas cosmétiques : sans le `\b` FINAL,
 * « échangeur » (autoroutier) matchait « échange » et faisait rougir cinq pages
 * villes. C'est ce faux positif qui aurait poussé à exclure le dossier entier.
 *
 * 🔴 ET PAS DE `\b` AU DÉBUT DE « échange » : en JavaScript, `\b` est une borne
 * ASCII. « é » n'est pas un caractère de mot pour elle, donc il n'y a AUCUNE
 * borne entre une espace et « é » — `\b[ée]change` ne matche jamais un mot
 * accentué en début de mot. La version Python qui a servi à mesurer, elle,
 * portait `re.U` et matchait : les deux moteurs ne donnaient pas le même
 * résultat sur la même expression. Le témoin « échangeur » l'a attrapé.
 */
const MOTS_DE_L_APPEL =
  /\bappels?\b|[ée]changes?\b|premier contact|\bcalls?\b|cadrage|d[ée]couverte|scoping/i;

/** Distance maximale, en caractères, entre la durée et le mot de l'appel. */
const PROXIMITE = 60;

function fichiersSous(racine: string): string[] {
  const absolu = join(process.cwd(), racine);
  if (!existsSync(absolu)) {
    throw new Error(
      `Garde inopérante : la racine « ${racine} » est introuvable. Le code a ` +
        `déménagé — corrige CETTE racine plutôt que de retirer l'entrée, sinon ` +
        `la durée peut redevenir fausse sans que rien ne le dise.`,
    );
  }
  const out: string[] = [];
  const pile = [absolu];
  while (pile.length) {
    const dossier = pile.pop() as string;
    for (const nom of readdirSync(dossier)) {
      if (nom === "node_modules" || nom === "__tests__") continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) pile.push(chemin);
      else if (EXTENSIONS.some((e) => nom.endsWith(e))) out.push(chemin);
    }
  }
  return out;
}

/** Une durée fautive ASSEZ PRÈS d'un mot de l'appel pour parler de lui. */
function lignesFautives(contenu: string): string[] {
  const trouvees: string[] = [];
  contenu.split("\n").forEach((ligne, i) => {
    for (const m of ligne.matchAll(new RegExp(DUREE_FAUTIVE, "gi"))) {
      const debut = Math.max(0, (m.index ?? 0) - PROXIMITE);
      const fenetre = ligne.slice(debut, (m.index ?? 0) + m[0].length + PROXIMITE);
      if (MOTS_DE_L_APPEL.test(fenetre)) {
        trouvees.push(`${i + 1}: ${ligne.trim().slice(0, 140)}`);
        break;
      }
    }
  });
  return trouvees;
}

describe("la durée de l'appel de découverte", () => {
  const fichiers = RACINES.flatMap(fichiersSous);

  it("le balayage regarde vraiment quelque chose", () => {
    // Sans ce cas, un balayage cassé rendrait le suivant vert par vacuité —
    // exactement le défaut « une garde verte parce qu'elle ne regarde pas ».
    expect(
      fichiers.length,
      `seulement ${fichiers.length} fichiers balayés : le parcours est cassé, ` +
        `la garde ne prouve plus rien`,
    ).toBeGreaterThanOrEqual(PLANCHER_FICHIERS);
  });

  it("aucune surface n'annonce 30 minutes pour l'appel", () => {
    const fautives = fichiers.flatMap((chemin) => {
      const lignes = lignesFautives(readFileSync(chemin, "utf8"));
      return lignes.map((l) => `${chemin.replace(process.cwd(), "").replace(/\\/g, "/")} → ${l}`);
    });

    expect(
      fautives,
      "l'appel de découverte dure 45 minutes (décision de Will, 2026-08-27) — " +
        "un prospect qui lit 30 bloque 45 minutes de son agenda sans le savoir",
    ).toEqual([]);
  });

  it("TÉMOIN — la garde détecte bien une durée fautive", () => {
    // Sans ce cas, une expression régulière cassée rendrait le balayage vert
    // par vacuité, et personne ne le verrait.
    const reel = '    "method1Title": "Cadrage 30 min",';
    // ⚠️ Le vrai défaut du 2026-08-28 était sur DEUX lignes JSON voisines : le
    // titre portait la durée, la description portait le mot. La garde travaille
    // par ligne, donc c'est le titre seul qui doit suffire — « cadrage » est
    // dans MOTS_DE_L_APPEL exactement pour ça.
    expect(lignesFautives(reel)).toHaveLength(1);

    const anglais = '    "method1Title": "30-min scoping",';
    expect(lignesFautives(anglais)).toHaveLength(1);
  });

  it("TÉMOIN — la garde ne se déclenche PAS sur un homonyme éloigné", () => {
    // Les temps de trajet des pages villes sont la famille d'homonymes la plus
    // nombreuse : 2 159 fichiers. Si ce cas rougit, la garde est trop large et
    // sera désactivée — ou pire, on lui excluera le dossier entier.
    const trajet =
      "Sommières est à 30 min de Nîmes et 30 min de Montpellier. Nos consultants " +
      "interviennent sur site. Échangeur direct après un premier échange.";
    expect(lignesFautives(trajet)).toEqual([]);

    const agenda = "Sans plancher, un rendez-vous de 30 min sur 14 h ferait 3,6 %.";
    expect(lignesFautives(agenda)).toEqual([]);
  });

  it("TÉMOIN — « échangeur » ne compte pas comme « échange »", () => {
    // Sans borne de mot, ce seul cas faisait rougir cinq pages villes, et c'est
    // ce qui aurait poussé à exclure le dossier — donc à créer l'angle mort.
    expect(MOTS_DE_L_APPEL.test("échangeur autoroutier")).toBe(false);
    expect(MOTS_DE_L_APPEL.test("un premier échange")).toBe(true);
  });
});
