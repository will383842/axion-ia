/**
 * Garde-fou CI — « qui AFFIRME la certification doit être gardé ».
 *
 * Contexte (audit F13, PR #401, 2026-07-25) — deux notions ont été DÉCOUPLÉES
 * parce qu'on les avait confondues en production :
 *
 *   isQualiopiPublicDisclosureEnabled()  → les pages OF sont VISIBLES
 *   isQualiopiCertificationObtenue()     → on a le droit d'AFFIRMER la certification
 *
 * Avant le découplage, `OF_PUBLIC_DISCLOSURE_ENABLED=true` était posé en prod
 * alors que la certification n'était PAS obtenue. Le site affirmait donc
 * publiquement, dans la formulation officielle réservée aux organismes
 * certifiés, que « la certification qualité a été délivrée ». L'en-tête de
 * `flag.ts` qualifie cette situation d'ILLÉGALE.
 *
 * ── Pourquoi ce test, et pas seulement le découplage ────────────────────────
 * Les DEUX fonctions existent toujours et sont TOUTES DEUX légitimes : la
 * première gate la visibilité des pages, la seconde gate l'affirmation. Une
 * surface d'affirmation qui repasserait à `isQualiopiPublicDisclosureEnabled()`
 * — par une résolution de conflit de merge, un copier-coller, ou une branche
 * ancienne rebasée sans attention — **compilerait sans erreur et passerait tous
 * les tests existants**. La régression serait totalement silencieuse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 RÉPARATION 2026-08-19 — la garde ne gardait presque rien
 * ─────────────────────────────────────────────────────────────────────────────
 * Mesuré en production le 2026-08-19, alors que la certification n'est TOUJOURS
 * pas obtenue (6 non-conformités majeures au 2026-08-15) : quatre surfaces
 * affirmaient la certification SANS AUCUNE CONDITION, et ce fichier ne les
 * voyait pas. Éteindre `QUALIOPI_CERTIFICATION_OBTENUE` n'y aurait rien changé.
 *
 * Deux défauts, tous deux corrigés ici :
 *
 *   (a) La liste `ASSERTION_SURFACES` est un REGISTRE TENU À LA MAIN. Elle ne
 *       peut, par construction, contenir que les surfaces dont quelqu'un s'est
 *       souvenu. Les quatre fuites (memo-isere, badge d'article, sitemap
 *       images, gabarit d'e-mail) n'y étaient pas — donc invisibles.
 *
 *   (b) La vérification se réduisait à `content.includes(ASSERTION_FLAG)` : une
 *       simple présence TEXTUELLE. Elle serait restée verte sur un import
 *       jamais appelé, un appel mis en commentaire, ou une mention du nom du
 *       drapeau dans une phrase de commentaire. Elle vérifiait l'existence
 *       d'une clé, pas son sens.
 *
 * D'où les trois blocs ci-dessous :
 *
 *   1. les surfaces du registre existent encore (inchangé) ;
 *   2. chaque surface du registre APPELLE réellement le drapeau — commentaires
 *      dépouillés, et parenthèse d'appel exigée ;
 *   3. 🔴 LE TEST INVERSE, celui qui aurait attrapé les quatre fuites : on
 *      balaie `src/**` à la recherche des FORMULATIONS ASSERTIVES, et tout
 *      fichier porteur doit être soit au registre, soit dans une liste
 *      d'exemptions justifiée entrée par entrée.
 *
 * ── Faire évoluer les listes ───────────────────────────────────────────────
 * Ajouter une surface qui affirme la certification → l'ajouter au registre.
 * Retirer une surface → la retirer, avec la raison en commentaire.
 * Ne jamais vider une liste pour faire passer un merge : une exemption est une
 * dérogation à une règle que le dépôt qualifie lui-même d'ILLÉGALE à enfreindre.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(process.cwd(), "src");

const ASSERTION_FLAG = "isQualiopiCertificationObtenue";

/**
 * 🔴 Les commentaires sont DÉPOUILLÉS avant toute recherche.
 *
 * Piège déjà payé par le dépôt : un test statique qui lit les commentaires
 * trouve **sa propre citation** et reste vert alors que la garde est désarmée.
 * Ce fichier-ci cite abondamment « certifié Qualiopi » et le nom du drapeau —
 * sans dépouillement, il s'exonérerait lui-même et accuserait des fichiers dont
 * la seule mention est un commentaire d'explication.
 *
 * Même implémentation que `lib/content-disposition.spec.ts` et
 * `app/[locale]/__tests__/canonical-heritage.spec.ts`.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = path.join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "node_modules") continue;
      fichiersSource(chemin, acc);
      continue;
    }
    if (/\.tsx?$/.test(entree)) acc.push(chemin);
  }
  return acc;
}

const relSrc = (abs: string): string => path.relative(SRC, abs).replace(/\\/g, "/");

/**
 * Surfaces publiques qui AFFIRMENT la certification Qualiopi.
 * Chemins relatifs à `src/`, séparateur `/`.
 */
