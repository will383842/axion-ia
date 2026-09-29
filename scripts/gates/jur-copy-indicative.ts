#!/usr/bin/env tsx
/**
 * scripts/gates/jur-copy-indicative.ts — la rémunération d'un apporteur ne se promet pas
 * (JUR-T29, chantier Axion Partners ; REQ-JUR-001, REQ-JUR-002, REQ-JUR-019, REQ-JUR-041).
 *
 *     pnpm exec tsx scripts/gates/jur-copy-indicative.ts    # code 1 et chaque faute nommée, sinon 0
 *
 * Trois familles :
 *   — `remuneration_ferme` : une formule qui présente une rémunération comme acquise (« vous
 *     touchez », « commission de 10 % », un montant de commission interpolé, « par journée
 *     vendue ») SANS mention indicative dans la même phrase servie : « à partir de », « selon
 *     profil », « à titre indicatif ». « Jusqu'à » n'en est PAS une : un plafond présenté seul se
 *     lit comme un dû ;
 *   — `kit_de_vente` : l'expression est bannie (REQ-JUR-041) : le contrat ne peut pas nommer
 *     « vente » ce que son article 1.2 dit n'être pas une vente ;
 *   — `jsonld_remuneration` : aucun balisage structuré de rémunération (JobPosting, baseSalary,
 *     incentiveCompensation, MonetaryAmount) sur une surface apporteur. Il a été retiré le
 *     2026-09-19 (décision B5 de Williams : un apporteur n'occupe pas un poste) ; la garde
 *     l'empêche de revenir.
 *
 * LA PHRASE, PAS LA LIGNE. Le JSX coupe une phrase sur plusieurs lignes : la mention indicative
 * est cherchée dans la ligne fautive et ses deux voisines de chaque côté (hors commentaires).
 * Limite déclarée : une mention indicative placée à plus de deux lignes de la formule ferme
 * n'est pas vue, et la faute est alors signalée à tort — on rapproche la mention, on n'élargit
 * pas la fenêtre.
 *
 * SURFACES : les surfaces PUBLIQUES de `jur:vocab-public` (`lireSurfacesApporteur`), lues par le
 * même lecteur, jamais une liste recopiée. Les gabarits d'e-mail en sont RETIRÉS : l'acceptance
 * vise la copy publique, et un e-mail privé à un candidat retenu lui transmet le barème de SON
 * contrat. Le dire « indicatif » y affaiblirait l'engagement que le contrat porte. Ils restent
 * gardés par `jur:vocab-public` (déclencheur, financement). Les lignes sont jugées telles que le candidat les LIT
 * (`telleQueLue` : entités JSX décodées).
 */
import { lireSurfacesApporteur, telleQueLue } from "./vocab-public";

/** Les gabarits d'e-mail : privés, hors de la copy publique (voir l'en-tête). */
const GABARITS_EMAIL = "src/lib/email/templates/";

/** Les surfaces PUBLIQUES d'un candidat apporteur : celles de vocab-public, sans les e-mails. */
export function lireSurfacesPubliques(racine = process.cwd()): { chemin: string; texte: string }[] {
  return lireSurfacesApporteur(racine).filter((s) => !s.chemin.startsWith(GABARITS_EMAIL));
}

export type FamilleRemuneration = "remuneration_ferme" | "kit_de_vente" | "jsonld_remuneration";

export type FauteRemuneration = {
  readonly famille: FamilleRemuneration;
  readonly chemin: string;
  readonly ligne: number;
  readonly extrait: string;
};

const FERME =
  /\b(?:vous|tu)\s+(?:touchez|touches|gagnez|gagnes|percevez|perçois)\b|\bcommissions?\s+de\s+\d|\$\{\s*commission\s*\(|\bpar\s+journée\s+vendue\b/i;
const INDICATIF =
  /à\s+partir\s+de|selon\s+(?:votre\s+|ton\s+|son\s+)?profil|à\s+titre\s+indicatif|\bindicati(?:f|ve|fs|ves)\b/i;
const KIT = /\bkit\s+de\s+vente\b/i;
const JSONLD = /\b(?:incentiveCompensation|baseSalary|MonetaryAmount)\b|"JobPosting"/;
const COMMENTAIRE = /^\s*(?:\/\/|\*|\/\*)/;
const FENETRE = 2;

export function fautesDeRemuneration(
  fichiers: ReadonlyArray<{ chemin: string; texte: string }>,
): FauteRemuneration[] {
  const fautes: FauteRemuneration[] = [];
  for (const { chemin, texte } of fichiers) {
    const brutes = texte.split("\n");
    const lues = brutes.map((l) => (COMMENTAIRE.test(l) ? null : telleQueLue(l)));
    lues.forEach((contenu, i) => {
      if (contenu === null) return;
      const ferme = FERME.exec(contenu);
      if (ferme) {
        const voisines = lues.slice(Math.max(0, i - FENETRE), i + FENETRE + 1);
        if (!voisines.some((v) => v !== null && INDICATIF.test(v))) {
          fautes.push({ famille: "remuneration_ferme", chemin, ligne: i + 1, extrait: ferme[0] });
        }
      }
      const kit = KIT.exec(contenu);
      if (kit) fautes.push({ famille: "kit_de_vente", chemin, ligne: i + 1, extrait: kit[0] });
      const ld = JSONLD.exec(contenu);
      if (ld) fautes.push({ famille: "jsonld_remuneration", chemin, ligne: i + 1, extrait: ld[0] });
    });
  }
  return fautes;
}

if (/jur-copy-indicative\.ts$/.test(process.argv[1] ?? "")) {
  const surfaces = lireSurfacesPubliques();
  if (surfaces.length === 0) {
    console.error("[jur:remuneration-indicative] ROUGE — aucune surface lue : rien à juger.");
    process.exit(1);
  }
  const fautes = fautesDeRemuneration(surfaces);
  if (fautes.length > 0) {
    for (const f of fautes)
      console.error(`  ✗ [${f.famille}] ${f.chemin}:${f.ligne} — « ${f.extrait} »`);
    console.error(`[jur:remuneration-indicative] ROUGE — ${fautes.length} faute(s).`);
    process.exit(1);
  }
  console.log(
    `[jur:remuneration-indicative] VERT — ${surfaces.length} surfaces apporteur publiques lues, aucune faute.`,
  );
}
