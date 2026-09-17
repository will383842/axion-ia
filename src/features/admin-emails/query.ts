/**
 * Lecture du journal des e-mails envoyés.
 *
 * ── Pourquoi ce module n'existait pas ─────────────────────────────────────
 * La table `email_logs` est écrite depuis le début par le worker d'envoi, et
 * indexée sur template, statut, destinataire et date — donc manifestement
 * pensée pour être lue. Elle ne l'a jamais été : aucune page, aucun composant,
 * aucune requête. Les 61 gabarits qui partent en automatique (convocations,
 * liens d'accès, confirmations, relances de paiement, rapports du simulateur)
 * n'étaient visibles nulle part.
 *
 * ⚠️ À ne pas confondre avec `email_outbox`, qui n'est PAS un journal d'envois
 * mais une corbeille de validation : seuls 5 gabarits y transitent, et elle est
 * vide dès qu'ils sont traités.
 *
 * ── Ce que ce journal ne contient pas ─────────────────────────────────────
 * Le CONTENU. Ni sujet, ni HTML, ni variables. On sait qu'un e-mail est parti,
 * à qui, quand et avec quel résultat — pas ce qu'il disait. La page le dit à
 * l'écran plutôt que de laisser croire à un archivage complet.
 */

import { prisma } from "@/lib/prisma";
import { analyserSerie, type LigneEchec } from "@/server/email/serie-echecs";
import type { EmailLogStatus } from "../../../prisma/generated/client";
// ⚠️ Import de VALEUR, pas de type : `STATUTS` est dérivé de l'énum à
// l'exécution. Un `import type` seul ne donnerait rien à énumérer.
import { EmailLogStatus as EmailLogStatusEnum } from "../../../prisma/generated/client";

/** Fenêtres proposées dans l'entête. */
export const FENETRES_EMAILS = [
  { jours: 7, libelle: "7 jours" },
  { jours: 30, libelle: "30 jours" },
  { jours: 90, libelle: "90 jours" },
  { jours: 0, libelle: "Tout" },
] as const;

export const FENETRE_EMAILS_DEFAUT = 30;

/** Lignes par page. Au-delà, la lecture n'a plus de valeur d'inspection. */
export const PAR_PAGE = 50;

/**
 * 🔴 2026-08-24 — `bounced` MANQUAIT, ET C'EST LE SEUL STATUT QUI COMPTE VRAIMENT.
 *
 * `EmailLogStatus` porte quatre valeurs. Cette liste en déclarait trois. Le
 * statut `bounced` a été ajouté le 2026-08-20 avec le webhook ZeptoMail —
 * l'énum le documente mot pour mot : « un rebond dur était indiscernable d'une
 * remise réussie : le relais acceptait le message (`sent`), le serveur
 * destinataire le refusait ensuite, et rien ne revenait. Une convocation
 * "envoyée" pouvait n'être jamais arrivée. »
 *
 * Le webhook écrit bien `bounced`. La console, elle, ne le proposait dans aucun
 * filtre et ne le comptait dans aucun compteur : un rebond DISPARAISSAIT de
 * l'écran censé le montrer. Le défaut a donc été corrigé à moitié — la donnée
 * arrive, personne ne la voit.
 *
 * 🔑 Cette liste est désormais DÉRIVÉE de l'énum, pas énumérée : le jour où une
 * cinquième valeur apparaît, elle est couverte sans que personne y pense. Une
 * liste écrite à la main vieillit toujours mal — ce dépôt l'a payé le matin même
 * sur un autre cliquet.
 */
const STATUTS: readonly EmailLogStatus[] = Object.values(EmailLogStatusEnum);
/** Les statuts, dans l'ordre de l'énum — pour les puces de filtre de l'écran (lot 3). */
export const STATUTS_EMAILS: readonly EmailLogStatus[] = STATUTS;

/**
 * Libellé français de CHAQUE statut — lot 3 (2026-09-02). Typé sur l'énum :
 * un statut ajouté sans libellé ne compile plus. Avant, la vue portait sa
 * propre table à trois entrées, et « bounced » s'affichait en anglais brut
 * dans une console française — sur le seul statut qui exige un geste humain.
 */
