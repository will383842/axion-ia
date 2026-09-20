/**
 * le-materiel-annonce-est-le-meme-partout.spec.ts
 *
 * 🔴 POURQUOI CE FICHIER EXISTE.
 *
 * Mesuré le 2026-09-18 : la base (`formations.moyens_techniques`), imprimée sur
 * le programme PDF et la convocation, dit « smartphone ou poste ». Les fiches
 * publiques de 21 formations disaient « Ordinateur portable ». Le même stagiaire
 * lisait deux règles.
 *
 * Décision de Will du 2026-09-18 : smartphone OU ordinateur. Deux exceptions,
 * confirmées par Will le même jour : IA pour l'IT (environnement de
 * développement habituel) et IA pour l'automatisation (prototype construit sur
 * poste). Le séminaire n'exige aucun matériel individuel. Et, décision de Will
 * du même jour : pour les quatre formations à exercices sur tableur (finance,
 * achats, commerce, équipes), « un ordinateur est recommandé ».
 *
 * 🔴 PREMIÈRE VERSION DE CETTE GARDE : TROP ÉTROITE. Elle ne cherchait dans la
 * FAQ qu'UNE phrase exacte ; l'entrée `presentiel-distance` disait encore
 * « un ordinateur portable et une connexion internet » (publiée sur /faq, le
 * JSON-LD QAPage et llms-full.txt), et la garde passait 22/22 en vert.
 *
 * 🔴 DEUXIÈME VERSION : ENCORE TROP ÉTROITE. Elle ne reconnaissait « ordinateur
 * portable » que collé à « connexion internet » : « un ordinateur portable »
 * seul, « … avec une connexion internet », « … et d'une connexion internet »,
 * « … — et une connexion internet » passaient en exit 0 (revue sécurité
 * 5251842255).
 *
 * Ce qu'elle garantit désormais, et ce qu'elle ne garantit pas :
 *  - FAQ_GLOBAL (FR ET EN, réponses, points clés, nuances) : AUCUNE occurrence
 *    de « ordinateur portable » ni de « laptop », quelle que soit la phrase.
 *    Il n'en reste aucune légitime ; une future mention exigera de retoucher
 *    cette garde, et c'est voulu.
 *  - Fiches formation, texte AFFICHÉ (page et JSON-LD) : champs de l'objet ET
 *    sortie de CHAQUE export de `catalog-v2-facts.ts` appliqué à la fiche —
 *    défauts (matériel, prérequis, effectif, outils, méthodes…) et libellés
 *    `format*` réellement rendus (modalités, durée). Même interdiction,
 *    « PC portable », espace insécable et saut de ligne compris. Un export
 *    nouveau non classé fait échouer la garde. Exclus, avec leur motif : le
 *    matériel des deux exceptions confirmées, et les textes alternatifs et
 *    légendes de photos. Pannes fermées : R10 (`prerequisFr`), D1 (défaut du
 *    matériel absent de l'objet), S1/N1 (libellé `formatModalitesFr`), N2
 *    (prérequis par défaut écrit en dur dans la page, désormais
 *    `FORMATION_PREREQUIS_DEFAUT`).
 *  - Les entrées qui parlent du matériel (`presentiel-distance`,
 *    `competences-techniques`) doivent CONTENIR la phrase et nommer les
 *    exceptions : si la phrase disparaît, le test échoue au lieu de passer à vide.
 *  - Décision de Will du 2026-09-19 : À DISTANCE, un ordinateur avec caméra et
 *    micro (le smartphone ne suffit pas pour la visio). Ces deux entrées doivent
 *    le dire dans leur réponse, FR et EN ; et plus aucune entrée ne peut
 *    affirmer que le matériel est « le même » sur place et à distance — la
 *    phrase que la FAQ publiait jusque-là, pendant que la convocation exigeait
 *    déjà l'ordinateur.
 *  - Même décision, sur les FICHES formation : `getFormationMateriel` scinde le
 *    texte par format dès que la fiche se suit à distance (« En présentiel, … ;
 *    en distanciel, un ordinateur avec caméra et micro, … Zoom, depuis le
 *    navigateur… ») — carte « Matériel », FAQ de la fiche et JSON-LD. La page
 *    ne doit rien écrire du matériel en dur.
 *  - Balayage des fichiers publics : toute ligne qui annonce « smartphone ou
 *    (un) ordinateur » doit parler du distanciel SUR LA MÊME LIGNE (pages,
 *    messages, FAQ). Seule exception : le fichier `materiel.ts`, dont
 *    `getFormationMateriel` complète les constantes. La convocation distanciel
 *    IMPORTE les éléments de `MATERIEL_DISTANCIEL` : elle exige ce que les
 *    fiches annoncent par construction.
 *  - Seconde décision de Will du 2026-09-19 : la visio se fait sur Zoom (l'outil
 *    de l'organisme), depuis le navigateur de l'ordinateur. Il n'y a donc RIEN
 *    À INSTALLER, ni sur place ni à distance. Règle unique
 *    (`fautesInstallation`, `regle-installation.ts`), appliquée à
 *    la FAQ, aux fiches (texte affiché et JSON-LD) et à la page
 *    `/formations/entreprise`, FR et EN, PROPOSITION par proposition — pas
 *    ligne par ligne de source, qu'une phrase repliée déjouait :
 *      · toute proposition qui contient « install » porte une NÉGATION (rien,
 *        aucun, sans, pas, ni, no, nothing, without…). « Il faut installer
 *        Zoom », « Installez l'application Teams », « You need to install
 *        Zoom » rougissent, quelle que soit la tournure ;
 *      · et, si elle est bornée au présentiel (« sur place »), elle couvre
 *        aussi le distanciel — sinon elle laisse entendre qu'à distance il
 *        faut installer quelque chose.
 *    Seules exceptions : les sens FIGURÉS ou hors session (« installer une
 *    pratique commune », « modèles installés sur vos serveurs »), listés
 *    nommément dans `FIGURES` ; une entrée qui ne sert plus rougit.
 *    🔴 La version précédente listait les tournures FAUTIVES
 *    (`INSTALLATION_EXIGEE`) : « il faut installer l'application Zoom »
 *    passait en exit 0 (revue simplicité 5256426101).
 *  - ⚠️ LIMITE DÉCLARÉE du balayage des fichiers (src/content, src/app,
 *    src/components, src/messages) : il ne repère que la formulation
 *    « ordinateur portable » JOINTE à « connexion internet » (avec ou sans
 *    « avec », « et », « d' », tiret). Une mention isolée hors FAQ n'y est pas
 *    détectée : elle serait indiscernable des descriptions de photos
 *    (« une main au-dessus d'un ordinateur portable »), nombreuses et légitimes.
 *
 * Elle ne lit pas la base : elle vérifie que le contenu public dit la même
 * chose qu'elle.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as FAITS from "@/content/formations/catalog-v2-facts";
import { getFormationMateriel, getFormationModalites } from "@/content/formations/catalog-v2-facts";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { MATERIEL_DISTANCIEL } from "@/content/formations/materiel";
import { FAQ_GLOBAL } from "@/content/transversal";

import { FIGURES, fautesInstallation, propositions } from "./regle-installation";

/** Fiches où le smartphone serait une promesse fausse — confirmées par Will le 2026-09-18. */
const EXCEPTIONS_ORDINATEUR = new Set(["ia-pour-l-it", "ia-pour-l-automatisation"]);

