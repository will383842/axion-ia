#!/usr/bin/env tsx
/**
 * scripts/gates/vocab-public.ts — ce que les pages de recrutement des apporteurs ont le droit de
 * dire (JUR-T03, chantier Axion Partners ; REQ-JUR-001, REQ-JUR-002, REQ-JUR-024).
 *
 *     pnpm exec tsx scripts/gates/vocab-public.ts    # code 1 et chaque faute nommée, sinon 0
 *
 * Trois familles, et une limite déclarée :
 *   — `declencheur_hors_encaissement` : une commission se déclenche à l'ENCAISSEMENT (contrat
 *     d'apporteur). « Vente signée » ou « dès la signature » promettent un droit que le
 *     contrat ne donne pas ;
 *   — `financement_inconditionnel` : les formules que la SSOT du financement
 *     (`src/server/qualiopi/config/financing.ts`, point 4 de son contrat légal) interdit, MÊME
 *     certification obtenue — elle ne lit donc AUCUN drapeau : « prise en charge à 100 % »,
 *     « financé par Qualiopi », « sans avance de frais » et leurs périphrases (trésorerie à
 *     sortir, avancer les fonds, coût nul ou quasi nul) ;
 *   — `financement_non_gate` : une mention de financement (financ…, OPCO, France Travail) dans
 *     un fichier qui ne consulte jamais la certification : avant elle, toute mention
 *     « finançable » est illicite (point 1 du contrat légal de `financing.ts`) ;
 *   — `qualiopi_nu` : « Qualiopi » employé comme un label de financement, hors de la seule
 *     affirmation « certifié(e) Qualiopi », que `assertion-flag-surfaces.spec.ts` garde déjà
 *     derrière le drapeau ;
 *   — `cpf` : le CPF n'est pas mobilisable (`CPF_ELIGIBLE = false`) : ni « CPF », ni « Mon
 *     Compte Formation ».
 *
 * CE QU'ELLE NE LIT PAS. Les commentaires (une ligne qui commence par `//` ou `*`) : ils
 * expliquent les interdits, ils ne sont pas servis. Et seulement les surfaces que lit ou
 * reçoit un candidat apporteur (ci-dessous) : les pages de formation ont leur propre garde
 * (`src/server/editorial/conformite`). Le mot « commercial » n'est PAS interdit : il désigne
 * ici les apporteurs (décision de Williams du 2026-09-29).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type FamilleVocabulaire =
  | "declencheur_hors_encaissement"
  | "financement_inconditionnel"
  | "financement_non_gate"
  | "qualiopi_nu"
  | "cpf";

/**
 * Une mention de financement n'est admise que dans un fichier qui CONSULTE la certification :
 * le drapeau lui-même, la SSOT du financement, ou le paramètre `financementAffichable` que
 * reçoivent les mots-clés. C'est une lecture par FICHIER, pas par branche : elle ne prouve pas
 * que la phrase est derrière le test, seulement que le fichier sait qu'il y en a un — la
 * preuve fine reste `assertion-flag-surfaces.spec.ts`.
 */
const MENTION_FINANCEMENT = /finan[cç]|\bOPCO\b|France\s+Travail/i;
const CONSULTE_LA_CERTIFICATION =
  /isQualiopiCertificationObtenue|getPublicFinancing(?:Blurb|Micro)|financementAffichable/;

export type FauteVocabulaire = {
  readonly famille: FamilleVocabulaire;
  readonly chemin: string;
  readonly ligne: number;
  readonly extrait: string;
};