export const LIBELLES_STATUT_EMAIL: Readonly<Record<EmailLogStatus, string>> = {
  pending: "En attente",
  sent: "Envoyé",
  failed: "Échec",
  bounced: "Rebond",
  // 🔴 2026-09-09 — AJOUTÉ AVANT QUE LA VALEUR N'EXISTE EN BASE, et c'est
  // délibéré. Cette carte est la seule source des libellés ; une ligne portant
  // un statut absent d'ici s'afficherait avec une cellule VIDE — pas une
  // erreur, pas un rouge, juste un trou que personne ne remarque. Le libellé
  // précède donc l'écriture du statut, jamais l'inverse.
  cancelled: "Annulé",
};

/** Libellé complet d'une ligne : le type de rebond compte, il commande le geste. */
export function libelleStatutLigne(l: Pick<LigneEmail, "status" | "bounceType">): string {
  if (l.status === "bounced") {
    return l.bounceType === "hard"
      ? "Rebond définitif"
      : l.bounceType === "soft"
        ? "Rebond temporaire"
        : "Rebond";
  }
  return LIBELLES_STATUT_EMAIL[l.status];
}

export type FiltresEmails = {
  jours: number;
  statut: EmailLogStatus | null;
  gabarit: string | null;
  destinataire: string | null;
  /**
   * Session de formation dont on veut le journal — la question de l'auditeur.
   *
   * « Montrez-moi ce qui est parti pour la formation de telle date, chez tel
   * client, à tel stagiaire. » Le journal n'indexait que le destinataire : pour
   * une session à douze inscrits il fallait douze recherches et un recollement
   * à la main. Ici la session résout elle-même ses entités liées.
   */
  sessionId: string | null;
  page: number;
};

/** La session filtrée, telle qu'on la NOMME à l'écran (jamais un UUID nu). */
export type SessionFiltree = {
  id: string;
  numero: string;
  titre: string;
  client: string | null;
  dateDebut: Date;
};

export type LigneEmail = {
  id: string;
  template: string;
  recipient: string;
  status: EmailLogStatus;
  attempts: number;
  error: string | null;
  entityType: string | null;
  entityId: string | null;
  providerMessageId: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  /** Identifiant du job BullMQ — c'est lui qu'on rejoue depuis l'écran (lot 3). */
  jobId: string | null;
  bounceType: string | null;
  bounceReason: string | null;
};

export type ChargementEmails = {
  lignes: LigneEmail[];
  total: number;
  page: number;
  pages: number;
  /** Répartition par statut sur la fenêtre, tous filtres de statut ignorés. */
  parStatut: {
    envoyes: number;
    echecs: number;
    enAttente: number;
    rebonds: number;
    /** Envois retirés de la file avant leur échéance (2026-09-09). */
    annules: number;
    /** Rebonds DÉFINITIFS : les seuls qui demandent de corriger une adresse (lot 3). */
    rebondsDurs: number;
  };
  /** Gabarits présents sur la fenêtre, pour alimenter le filtre. */
  gabarits: Array<{ nom: string; envois: number }>;
  /** La session filtrée, si le filtre porte sur une session. */
  session: SessionFiltree | null;
};

/**
 * Les identifiants d'entités qu'une session « couvre » dans le journal.
 *
 * 🔑 On passe par `entityId`, pas par le destinataire. Deux raisons, et la
 * seconde est celle qui compte pour un auditeur :
 *
 *   · une adresse peut servir à plusieurs sessions (un référent formation qui
 *     inscrit ses collègues deux fois dans l'année) — filtrer par adresse
 *     mélangerait deux dossiers ;
 *   · l'`entityId` est ce que l'envoi a RÉELLEMENT visé au moment où il est
 *     parti. C'est un lien de causalité, pas une ressemblance de chaîne.
 *
 * On ratisse les quatre familles d'entités qu'une session engendre : ses
 * inscriptions (convocation, rappels, émargement, attestation), ses pièces
 * (convention, devis, facture, exemplaire signé), ses questionnaires
 * (positionnement, satisfaction, suivi à froid) et ses missions de formateur.
 *
 * ⚠️ Rend `[]` si la session n'existe pas — et l'appelant doit alors filtrer sur
 * une liste VIDE plutôt que de ne pas filtrer du tout. Un identifiant erroné
 * doit rendre zéro ligne, jamais tout le journal : sinon l'auditeur lirait le
 * courrier d'autres dossiers en croyant lire le sien.
 */