/** Exercices sur tableur : smartphone ou ordinateur, ordinateur recommandé (Will, 2026-09-18). */
const FORMATIONS_TABLEUR = new Set([
  "ia-pour-la-finance",
  "ia-pour-les-achats",
  "ia-pour-le-commerce",
  "ia-pour-les-equipes",
]);

/**
 * Un ordinateur portable présenté comme MATÉRIEL REQUIS : il est suivi (ou
 * précédé) de la connexion internet. Les descriptions de photos (« une main
 * au-dessus d'un ordinateur portable ») ne le sont pas, et ne sont pas visées.
 */
const LIEN = String.raw`\s*(?:[,;—–-]\s*)?(?:et|avec)?\s*(?:d'|de\s+)?(?:une?\s+)?`;
const ORDINATEUR_COMME_MATERIEL = new RegExp(
  String.raw`ordinateur portable${LIEN}connexion internet|connexion internet${LIEN}ordinateur portable`,
  "i",
);

/**
 * Aucune occurrence n'est tolérée, dans aucune langue : « ordinateur portable »,
 * « PC portable », « laptop » — espace ordinaire ou insécable.
 */
const ORDINATEUR_PORTABLE_OU_LAPTOP = /(?:ordinateurs?|pc)[\s\u00a0\u202f]+portables?|laptops?/i;