const REGLES: ReadonlyArray<{ famille: FamilleVocabulaire; motif: RegExp }> = [
  { famille: "declencheur_hors_encaissement", motif: /vente\s+sign[ée]e|d[èe]s\s+la\s+signature/i },
  {
    famille: "financement_inconditionnel",
    motif:
      /pris(?:e|es)?\s+en\s+charge\s+(?:à|a)\s+100|(?:finan[cç]|pris)[\wÀ-ÿ]*\s+(?:jusqu['’]à\s+|à\s+)?100\s*%|100\s*%\s*(?:finan[cç]|pris)|finan[cç][\wÀ-ÿ]*\s+par\s+qualiopi|sans\s+avance\s+de\s+frais|avancer\s+les\s+fonds|trésorerie\s+à\s+sortir|co[uû]t\s+(?:quasi[\s-]+)?nul/i,
  },
  { famille: "qualiopi_nu", motif: /(?<!certifi[a-zéèê]{0,3}\s)\bQualiopi\b/ },
  {
    famille: "cpf",
    motif: /\bCPF\b|mon\s+compte\s+formation|compte\s+personnel\s+de\s+formation/i,
  },
];

const COMMENTAIRE = /^\s*(?:\/\/|\*|\/\*)/;

export function fautesDeVocabulaire(
  fichiers: ReadonlyArray<{ chemin: string; texte: string }>,
): FauteVocabulaire[] {
  const fautes: FauteVocabulaire[] = [];
  for (const { chemin, texte } of fichiers) {
    const consulte = CONSULTE_LA_CERTIFICATION.test(texte);
    texte.split("\n").forEach((contenu, i) => {
      if (COMMENTAIRE.test(contenu)) return;
      for (const { famille, motif } of REGLES) {
        const m = motif.exec(contenu);
        if (m) fautes.push({ famille, chemin, ligne: i + 1, extrait: m[0] });
      }
      const f = consulte ? null : MENTION_FINANCEMENT.exec(contenu);
      if (f) {
        fautes.push({ famille: "financement_non_gate", chemin, ligne: i + 1, extrait: f[0] });
      }
    });
  }
  return fautes;
}

/** Les surfaces LUES ou REÇUES par un candidat apporteur. */
export const DOSSIERS_APPORTEUR = [
  "src/content/recrutement",
  "src/components/recrutement",
  "src/components/services/devenir-commercial",
  "src/app/[locale]/devenir-commercial-ia",
  "src/app/[locale]/apporteur-affaires",
  "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise",
  "src/app/[locale]/memo-isere",
];
const GABARITS = "src/lib/email/templates";
const GABARIT_APPORTEUR = /apporteur|commercial/;
const HORS = /(?:__tests__|\.spec\.|\.test\.)/;
const SOURCE = /\.(?:ts|tsx)$/;

function lister(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.posix.join(dossier, nom);
    if (HORS.test(chemin)) return [];
    if (statSync(chemin).isDirectory()) return lister(chemin);
    return SOURCE.test(nom) ? [chemin] : [];
  });
}

export function lireSurfacesApporteur(racine = process.cwd()): { chemin: string; texte: string }[] {
  const chemins = [
    ...DOSSIERS_APPORTEUR.flatMap((d) => lister(d)),
    ...lister(GABARITS).filter((c) => GABARIT_APPORTEUR.test(path.posix.basename(c))),
  ];
  return chemins.map((chemin) => ({
    chemin,
    texte: readFileSync(path.join(racine, chemin), "utf8"),
  }));
}

if (/vocab-public\.ts$/.test(process.argv[1] ?? "")) {
  const surfaces = lireSurfacesApporteur();
  const fautes = fautesDeVocabulaire(surfaces);
  if (surfaces.length === 0) {
    console.error(
      "[jur:vocab-public] ROUGE — aucune surface lue : rien à juger n'est pas un vert.",
    );
    process.exit(1);
  }
  if (fautes.length > 0) {
    for (const f of fautes)
      console.error(`  ✗ [${f.famille}] ${f.chemin}:${f.ligne} — « ${f.extrait} »`);
    console.error(`[jur:vocab-public] ROUGE — ${fautes.length} faute(s).`);
    process.exit(1);
  }
  console.log(
    `[jur:vocab-public] VERT — ${surfaces.length} surfaces apporteur lues, aucune faute.`,
  );
}
