/**
 * `admin-job-applications/reads.ts` — **LA LECTURE DES CANDIDATURES, SANS SESSION.**
 *
 * ⚠️ **CE FICHIER N'EST PAS UN MODULE `"use server"`, ET C'EST TOUT LE POINT.**
 *    Dans un fichier de Server Actions, *chaque export devient un point d'entrée
 *    réseau*. Une lecture sans garde de session exportée depuis `actions.ts`
 *    serait appelable depuis n'importe quel navigateur.
 *
 * Même motif que `admin-submissions/reads.ts` : `listApplicationsAction`
 * commençait par `requireAdminRead()`, qui appelle `auth()` — lequel lit un
 * **cookie de navigateur**. La boîte de réception
 * (`admin-inbox/queries.ts:158`) passait par cette action, donc elle exigeait
 * une session de navigateur qu'un appel MCP n'a pas.
 *
 * ⚠️ **CETTE EXTRACTION N'ÉLARGIT RIEN.** Le corps est déplacé sans une
 *    modification, et `listApplicationsAction` garde sa garde à l'identique.
 *
 * Y vivent aussi les trois choses dont la lecture a besoin et qu'un module
 * `"use server"` ne peut pas exporter : la liste des statuts, le schéma de
 * filtres, et le déchiffrement tolérant. Elles n'ont pas été dupliquées —
 * `actions.ts` les importe désormais d'ici, pour qu'il n'y en ait qu'une
 * écriture.
 */

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/client-ip";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { decryptPii } from "@/lib/pii-crypto";
import { VIDEO_EDITOR_OFFER_SLUG } from "@/lib/careers/video-editor-offer";
import type { JobApplicationStatus, Prisma } from "../../../prisma/generated/client";
import { STATUTS_CANDIDATURE } from "@/content/recrutement/statuts";

/**
 * Les statuts, RÉEXPORTÉS depuis la table unique.
 *
 * 🔴 Cette liste était une TROISIÈME copie tenue à la main, et elle a vécu
 * exactement le défaut qu'on redoutait : l'enum Postgres portait six valeurs,
 * cette liste six aussi — mais rien ne les reliait. Le jour où l'enum en a
 * gagné trois (`interview`, `offer`, `withdrawn`), le filtre de la liste serait
 * resté aveugle à trois états REÉLLEMENT présents en base, sans qu'aucun test
 * ne rougisse.
 *
 * Le nom anglais est conservé : une trentaine d'appelants l'utilisent, et un
 * renommage cosmétique noierait ce lot dans un diff sans rapport.
 */
export const STATUSES = STATUTS_CANDIDATURE;

/**
 * Déchiffre sans jamais faire tomber la page. Un PII corrompu rend une chaîne
 * lisible plutôt qu'une exception : l'écran doit rester consultable même quand
 * une ligne est illisible.
 */
export function safeDecrypt(v: string): string {
  try {
    return decryptPii(v);
  } catch {
    return "[déchiffrement échoué]";
  }
}

/**
 * Sentinelle du filtre « aucune offre » (candidature spontanée, ou offre
 * depuis supprimée — cf. `getOffresAvecCandidatures` plus bas, où les deux
 * cas se regroupent). Déclarée ICI, avant le schéma qui la consomme : une
 * `const` référencée dans son propre module avant son initialisation lève à
 * l'import, pas à l'usage — l'aurait laissée après `listApplicationsSchema`
 * cassé le chargement de CE fichier entier, pour tous ses appelants.
 */
export const AUCUNE_OFFRE_ID = "spontanee";