/**
 * Ce que la fiche AFFICHE (page et JSON-LD), dérivé MÉCANIQUEMENT de tout le
 * module `catalog-v2-facts.ts`, et non d'une liste tapée à la main.
 *
 * Historique de l'escalade, pour ne pas la rejouer : l'objet seul ne voyait pas
 * les défauts (panne D1, revue sécurité 5252455088) ; une liste de `get*` tapée
 * à la main ne voyait pas les libellés `format*` réellement rendus (panne S1,
 * revue simplicité 5253007780 : « Présentiel — ordinateur portable obligatoire »
 * dans `formatModalitesFr` restait vert).
 *
 * Règle : chaque export du module est classé ci-dessous, et un test échoue si
 * un export nouveau n'entre dans aucune classe.
 *  - fonction d'arité 1 → appelée sur la fiche ;
 *  - `format*` dont l'argument est la SORTIE d'un `get*` → appelée sur cette
 *    sortie (table `FORMATEURS_SUR_SORTIE`) ;
 *  - constante → sérialisée telle quelle ;
 *  - exclus, avec leur motif (`EXCLUS`).
 */
const FORMATEURS_SUR_SORTIE: Record<string, string> = {
  formatModalitesFr: "getFormationModalites",
};

/** Exports exclus, et pourquoi. Tout ajout ici doit se justifier. */
const EXCLUS: Record<string, string> = {
  // ⚠️ Ces textes servent AUSSI de légende (`caption`) dans le JSON-LD de la
  // fiche. Ils restent exclus parce qu'au 2026-09-19 deux d'entre eux décrivent
  // une photo où figure un laptop (IA pour les équipes, IA pour le marketing) :
  // ce n'est pas une exigence de matériel. `imageAltFr` propre à une fiche, lui,
  // reste contrôlé (aucune valeur actuelle ne parle de laptop).
  getFormationImage: "texte alternatif et légende de photo (« people around a laptop »)",
  getFormationImageCredit: "nom et lien du photographe",
  getFormationScenePhotos: "textes alternatifs de photos",
  FORMATION_GAMME_IMAGE: "textes alternatifs de photos",
};

type Fonction = (x: unknown) => unknown;

function classer(nom: string, valeur: unknown): "fiche" | "sortie" | "constante" | "exclu" | null {
  if (nom in EXCLUS) return "exclu";
  if (nom in FORMATEURS_SUR_SORTIE) return "sortie";
  if (typeof valeur === "function") return (valeur as Fonction).length === 1 ? "fiche" : null;
  return "constante";
}

/** Espaces et sauts de ligne normalisés : « ordinateur⏎portable » est cherché comme tel. */
function normaliser(texte: string): string {
  // `\\[nrt]` : les sauts de ligne tels que JSON.stringify les \u00e9crit (barre
  // oblique inverse suivie d'une lettre), pas des caract\u00e8res de contr\u00f4le.
  return texte.replace(/\\[nrt]/g, " ").replace(/[\s\u00a0\u202f]+/g, " ");
}

function morceauxAffiches(f: (typeof FORMATIONS_V2)[number]): unknown[] {
  const exception = EXCEPTIONS_ORDINATEUR.has(f.id);
  const morceaux: unknown[] = [{ ...f, materielFr: undefined }];
  for (const [nom, valeur] of Object.entries(FAITS)) {
    const classe = classer(nom, valeur);
    if (classe === "exclu" || classe === null) continue;
    if (classe === "constante") {
      // Les constantes de matériel sont lues via la fiche : pour une exception,
      // son texte propre remplace le défaut, qui n'est alors pas affiché.
      morceaux.push(valeur);
    } else if (classe === "fiche") {
      if (exception && nom === "getFormationMateriel") continue;
      morceaux.push((valeur as Fonction)(f));
    } else {
      const source = (FAITS as Record<string, unknown>)[FORMATEURS_SUR_SORTIE[nom]!] as Fonction;
      morceaux.push((valeur as Fonction)(source(f)));
    }
  }
  return morceaux;
}

