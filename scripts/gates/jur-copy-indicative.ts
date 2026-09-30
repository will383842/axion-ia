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

export type FamilleRemuneration =
  | "remuneration_ferme"
  | "revenu_illimite"
  | "promesse_sans_risque"
  | "ai_act_trop_large"
  | "kit_de_vente"
  | "jsonld_remuneration"
  | "exception_perimee";

export type FauteRemuneration = {
  readonly famille: FamilleRemuneration;
  readonly chemin: string;
  readonly ligne: number;
  readonly extrait: string;
};

/**
 * Les formules fermes : tout MONTANT ou TAUX de rémunération affiché sans mention indicative,
 * verbe ou pas. Élargies après les relectures securite et exactitude de #1232, qui en ont
 * trouvé de servies sans être vues :
 *   — le verbe : « vous touchez / gagnez / percevez », et l'impératif « Gagnez », « Touchez » ;
 *   — un montant TAPÉ (« 500 € », « €500 ») ou INTERPOLÉ (`${X} €`, `{X} €`, `€${X}`) à moins
 *     de 60 caractères d'une journée, d'un jour, d'une formation, d'une mission, d'une vente,
 *     d'un « pour vous » ou d'une commission ;
 *   — un TAUX (« 30 % », `{pct} %`) à moins de 60 caractères, dans un sens ou dans l'autre,
 *     d'une commission, de revenus, d'une rémunération, de « gagn… » ou de « pour vous » ;
 *   — un montant de commission interpolé, en gabarit (`${commission(`) comme en JSX
 *     (`{commission(`, `{montantJournee}`) ;
 *   — « par journée … vendue | payée | signée », avec jusqu'à six mots entre les deux ;
 *   — le revenu ILLIMITÉ : « sans plafond », « non plafonnés », « pas de plafond », « aucune
 *     limite », « déplafonné », « uncapped », « no limit » ;
 *   — l'ANGLAIS : « you earn / pocket », « you get / receive / make » suivis d'une commission
 *     ou d'un montant, « per … day », « for you per ».
 * AJUSTEMENT (faux positif démontré) : « you receive / get / make » SEULS rougissaient sur
 * « You receive a confirmation email » (CommercialProcess.tsx). Un e-mail n'est pas une
 * rémunération : ils ne rougissent plus que suivis d'une commission ou d'un montant. « You
 * receive your commission » reste rouge (témoin de remuneration-indicative.spec.ts).
 * Fin de mot : `(?![\wÀ-ÿ])` et non `\b`, qui ne voit pas la fin de « journée » (é hors de \w).
 */
const FIN = String.raw`(?![\wÀ-ÿ])`;
const DEBUT = String.raw`(?<![\wÀ-ÿ])`;
const REMUNERATION = String.raw`(?:commissions?|revenus?|rémunérations?|gagn[\wÀ-ÿ]*|pour\s+vous)${FIN}`;
const TAUX = String.raw`(?:\d+(?:[,.]\d+)?|\})[\s  ]?%`;
const MONTANT = String.raw`(?:(?:\d|\})[\d\s  .]*(?:€|euros?${FIN})|€[\s  ]?(?:\d|\$\{))`;
const OBJET = String.raw`(?:journées?|jours?|days?|formations?|missions?|ventes?|vendues?|pour\s+vous|for\s+you|commissions?)${FIN}`;
const FERME = new RegExp(
  [
    String.raw`${DEBUT}(?:vous|tu)\s+(?:touchez|touches|gagnez|gagnes|percevez|perçois)${FIN}`,
    String.raw`${DEBUT}(?:gagnez|touchez)${FIN}`,
    String.raw`\bcommissions?\s+de\s+\d`,
    String.raw`\$?\{\s*(?:commission\s*\(|montant[A-Z]\w*\s*\})`,
    String.raw`${MONTANT}(?=[^.;!?]{0,60}?${DEBUT}${OBJET})`,
    String.raw`${TAUX}(?=[^.;!?]{0,60}?${DEBUT}${REMUNERATION})`,
    String.raw`${DEBUT}${REMUNERATION}[^.;!?]{0,60}?${TAUX}`,
    String.raw`\bpar\s+journée(?:\s+[\wÀ-ÿ'’-]+){0,6}?\s+(?:vendue|payée|signée)s?${FIN}`,
    String.raw`\byou\s+(?:earn|pocket)\b|\byou\s+(?:get|receive|make)\s+(?:(?:your|a|an|the)\s+)?(?:commissions?\b|€|\d|\$?\{)`,
    String.raw`\bper\s+(?:[a-z]+\s+){0,3}days?\b|\bfor\s+you\s+per\b`,
  ].join("|"),
  "i",
);
const INDICATIF =
  /à\s+partir\s+de|selon\s+(?:votre\s+|ton\s+|son\s+)?profil|à\s+titre\s+indicatif|\bindicati(?:f|ve|fs|ves)\b|\bas\s+a\s+guide\b|\bfrom\s+€|\bdepending\s+on\s+(?:your\s+)?profile\b/i;
