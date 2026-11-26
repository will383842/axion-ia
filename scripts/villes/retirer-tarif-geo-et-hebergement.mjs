#!/usr/bin/env node
/**
 * Retire des pages villes les promesses de tarif géographique et d'hébergement
 * (« Aucun supplément géographique : le tarif est identique à X », « au même
 * tarif », « Pour les multi-jours, hébergement local possible », « le
 * déplacement … est compris dans la prestation ») et la partie « déplacement »
 * des phrases de prix (« dès {{price:…}}, déplacement sous 5 jours »).
 *
 * Règle de Will : les frais de déplacement ne s'affichent JAMAIS sur les pages,
 * seulement dans les CGV. Lignes de commentaire ignorées.
 *
 * Usage : node scripts/villes/retirer-tarif-geo-et-hebergement.mjs [--dry-run]
 * Verrouillé par src/content/villes/__tests__/villes-sans-frais-ni-fausse-presence.spec.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "content",
  "villes",
);
const DRY = process.argv.includes("--dry-run");

const REGLES = [
  [
    / ?(?:Aucun|aucun) (?:supplément|surcoût) (?:géographique|de zone)(?: ?: ?le tarif[^."]*?(?:est|sont) (?:identique|le même|les mêmes)[^."]*)?\./gu,
    "",
  ],
  [
    /,? (?:sans|pas de) surcoût géographique(?: (?:pour|sur) [^.,"]+(?: ni [^.,"]+)?)?(?=[.,"])/gu,
    "",
  ],
  [/, au même tarif\./gu, "."],
  [
    / ?(?:Pour les (?:missions |interventions )?multi-jours(?: en [^,."]+)?, |Multi-jours ?: )(?:repas et )?hébergement local possibles?(?: [^."]*)?\./gu,
    "",
  ],
  [/, et le déplacement sur l'ensemble du Val-de-Marne est compris dans la prestation/gu, ""],
  [
    /,? (?:avec )?(?:un )?déplacement(?: (?:équipe|consultant|Williams|physique|sur site))?(?: sous \d+ jours(?: ouvrés)?)?(?: depuis notre (?:couverture|équipe) nationale)?(?=[.,"])(?<=\}\}[^."]{0,60})/gu,
    "",
  ],
];

const NOUVELLE = "Nous intervenons partout en France, sur place ou à distance.";
const DEPLACE = "Nous nous déplaçons chez vous, partout en France.";

/** Phrase « Nos consultants rejoignent / viennent d'… » : remplacée, ou retirée si la ligne dit déjà « partout en France ». */
const PHRASE_CONSULTANTS =
  /(^|["“] ?|[.!?] )(?:Oui\. )?(?:[Nn]os consultants (?:seniors )?(?:rejoignent|viennent d['’]|viennent de|viennent depuis|interviennent à [^."]*?depuis|interviennent[^."]{0,40}depuis|arrivent (?:depuis|en \d)|se déplacent[^."]{0,60}depuis)|Consultants depuis [A-ZÉ]|Nous arrivons[^."]{0,30}depuis)[^."]*\.(?= |"|$)/gu;

function phraseConsultants(ligne) {
  const dejaDit = ligne.includes("partout en France");
  return ligne.replace(PHRASE_CONSULTANTS, (m, avant, decalage, tout) => {
    if (!dejaDit) return `${avant}${NOUVELLE}`;
    const seule = avant.startsWith('"') && tout[decalage + m.length] === '"';
    if (seule) return `${avant}${NOUVELLE}`;
    return avant.startsWith('"') || avant === "" ? avant : avant.slice(0, -1);
  });
}

/** Phrase dont le sujet est « nous / nos consultants / Williams… » et qui donne une origine (« depuis <Ville> », « arrivent via la gare »). */
const PHRASE_ORIGINE =
  /(^|["“] ?|[.!?] )(?:Oui[,.] )?(?![^."?]*autonomie)[^."?]*?(?:\b[Cc]onsultants?\b|\b[Ee]xperts?\b|Williams|\b[Nn]ous\b|[Nn]otre équipe|[Nn]os équipes|\bTrajet|disponibilité consultant)[^."?]*?(?:(?:depuis|venant de|se deplacent depuis|arrivent (?:via|par|le matin|en une)|accèdent à)[ \u00a0](?:[A-ZÉ]|gare|la gare)|se deplacent|repartent le soir|arrivent le matin)[^."]*\.(?= |"|$)/gu;

function phraseOrigine(ligne) {
  const dejaDit = ligne.includes("partout en France");
  return ligne.replace(PHRASE_ORIGINE, (m, avant, decalage, tout) => {
    if (!dejaDit) return `${avant}${NOUVELLE}`;
    const seule = avant.startsWith('"') && tout[decalage + m.length] === '"';
    if (seule) return `${avant}${NOUVELLE}`;
    return avant.startsWith('"') || avant === "" ? avant : avant.slice(0, -1);
  });
}

const REGLES_BASE = [
  [/ en visio depuis [A-ZÉ][\p{L}'-]+(?: centre)?/gu, " en visio"],
  [/Williams se déplace sur site depuis notre base nationale/gu, "Nous nous déplaçons chez vous"],
  [
    / ?[A-ZÉ][^."]*(?:toute logistique mission multi-jours|idéalement situé pour des missions multi-jours)[^."]*\./gu,
    "",
  ],
  [
    /(?<=\}\}\.) (?:Déplacement|Intervention) (?:consultant )?(?:sur site )?sous \d+ jours ouvrés[^."]*\./gu,
    "",
  ],
  [
    /(?<=\}\}), (?:déplacement|intervention) (?:consultant )?(?:sur site )?sous \d+ jours ouvrés[^."]*?(?=\.)/gu,
    "",
  ],
  [/(?<=\.)  (?=[A-ZÉ])/gu, " "],
  [
    /(?<=[.!?] )(?:Pour (?:les )?(?:missions |interventions )?(?:de plusieurs jours|multi-jours)[^.,"]*, |Pour missions multi-jours, )(?:un )?h[ée]bergement[^."]*\./gu,
    "",
  ],
  [
    /(?<=[.!?] |["“])(?:Multi-jours ?: ?)?(?:Un )?[Hh][ée]bergement (?:local|possible|disponible)[^."]*\./gu,
    "",
  ],
  [
    / ?(?:Pour (?:les )?(?:missions )?(?:de plusieurs jours|multi-jours)[^.,"]*, )(?:un )?h[ée]bergement[^."]*\./gu,
    "",
  ],
  [/ Hébergement local possible \([^)]*\)\./gu, ""],
  [/ Hébergement local[^."]*\./gu, ""],
  [/Williams se déplace-t-il à ([^"?]*?) depuis Paris ?\?/gu, "Vous déplacez-vous à $1 ?"],
  [
    /Williams se déplace(?: sur site)? depuis Paris(?: \([^)]*\))?(?: (?:via|en|par)[^."]*?)?(?= pour )/gu,
    "Nous nous déplaçons chez vous",
  ],
  [/Williams intervient depuis Paris(?= pour )/gu, "Nous intervenons partout en France"],
  [
    /(?<=[.!?] |["“]|\n\s*)(?:Oui, )?Williams se déplace(?: sur site)? depuis Paris[^."]*\./gu,
    DEPLACE,
  ],
  [/ \(souvent moins, étant basé à Paris\)/gu, ""],
  [/(?<=[.!?] |["“])Déplacements? (?:rapide |direct |simple )?depuis [^."]*\./gu, DEPLACE],
  [/ \(déplacement depuis [^)]*\)/gu, " (déplacement sur site)"],
  [
    /, déplacements? (?:rapide )?depuis [^."]*?(?=\.)/gu,
    ", déplacement sur site partout en France",
  ],
  [/, avec déplacements depuis [^."]*?(?=\.)/gu, ", avec déplacement sur site"],
  [/ depuis notre base (?:nantaise|à [A-ZÉ][\p{L}-]+)/gu, ""],
  [/, depuis nos points de cadrage [A-ZÉ][\p{L}-]+/gu, ""],
  [/ — depuis nos points de cadrage [A-ZÉ][\p{L}-]+/gu, ""],
  [/ depuis nos points de cadrage [A-ZÉ][\p{L}-]+/gu, ""],
  [
    /les ateliers Axion-IA à Jacou sont accessibles sans voiture/gu,
    "nous nous déplaçons chez vous",
  ],
];

const fichiers = [
  ...readdirSync(join(RACINE, "copy"))
    .filter((n) => n.endsWith(".ts") && n !== "types.ts" && !n.startsWith("_"))
    .map((n) => `copy/${n}`),
  ...readdirSync(join(RACINE, "fiches-locales"))
    .filter((n) => n.endsWith(".ts"))
    .map((n) => `fiches-locales/${n}`),
  "journee-ia-locale.ts",
];
let lignes = 0,
  nbFichiers = 0;
for (const f of fichiers) {
  const chemin = join(RACINE, f);
  const src = readFileSync(chemin, "utf8");
  const sortie = src
    .split("\n")
    .map((l) => {
      if (/^\s*(\/\/|\/?\*)/.test(l)) return l;
      let n = l;
      for (const [re, par] of [...REGLES, ...REGLES_BASE]) n = n.replace(re, par);
      n = phraseConsultants(n);
      n = phraseOrigine(n);
      if (n !== l) lignes++;
      return n;
    })
    .join("\n");
  if (sortie !== src) {
    nbFichiers++;
    if (!DRY) writeFileSync(chemin, sortie);
  }
}
console.log(`${DRY ? "[dry-run] " : ""}${lignes} lignes, ${nbFichiers} fichiers`);