function texteAffiche(f: (typeof FORMATIONS_V2)[number]): string {
  return normaliser(JSON.stringify(morceauxAffiches(f)));
}

/** Une fiche qui peut se suivre à distance. */
function aDuDistanciel(f: (typeof FORMATIONS_V2)[number]): boolean {
  const m = getFormationModalites(f);
  return m.includes("distanciel") || m.includes("hybride");
}

const CLAUSE_DISTANCIEL =
  /en distanciel, un ordinateur avec caméra et micro, une connexion internet stable, Zoom, depuis le navigateur \(rien à installer\), testé avant la session, accès aux outils IA/;

/** Toutes les chaînes d'un objet (réponse, points clés, nuances…), en phrases. */
function phrases(valeur: unknown): string[] {
  if (typeof valeur === "string") return valeur.split(/(?<=[.!?])\s+|\n+/);
  if (Array.isArray(valeur)) return valeur.flatMap(phrases);
  if (valeur && typeof valeur === "object") return Object.values(valeur).flatMap(phrases);
  return [];
}

/** Source d'une page, commentaires retirés : les phrases repliées se recollent. */
function sourceSansCommentaires(fichier: string): string {
  return readFileSync(path.join(RACINE, fichier), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** Pages qui énoncent le matériel en prose propre, hors FAQ et fiches. */
const PAGES_MATERIEL = ["src/app/[locale]/formations/entreprise/page.tsx"] as const;

/** Tout le périmètre de la règle, étiqueté pour le message d'échec. */
function perimetreInstallation(): Array<{ ou: string; textes: string[] }> {
  return [
    ...FAQ_GLOBAL.flatMap((e) =>
      (["fr", "en"] as const).map((langue) => ({
        ou: `FAQ ${e.id}:${langue}`,
        textes: phrases(e[langue]),
      })),
    ),
    ...FORMATIONS_V2.map((f) => ({
      ou: `fiche ${f.id}`,
      textes: phrases([morceauxAffiches(f), getFormationMateriel(f), f.materielFr ?? ""]),
    })),
    ...PAGES_MATERIEL.map((fichier) => ({
      ou: fichier,
      textes: [sourceSansCommentaires(fichier)],
    })),
  ];
}

/**
 * Toute phrase qui dit que le matériel est le même sur place et à distance —
 * celle que la décision du 2026-09-19 a rendue fausse, et ses variantes
 * (revue exactitude 5254909256 : « l'équipement demandé est identique »
 * passait).
 */
const MEME_MATERIEL = new RegExp(
  [
    String.raw`(?:mat[ée]riel|[ée]quipement)s?\s+(?:demand[ée]s?\s+|requis\s+|n[ée]cessaires?\s+)?(?:est|sont|reste|restent)\s+(?:le m[êe]me|les m[êe]mes|identiques?)`,
    String.raw`(?:le|les|un|du) m[êe]mes?\s+(?:mat[ée]riel|[ée]quipement)s?`,
    String.raw`(?:mat[ée]riel|[ée]quipement)s?\s+identiques?`,
    String.raw`same (?:equipment|hardware|devices?)`,
    String.raw`(?:equipment|hardware) (?:is|are|remains?) (?:the same|identical)`,
    String.raw`identical (?:equipment|hardware)`,
    String.raw`in both cases,? participants need`,
  ].join("|"),
  "i",
);

/** « smartphone ou (un) ordinateur », en FR ou en EN. */
const SMARTPHONE_OU_ORDINATEUR = /smartphone (?:ou (?:un )?ordinateur|or (?:a )?computer)/i;
const PARLE_DU_DISTANCIEL = /distance|distanciel|remote|visio/i;

/** Entrées de la FAQ qui énoncent le matériel, en FR et en EN. */
const FAQ_MATERIEL = ["presentiel-distance", "competences-techniques"] as const;

const RACINE = path.resolve(__dirname, "../../..");

/** Lignes des fichiers publics, lues une fois pour les deux balayages. */
type LignePublique = { fichier: string; ligne: string; n: number };
let lignesPubliques: LignePublique[] | null = null;
function toutesLesLignesPubliques(): LignePublique[] {
  if (lignesPubliques) return lignesPubliques;
  const racines = ["src/content", "src/app", "src/components", "src/messages"]
    .map((r) => path.join(RACINE, r))
    .filter((r) => existsSync(r));
  expect(racines.length).toBeGreaterThanOrEqual(3);
  lignesPubliques = racines.flatMap(fichiers).flatMap((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .map((ligne, i) => ({
        fichier: path.relative(RACINE, f).replace(/\\/g, "/"),
        ligne,
        n: i + 1,
      })),
  );
  return lignesPubliques;
}

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      out.push(...fichiers(p));
    } else if (/\.(ts|tsx|json)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      out.push(p);
    }
  }
  return out;
}