const ASSERTION_SURFACES: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: "components/nav/Footer.tsx",
    why: "mention « organisme de formation certifié Qualiopi » rendue sur ~17 600 routes",
  },
  {
    file: "app/[locale]/page.tsx",
    // Ajoutée 2026-07-28 : la home avait été OUBLIÉE lors du découplage #401.
    // Elle gatait « certifié Qualiopi » sur isQualiopiPublicDisclosureEnabled(),
    // alors que /formations avait bien été migrée. Latent et non détecté : les
    // deux flags sont à false en prod, donc aucune fuite observable — la
    // régression ne serait apparue qu'au passage en Phase B.
    why: "claim « certifié Qualiopi » dans la description SERP de la page d'accueil",
  },
  {
    file: "app/[locale]/a-propos/page.tsx",
    why: "bloc de réassurance OF sur la page institutionnelle",
  },
  {
    file: "app/[locale]/avis/page.tsx",
    why: "mention de certification dans le hub avis (E-E-A-T)",
  },
  {
    file: "app/[locale]/formations/page.tsx",
    why: "suffixe SERP + hero du hub formations",
  },
  {
    file: "app/[locale]/formations/entreprise/page.tsx",
    why: "argument de financement OPCO conditionné à la certification",
  },
  {
    // Ajoutée 2026-08-23 avec la page SEO de l'annonce jemepropose.com. Le
    // littéral y est déclaré DANS la page, à côté de l'appel au drapeau — pas
    // dans un fichier de contenu qui n'en importe aucun.
    file: "app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx",
    why: "bande de réassurance + argument OPCO de la page apporteur d'affaires",
  },
  {
    // Ajoutée 2026-08-23 avec la landing de réception d'annonce Le Bon Coin.
    // Le littéral y est déclaré DANS la page, à quelques lignes de l'appel au
    // drapeau — pas dans son fichier de contenu, qui n'en importe aucun.
    // C'est la leçon directe de la ligne « bande de réassurance de l'annonce
    // de recrutement » ci-dessous : une garde qui vit dans un autre fichier
    // n'est pas une garde, c'est une intention.
    file: "components/recrutement/PartenaireLandingPage.tsx",
    why: "bande de réassurance + argument OPCO du gabarit des landings d’annonce (`/leboncoin`, `/indeed`)",
  },
  {
    file: "app/[locale]/formations/tarifs/page.tsx",
    why: "suffixe « certifié Qualiopi » sur les prix",
  },
  {
    file: "app/[locale]/formations/[slug]/page.tsx",
    why: "suffixe SERP des fiches formation",
  },
  {
    file: "components/formations/FormationDetailPage.tsx",
    why: "bandeau OF des fiches formation",
  },
  {
    file: "app/[locale]/certification-qualiopi/page.tsx",
    why: "la page dédiée — notFound() tant que la certification n'est pas obtenue",
  },
  {
    file: "app/[locale]/financement-opco-france-travail/page.tsx",
    why: "le financement OPCO découle de la certification",
  },
  {
    file: "server/qualiopi/config/public-identity.ts",
    why: "identité publique OF exposée en JSON-LD et PDF",
  },
  {
    file: "server/qualiopi/config/financing.ts",
    why: "libellés de financement conditionnés à la certification",
  },
  {
    file: "app/sitemap.ts",
    why: "les URLs OF ne sont émises que si la certification est réelle",
  },
  // ── Ajoutées le 2026-08-19 : les trois fuites mesurées en ligne ──────────
  {
    file: "app/[locale]/memo-isere/page.tsx",
    why: "bande de réassurance de l'annonce de recrutement — « Organisme certifié Qualiopi » était une entrée LITTÉRALE d'un tableau, dans un fichier qui n'importait aucun drapeau (3 occurrences servies en prod le 2026-08-19)",
  },
  {
    file: "components/qualiopi/QualiopiContentBadge.tsx",
    why: "badge de clôture rendu sur CHAQUE article de blog — son unique appelant (blog/[slug]/page.tsx) l'invoque sans condition, le composant devait donc se garder lui-même",
  },
  {
    file: "lib/email/templates/_layout.tsx",
    why: "lockup Qualiopi du bandeau de confiance de TOUS les e-mails — la garde `trust` est un booléen de MISE EN PAGE, pas un drapeau de certification : 6 gabarits le passent en attribut JSX nu",
  },
];

