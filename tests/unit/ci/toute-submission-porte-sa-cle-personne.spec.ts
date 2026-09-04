// Toute création de `Submission` doit poser `contactEmailHash`.
//
// ── Pourquoi cette garde existe ───────────────────────────────────────────
// `Submission.contactEmail` est chiffré avec un IV ALÉATOIRE : deux lignes
// portant la même adresse ne se ressemblent pas, donc aucune égalité SQL n'y
// est possible. `contactEmailHash` (HMAC déterministe) est le SEUL moyen de
// retrouver une personne. Le schéma raconte lui-même ce qui arrive sans lui :
// « l'export art. 15 et l'effacement art. 17 renvoyaient donc VIDE en
// répondant "succès" » (`prisma/schema.prisma`, ~l. 515).
//
// Le 2026-09-04, un audit a trouvé DEUX chemins sur six qui l'oubliaient —
// `commercial-application/lead-actions.ts` et `commercial-application/
// actions.ts`, les deux formulaires du tunnel apporteurs. Personne ne l'avait
// vu parce que rien ne le regardait : une colonne nullable qui reste nulle ne
// casse aucun test, ne lève aucune erreur, et l'effacement RGPD répond
// « succès » en n'effaçant rien. C'est exactement le genre de défaut qu'une
// garde attrape et qu'une revue humaine laisse passer.
//
// La même valeur est la `person_key` du CRM (`server/crm-sync/index.ts`) :
// l'oublier casse aussi la réconciliation entre les deux systèmes.
//
// ── Ce que la garde vérifie, et comment ───────────────────────────────────
// Elle ne COMPTE pas des occurrences — compter n'est pas lire. Pour chaque
// `prisma.submission.create({` (ou `tx.submission.create({`) du code de
// production, elle isole le bloc `data: { … }` par équilibrage d'accolades,
// puis exige que `contactEmailHash` y figure comme CLÉ.
//
// Le dernier test est un TÉMOIN POSITIF : il donne au détecteur un bloc
// fabriqué SANS la clé et exige qu'il le refuse. Sans lui, un détecteur cassé
// qui ne trouve jamais rien rendrait cette garde verte à perpétuité.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Repère un appel de création de Submission, quel que soit le porteur (`prisma`, `tx`, …). */
const APPEL_CREATE = /\b[\w.]*\bsubmission\.create\s*\(\s*\{/g;

/**
 * Depuis l'accolade ouvrante d'un objet, rend le texte jusqu'à sa fermeture.
 * Équilibrage réel : une regex ne sait pas où finit un objet imbriqué, et
 * `details: { … }` en contient toujours.
 */
function blocEquilibre(source: string, indexAccoladeOuvrante: number): string {
  let profondeur = 0;
  for (let i = indexAccoladeOuvrante; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{") profondeur += 1;
    else if (c === "}") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(indexAccoladeOuvrante, i + 1);
    }
  }
  return source.slice(indexAccoladeOuvrante);
}

/** Rend les blocs d'arguments de chaque `submission.create({ … })` du fichier. */
function blocsDeCreation(source: string): string[] {
  const blocs: string[] = [];
  APPEL_CREATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = APPEL_CREATE.exec(source)) !== null) {
    const ouvrante = source.indexOf("{", m.index + m[0].length - 1);
    if (ouvrante === -1) continue;
    blocs.push(blocEquilibre(source, ouvrante));
  }
  return blocs;
}

/** Retire commentaires de ligne et de bloc, pour qu'un mot commenté ne compte pas. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Clés de PREMIER NIVEAU d'un objet donné par son texte `{ … }`.
 *
 * 🔑 Le niveau compte. `details: { … }` est un JSON libre où n'importe qui peut
 * écrire `contactEmailHash` sans que la COLONNE soit remplie : une recherche de
 * sous-chaîne rendrait donc la garde verte sur exactement le défaut qu'elle
 * traque. On ne lit que la profondeur 1.
 */
function clesDePremierNiveau(objet: string): Set<string> {
  const src = sansCommentaires(objet);
  const cles = new Set<string>();
  let profondeur = 0;
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (c === "{" || c === "[" || c === "(") profondeur += 1;
    else if (c === "}" || c === "]" || c === ")") profondeur -= 1;
    else if (profondeur === 1) {
      const reste = src.slice(i);
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(reste);
      if (m && /[\s,{]/.test(src[i - 1] ?? "{")) {
        cles.add(m[1] as string);
        i += m[0].length - 1;
      }
    }
  }
  return cles;
}