export const listApplicationsSchema = z.object({
  offerId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.union([z.string().uuid(), z.literal(AUCUNE_OFFRE_ID)]).optional(),
  ),
  status: z.enum([...STATUSES, "all"]).default("all"),
  // Vues séparées (demande Will 2026-08-12) : la vue standard EXCLUT l'offre
  // monteur vidéo freelance, qui a son propre onglet. L'onglet « Toutes »
  // (demande Will 2026-08-13) passe `all` : aucune contrainte d'offre.
  // Le défaut reste `standard` — la boîte de réception unifiée appelle cette
  // action sans `view` et son canal Candidatures ne doit pas changer de
  // périmètre en silence.
  view: z.enum(["standard", "monteur", "all"]).default("standard"),
  onlyAttention: z.coerce.boolean().optional(),
  /**
   * Recherche libre sur le nom et l'adresse.
   *
   * 🔴 ELLE NE PEUT PAS ÊTRE UNE CLAUSE SQL. `firstName`, `lastName` et `email`
   * sont CHIFFRÉS en base (`enc:v1`, IV aléatoire) : un `contains` dessus ne
   * correspondrait jamais, et il ne lèverait aucune erreur — l'écran rendrait
   * simplement « aucun résultat » pour un candidat qui existe. Elle s'applique
   * donc APRÈS déchiffrement, sur un balayage borné. Même mécanique que la
   * boîte de réception, dont c'est le seul chemin possible depuis le
   * chiffrement des PII.
   */
  search: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(200).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export type ListApplicationsInput = z.infer<typeof listApplicationsSchema>;

export interface JobApplicationListItem {
  id: string;
  /**
   * 🔴 `null` QUAND LA CANDIDATURE N'A PLUS — OU N'A JAMAIS EU — D'OFFRE.
   *
   * Deux causes, et le type ne les distingue pas volontairement : l'offre a été
   * supprimée (`ON DELETE SET NULL`, lot 6 — elle n'emporte plus le dossier), ou
   * la candidature est spontanée. Dans les deux cas il n'y a pas de fiche
   * d'offre à ouvrir, et c'est la seule chose que l'écran doit savoir.
   *
   * ⚠️ `offerTitleSnap` reste renseigné dans les deux cas : c'est l'instantané
   * du poste, figé à la soumission. On sait donc TOUJOURS pour quel poste la
   * personne a postulé, même sans offre — c'est tout l'intérêt d'un instantané.
   */
  offerId: string | null;
  offerTitleSnap: string;
  /**
   * 🔴 `null` QUAND L'APPELANT N'A PAS LE DROIT D'OUVRIR LE DOSSIER.
   *
   * Le type le dit, plutôt qu'une chaîne vide : un consommateur qui l'oublie
   * est signalé par le compilateur, là où `""` se serait affiché sans un mot.
   */
  contactName: string | null;
  contactEmail: string | null;
  status: JobApplicationStatus;
  hasCv: boolean;
  needsAttention: boolean;
  submittedAt: Date;
}

export interface JobApplicationListResult {
  items: JobApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /**
   * `true` quand la recherche a mordu son plafond de balayage : des
   * candidatures plus anciennes n'ont PAS été examinées. L'écran doit le dire.
   */
  balayageTronque: boolean;
}

/**
 * Le droit d'ouvrir un dossier de candidat, et la trace de son ouverture.
 *
 * 🔴 **AUCUNE VALEUR PAR DÉFAUT, ET C'EST LE CŒUR DU CORRECTIF.** Extraire
 *    cette lecture de son action lui avait retiré `requireAdminRead()`, donc le
 *    prédicat `peutOuvrirDossierCandidat` — et la Boîte de réception servait de
 *    nouveau le nom et l'adresse de chaque candidat à tous les rôles, y compris
 *    `reader`. C'est exactement le défaut du 2026-08-25 (cahier D6-1), rouvert
 *    par le lot 4a et rattrapé par la garde `dossier-candidat-cloisonne`.
 *    Sans défaut, le compilateur oblige chaque appelant à TRANCHER.
 */
/**
 * Plafond du balayage déchiffrant de la recherche.
 *
 * 🔴 C'est une VRAIE limite, pas une précaution de style : au-delà de ce
 * nombre de candidatures (déjà filtrées par offre / statut / vue), les plus
 * anciennes ne sont pas examinées et deviennent introuvables PAR LA RECHERCHE
 * — elles restent atteignables par les filtres et la pagination. Deux mille
 * est très large au regard du volume réel ; le jour où il ne le serait plus,
 * `balayageTronque` le dira à l'écran au lieu de laisser croire à une absence.
 */
export const PLAFOND_BALAYAGE_RECHERCHE = 2_000;

/** Terme normalisé, ou `null` s'il est trop court pour rendre autre chose que du bruit. */
export function normaliserRecherche(terme: string | undefined): string | null {
  const t = terme?.trim().toLowerCase();
  return t && t.length >= 2 ? t : null;
}

/**
 * La correspondance, appliquée APRÈS déchiffrement.
 *
 * 🔑 Partagée par le listing ET l'export : sans elle écrite une seule fois,
 * exporter depuis un écran filtré par nom ramènerait tout le stock — c'est le
 * défaut exact qui avait été corrigé côté boîte de réception.
 */
export function matchCandidatureSearch(
  ligne: { prenom: string; nom: string; email: string },
  terme: string,
): boolean {
  return (
    ligne.prenom.toLowerCase().includes(terme) ||
    ligne.nom.toLowerCase().includes(terme) ||
    `${ligne.prenom} ${ligne.nom}`.toLowerCase().includes(terme) ||
    ligne.email.toLowerCase().includes(terme)
  );
}

/**
 * LE FILTRE SQL DE LA LISTE — construit ici, et ici seulement.
 *
 * 🔴 Il est EXTRAIT parce que l'export CSV doit refléter **exactement** l'écran
 * depuis lequel on le lance. Deux constructions de `where` tenues à la main
 * divergeraient à la première option ajoutée, et personne ne le verrait : le
 * fichier sortirait, plus gros ou plus petit que la liste, sans une erreur.
 *
 * Il rend aussi le terme de recherche BRUT, parce que celui-ci ne peut pas
 * entrer dans le `where` : les colonnes concernées sont chiffrées.
 */
export function construireFiltreCandidatures(input: Partial<ListApplicationsInput> = {}): {
  where: Record<string, unknown>;
  recherche: string | undefined;
  parsed: ListApplicationsInput;
} {
  const parsed = listApplicationsSchema.parse(input);
  const where: Record<string, unknown> = {};
  // 🔴 `AUCUNE_OFFRE_ID` filtre EXPLICITEMENT `offerId IS NULL` (sélecteur
  // « Candidature spontanée ») — distinct d'un `offerId` absent, qui ne
  // contraint rien. Confondre les deux aurait fait du filtre « spontanée » un
  // filtre muet : `where.offerId = "spontanee"` ne correspondrait à AUCUNE
  // ligne, la colonne étant un UUID.
  if (parsed.offerId === AUCUNE_OFFRE_ID) where.offerId = null;
  else if (parsed.offerId) where.offerId = parsed.offerId;
  if (parsed.status !== "all") where.status = parsed.status;
  if (parsed.onlyAttention) where.needsAttention = true;
  if (parsed.view === "monteur") {
    where.offer = { slug: VIDEO_EDITOR_OFFER_SLUG };
  } else if (parsed.view === "standard" && !parsed.offerId) {
    // Vue standard sans filtre d'offre explicite : les candidatures monteur
    // vidéo restent dans leur onglet. Un `offerId` explicite (lien depuis la
    // fiche offre) garde la priorité et n'est pas amputé.
    where.offer = { slug: { not: VIDEO_EDITOR_OFFER_SLUG } };
  }
  return { where, recherche: parsed.search, parsed };
}

export interface AccesDossierCandidat {
  /**
   * Le rôle au nom duquel on lit — **pas** un booléen déjà tranché.
   *
   * 🔑 C'est ce fichier qui appelle `peutOuvrirDossierCandidat`, et c'est
   *    délibéré : recevoir un `true` déjà calculé rendrait le cloisonnement
   *    dépendant de la rigueur de chaque appelant, et un `true` posé par erreur
   *    ne se verrait nulle part. Le rôle, lui, ne peut pas mentir sur lui-même.
   *    `null` (aucun rôle établi) ⇒ refus, comme pour un rôle inconnu.
   */
  readonly role: string | null;
  /**
   * Qui consulte, pour la trace. `null` quand l'appel n'a pas de session
   * (adaptateur MCP) : la trace porte alors l'absence d'acteur plutôt que
   * d'inventer un identifiant.
   */
  readonly acteurId: string | null;
}

/**
 * **LE CORPS DE `listApplicationsAction`, MOT POUR MOT, MOINS SA GARDE DE SESSION.**
 *
 * Ne l'appeler que depuis un contexte qui a DÉJÀ établi *qui* appelle :
 * `listApplicationsAction` (session de navigateur) ou le handler `/api/mcp`
 * (secret partagé). Ce fichier ne lit aucune session — mais il EXIGE que le
 * droit ait été tranché, et il le fait respecter.
 */
export async function listApplications(
  input: Partial<ListApplicationsInput> = {},
  acces: AccesDossierCandidat,
): Promise<JobApplicationListResult> {
  const { where, recherche, parsed } = construireFiltreCandidatures(input);
  const terme = normaliserRecherche(recherche);

  const SELECTION = {
    id: true,
    offerId: true,
    offerTitleSnap: true,
    firstName: true,
    lastName: true,
    email: true,
    status: true,
    cvStoragePath: true,
    needsAttention: true,
    submittedAt: true,
  } as const;

  // ── DEUX CHEMINS, ET LE SECOND N'EST PAS UN LUXE ──────────────────────────
  //
  // Sans terme : Postgres compte et pagine, comme avant — rien ne change.
  //
  // Avec terme : le filtre porte sur des colonnes CHIFFRÉES. Aucune clause SQL
  // ne peut l'exprimer, et une clause qui essaierait ne lèverait rien : elle
  // rendrait « aucun résultat » pour un candidat qui existe. On balaie donc un
  // nombre BORNÉ de lignes les plus récentes (parmi celles qui passent déjà les
  // autres filtres), on déchiffre, on filtre, puis on pagine en mémoire.
  //
  // ⚠️ Le plafond est une VRAIE limite, pas une précaution : au-delà, un
  // candidat ancien devient introuvable par la recherche. Il est dit à
  // l'appelant (`balayageTronque`) plutôt que tu, pour que l'écran puisse le
  // dire à son tour — une recherche qui ment par omission est pire qu'une
  // recherche absente.
  let total: number;
  let rows: Array<Prisma.JobApplicationGetPayload<{ select: typeof SELECTION }>>;
  let balayageTronque = false;

  if (terme) {
    const balayees = await prisma.jobApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }],
      take: PLAFOND_BALAYAGE_RECHERCHE,
      select: SELECTION,
    });
    balayageTronque = balayees.length === PLAFOND_BALAYAGE_RECHERCHE;
    const retenues = balayees.filter((r) =>
      matchCandidatureSearch(
        {
          prenom: safeDecrypt(r.firstName),
          nom: safeDecrypt(r.lastName),
          email: safeDecrypt(r.email),
        },
        terme,
      ),
    );
    total = retenues.length;
    const debut = (parsed.page - 1) * parsed.pageSize;
    rows = retenues.slice(debut, debut + parsed.pageSize);
  } else {
    // 🔴 2026-09-23 — TRIÉ PAR OFFRE quand la vue « Toutes » (34 offres, aucune
    // vue mono-offre choisie) est lue SANS offre ni recherche. Mesuré en prod :
    // 164 candidatures triées par seule date ressemblent à un tas — la même
    // offre revient toutes les cinq lignes, jamais groupée. Trier par
    // `offerTitleSnap` d'abord rend les 34 métiers contigus à l'écran, sans
    // toucher à la pagination ni au total.
    //
    // ⚠️ Restreint à `view === "all"` SANS `offerId` : la Boîte de réception
    // (`admin-inbox/queries.ts`) et les vues mono-offre (`monteur`, `standard`,
    // lien depuis une fiche d'offre) veulent la chronologie pure — leur
    // comportement ne bouge pas d'un octet.
    const trierParOffre = parsed.view === "all" && !parsed.offerId;
    const orderBy = trierParOffre
      ? [{ offerTitleSnap: "asc" as const }, { submittedAt: "desc" as const }]
      : [{ submittedAt: "desc" as const }];
    const [compte, page] = await Promise.all([
      prisma.jobApplication.count({ where }),
      prisma.jobApplication.findMany({
        where,
        orderBy,
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
        select: SELECTION,
      }),
    ]);
    total = compte;
    rows = page;
  }

  // ── LE CLOISONNEMENT, ICI ET NULLE PART AILLEURS ──────────────────────────
  //    Les lignes restent — compteurs et chronologie justes, comme pour le canal
  //    « appel » depuis le 2026-08-27. L'identité, non : sans le droit, elle ne
  //    sort pas de cette fonction, et `hasCv` non plus (savoir qu'un CV existe
  //    est déjà une information sur la personne).
  // Le prédicat COMMUN, appelé ici — jamais une liste de rôles recopiée : le
  // dépôt en a soldé vingt-neuf copies, et c'est la divergence entre copies qui
  // avait laissé la pièce jointe mieux protégée que l'identité qu'elle porte.
  const ouvert = peutOuvrirDossierCandidat(acces.role);
  const items: JobApplicationListItem[] = rows.map((r) => ({
    id: r.id,
    offerId: r.offerId,
    offerTitleSnap: r.offerTitleSnap,
    contactName: ouvert ? `${safeDecrypt(r.firstName)} ${safeDecrypt(r.lastName)}`.trim() : null,
    contactEmail: ouvert ? safeDecrypt(r.email) : null,
    status: r.status,
    hasCv: ouvert ? Boolean(r.cvStoragePath) : false,
    needsAttention: r.needsAttention,
    submittedAt: r.submittedAt,
  }));

  // ── LA TRACE — ce qui rend l'accès défendable ─────────────────────────────
  //    Écrite seulement quand des identités sont réellement sorties. Une liste
  //    cloisonnée ne montre personne : la journaliser noierait les vraies
  //    consultations sous du bruit.
  //
  //    ⚠️ Best-effort, comme partout ailleurs dans le dépôt : un journal
  //    indisponible ne doit pas priver le recruteur de sa liste.
  if (ouvert && items.length > 0) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId: acces.acteurId,
          action: "careers.candidature.liste.consultee",
          targetType: "JobApplication",
          targetId: null,
          ipAddress: await getClientIp(),
        },
      });
    } catch {
      // silence volontaire : cf. ci-dessus
    }
  }

  return {
    items,
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
    balayageTronque,
  };
}