/**
 * 🔴 Fichiers qui ont le DROIT de porter une formulation assertive sans appeler
 * eux-mêmes le drapeau — chacun avec sa raison et, quand c'est vérifiable, le
 * JETON qui prouve que la garde existe vraiment quelque part.
 *
 * Une exemption sans jeton est une promesse ; une exemption avec jeton est une
 * vérification. On préfère la seconde partout où c'est possible, sinon la liste
 * se vide au premier merge pressé et la garde ne garde plus rien.
 *
 * `jeton`          : chaîne qui doit apparaître dans le CODE du fichier lui-même.
 * `gardeChez`      : la garde est portée par un AUTRE fichier (module de données
 *                    pur → c'est son consommateur qui gate). Les deux sont vérifiés.
 */
const EXEMPTIONS: ReadonlyArray<{
  chemin: string;
  raison: string;
  jeton?: string;
  gardeChez?: { fichier: string; jeton: string };
}> = [
  {
    chemin: "app/llms.txt/route.ts",
    raison:
      "Route EDGE : le helper serveur n'y est pas importable (cloisonnement + runtime). " +
      "Le bloc « Certification qualité » est bel et bien gaté, mais sur une lecture env " +
      "BRUTE — convention documentée dans le fichier, cf. audit F13.",
    jeton: "QUALIOPI_CERTIFICATION_OBTENUE",
  },
  {
    chemin: "components/formations/FormationsLesPlus.tsx",
    raison:
      "Composant purement présentationnel : sa ligne assertive porte `on: ofPublic`, " +
      "et son UNIQUE appelant (app/[locale]/formations/entreprise/page.tsx, au registre) " +
      "dérive `ofPublic` de isQualiopiCertificationObtenue().",
    jeton: "ofPublic",
  },
  {
    chemin: "components/qualiopi/QualiopiBadge.tsx",
    raison:
      "Rend `null` quand getQualiopiPublicIdentity() est nulle — cette source est elle-même " +
      "au registre et gate sur le drapeau d'affirmation.",
    jeton: "getQualiopiPublicIdentity",
  },
  {
    chemin: "components/qualiopi/QualiopiReassuranceBand.tsx",
    raison: "Même garde que QualiopiBadge : `if (!identity) return null`.",
    jeton: "getQualiopiPublicIdentity",
  },
  {
    chemin: "components/qualiopi/QualiopiFinancingFaq.tsx",
    raison: "Même garde : `if (!id) return null` sur l'identité publique.",
    jeton: "getQualiopiPublicIdentity",
  },
  {
    chemin: "components/qualiopi/certifications-section.ts",
    raison:
      "buildQualiopiCertificationsSection() ne construit la section qu'à partir d'une " +
      "identité publique non nulle.",
    jeton: "getQualiopiPublicIdentity",
  },
  {
    chemin: "server/qualiopi/documents/templates/livret-accueil.tsx",
    raison:
      "🔵 LE MODÈLE DU DÉPÔT. À défaut de numéro de certificat, bascule vers la " +
      "formulation NON ASSERTIVE « démarche qualité alignée sur le référentiel national " +
      "qualité ». Gardé par son propre test négatif " +
      "(templates/formulaires-contenu.spec.tsx, « sans certification : jamais de fausse " +
      "revendication »). La branche assertive n'existe que si `identite.qualiopi` est renseigné.",
    jeton: "identite.qualiopi",
  },
  {
    chemin: "server/qualiopi/legal/legal-mentions.ts",
    raison:
      "C'est le module qui PRODUIT la mention officielle de la marque Qualiopi — il doit " +
      "pouvoir l'écrire, exactement comme lib/content-disposition.ts écrit « attachment ». " +
      "Ses appelants sont gatés, pas lui.",
  },
  {
    chemin: "server/qualiopi/engine/prompts.ts",
    raison:
      "Personas de prompts LLM internes (« Tu es un expert […] certifié Qualiopi (RNQ 2022) ») : " +
      "instructions envoyées au modèle, JAMAIS servies à un visiteur ni à un moteur. " +
      "Décrivent le rôle attendu du rédacteur, pas le statut d'Axion-IA.",
  },
  {
    chemin: "lib/seo/page-images.ts",
    raison:
      "Manifeste de DONNÉES pur (SSOT des images de pages) : aucune logique, aucun accès env. " +
      "Ses libellés Qualiopi sont tous dans le bloc `/certification-qualiopi`, dont la page " +
      "est déjà en notFound() hors certification. La seule fuite était le sitemap images, " +
      "qui est un consommateur — c'est LUI qui gate. Les libellés sont conservés intacts : " +
      "ils redeviendront exacts le jour de la certification, et les réécrire ne changerait " +
      "rien au fait que les IMAGES elles-mêmes montrent un certificat non détenu.",
    gardeChez: {
      fichier: "app/sitemap-images-services.xml/route.ts",
      jeton: ASSERTION_FLAG,
    },
  },
];