describe("le matériel annoncé est le même partout", () => {
  const formations = FORMATIONS_V2.filter((f) => !f.seminaire);

  it("porte sur les 21 formations hors séminaire", () => {
    expect(formations.length).toBe(21);
  });

  it.each(
    formations.filter((f) => !EXCEPTIONS_ORDINATEUR.has(f.id)).map((f) => [f.id, f] as const),
  )("%s annonce « smartphone ou ordinateur » en présentiel", (_id, f) => {
    const materiel = getFormationMateriel(f);
    expect(materiel).toMatch(/^en présentiel, smartphone ou ordinateur/i);
    expect(materiel).not.toMatch(ORDINATEUR_COMME_MATERIEL);
  });

  it.each(formations.map((f) => [f.id, f] as const))(
    "%s exige l'ordinateur avec caméra et micro en distanciel",
    (_id, f) => {
      // Toutes les fiches hors séminaire se suivent à distance : sinon ce test
      // passerait à vide sur une fiche passée en présentiel seul.
      expect(aDuDistanciel(f)).toBe(true);
      expect(getFormationMateriel(f)).toMatch(CLAUSE_DISTANCIEL);
    },
  );

  it("une fiche en présentiel seul n'annonce pas de distanciel", () => {
    const presentielSeul = FORMATIONS_V2.filter((f) => !aDuDistanciel(f));
    expect(presentielSeul.length).toBeGreaterThan(0);
    for (const f of presentielSeul) expect(getFormationMateriel(f)).not.toMatch(/distanciel/i);
  });

  it("la fiche formation n'écrit pas le matériel en dur : elle lit getFormationMateriel", () => {
    const page = readFileSync(
      path.join(RACINE, "src/components/formations/FormationDetailPage.tsx"),
      "utf8",
    );
    expect(page).toContain("getFormationMateriel(f)");
    expect(page).not.toMatch(/smartphone/i);
  });

  it("MATERIEL_DISTANCIEL dit Zoom dans le navigateur, sans rien à installer", () => {
    // La convocation distanciel IMPORTE ces éléments (`materiel.ts`) : la
    // « même exigence » tient par construction ; la garde du dispositif
    // d'assistance lit la convocation rendue.
    expect(MATERIEL_DISTANCIEL).toContain("Zoom, depuis le navigateur");
    expect(MATERIEL_DISTANCIEL).toContain("rien à installer");
    expect(fautesInstallation([MATERIEL_DISTANCIEL])).toEqual([]);
  });

  it.each([...FORMATIONS_TABLEUR])("%s recommande l'ordinateur pour le tableur", (id) => {
    const f = formations.find((x) => x.id === id);
    expect(f, id).toBeDefined();
    expect(getFormationMateriel(f!)).toMatch(
      /^en présentiel, smartphone ou ordinateur.*un ordinateur est recommandé pour les exercices sur tableur.*en distanciel, un ordinateur avec caméra et micro/i,
    );
  });

  it("chaque export de catalog-v2-facts.ts est couvert par texteAffiche, ou exclu avec un motif", () => {
    const nonClasses = Object.entries(FAITS)
      .filter(([nom, valeur]) => classer(nom, valeur) === null)
      .map(([nom]) => nom);
    expect(nonClasses).toEqual([]);
    for (const [nom, source] of Object.entries(FORMATEURS_SUR_SORTIE)) {
      expect(typeof (FAITS as Record<string, unknown>)[nom], nom).toBe("function");
      expect(typeof (FAITS as Record<string, unknown>)[source], source).toBe("function");
    }
    for (const nom of Object.keys(EXCLUS)) expect(nom in FAITS, nom).toBe(true);
  });

  it.each(FORMATIONS_V2.map((f) => [f.id, f] as const))(
    "%s n'affiche ni ordinateur portable ni laptop, défauts centralisés compris",
    (_id, f) => {
      expect(texteAffiche(f)).not.toMatch(ORDINATEUR_PORTABLE_OU_LAPTOP);
    },
  );

  it("les exceptions existent et restent sur ordinateur", () => {
    for (const id of EXCEPTIONS_ORDINATEUR) {
      const f = formations.find((x) => x.id === id);
      expect(f, id).toBeDefined();
      expect(getFormationMateriel(f!)).toMatch(/^en présentiel, ordinateur portable/i);
    }
  });

  it.each(formations.map((f) => [f.id, f] as const))(
    "%s exige à distance ce qu'elle exige sur place au-delà du poste",
    (_id, f) => {
      // Revue exactitude 5255141619 : pour IA pour l'IT et IA pour
      // l'automatisation, l'environnement de développement et les données
      // disparaissaient de la clause distanciel.
      const [presentiel, distanciel] = getFormationMateriel(f).split(" ; en distanciel, ");
      const i = presentiel!.indexOf("accès aux outils IA");
      expect(i, "la partie présentiel ne dit plus « accès aux outils IA »").toBeGreaterThan(-1);
      expect(distanciel).toContain(presentiel!.slice(i));
    },
  );

  it("à distance, l'IT garde son environnement de développement et l'automatisation ses données", () => {
    const distanciel = (id: string) =>
      getFormationMateriel(formations.find((x) => x.id === id)!).split(" ; en distanciel, ")[1];
    expect(distanciel("ia-pour-l-it")).toContain("environnement de développement habituel");
    expect(distanciel("ia-pour-l-automatisation")).toContain("données concernées");
  });

  it("aucune entrée de la FAQ, en FR comme en EN, ne mentionne l'ordinateur portable ni le laptop", () => {
    const fautives = FAQ_GLOBAL.flatMap((e) =>
      (["fr", "en"] as const)
        .filter((langue) =>
          ORDINATEUR_PORTABLE_OU_LAPTOP.test(normaliser(JSON.stringify(e[langue]))),
        )
        .map((langue) => `${e.id}:${langue}`),
    );
    expect(fautives).toEqual([]);
  });

  it.each([...FAQ_MATERIEL])(
    "%s énonce le matériel en FR et en EN, avec les exceptions et le tableur",
    (id) => {
      const e = FAQ_GLOBAL.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      const fr = JSON.stringify(e!.fr);
      const en = JSON.stringify(e!.en);
      // Pas de passage à vide : la phrase doit être là.
      expect(fr).toMatch(/smartphone ou un ordinateur/i);
      expect(fr).toMatch(/IA pour l'IT et IA pour l'automatisation/);
      expect(fr).toMatch(/tableur/);
      expect(en).toMatch(/smartphone or a computer/i);
      expect(en).toMatch(/AI for IT and AI for automation/);
      expect(en).toMatch(/spreadsheet/);
      // Décision de Will du 2026-09-19 : à distance, le smartphone ne suffit
      // pas — un ordinateur avec caméra et micro, comme le dit la convocation ;
      // et la visio se fait sur Zoom, dans le navigateur, sans rien
      // installer. Cherché dans la RÉPONSE elle-même (celle du JSON-LD), pas
      // dans tout l'objet : un point clé seul la laisserait muette sans que
      // rien rougisse.
      expect(e!.fr.answer).toMatch(/à distance[^.]*un ordinateur avec caméra et micro/i);
      expect(e!.fr.answer).toMatch(/Zoom[^.]*navigateur[^.]*sans rien installer/);
      expect(e!.en.answer).toMatch(/remote[^.]*a computer with a camera and a microphone/i);
      expect(e!.en.answer).toMatch(/Zoom[^.]*browser[^.]*nothing to install/);
    },
  );

  it("presentiel-distance dit l'assistance à distance, en FR et en EN", () => {
    // Dispositif d'assistance (D.6313-3-1), décision de Will du 2026-09-19 :
    // le formateur pendant la session, contact@axion-ia.com sous 1 jour ouvré
    // en dehors. Même dispositif, en entier, sur la convocation et le livret.
    const e = FAQ_GLOBAL.find((x) => x.id === "presentiel-distance")!;
    expect(e.fr.answer).toMatch(/Pendant la session, le formateur répond dans la conversation/);
    expect(e.fr.answer).toMatch(/en dehors, contact@axion-ia\.com répond sous 1 jour ouvré/);
    expect(e.en.answer).toMatch(
      /During the session, the trainer answers in the videoconference chat/,
    );
    expect(e.en.answer).toMatch(/outside it, contact@axion-ia\.com replies within 1 business day/);
  });

  it("aucun texte public du périmètre ne parle d'installer sans le nier, ni sur place seulement", () => {
    const fautives = perimetreInstallation().flatMap(({ ou, textes }) =>
      fautesInstallation(textes).map((p) => `${ou} — ${p.slice(0, 100)}`),
    );
    expect(fautives).toEqual([]);
  });

  it("chaque figure déclarée sert encore (sinon, la retirer)", () => {
    const tout = perimetreInstallation()
      .flatMap(({ textes }) => textes.flatMap(propositions))
      .join(" \u0000 ")
      .toLowerCase();
    const perimees = FIGURES.filter((f) => !tout.includes(f.toLowerCase()));
    expect(perimees).toEqual([]);
  });

  it.each([
    // Revue simplicité 5256426101 : les cinq passaient en exit 0.
    "À distance, il faut installer l'application Zoom avant la session.",
    "You need to install Zoom before the session.",
    "Installez l'application Teams avant la session.",
    "Pensez à installer Zoom.",
    "Please install the Teams app beforehand.",
    // Revue exactitude 5256482948.
    "Installez l'application de visioconférence sur votre ordinateur avant la session.",
    "Installez l'application Zoom sur votre ordinateur avant la session.",
    "Il faut installer Zoom.",
    "Install Zoom before the session.",
    "Vous devrez installer le logiciel de visio.",
    // Anciennes phrases publiées.
    "L'application de visioconférence installée et testée avant la session.",
    "à distance, seule l'application de visioconférence est à installer",
    "the videoconferencing app installed and tested before the session",
    // Négation bornée au présentiel.
    "Sur place, rien à installer : un smartphone suffit.",
    "Aucune compétence technique requise, aucune installation sur place",
    "Sur place, aucun logiciel à installer.",
    "On site, nothing to install.",
    // Une figure ne couvre pas une consigne voisine.
    "Installez Zoom et installez une pratique commune.",
    // 🔴 2026-09-20 — ces six tournures PASSAIENT. Relevées par les lentilles
    // exactitude et simplicité sur la tête `da583bd94`, elles n'étaient
    // épinglées par aucun test : retirer la réparation laissait la suite verte,
    // et le rouge n'existait qu'à la main. Une réparation que rien ne retient
    // se défait au premier refactor, sans bruit.
    //
    // Un figuré emprunté pour viser l'outil.
    "Suivez la procédure d'installation de Zoom avant la session.",
    "Il faut évaluer, installer et tester Zoom avant la session.",
    "Le distanciel suppose des usages à installer sur votre poste, à savoir Zoom.",
    // Une négation qui porte sur autre chose que l'installation.
    "N'oubliez pas d'installer Zoom avant la session.",
    "Pas besoin d'être technicien, installez l'application Zoom.",
    "Don't forget to install Zoom before the session.",
    // Une clause d'exception reprend ce que la négation donnait.
    "Rien à installer, sauf l'application Zoom.",
    "Aucune installation n'est requise, sauf Zoom qu'il faut installer.",
  ])("fautesInstallation refuse « %s »", (ph) => {
    expect(fautesInstallation([ph])).not.toEqual([]);
  });

  it.each([
    "Rien à installer, ni sur place ni à distance.",
    "Aucune installation n'est requise, ni sur place ni à distance (Zoom s'ouvre dans le navigateur).",
    "Rien à installer : sur place, un smartphone suffit ; à distance, Zoom dans le navigateur.",
    "Aucun logiciel à installer.",
    "Sans rien installer.",
    "Nothing to install, on site or remotely.",
    "Zoom, depuis le navigateur (rien à installer), testé avant la session.",
    // 🔑 CONTRE-ÉPREUVE des lignes ci-dessus : la règle ne doit pas rougir dès
    // qu'une phrase nomme l'outil. Ces deux-là ont VIRÉ AU ROUGE le 2026-09-20
    // dans une première version de la réparation — un échec FERMÉ, qui aurait
    // rendu `FIGURES` inopérante le jour où elle sert, sans laisser de trace.
    "Avec Zoom, l'autonomie s'installe en trois séances.",
    "Sur Zoom, les usages installés tiennent après la formation.",
    "Des modèles open-source installés sur vos propres serveurs, sans transfert hors UE.",
  ])("fautesInstallation laisse passer « %s »", (ph) => {
    expect(fautesInstallation([ph])).toEqual([]);
  });

  it("aucune entrée de la FAQ ne dit que le matériel est le même sur place et à distance", () => {
    const fautives = FAQ_GLOBAL.flatMap((e) =>
      (["fr", "en"] as const)
        .filter((langue) => MEME_MATERIEL.test(normaliser(JSON.stringify(e[langue]))))
        .map((langue) => `${e.id}:${langue}`),
    );
    expect(fautives).toEqual([]);
  });

  it.each([
    "Dans les deux cas, le matériel demandé est le même.",
    "L'équipement demandé est identique sur place et à distance.",
    "Le même équipement suffit dans les deux formats.",
    "Un matériel identique dans les deux cas.",
    "Les équipements requis restent les mêmes.",
    "The same equipment is needed in both formats.",
    "Equipment is identical on site and remotely.",
    "In both cases, participants need a smartphone.",
  ])("MEME_MATERIEL reconnaît « %s »", (phrase) => {
    expect(phrase).toMatch(MEME_MATERIEL);
  });

  it.each([
    "Les deux, au choix, et avec le même programme.",
    "Même contenu et même niveau d'interactivité.",
    "The same programme and the same duration.",
  ])("MEME_MATERIEL laisse passer « %s »", (phrase) => {
    expect(phrase).not.toMatch(MEME_MATERIEL);
  });

  it("toute ligne publique qui annonce « smartphone ou ordinateur » parle aussi du distanciel", () => {
    // Admis : TOUT le fichier `materiel.ts` — ses constantes sont complétées
    // par getFormationMateriel, vérifié plus haut fiche par fiche. Ignorées :
    // les lignes qui COMMENCENT par `//`, `*` ou `/*` (commentaires, non
    // publiés) ; un commentaire en fin de ligne de code ne l'est pas.
    const fautives = toutesLesLignesPubliques()
      .filter(
        ({ ligne }) =>
          !/^\s*(?:\/\/|\/?\*)/.test(ligne) &&
          SMARTPHONE_OU_ORDINATEUR.test(ligne) &&
          !PARLE_DU_DISTANCIEL.test(ligne),
      )
      .map(({ fichier, n }) => `${fichier}:${n}`)
      .filter((t) => !t.startsWith("src/content/formations/materiel.ts:"));
    expect(fautives).toEqual([]);
  });

  it("aucun fichier de contenu public n'exige l'ordinateur portable hors des deux exceptions", () => {
    const trouvailles = toutesLesLignesPubliques()
      .filter(({ ligne }) => ORDINATEUR_COMME_MATERIEL.test(ligne))
      .map(({ fichier, n }) => `${fichier}:${n}`);
    // Les deux seules lignes admises : les surcharges `materielFr` des exceptions.
    const admises = trouvailles.filter((t) =>
      t.startsWith("src/content/formations/catalog-v2.ts:"),
    );
    expect(trouvailles.filter((t) => !admises.includes(t))).toEqual([]);
    expect(admises).toHaveLength(EXCEPTIONS_ORDINATEUR.size);
  });
});
