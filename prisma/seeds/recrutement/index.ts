#!/usr/bin/env tsx
/**
 * Lot 0 — LE SOCLE DE RECETTE DU RECRUTEMENT.
 *
 * ## Pourquoi ce fichier existe
 *
 * L'audit Qualiopi du 2026-09-02 a mesuré une chose qui vaut bien au-delà de
 * Qualiopi : **neuf défauts sur onze étaient invisibles sur une base vide**.
 * Un écran jugé sur zéro ligne ne prouve rien — ni la pagination, ni le tri, ni
 * l'état vide, ni ce qui déborde, ni ce qui se masque selon le rôle.
 *
 * Le recrutement est exactement dans cette situation. `pnpm db:seed` ne crée
 * aucune candidature, la fixture volumétrique n'en crée aucune non plus (elle
 * couvre les sessions et les inscriptions), et `qualiopi:seed-demo` encore
 * moins. Toute la console des candidatures se recette donc aujourd'hui sur du
 * vide, et le chantier qui commence va y ajouter une frise, un composeur de
 * réponses, des entretiens, un pipeline et une recherche — cinq surfaces dont
 * AUCUNE ne se juge sans données.
 *
 * ## Les deux verrous, et pourquoi le second est le vrai
 *
 * 1. `cibleAutorisee()` — liste BLANCHE d'hôtes, refus par défaut. Le même
 *    verrou que la fixture volumétrique, et il échoue fermé.
 *
 * 2. 🔑 **Ce seed ne peut créer ou modifier que des lignes QU'IL POSSÈDE.**
 *    Toute offre écrite ici porte un slug préfixé `rec-demo-`, et toute
 *    candidature écrite ici appartient à l'une de ces offres. Il n'existe dans
 *    ce fichier aucun `update`, aucun `delete` et aucun `deleteMany` dont la
 *    clause ne soit bornée à ce périmètre.
 *
 *    C'est une propriété plus forte qu'un comptage préalable « la base est-elle
 *    vierge ? » — et c'est délibéré. Un comptage préalable interdirait de semer
 *    sur une base de développement qui contient déjà du travail, ce qui est le
 *    cas normal ici ; et il ne protégerait de rien une fois franchi. La
 *    propriété de propriété, elle, tient à chaque écriture, et
 *    `recrutement-seed-non-destructeur.spec.ts` la vérifie sur le texte du
 *    fichier.
 *
 *    Le dépôt a déjà payé l'inverse : `seed-careers-offers` a écrasé les
 *    salaires de vingt et une offres qui n'existaient qu'en production.
 *
 * ## Idempotence
 *
 * Graine fixe, identifiants DÉRIVÉS d'un libellé stable (pas de hasard), et
 * `upsert` partout : deux exécutions successives laissent exactement la même
 * base. Les pièces jointes déjà présentes sur le disque sont RÉUTILISÉES —
 * `storeCv` crée un dossier par appel, le rappeler sans précaution ferait fuir
 * un fichier orphelin à chaque passage.
 *
 * ## Ce que ce seed NE fait PAS
 *
 * - Il ne sème pas l'offre « monteur vidéo ». Son flux séparé est identifié par
 *   un slug RÉEL (`VIDEO_EDITOR_OFFER_SLUG`), verrouillé par
 *   `candidate-family.spec.ts` contre `careers_seed_input.json` : une offre de
 *   démonstration ne peut pas le porter sans casser cette garde, ni le
 *   contourner sans rendre l'onglet intestable. À traiter au lot 6, quand le
 *   flux séparé deviendra une case à cocher sur l'offre.
 * - Il n'écrit aucun entretien ni aucune réponse : ces tables n'existent pas
 *   encore (lots 1 et 2). Ce fichier grandira avec elles.
 *
 * Usage :
 *   pnpm recrutement:seed-scenarios            # écrit (ou remet à jour)
 *   pnpm recrutement:seed-scenarios --purge    # retire tout ce qu'il a écrit
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { cibleAutorisee } from "../volumetrie/garde-cible";
import type {
  PrismaClient,
  JobCategory,
  JobWorkMode,
  Locale,
  PublishStatus,
} from "../../generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Environnement
//
// `tsx` ne charge pas `.env` ; seul le CLI Prisma le fait. Sans ce chargeur, le
// seed ne verrait ni `DATABASE_URL` ni `PII_ENCRYPTION_KEY` et échouerait sur
// « clé absente » — un message qui accuse la configuration alors que le fichier
// est là. Chargeur zéro-dépendance, copié de `vitest.integration.setup.ts`.
// ─────────────────────────────────────────────────────────────────────────────

function chargerEnv(nom: string): void {
  const chemin = resolve(process.cwd(), nom);
  if (!existsSync(chemin)) return;
  for (const ligneBrute of readFileSync(chemin, "utf8").split(/\r?\n/)) {
    const ligne = ligneBrute.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const eq = ligne.indexOf("=");
    if (eq === -1) continue;
    const cle = ligne.slice(0, eq).trim();
    let val = ligne.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[cle] === undefined || process.env[cle] === "") process.env[cle] = val;
  }
}
chargerEnv(".env.local");
chargerEnv(".env");

/**
 * Préfixe de TOUT ce que ce seed écrit, et périmètre exact de sa purge.
 * Exporté : la garde de non-destruction le relit plutôt que d'en tenir copie.
 */