/**
 * Les fichiers de test CITENT les formulations pour les vérifier — c'est leur
 * métier. Ils ne sont servis à personne. Règle de CATÉGORIE assumée, plutôt
 * qu'une douzaine d'entrées d'exemption qui ne se relisent plus.
 */
const estUnTest = (rel: string): boolean => /\.spec\.tsx?$/.test(rel) || rel.includes("__tests__/");

/**
 * Les formulations qui AFFIRMENT la certification. Volontairement étroites :
 * « Qualiopi » seul, « référentiel national qualité » ou « démarche qualité »
 * ne sont PAS des affirmations — la prose pédagogique du dépôt (fiches
 * formations, doctrine de financement) en est pleine et elle est légitime.
 * Ce qui est interdit, c'est de dire qu'Axion-IA EST certifié.
 */
const FORMULATIONS: ReadonlyArray<{ regex: RegExp; libelle: string }> = [
  { regex: /certifi[ée]e?s? Qualiopi/i, libelle: "« certifié Qualiopi »" },
  { regex: /Qualiopi[-\s]certified/i, libelle: "« Qualiopi-certified »" },
  { regex: /organisme certifi[ée]/i, libelle: "« organisme certifié »" },
  { regex: /qualit[ée] certifi[ée]e/i, libelle: "« qualité certifiée »" },
  {
    regex: /certification qualit[ée] a [ée]t[ée] d[ée]livr[ée]e/i,
    libelle: "« la certification qualité a été délivrée » (formule officielle)",
  },
  {
    regex: /Quality certification granted/i,
    libelle: "« Quality certification granted » (formule officielle EN)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Balayage — fait UNE fois, partagé par les tests
// ─────────────────────────────────────────────────────────────────────────────
const TOUS_LES_FICHIERS = fichiersSource(SRC);

const PORTEURS = TOUS_LES_FICHIERS.map((abs) => ({
  rel: relSrc(abs),
  code: sansCommentaires(readFileSync(abs, "utf8")),
}))
  .map((f) => ({
    ...f,
    formulations: FORMULATIONS.filter((m) => m.regex.test(f.code)).map((m) => m.libelle),
  }))
  .filter((f) => f.formulations.length > 0);

describe("Qualiopi — flag d'affirmation de la certification", () => {
  it("chaque surface d'affirmation existe encore", () => {
    const missing = ASSERTION_SURFACES.map((s) => s.file).filter(
      (f) => !existsSync(path.join(SRC, ...f.split("/"))),
    );
    expect(
      missing,
      `Fichier(s) disparu(s) — mettre à jour ASSERTION_SURFACES :\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it(`chaque surface d'affirmation APPELLE ${ASSERTION_FLAG}()`, () => {
    const violations: string[] = [];

    for (const { file, why } of ASSERTION_SURFACES) {
      const abs = path.join(SRC, ...file.split("/"));
      if (!existsSync(abs)) continue; // couvert par le test précédent
      // 🔴 Commentaires dépouillés + parenthèse d'appel exigée : la version
      // d'origine se contentait de `includes(ASSERTION_FLAG)`, donc un import
      // jamais appelé, un appel commenté ou une simple mention du nom dans une
      // phrase suffisaient à la rendre verte.
      const code = sansCommentaires(readFileSync(abs, "utf8"));
      if (!code.includes(`${ASSERTION_FLAG}(`)) {
        violations.push(
          `${file}\n     rôle   : ${why}\n     attendu: un APPEL ${ASSERTION_FLAG}() — le drapeau qui autorise l'AFFIRMATION\n` +
            `     ⚠️ utiliser isQualiopiPublicDisclosureEnabled() ici ferait affirmer la\n` +
            `        certification dès OF_PUBLIC_DISCLOSURE_ENABLED=true (cas de la prod),\n` +
            `        alors qu'elle n'est pas obtenue. Régression silencieuse : ça compile.`,
        );
      }
    }

    expect(
      violations,
      `\n${violations.length} surface(s) affirmant la certification sans le bon drapeau :\n\n${violations.join("\n\n")}\n`,
    ).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LE TEST INVERSE — celui qui attrape ce que le registre a oublié
// ─────────────────────────────────────────────────────────────────────────────
describe("🔴 aucune affirmation de certification hors registre", () => {
  it("le balayage lit vraiment des fichiers", () => {
    // Sans ce témoin, un chemin cassé ou un filtre d'extension raté viderait le
    // balayage et le test suivant serait vert en ne cherchant RIEN.
    expect(TOUS_LES_FICHIERS.length, "aucun fichier .ts/.tsx trouvé sous src/").toBeGreaterThan(
      500,
    );
    expect(
      PORTEURS.length,
      "aucune formulation assertive trouvée — les regex ou le dépouillement des commentaires sont cassés",
    ).toBeGreaterThan(10);
  });

  it("tout fichier qui affirme la certification est au registre ou exempté", () => {
    const auRegistre = new Set(ASSERTION_SURFACES.map((s) => s.file));
    const exempte = new Map(EXEMPTIONS.map((e) => [e.chemin, e]));

    const orphelins = PORTEURS.filter(({ rel }) => !estUnTest(rel))
      .filter(({ rel }) => !auRegistre.has(rel))
      .filter(({ rel }) => !exempte.has(rel))
      .map(
        ({ rel, formulations }) =>
          `${rel}\n     affirme : ${formulations.join(", ")}\n` +
          `     → soit ce fichier APPELLE ${ASSERTION_FLAG}() et entre dans ASSERTION_SURFACES,\n` +
          `       soit sa garde est ailleurs et il entre dans EXEMPTIONS avec sa raison.\n` +
          `     ⚠️ La certification Qualiopi d'Axion-IA n'est PAS obtenue (6 NC majeures,\n` +
          `        2026-08-15). L'en-tête de server/qualiopi/config/flag.ts qualifie\n` +
          `        d'ILLÉGAL le fait d'afficher « Qualiopi / CPF / OPCO » avant certification.`,
      );

    expect(
      orphelins,
      `\n${orphelins.length} fichier(s) affirment la certification sans garde connue :\n\n${orphelins.join("\n\n")}\n`,
    ).toEqual([]);
  });

  it("chaque exemption est encore fondée", () => {
    const problemes: string[] = [];

    for (const e of EXEMPTIONS) {
      const abs = path.join(SRC, ...e.chemin.split("/"));
      if (!existsSync(abs)) {
        problemes.push(`${e.chemin}\n     fichier disparu — retirer l'exemption devenue morte.`);
        continue;
      }
      const code = sansCommentaires(readFileSync(abs, "utf8"));

      // Une exemption pour un fichier qui n'affirme plus rien n'a plus d'objet :
      // on la retire, sinon la liste ne se relit plus.
      if (!FORMULATIONS.some((m) => m.regex.test(code))) {
        problemes.push(
          `${e.chemin}\n     n'affirme plus la certification — retirer l'exemption (elle n'a plus d'objet).`,
        );
        continue;
      }

      if (e.jeton && !code.includes(e.jeton)) {
        problemes.push(
          `${e.chemin}\n     garde attendue « ${e.jeton} » INTROUVABLE dans le code.\n` +
            `     raison invoquée : ${e.raison}\n` +
            `     → la garde a disparu : le fichier affirme désormais sans condition.`,
        );
      }

      if (e.gardeChez) {
        const absGarde = path.join(SRC, ...e.gardeChez.fichier.split("/"));
        const codeGarde = existsSync(absGarde)
          ? sansCommentaires(readFileSync(absGarde, "utf8"))
          : "";
        if (!codeGarde.includes(e.gardeChez.jeton)) {
          problemes.push(
            `${e.chemin}\n     module de données : sa garde doit vivre chez ${e.gardeChez.fichier},\n` +
              `     qui doit contenir « ${e.gardeChez.jeton} » — INTROUVABLE.\n` +
              `     raison invoquée : ${e.raison}`,
          );
        }
      }
    }

    expect(
      problemes,
      `\n${problemes.length} exemption(s) sans fondement :\n\n${problemes.join("\n\n")}\n`,
    ).toEqual([]);
  });
});