async function idsLiesALaSession(sessionId: string): Promise<string[]> {
  const s = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      enrollments: { select: { id: true, questionnaires: { select: { id: true } } } },
      documents: { select: { id: true } },
      sessionFormateurs: { select: { id: true } },
      missionsFormateur: { select: { id: true } },
    },
  });
  if (s === null) return [];

  const ids = [s.id];
  for (const e of s.enrollments) {
    ids.push(e.id);
    for (const q of e.questionnaires) ids.push(q.id);
  }
  for (const d of s.documents) ids.push(d.id);
  for (const f of s.sessionFormateurs) ids.push(f.id);
  for (const m of s.missionsFormateur) ids.push(m.id);
  return ids;
}

/** Normalise la fenêtre reçue de l'URL. `0` = pas de borne de date. */
export function lireFenetreEmails(brut: string | undefined): number {
  const n = Number(brut);
  return FENETRES_EMAILS.some((f) => f.jours === n) ? n : FENETRE_EMAILS_DEFAUT;
}

/**
 * Normalise le statut reçu de l'URL.
 *
 * Liste fermée : une valeur libre passerait telle quelle dans le `where` et
 * rendrait une page vide — impossible de distinguer « aucun e-mail » de
 * « filtre erroné ».
 */
export function lireStatutEmail(brut: string | undefined): EmailLogStatus | null {
  return brut && (STATUTS as readonly string[]).includes(brut) ? (brut as EmailLogStatus) : null;
}