export const PREFIXE_RECRUTEMENT = "rec-demo";

/** Domaine des adresses de démonstration — jamais une adresse joignable. */
const DOMAINE_DEMO = "recette.axion-ia.invalid";

// ─────────────────────────────────────────────────────────────────────────────
// Déterminisme
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifiant DÉRIVÉ d'un libellé stable, au format UUID v4.
 *
 * 🔑 Ni `randomUUID()`, ni un compteur : c'est ce qui rend l'`upsert`
 * idempotent. Deux exécutions visent la même ligne, donc la seconde met à jour
 * au lieu de dupliquer — et un test peut viser une candidature par son nom sans
 * avoir à la chercher.
 */
function idDerive(libelle: string): string {
  const h = createHash("sha256").update(`${PREFIXE_RECRUTEMENT}:${libelle}`).digest("hex");
  const variante = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Entier pseudo-aléatoire STABLE tiré d'un libellé — même libellé, même tirage. */
function tirage(libelle: string, borne: number): number {
  return parseInt(createHash("sha256").update(libelle).digest("hex").slice(0, 8), 16) % borne;
}

/** Date à J-`jours`, à midi UTC pour ne dépendre d'aucun fuseau. */
function ilYA(jours: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - jours);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les offres
// ─────────────────────────────────────────────────────────────────────────────

// Les trois vocabulaires viennent du SCHÉMA, jamais d'une recopie : une
// valeur ajoutée à l'enum Prisma doit être utilisable ici sans qu'on y pense,
// et une valeur retirée doit faire rougir le typecheck.
type StatutOffre = PublishStatus;
type ModeTravail = JobWorkMode;

interface QuestionOffre {
  readonly id: string;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly required: boolean;
}

interface OffreDemo {
  readonly cle: string;
  readonly titre: string;
  readonly categorie: JobCategory;
  readonly statut: StatutOffre;
  readonly mode: ModeTravail;
  readonly ville: string | null;
  readonly deposeeIlYaJours: number;
  readonly pourvue: boolean;
  readonly permisRequis: boolean;
  readonly vehiculeRequis: boolean;
  readonly questions: readonly QuestionOffre[];
  /** Ce que cette offre rend testable, et qu'aucune autre ne couvre. */
  readonly couvre: string;
}

/** Les douze questions de l'offre chargée — le cas « la fiche déborde ». */
const DOUZE_QUESTIONS: readonly QuestionOffre[] = [
  "Décrivez une automatisation que vous avez livrée",
  "Quel est votre rapport à la relecture humaine d'une sortie d'IA ?",
  "Quels outils d'IA utilisez-vous au quotidien ?",
  "Avez-vous déjà formé des adultes en entreprise ?",
  "Comment expliqueriez-vous un LLM à un dirigeant non technique ?",
  "Quelle est votre expérience du secteur industriel ?",
  "Êtes-vous à l'aise avec les déplacements hebdomadaires ?",
  "Quel est votre délai de préavis ?",
  "Qu'attendez-vous de votre prochain poste ?",
  "Un cas où vous vous êtes trompé, et ce que vous en avez tiré",
  "Comment mesurez-vous qu'une formation a servi ?",
  "Une question que vous aimeriez qu'on vous pose",
].map((labelFr, i) => ({
  id: `q${i + 1}`,
  labelFr,
  labelEn: labelFr,
  required: i < 3,
}));

const OFFRES: readonly OffreDemo[] = [
  {
    cle: "developpeur-web",
    titre: "Développeur web / Product Engineer (F/H)",
    categorie: "developpement",
    statut: "published",
    mode: "hybrid",
    ville: "Grenoble",
    deposeeIlYaJours: 12,
    pourvue: false,
    permisRequis: false,
    vehiculeRequis: false,
    questions: [
      {
        id: "stack",
        labelFr: "Sur quelle pile travaillez-vous aujourd'hui ?",
        labelEn: "What stack do you work with today?",
        required: true,
      },
      {
        id: "opensource",
        labelFr: "Un dépôt public dont vous êtes fier ?",
        labelEn: "A public repository you are proud of?",
        required: false,
      },
    ],
    couvre: "l'offre normale, celle qui porte le gros du volume",
  },
  {
    cle: "formateur-ia-itinerant",
    titre: "Formateur / Intervenant IA en entreprise (F/H)",
    categorie: "conseil",
    statut: "published",
    mode: "on_site",
    ville: "Lyon",
    deposeeIlYaJours: 30,
    pourvue: false,
    permisRequis: true,
    vehiculeRequis: true,
    questions: DOUZE_QUESTIONS,
    couvre: "permis + véhicule affichés, et douze questions de présélection",
  },
  {
    cle: "office-manager",
    titre: "Office Manager (F/H)",
    categorie: "operations",
    statut: "draft",
    mode: "on_site",
    ville: "Grenoble",
    deposeeIlYaJours: 3,
    pourvue: false,
    permisRequis: false,
    vehiculeRequis: false,
    questions: [],
    couvre: "un brouillon — ne doit apparaître ni sur le site ni dans le sitemap",
  },
  {
    cle: "comptable-raf",
    titre: "Comptable / Responsable administratif et financier (F/H)",
    categorie: "operations",
    statut: "archived",
    mode: "hybrid",
    ville: "Grenoble",
    deposeeIlYaJours: 240,
    pourvue: false,
    permisRequis: false,
    vehiculeRequis: false,
    questions: [],
    couvre: "une offre archivée qui garde ses candidatures",
  },
  {
    cle: "designer-ux-ui",
    titre: "Designer UX/UI (F/H)",
    categorie: "design",
    statut: "published",
    mode: "remote",
    ville: null,
    deposeeIlYaJours: 90,
    pourvue: true,
    permisRequis: false,
    vehiculeRequis: false,
    questions: [
      {
        id: "portfolio",
        labelFr: "Lien vers votre portfolio",
        labelEn: "Link to your portfolio",
        required: true,
      },
    ],
    couvre: "une offre POURVUE — la mention « pourvu » et la sortie du sitemap",
  },
  {
    cle: "charge-relations-presse",
    titre: "Chargé de relations presse (F/H)",
    categorie: "marketing",
    statut: "published",
    mode: "hybrid",
    ville: "Paris",
    deposeeIlYaJours: 400,
    pourvue: false,
    permisRequis: false,
    vehiculeRequis: false,
    questions: [],
    couvre: "une offre PÉRIMÉE pour Google — le bandeau de fraîcheur et le cron hebdo",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Les candidatures
// ─────────────────────────────────────────────────────────────────────────────

const PRENOMS = [
  "Camille",
  "Sofia",
  "Malik",
  "Élodie",
  "Thomas",
  "Nadia",
  "Youssef",
  "Claire",
  "Antoine",
  "Rachida",
  "Léa",
  "Baptiste",
  "Fatou",
  "Hugo",
  "Inès",
  "Mehdi",
  "Julie",
  "Karim",
  "Amandine",
  "Vincent",
] as const;

const NOMS = [
  "Rousseau",
  "Benali",
  "Marchand",
  "Dufour",
  "Nguyen",
  "Lemoine",
  "Ferreira",
  "Bouchard",
  "Sanchez",
  "Perrin",
  "Diallo",
  "Moreau",
  "Chevalier",
  "Ostrowski",
  "Bianchi",
  "Renaud",
  "Toussaint",
  "Vasseur",
  "Lemaire",
  "Cordier",
] as const;

const VILLES = [
  "Grenoble",
  "Lyon",
  "Chambéry",
  "Valence",
  "Annecy",
  "Saint-Étienne",
  "Villeurbanne",
  "Voiron",
  "Paris",
  "Bordeaux",
] as const;

const EXPERIENCES = ["0-2 ans", "3-5 ans", "6-10 ans", "10 ans et plus"] as const;
const DISPOS = ["Immédiate", "Sous 1 mois", "Sous 3 mois", "À partir de janvier"] as const;
/**
 * Combien de candidatures dans chaque statut. La somme fait 60.
 *
 * 🔑 SOURCE UNIQUE : la liste des statuts se DÉDUIT de ce tableau
 * (`StatutCandidature` ci-dessous), elle n'est pas écrite une seconde fois à
 * côté. Une énumération recopiée et une répartition finissent toujours par
 * diverger — et c'est la recopie qu'on lit, jamais celle qui est appliquée.
 */
const REPARTITION = [
  ["new", 18],
  ["reviewing", 14],
  ["shortlisted", 10],
  ["rejected", 12],
  ["hired", 3],
  ["archived", 3],
] as const;

type StatutCandidature = (typeof REPARTITION)[number][0];

interface CandidatureDemo {
  readonly cle: string;
  readonly offre: string;
  readonly statut: StatutCandidature;
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly ville: string;
  readonly deposeeIlYaJours: number;
  readonly avecCv: boolean;
  readonly photoHeic: boolean;
  readonly reponsesCompletes: boolean;
  readonly consentVivier: boolean;
  readonly opposition: boolean;
}

/**
 * Le jeu de données, DÉRIVÉ et non tiré au sort.
 *
 * Les cas limites ne sont pas laissés au hasard : ils sont NOMMÉS, parce qu'un
 * jeu aléatoire qui « contient probablement » le cas d'une candidature sans CV
 * ne le contient pas les jours où il ne le contient pas — et c'est ce jour-là
 * qu'on conclut qu'un écran fonctionne.
 */
function construireCandidatures(): readonly CandidatureDemo[] {
  const liste: CandidatureDemo[] = [];
  let i = 0;

  for (const [statut, combien] of REPARTITION) {
    for (let n = 0; n < combien; n++, i++) {
      const cle = `cand-${statut}-${n}`;
      const offre = OFFRES[tirage(`${cle}:offre`, OFFRES.length)]!.cle;
      const prenom = PRENOMS[tirage(`${cle}:prenom`, PRENOMS.length)]!;
      const nom = NOMS[tirage(`${cle}:nom`, NOMS.length)]!;

      liste.push({
        cle,
        offre,
        statut,
        prenom,
        nom,
        // Adresse dérivée de la clé, donc unique — les doublons sont posés plus bas.
        email: `${cle}@${DOMAINE_DEMO}`,
        ville: VILLES[tirage(`${cle}:ville`, VILLES.length)]!,
        // Les cinq premières dépassent 25 mois : elles éprouvent la purge.
        deposeeIlYaJours: i < 5 ? 780 + i * 10 : 1 + tirage(`${cle}:age`, 300),
        // Huit candidatures sans CV — l'écran doit dire « Sans CV », pas rien.
        avecCv: i >= 8,
        // Trois photos au format iPhone, qu'aucun navigateur hors Safari
        // n'affiche : la fiche doit proposer le téléchargement, pas une image
        // cassée.
        photoHeic: i >= 8 && i < 11,
        reponsesCompletes: offre === "formateur-ia-itinerant" && n === 0,
        consentVivier: i % 15 === 3,
        opposition: i === 7 || i === 23,
      });
    }
  }

  // Deux doublons d'adresse — le cas que la recherche par e-mail doit savoir
  // rendre, et que l'empreinte HMAC rend trouvable.
  const doublon = `doublon@${DOMAINE_DEMO}`;
  liste[12] = { ...liste[12]!, email: doublon };
  liste[41] = { ...liste[41]!, email: doublon };

  // 🔑 LE TÉMOIN DE LA DÉCISION D4, et il est posé EXPLICITEMENT.
  //
  // Une première version se contentait de vieillir les cinq premières entrées
  // en espérant que l'une soit `hired`. Elle ne l'était pas : la répartition
  // commence par dix-huit `new`, donc les cinq plus anciennes étaient toutes
  // `new`, et le compte-rendu du seed annonçait un témoin qui n'existait pas.
  // Une donnée « probablement présente » est absente les jours où elle l'est —
  // et c'est ce jour-là qu'on conclut qu'une purge est correcte.
  //
  // Cette candidature-ci est RECRUTÉE et déposée il y a plus de deux ans : la
  // passe de rétention doit la laisser intacte. C'est la preuve vivante, en
  // base, de ce que `les-dossiers-recrutes-ne-sont-jamais-purges.spec.ts`
  // affirme sur le code.
  const premierRecrute = liste.findIndex((c) => c.statut === "hired");
  liste[premierRecrute] = { ...liste[premierRecrute]!, deposeeIlYaJours: 810 };

  return liste;
}

/** Seuil au-delà duquel la purge de rétention s'applique — 24 mois. */
const SEUIL_PURGE_JOURS = 24 * 30.44;

/**
 * Ce que le jeu de données contient VRAIMENT, recompté à chaque exécution.
 *
 * 🔑 Le compte-rendu du seed est DÉRIVÉ, jamais rédigé à la main. La première
 * version annonçait « 5 de plus de 25 mois dont une recrutée » ; il y en avait
 * zéro. Un bandeau écrit en dur décrit les intentions de son auteur, pas la
 * base qu'il vient d'écrire — et on le lit comme une vérification.
 */
function inventaire(liste: readonly CandidatureDemo[]) {
  const vieilles = liste.filter((c) => c.deposeeIlYaJours > SEUIL_PURGE_JOURS);
  const adresses = new Map<string, number>();
  for (const c of liste) adresses.set(c.email, (adresses.get(c.email) ?? 0) + 1);

  return {
    total: liste.length,
    sansCv: liste.filter((c) => !c.avecCv).length,
    photosHeic: liste.filter((c) => c.photoHeic).length,
    doublons: [...adresses.values()].filter((n) => n > 1).length,
    purgeables: vieilles.filter((c) => c.statut !== "hired").length,
    recrutesEpargnes: vieilles.filter((c) => c.statut === "hired").length,
    accordsVivier: liste.filter((c) => c.consentVivier).length,
    oppositions: liste.filter((c) => c.opposition).length,
    fichesChargees: liste.filter((c) => c.reponsesCompletes).length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Écriture
// ─────────────────────────────────────────────────────────────────────────────

/** Un PDF minimal mais VALIDE — un octet aléatoire ne s'ouvrirait pas. */
const PDF_DEMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);

/** Une image de démonstration — le contenu importe peu, le type MIME décide. */
const IMAGE_DEMO = Buffer.from("HEIC-demo-recette", "utf8");

interface Resultat {
  offres: number;
  candidatures: number;
  fichiers: number;
}

export async function ecrireScenariosRecrutement(prisma: PrismaClient): Promise<Resultat> {
  const [{ encryptPii }, { hashEmailForLookup }, { storeCv }] = await Promise.all([
    import("../../../src/lib/pii-crypto"),
    import("../../../src/lib/security/email-hash"),
    import("../../../src/server/careers/cv-storage"),
  ]);

  const resultat: Resultat = { offres: 0, candidatures: 0, fichiers: 0 };
  const idParCle = new Map<string, string>();

  for (const offre of OFFRES) {
    const slug = `${PREFIXE_RECRUTEMENT}-${offre.cle}`;
    const id = idDerive(`offre:${offre.cle}`);
    const posee = ilYA(offre.deposeeIlYaJours);
    const donnees = {
      slug,
      status: offre.statut,
      category: offre.categorie,
      titleFr: offre.titre,
      titleEn: offre.titre,
      summaryFr: `Offre de démonstration — ${offre.couvre}.`,
      summaryEn: `Demo posting — ${offre.couvre}.`,
      bodyFr: `<p>Offre de démonstration du socle de recette. ${offre.couvre}.</p>`,
      bodyTextFr: `Offre de démonstration du socle de recette. ${offre.couvre}.`,
      bodyEn: `<p>Demo posting for the acceptance fixture. ${offre.couvre}.</p>`,
      bodyTextEn: `Demo posting for the acceptance fixture. ${offre.couvre}.`,
      workMode: offre.mode,
      city: offre.ville,
      requiresDriverLicense: offre.permisRequis,
      requiresVehicle: offre.vehiculeRequis,
      screeningQuestions: offre.questions as unknown as object,
      datePosted: posee,
      publishedAt: offre.statut === "published" ? posee : null,
      filledAt: offre.pourvue ? ilYA(5) : null,
    };

    // ⚠️ `upsert` par ID DÉRIVÉ, jamais par slug seul : c'est ce qui garantit
    // qu'une seconde exécution met à jour la même ligne au lieu d'en créer une.
    await prisma.jobOffer.upsert({
      where: { id },
      create: { id, ...donnees },
      update: donnees,
    });
    idParCle.set(offre.cle, id);
    resultat.offres++;
  }

  for (const c of construireCandidatures()) {
    const offre = OFFRES.find((o) => o.cle === c.offre)!;
    const offreId = idParCle.get(c.offre)!;
    const id = idDerive(`candidature:${c.cle}`);
    const deposee = ilYA(c.deposeeIlYaJours);

    // Pièces jointes : on RÉUTILISE ce qui est déjà sur le disque. `storeCv`
    // crée un dossier neuf à chaque appel — le rappeler sans précaution ferait
    // fuir un fichier orphelin à chaque exécution du seed.
    const existante = await prisma.jobApplication.findUnique({
      where: { id },
      select: { cvStoragePath: true, photoStoragePath: true },
    });

    let cheminCv = existante?.cvStoragePath ?? null;
    if (c.avecCv && (cheminCv === null || !existsSync(cheminCv))) {
      cheminCv = await storeCv(PDF_DEMO, `cv-${c.prenom}-${c.nom}.pdf`);
      resultat.fichiers++;
    }

    let cheminPhoto = existante?.photoStoragePath ?? null;
    if (c.photoHeic && (cheminPhoto === null || !existsSync(cheminPhoto))) {
      cheminPhoto = await storeCv(IMAGE_DEMO, `photo-${c.prenom}-${c.nom}.heic`);
      resultat.fichiers++;
    }

    const reponses: Record<string, string> = {};
    if (c.reponsesCompletes) {
      for (const q of offre.questions)
        reponses[q.id] = `Réponse de démonstration à « ${q.labelFr} »`;
    } else if (offre.questions.length > 0) {
      const premiere = offre.questions[0]!;
      reponses[premiere.id] = "Réponse de démonstration.";
    }

    const donnees = {
      offerId: offreId,
      offerTitleSnap: offre.titre,
      civility: c.prenom.endsWith("e") ? "Mme" : "M.",
      firstName: encryptPii(c.prenom),
      lastName: encryptPii(c.nom),
      email: encryptPii(c.email),
      emailHash: hashEmailForLookup(c.email),
      phone: encryptPii(`+336${String(10_000_000 + tirage(c.cle, 89_999_999)).slice(0, 8)}`),
      city: c.ville,
      motivation: `Bonjour, je suis très intéressé par le poste de ${offre.titre.replace(" (F/H)", "")}. (Candidature de démonstration — socle de recette.)`,
      currentRole: "Poste actuel de démonstration",
      experienceBand: EXPERIENCES[tirage(`${c.cle}:exp`, EXPERIENCES.length)]!,
      availability: DISPOS[tirage(`${c.cle}:dispo`, DISPOS.length)]!,
      linkedinUrl: `https://www.linkedin.com/in/${c.cle}`,
      hasDriverLicense: offre.permisRequis ? tirage(`${c.cle}:permis`, 4) > 0 : null,
      hasVehicle: offre.vehiculeRequis ? tirage(`${c.cle}:vehicule`, 3) > 0 : null,
      answers: reponses as unknown as object,
      cvStoragePath: cheminCv,
      cvOriginalName: cheminCv ? `cv-${c.prenom}-${c.nom}.pdf` : null,
      cvMimeType: cheminCv ? "application/pdf" : null,
      cvSizeBytes: cheminCv ? PDF_DEMO.length : null,
      photoStoragePath: cheminPhoto,
      photoOriginalName: cheminPhoto ? `photo-${c.prenom}-${c.nom}.heic` : null,
      // 🔑 Le type qui compte : aucun navigateur hors Safari ne rend le HEIC.
      // La fiche doit proposer un téléchargement, pas une image cassée.
      photoMimeType: cheminPhoto ? "image/heic" : null,
      salaryExpectation: `${38 + tirage(`${c.cle}:salaire`, 20)} k€`,
      consentVersion: "careers-v2-2026-08-13",
      locale: "fr" satisfies Locale as Locale,
      consentVivierAt: c.consentVivier ? deposee : null,
      vivierInfoSentAt: c.opposition ? ilYA(20) : null,
      vivierOpposedAt: c.opposition ? ilYA(18) : null,
      status: c.statut,
      internalNotes: c.statut === "reviewing" ? "Note interne de démonstration." : null,
      needsAttention: c.statut === "new",
      submittedAt: deposee,
    };

    await prisma.jobApplication.upsert({
      where: { id },
      create: { id, ...donnees },
      update: donnees,
    });
    resultat.candidatures++;
  }

  return resultat;
}

/**
 * Retire tout ce que ce seed a écrit, et RIEN d'autre.
 *
 * 🔑 Le périmètre est le préfixe de slug, jamais une date ni un domaine
 * d'adresse : une candidature est supprimée parce qu'elle appartient à une
 * offre de démonstration, ce qui est vérifiable en une requête.
 */
export async function purgerScenariosRecrutement(prisma: PrismaClient): Promise<number> {
  const { deleteCv } = await import("../../../src/server/careers/cv-storage");

  const candidatures = await prisma.jobApplication.findMany({
    where: { offer: { slug: { startsWith: `${PREFIXE_RECRUTEMENT}-` } } },
    select: { id: true, cvStoragePath: true, photoStoragePath: true },
  });
  // Fichiers d'abord : supprimer la ligne en premier perdrait le chemin, donc
  // rendrait la pièce introuvable — donc ineffaçable. Même ordre que la purge
  // de rétention, pour la même raison.
  for (const c of candidatures) {
    await deleteCv(c.cvStoragePath);
    await deleteCv(c.photoStoragePath);
  }
  await prisma.jobOffer.deleteMany({
    where: { slug: { startsWith: `${PREFIXE_RECRUTEMENT}-` } },
  });
  return candidatures.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const verdict = cibleAutorisee({
    DATABASE_URL: process.env["DATABASE_URL"],
    NODE_ENV: process.env["NODE_ENV"],
  });
  if (!verdict.ok) {
    console.error(`\n⛔ Socle de recette REFUSÉ — ${verdict.raison}\n   ${verdict.message}\n`);
    process.exit(1);
  }

  const { PrismaClient: Client } = await import("../../generated/client");
  const prisma = new Client() as unknown as PrismaClient;

  try {
    if (process.argv.includes("--purge")) {
      const retirees = await purgerScenariosRecrutement(prisma);
      console.log(
        `\n✅ [recrutement:seed-scenarios] ${retirees} candidature(s) et les offres ` +
          `${PREFIXE_RECRUTEMENT}-* retirées de ${verdict.base}.\n`,
      );
      return;
    }

    const r = await ecrireScenariosRecrutement(prisma);
    console.log(`\n✅ [recrutement:seed-scenarios] Écrit sur ${verdict.base}.\n`);
    console.log(`   Offres         ${r.offres}`);
    for (const o of OFFRES) {
      console.log(`     · ${`${PREFIXE_RECRUTEMENT}-${o.cle}`.padEnd(34)} ${o.couvre}`);
    }
    console.log(`   Candidatures   ${r.candidatures}`);
    console.log(`   Pièces écrites ${r.fichiers} (les suivantes seront réutilisées)`);

    // Compte-rendu DÉRIVÉ du jeu de données réellement construit.
    const inv = inventaire(construireCandidatures());
    console.log(`\n   Cas limites RECOMPTÉS :`);
    console.log(`     · sans CV                        ${inv.sansCv}`);
    console.log(`     · photos HEIC (non affichables)  ${inv.photosHeic}`);
    console.log(`     · adresses en doublon            ${inv.doublons}`);
    console.log(`     · au-delà des 24 mois, purgeables ${inv.purgeables}`);
    console.log(
      `     · au-delà des 24 mois, RECRUTÉES ${inv.recrutesEpargnes}` +
        `  ← témoin D4 : doit survivre à la purge`,
    );
    console.log(`     · accords vivier                 ${inv.accordsVivier}`);
    console.log(`     · oppositions posées             ${inv.oppositions}`);
    console.log(`     · fiches à 12 réponses           ${inv.fichesChargees}\n`);

    if (inv.recrutesEpargnes === 0) {
      // 🔴 Le seed REFUSE de se déclarer réussi sans son témoin. Sans lui, la
      // recette de la purge se ferait sur une base qui ne contient pas le cas
      // qu'elle prétend vérifier — exactement le défaut que ce message existe
      // pour empêcher de reproduire.
      console.error(
        "⛔ aucune candidature RECRUTÉE au-delà de 24 mois : le témoin de la " +
          "décision D4 n'est pas dans le jeu de données.",
      );
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuté seulement quand CE fichier est le point d'entrée — les tests et les
// parcours importent ses fonctions sans déclencher d'écriture.
//
// 🔴 La première version testait `argv[1].includes("recrutement")`. C'est trop
// large : `tests/e2e/flows/recrutement.spec.ts` contient le mot. Un parcours qui
// importerait une constante d'ici aurait lancé le seed COMPLET au milieu d'une
// suite de tests, en écrivant soixante candidatures sans que personne ne l'ait
// demandé.
//
// On compare l'URL du MODULE à celle du point d'entrée : c'est l'idiome
// portable, et il ne dépend d'aucune convention de séparateur. Une première
// tentative comparait les chemins en texte ; l'échappement de l'antislash
// Windows y a produit une expression régulière qui ne remplaçait rien, donc
// une condition toujours fausse — le seed ne s'exécutait plus du tout, en
// silence. Un test manuel l'a vu ; rien d'automatique ne l'aurait vu.
const pointEntree = process.argv[1] ?? "";
if (import.meta.url === pathToFileURL(pointEntree).href) {
  void main();
}