// ── L'offre, comme SÉLECTEUR ────────────────────────────────────────────────
//
// 🔴 2026-09-23 — REMPLACE L'ONGLET « MONTEUR VIDÉO » (UNE offre sur 34
// promue au rang d'onglet, mesuré en prod : 164 candidatures / 34 offres).
// « Qui a postulé à Rédacteur web ? » est la question naturelle ; un onglet
// fixe ne pouvait répondre qu'à UNE offre, toujours la même.

export interface OffreAvecCandidatures {
  /** UUID de l'offre, ou `AUCUNE_OFFRE_ID`. */
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Les offres RÉELLEMENT présentes dans les candidatures, avec leur volume —
 * pour alimenter le sélecteur (au lieu d'un onglet figé sur une seule offre).
 *
 * 🔴 `offerId` est `NULL` pour DEUX raisons distinctes, et ce sélecteur ne
 * peut pas — et n'a pas besoin de — les démêler : une candidature spontanée
 * (jamais d'offre visée), ou une offre depuis supprimée (`onDelete: SetNull`,
 * lot 6 — cf. schema.prisma). Les deux se regroupent sous UN SEUL filtre :
 * dans les deux cas, il n'existe aucune fiche d'offre vers laquelle filtrer,
 * et c'est la seule chose que ce sélecteur a besoin de savoir. Les regrouper
 * SOUS DES LIBELLÉS DIFFÉRENTS (texte saisi à la main par chaque candidat
 * spontané) aurait produit jusqu'à six entrées à un seul candidat chacune —
 * l'exact inverse d'un sélecteur qui doit tenir sur un écran.
 *
 * Dérivées des données et non d'une liste figée, même principe que
 * `getSourcesCandidatures` : une offre pourvue puis dépubliée reste
 * filtrable tant qu'un dossier lui est rattaché, et aucune offre à zéro
 * candidature n'encombre le sélecteur.
 */
export async function getOffresAvecCandidatures(): Promise<readonly OffreAvecCandidatures[]> {
  const groupes = await prisma.jobApplication.groupBy({
    by: ["offerId"],
    _count: { _all: true },
  });

  const idsReels = groupes.map((g) => g.offerId).filter((id): id is string => id !== null);

  // Un représentant par offre — `offerTitleSnap` est figé à la soumission,
  // donc stable pour une même offre. `distinct` + tri par date décroissante
  // retient le libellé le plus RÉCENT si jamais deux candidatures d'une même
  // offre en portaient un différent (renommage entre les deux dépôts).
  const representants = idsReels.length
    ? await prisma.jobApplication.findMany({
        where: { offerId: { in: idsReels } },
        distinct: ["offerId"],
        orderBy: { submittedAt: "desc" },
        select: { offerId: true, offerTitleSnap: true },
      })
    : [];
  const labelParOffre = new Map(representants.map((r) => [r.offerId as string, r.offerTitleSnap]));

  // 🔴 FUSIONNÉ PAR `id`, JAMAIS UNE PROJECTION DIRECTE DE `groupes`. Le
  // `groupBy({ by: ["offerId"] })` ci-dessus garantit déjà UN SEUL groupe
  // `offerId: null` — mais cette fusion est une DEUXIÈME digue, pas une
  // simple reformulation : si `by` gagnait un jour un second champ (même
  // raisonnement que `getSourcesCandidatures`, qui groupe par un texte), les
  // candidatures spontanées se fragmenteraient en autant de groupes que de
  // textes saisis à la main — jusqu'à six entrées à un seul candidat chacune,
  // silencieusement. Merger par `id` ICI absorbe ce cas SANS dépendre de la
  // requête amont.
  const compteParId = new Map<string, number>();
  for (const g of groupes) {
    const id = g.offerId ?? AUCUNE_OFFRE_ID;
    compteParId.set(id, (compteParId.get(id) ?? 0) + g._count._all);
  }
  const lignes: OffreAvecCandidatures[] = [...compteParId.entries()].map(([id, count]) => ({
    id,
    label: id === AUCUNE_OFFRE_ID ? "Candidature spontanée" : (labelParOffre.get(id) ?? "Offre"),
    count,
  }));

  return lignes.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr"));
}