/** `contactEmailHash` figure-t-il comme clé de premier niveau du bloc `data` ? */
function porteLaClePersonne(blocArguments: string): boolean {
  const src = sansCommentaires(blocArguments);
  const posData = src.search(/(^|[\s,{])data\s*:\s*\{/);
  if (posData === -1) return false;
  const ouvrante = src.indexOf("{", src.indexOf("data", posData) + 4);
  if (ouvrante === -1) return false;
  return clesDePremierNiveau(blocEquilibre(src, ouvrante)).has("contactEmailHash");
}

/** Balaie `src/` en profondeur — code de production seulement, tests exclus. */
function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dir)) {
    const abs = path.join(dir, entree);
    if (statSync(abs).isDirectory()) {
      if (entree === "__tests__" || entree === "node_modules") continue;
      fichiersSource(abs, acc);
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entree)) continue;
    acc.push(path.relative(RACINE, abs).split(path.sep).join("/"));
  }
  return acc;
}

const FICHIERS = fichiersSource(path.join(RACINE, "src")).sort();

interface Creation {
  fichier: string;
  bloc: string;
}

const CREATIONS: Creation[] = FICHIERS.flatMap((rel) => {
  const source = readFileSync(path.join(RACINE, rel), "utf8");
  if (!source.includes("submission.create")) return [];
  return blocsDeCreation(source).map((bloc) => ({ fichier: rel, bloc }));
});

describe("toute Submission créée porte sa clé de personne", () => {
  it("le balayage trouve bien des créations — sinon il ne prouve rien", () => {
    // Six chemins connus au 2026-09-04 : contact unifié, rapport ROI, chatbot,
    // et les deux du tunnel apporteurs. Si ce nombre tombe à zéro, c'est le
    // DÉTECTEUR qui est cassé, pas le code qui est devenu parfait.
    expect(CREATIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("aucune création de Submission n'oublie `contactEmailHash`", () => {
    const fautives = CREATIONS.filter((c) => !porteLaClePersonne(c.bloc)).map((c) => c.fichier);
    expect(
      [...new Set(fautives)],
      "création(s) de Submission sans `contactEmailHash` — la ligne sera INTROUVABLE par " +
        "son adresse (IV aléatoire), donc ni exportable (art. 15) ni effaçable (art. 17), " +
        "et la réconciliation CRM par `person_key` la ratera. Poser " +
        "`contactEmailHash: hashEmailForLookup(<email>)` dans le bloc `data`",
    ).toEqual([]);
  });

  it("les deux formulaires du tunnel apporteurs sont bien couverts par ce balayage", () => {
    // Verrou d'ANCRAGE : ce sont eux qui manquaient. Si un renommage les sort
    // du balayage, la garde deviendrait verte en cessant de les regarder — le
    // pire mode de défaillance d'une garde.
    const balayes = new Set(CREATIONS.map((c) => c.fichier.replace(/\\/g, "/")));
    expect([...balayes]).toEqual(
      expect.arrayContaining([
        "src/features/commercial-application/lead-actions.ts",
        "src/features/commercial-application/actions.ts",
      ]),
    );
  });

  it("TÉMOINS — le détecteur accepte la bonne forme et refuse les trois leurres", () => {
    // ① La forme correcte : la clé au premier niveau de `data`.
    expect(
      porteLaClePersonne(`{
        data: {
          contactEmail: encryptPii(d.email),
          contactEmailHash: emailKey,
          details: { unifiedType: "recrutement" },
        },
      }`),
    ).toBe(true);

    // ② Absente : c'est le défaut réel trouvé le 2026-09-04.
    expect(
      porteLaClePersonne(`{
        data: {
          type: SubmissionType.contact,
          contactEmail: encryptPii(d.email),
          details: { unifiedType: "recrutement" },
        },
      }`),
    ).toBe(false);

    // ③ Présente SEULEMENT dans un commentaire — le cas « quelqu'un a voulu le
    //    faire puis l'a désactivé ». Une recherche de sous-chaîne dirait oui.
    expect(
      porteLaClePersonne(`{
        data: {
          contactEmail: encryptPii(d.email),
          // contactEmailHash: emailKey,
        },
      }`),
    ).toBe(false);

    // ④ Présente mais ENFOUIE dans le JSON libre `details` — le leurre qui
    //    compte le plus : la colonne reste vide, l'effacement RGPD rate quand
    //    même, et une garde naïve serait verte.
    expect(
      porteLaClePersonne(`{
        data: {
          contactEmail: encryptPii(d.email),
          details: { unifiedType: "recrutement", meta: { contactEmailHash: "leurre" } },
        },
      }`),
    ).toBe(false);
  });
});