/**
 * `revenu_illimite` : une FAMILLE À PART, que la mention indicative N'EXCUSE PAS (arbitrage -d7
 * du 2026-09-29). « À titre indicatif, 500 € par journée, sans plafond » reste une promesse de
 * revenu illimité : un plafond absent ne se nuance pas. Seules les exceptions nommées (la limite
 * d'ÂGE) en sortent.
 */
const ILLIMITE =
  /\bsans\s+(?:aucune?\s+)?plafond|\b(?:sans\s+(?:aucune\s+)?|aucune\s+)limite(?!\s+d['’]\s?âge)|\bnon\s+plafonn|\bpas\s+de\s+plafond|\bdéplafonn|\billimit[ée]e?s?\b|\buncapped\b|\bunlimited\b|\bno\s+(?:limit|cap)\b/i;
/**
 * Deux formules que la juriste A07 juge bloquantes (arbitrage -d7 du 2026-09-30) :
 *   — `promesse_sans_risque` : promettre à un indépendant l'absence de risque (« zéro risque »,
 *     « sans risque », « risk-free »). On dit ce qui est vrai : aucun frais d'entrée, aucun
 *     engagement de volume ;
 *   — `ai_act_trop_large` : « l'AI Act impose / oblige » rapporté aux PME, ETI ou grands groupes
 *     en bloc. Le règlement vise des usages et des systèmes d'IA, pas des tailles d'entreprise.
 */
const SANS_RISQUE =
  /\bz[ée]ro\s+risque|\brisque\s+z[ée]ro|\bsans\s+(?:aucun\s+)?risque|\bzero\s+risk|\brisk[-\s]free\b|\bno\s+risk\b/i;
const AI_ACT_LARGE =
  /\bAI\s+Act\b[^.;!?]{0,20}\b(?:l['’]\s?)?(?:impose|oblige|mandates|requires|forces)\b[^.;!?]{0,60}\b(?:PME|ETI|grands\s+groupes|TPE|SMEs|mid-caps|large\s+groups)\b/i;
const KIT = /\bkit\s+de\s+vente\b/i;
const JSONLD = /\b(?:incentiveCompensation|baseSalary|MonetaryAmount)\b|"JobPosting"/;
const COMMENTAIRE = /^\s*(?:\/\/|\*|\/\*)/;
const FENETRE = 2;

/**
 * EXCEPTIONS NOMMÉES : des faux positifs DÉMONTRÉS, jamais un motif affaibli. Chacune nomme
 * son fichier, un extrait de SA ligne (texte source brut) et son motif. Elle ne couvre que la
 * PREMIÈRE ligne du fichier qui porte l'extrait : la même phrase ailleurs, ou une seconde fois
 * dans le même fichier, rougit. Une exception qui ne trouve plus sa ligne est une faute
 * (`exception_perimee`) : la liste ne peut pas survivre à la copy qu'elle excuse.
 */
export const EXCEPTIONS_REMUNERATION: ReadonlyArray<{
  readonly chemin: string;
  readonly ligne: string;
  readonly motif: string;
}> = [
  {
    chemin: "src/components/recrutement/PartenaireLandingPage.tsx",
    ligne: `"Aucune limite d'âge, et les commerciaux à la retraite`,
    motif: "« aucune limite » d'ÂGE : une condition d'accès, pas un revenu illimité.",
  },
  {
    chemin: "src/components/recrutement/PartenaireLandingPage.tsx",
    ligne: "{/* 7 ── À qui ça va + aucune limite d'âge */}",
    motif: "Commentaire JSX (non servi) sur la limite d'ÂGE, pas sur un revenu.",
  },
  {
    chemin: "src/components/recrutement/PartenaireLandingPage.tsx",
    ligne: "Aucune limite d&apos;âge</h3>",
    motif: "Titre « Aucune limite d'âge » : une condition d'accès, pas un revenu illimité.",
  },
  {
    chemin: "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx",
    ligne: "Aucune limite d&apos;âge</h3>",
    motif: "Titre « Aucune limite d'âge » : une condition d'accès, pas un revenu illimité.",
  },
  {
    chemin: "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx",
    ligne: "L&apos;activité est ouverte à tout indépendant en capacité de facturer, sans limite",
    motif:
      "« sans limite » d'ÂGE, dont « d'âge » ouvre la ligne suivante (JSX coupé) : une condition " +
      "d'accès, pas un revenu illimité.",
  },
  {
    chemin: "src/app/[locale]/memo-isere/page.tsx",
    ligne: `"Oui. L'activité est 100 % à la commission et sans quota horaire`,
    motif: "« 100 % à la commission » dit le MODE de rémunération (aucun fixe), pas un taux.",
  },
];

export function fautesDeRemuneration(
  fichiers: ReadonlyArray<{ chemin: string; texte: string }>,
  exceptions: typeof EXCEPTIONS_REMUNERATION = EXCEPTIONS_REMUNERATION,
): FauteRemuneration[] {
  const fautes: FauteRemuneration[] = [];
  for (const { chemin, texte } of fichiers) {
    const brutes = texte.split("\n");
    const lues = brutes.map((l) => (COMMENTAIRE.test(l) ? null : telleQueLue(l)));
    const exemptees = new Set<number>();
    for (const e of exceptions.filter((x) => x.chemin === chemin)) {
      const i = brutes.findIndex((l) => l.includes(e.ligne));
      if (i < 0) fautes.push({ famille: "exception_perimee", chemin, ligne: 0, extrait: e.ligne });
      else exemptees.add(i);
    }
    lues.forEach((contenu, i) => {
      if (contenu === null) return;
      const ferme = exemptees.has(i) ? null : FERME.exec(contenu);
      if (ferme) {
        const voisines = lues.slice(Math.max(0, i - FENETRE), i + FENETRE + 1);
        if (!voisines.some((v) => v !== null && INDICATIF.test(v))) {
          fautes.push({ famille: "remuneration_ferme", chemin, ligne: i + 1, extrait: ferme[0] });
        }
      }
      const illimite = exemptees.has(i) ? null : ILLIMITE.exec(contenu);
      if (illimite) {
        fautes.push({ famille: "revenu_illimite", chemin, ligne: i + 1, extrait: illimite[0] });
      }
      const risque = SANS_RISQUE.exec(contenu);
      if (risque) {
        fautes.push({ famille: "promesse_sans_risque", chemin, ligne: i + 1, extrait: risque[0] });
      }
      const aiAct = AI_ACT_LARGE.exec(contenu);
      if (aiAct) {
        fautes.push({ famille: "ai_act_trop_large", chemin, ligne: i + 1, extrait: aiAct[0] });
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