/** Numéro de page, borné : une valeur absurde ne doit pas coûter une requête. */
export function lirePage(brut: string | undefined): number {
  const n = Number(brut);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ce qui est resté à quai — et qu'on peut remettre à la poste
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plafond d'un renvoi en lot.
 *
 * Ce n'est pas un réglage de confort : c'est la borne au-delà de laquelle un
 * clic cesse d'être un geste et devient une campagne. Deux cents envois vers
 * deux cents personnes réelles, c'est déjà beaucoup pour un bouton.
 */
export const PLAFOND_RENVOI_LOT = 200;

/** Fenêtre de rattrapage. Au-delà d'un mois, un accusé de réception n'a plus d'objet. */
export const FENETRE_RENVOI_JOURS = 30;

/**
 * Ce qu'il faut savoir AVANT de cliquer « renvoyer », et qui n'existait nulle
 * part.
 *
 * 🔴 2026-09-17. Pendant les 43 heures de panne, l'écran « E-mails envoyés »
 * savait tout et ne disait rien : un compteur « Échecs » au milieu de quatre
 * autres, et un bouton « Renvoyer » par ligne. Rien ne disait que dix-huit
 * personnes distinctes attendaient un accusé de réception depuis deux jours, ni
 * qu'aucun envoi n'avait abouti dans l'intervalle.
 */
export type EchecsRenvoyables = {
  /** Envois en échec qu'on peut effectivement rejouer (le job BullMQ existe). */
  total: number;
  /** Combien de personnes distinctes n'ont rien reçu. C'est ce chiffre qui parle. */
  destinatairesDistincts: number;
  /** Le plus ancien échec de la sélection — « depuis quand ». */
  depuis: Date | null;
  /** Motif le plus récent imputable à la chaîne, pour dire ce qui s'est passé. */
  motif: string | null;
  /**
   * Échecs SANS identifiant de job : irrécupérables depuis cet écran (le journal
   * ne garde pas le contenu). On les annonce plutôt que de les faire disparaître
   * du décompte — un écran qui promet « tout renvoyer » et en oublie quatre est
   * pire qu'un écran qui dit lesquels il ne sait pas reprendre.
   */
  sansJob: number;
  /** Vrai si le plafond a tronqué la lecture : les chiffres sont des minorants. */
  tronque: boolean;
};

export const AUCUN_ECHEC_RENVOYABLE: EchecsRenvoyables = {
  total: 0,
  destinatairesDistincts: 0,
  depuis: null,
  motif: null,
  sansJob: 0,
  tronque: false,
};

/**
 * Ce que le dernier geste de renvoi a produit — relu depuis l'URL.
 *
 * 🔴 L'action de formulaire d'un composant serveur ne rend rien à l'appelant :
 * la page se recharge, et c'est tout. C'est pour ça que l'ancien « Renvoyer »
 * par ligne se contentait d'un `console.warn` — un résultat qu'aucun
 * utilisateur ne voit. Le résultat transite donc par l'URL, et cette fonction
 * le relit en liste fermée.
 */
export type IssueRenvoi =
  | { kind: "ok"; renvoyes: number; destinataires: number; irrecuperables: number }
  | { kind: "erreur"; motif: string }
  | null;

/** Un entier d'URL, borné. Une valeur absurde ne doit pas s'afficher telle quelle. */
function entierBorne(brut: string | undefined, max: number): number {
  const n = Number(brut);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
}

export function lireIssueRenvoi(sp: Record<string, string | undefined>): IssueRenvoi {
  const kind = sp["renvoi"];
  if (kind === "erreur") {
    const motif = sp["motif"]?.slice(0, 200).trim();
    return { kind: "erreur", motif: motif || "Motif inconnu." };
  }
  if (kind === "ok" || kind === "lot") {
    return {
      kind: "ok",
      // « ok » est le renvoi à l'unité : un message, un destinataire.
      renvoyes: kind === "ok" ? 1 : entierBorne(sp["n"], PLAFOND_RENVOI_LOT),
      destinataires: kind === "ok" ? 1 : entierBorne(sp["d"], PLAFOND_RENVOI_LOT),
      irrecuperables: kind === "ok" ? 0 : entierBorne(sp["ko"], PLAFOND_RENVOI_LOT),
    };
  }
  return null;
}

export async function resumerEchecsRenvoyables(
  maintenant: Date = new Date(),
): Promise<EchecsRenvoyables> {
  const depuis = new Date(maintenant.getTime() - FENETRE_RENVOI_JOURS * 24 * 3600_000);

  try {
    const [lignes, sansJob] = await Promise.all([
      prisma.emailLog.findMany({
        where: { status: "failed", jobId: { not: null }, failedAt: { gte: depuis } },
        orderBy: { failedAt: "desc" },
        take: PLAFOND_RENVOI_LOT,
        select: { recipient: true, template: true, error: true, failedAt: true, createdAt: true },
      }),
      prisma.emailLog.count({
        where: { status: "failed", jobId: null, failedAt: { gte: depuis } },
      }),
    ]);

    const serie = analyserSerie(lignes as LigneEchec[]);
    return {
      total: serie.total,
      destinatairesDistincts: serie.destinatairesDistincts,
      depuis: serie.depuis,
      motif: serie.motif,
      sansJob,
      tronque: lignes.length === PLAFOND_RENVOI_LOT,
    };
  } catch {
    // Au build (base stub) comme sur une base illisible : l'écran doit
    // s'afficher. Le bandeau disparaît, il ne ment pas.
    return AUCUN_ECHEC_RENVOYABLE;
  }
}

export async function chargerEmails(filtres: FiltresEmails): Promise<ChargementEmails> {
  const vide: ChargementEmails = {
    lignes: [],
    total: 0,
    page: 1,
    pages: 1,
    parStatut: { envoyes: 0, echecs: 0, enAttente: 0, rebonds: 0, annules: 0, rebondsDurs: 0 },
    gabarits: [],
    session: null,
  };

  const depuis = new Date();
  depuis.setUTCDate(depuis.getUTCDate() - filtres.jours);
  const fenetre = filtres.jours > 0 ? { createdAt: { gte: depuis } } : {};

  // Le destinataire est une colonne `citext` : la comparaison est déjà
  // insensible à la casse côté Postgres, pas besoin de `mode: "insensitive"`.
  const recherche = filtres.destinataire?.trim();

  // 🔴 2026-09-07 — LE PÉRIMÈTRE, ET POURQUOI IL EST EXTRAIT.
  //
  // Les compteurs de tête ignoraient le filtre de destinataire. On lisait donc
  // « Envoyés 197 » au-dessus d'une liste de TROIS lignes filtrées sur une
  // stagiaire — et rien ne disait que les deux nombres ne parlaient pas de la
  // même chose. Sur un écran qu'on montre à un auditeur, c'est pire qu'un
  // chiffre faux : c'est un chiffre vrai posé sur la mauvaise question.
  //
  // Le périmètre est ce que le filtre DÉLIMITE : fenêtre, destinataire, session.
  // Tout ce qui compte doit s'y restreindre.
  //
  // ⚠️ Le STATUT reste hors périmètre, et c'est délibéré (déjà documenté plus
  // bas) : sinon filtrer sur « Envoyé » afficherait toujours « 0 échec ». Le
  // gabarit, lui, entre dans les compteurs mais pas dans la liste des gabarits —
  // sans quoi choisir une puce ferait disparaître toutes les autres.
  let perimetre: Record<string, unknown> = {
    ...fenetre,
    ...(recherche ? { recipient: { contains: recherche } } : {}),
  };

  let session: SessionFiltree | null = null;
  if (filtres.sessionId !== null) {
    const s = await prisma.trainingSession
      .findUnique({
        where: { id: filtres.sessionId },
        select: {
          id: true,
          numero: true,
          titreSession: true,
          dateDebut: true,
          client: { select: { raisonSociale: true } },
        },
      })
      .catch(() => null);
    if (s !== null) {
      session = {
        id: s.id,
        numero: s.numero,
        titre: s.titreSession,
        client: s.client?.raisonSociale ?? null,
        dateDebut: s.dateDebut,
      };
    }
    // ⚠️ Même si la session est introuvable, on filtre sur la liste d'ids —
    // vide dans ce cas. Un identifiant erroné doit rendre ZÉRO ligne, jamais le
    // journal entier : un auditeur lirait le courrier d'un autre dossier en
    // croyant lire le sien.
    const ids = await idsLiesALaSession(filtres.sessionId).catch(() => [] as string[]);
    perimetre = { ...perimetre, entityId: { in: ids } };
  }

  const where = {
    ...perimetre,
    ...(filtres.statut ? { status: filtres.statut } : {}),
    ...(filtres.gabarit ? { template: filtres.gabarit } : {}),
  };

  // Chaque lecture est isolée : au build (base stub, ADR 0026) elles rendent du
  // vide et la page doit s'afficher plutôt qu'échouer.
  try {
    const [total, lignes, parStatutBrut, gabaritsBruts, rebondsDurs] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filtres.page - 1) * PAR_PAGE,
        take: PAR_PAGE,
        select: {
          id: true,
          template: true,
          recipient: true,
          status: true,
          attempts: true,
          error: true,
          entityType: true,
          entityId: true,
          providerMessageId: true,
          sentAt: true,
          failedAt: true,
          createdAt: true,
          jobId: true,
          bounceType: true,
          bounceReason: true,
        },
      }),
      // Compteurs de tête : calculés SANS le filtre de statut, sinon ils
      // afficheraient toujours « 0 échec » dès qu'on filtre sur les envois.
      prisma.emailLog.groupBy({
        by: ["status"],
        where: { ...perimetre, ...(filtres.gabarit ? { template: filtres.gabarit } : {}) },
        _count: { _all: true },
      }),
      prisma.emailLog.groupBy({
        by: ["template"],
        where: perimetre,
        _count: { _all: true },
        orderBy: { _count: { template: "desc" } },
      }),
      prisma.emailLog.count({
        where: {
          ...perimetre,
          ...(filtres.gabarit ? { template: filtres.gabarit } : {}),
          status: "bounced",
          bounceType: "hard",
        },
      }),
    ]);

    const compte = (s: EmailLogStatus): number =>
      parStatutBrut.find((r) => r.status === s)?._count._all ?? 0;

    return {
      lignes,
      total,
      page: filtres.page,
      pages: Math.max(1, Math.ceil(total / PAR_PAGE)),
      parStatut: {
        envoyes: compte("sent"),
        echecs: compte("failed"),
        enAttente: compte("pending"),
        // Remis au relais PUIS refusé par le serveur destinataire. Ni un envoi
        // réussi, ni un échec technique : le message est parti et n'arrivera
        // jamais. C'est le seul statut qui exige un geste humain — corriger
        // l'adresse — et il n'était affiché nulle part.
        rebonds: compte("bounced"),
        // Retiré de la file avant son échéance : la relance apporteur d'une
        // personne qui a répondu entre-temps. Ni parti, ni en échec — et
        // surtout PAS « en attente », état dans lequel ces lignes restaient
        // bloquées pour toujours faute d'un job pour les clore.
        annules: compte("cancelled"),
        rebondsDurs,
      },
      gabarits: gabaritsBruts.map((g) => ({ nom: g.template, envois: g._count._all })),
      session,
    };
  } catch {
    return vide;
  }
}
