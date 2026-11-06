/**
 * La FICHE PROSPECT AUTOMATIQUE à la demande écrite (besoin de Will, 04/11/2026) :
 * un message reçu par le site (`/fr/contact`, simulateur ROI, chatbot) crée tout seul
 * sa fiche dans la console (table `clients`, statut `prospect`), comme une réservation
 * d'appel (`fiche-auto.ts`, #1642). Will n'a rien à faire à la main.
 *
 * ## Quelles demandes (le prédicat est EXPORTÉ : `estDemandeAvecFiche`)
 *
 * audit, mise en œuvre, formation, un-à-un, devis, et le simulateur ROI (captcha passé) :
 * les types COMMERCIAUX. `autre` et le chatbot ne créent PAS de fiche : un doute est tracé
 * (`type_a_confirmer`), le message reste visible dans la boîte (décision par défaut, à
 * confirmer par Will). JAMAIS : recrutement, partenariat, presse, speaker, investisseur,
 * support client, dossier apporteur, adresse exclue du CRM, adresse sous opposition
 * (doute tracé), adresse effacée (art. 17), captcha non validé (`turnstilePassed:false`),
 * message en corbeille ou archivé.
 *
 * ## Les trois issues, dans l'ordre
 *
 *   1. une fiche porte EXACTEMENT la même adresse (`ficheSure`) : le message s'y relie
 *      (`submissions.fiche_client_id`, la seule écriture) ; la fiche n'est PAS touchée ;
 *   2. plusieurs fiches portent cette adresse : ambigu, rien n'est créé ni relié, le doute
 *      est noté une fois (`dossier.fiche_demande_doute`) ;
 *   3. sinon la fiche est CRÉÉE par la porte unique, sans signature. Une fiche PROCHE (même
 *      nom et ville, même domaine professionnel, même téléphone) ne bloque pas : la nouvelle
 *      fiche garde le lien, une trace `client.doublon_possible` et une alerte, jamais une
 *      écriture sur la fiche proche.
 *
 * ## Ce qui n'est jamais écrit
 *
 * Jamais de SIREN (même si le message en portait un : il ne se pose que d'un clic de Will,
 * l'annuaire n'est pas appelé ici). Aucune écriture sur une fiche existante. Aucune
 * suppression de donnée. `notes`, `contexteIa`, `besoinsIdentifies` restent vides : le
 * texte du message vit sur le message.
 *
 * ## Interrupteur
 *
 * `DOSSIER_FICHE_DEMANDE` : actif SEULEMENT si `"true"` ; `"essai"` = à blanc ; tout le reste
 * (absent compris) = coupé. `DOSSIER_FICHE_DEMANDE_DEPUIS` : une date `AAAA-MM-JJ` stricte
 * (aller-retour contrôlé, `04/11/2026` refusée). Absente ou invalide en mode allumé : l'étape ne
 * fait RIEN mais le dit (un avertissement, `dateManquante` dans le bilan, jamais un silence). Une
 * vieille date n'arrête PAS l'étape : la borne réellement appliquée est `borneEffective` = la plus
 * récente de la date et de « maintenant − 90 jours » (un message plus ancien n'est jamais traité).
 * Colonne `fiche_client_id` pas encore migrée : le passage le dit (`colonneAbsente`) et ne plante pas.
 *
 * ## Refus de la porte
 *
 * Chaque refus de `creerOuRetrouverClient` laisse une trace (`dossier.fiche_demande_refus_porte`).
 * Au 3e refus le message est écarté (doute permanent, plus de réessai) et UNE alerte agrégée
 * `visio.fiche_demande_refus_porte` est levée (dédupliquée, sans donnée de personne).
 *
 * Module neutre (sans `server-only`, sans Next) : le balayage du worker l'importe.
 */

import { createHash } from "node:crypto";

import { decryptPii, isDecryptedEmailUsable, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { estOpposee } from "@/server/email/opposition";
import {
  CODES_ALERTES_VISIO,
  creerOuDedupParDefaut,
  type CreerAlerte,
} from "@/server/visio/alertes";
import {
  chargerFichesCandidates,
  creerOuRetrouverClient,
  preparerCandidat,
  trouverFichesProches,
  type DonneesFiche,
  type PersonneSaisie,
} from "@/server/qualiopi/crm/porte-client";
import type { BaseTransactionnelle, Tx } from "./base";
import { dansLaTransaction } from "./base";
import {
  ACTION_CREATION_AUTOMATIQUE,
  ACTION_DOUBLON_POSSIBLE,
  domainesProDe,
  entrepriseUtilisable,
  ficheSure,
  fichesAuMemeTelephone,
  nomDePersonneUtilisable,
  type ProcheLie,
} from "./fiche-auto";
import {
  calculerProposition,
  chargerFichesPourRattachement,
  type IndicesDeRattachement,
} from "./rattacher";

// ── Interrupteur, date d'activation ──────────────────────────────────────────

export type ModeFicheDemande = "coupe" | "essai" | "actif";

type Env = Readonly<Record<string, string | undefined>>;

/** `"true"` actif, `"essai"` à blanc, tout le reste (absent compris) coupé. */
export function modeFicheDemande(env: Env = process.env): ModeFicheDemande {
  const brut = env["DOSSIER_FICHE_DEMANDE"];
  if (brut === "true") return "actif";
  if (brut === "essai") return "essai";
  return "coupe";
}

const JOURS_MAX_DEPUIS = 90;

/**
 * La date d'activation : seuls les messages reçus à partir d'elle sont traités. Format STRICT
 * `AAAA-MM-JJ` avec contrôle aller-retour (`2026-02-30` refusée) ; `04/11/2026` serait lu
 * « 11 avril » par `new Date` : refusée. Absente ou invalide : `null`. Une date ANCIENNE n'est plus
 * rejetée (sinon l'étape s'arrêtait en silence 90 jours après l'activation) : le plafond de 90 jours
 * est appliqué par `borneEffective`. Une date future reste permise.
 */
export function ficheDemandeDepuis(env: Env = process.env): Date | null {
  const brut = env["DOSSIER_FICHE_DEMANDE_DEPUIS"]?.trim();
  if (!brut || !/^\d{4}-\d{2}-\d{2}$/.test(brut)) return null;
  const [a, m, j] = brut.split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return d;
}

/** La borne réellement appliquée : la plus récente de la date d'activation et de « maintenant − 90 jours ». */
export function borneEffective(depuis: Date, maintenant: Date): Date {
  const plancher = maintenant.getTime() - JOURS_MAX_DEPUIS * 86_400_000;
  return new Date(Math.max(depuis.getTime(), plancher));
}

// ── Le prédicat des types (EXPORTÉ) ──────────────────────────────────────────

/**
 * Les `details.unifiedType` d'une demande qui crée une fiche : les types COMMERCIAUX et le
 * simulateur ROI (captcha passé). `autre` et le chatbot n'y sont PAS (voir `TYPES_A_CONFIRMER`).
 */
export const TYPES_DEMANDE_AVEC_FICHE = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "simulateur_roi",
] as const;

/** Visités et tracés (`type_a_confirmer`), jamais de fiche tant que Will n'a pas tranché. */
export const TYPES_A_CONFIRMER = ["autre"] as const;

const ENSEMBLE_TYPES: ReadonlySet<string> = new Set(TYPES_DEMANDE_AVEC_FICHE);

/** Ce qu'il faut lire d'un message pour décider (sans l'adresse : voir `assurerFicheDemande`). */
export interface LigneDemandeFiche {
  readonly type: string;
  readonly details: unknown;
  readonly source?: string | null;
  readonly deletedAt?: Date | null;
}

function champ(details: unknown, cle: string): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[cle];
}

function ecarte(l: LigneDemandeFiche): boolean {
  return !!l.deletedAt || estApporteur(l.details) || champ(l.details, "turnstilePassed") === false;
}

/**
 * Ce message crée-t-il une fiche prospect ? PUR. Les exclusions qui demandent l'adresse
 * (CRM, opposition, effacement) se jugent ensuite, sur le message lu.
 */
export function estDemandeAvecFiche(l: LigneDemandeFiche): boolean {
  if (ecarte(l)) return false;
  const u = champ(l.details, "unifiedType");
  return typeof u === "string" && ENSEMBLE_TYPES.has(u);
}

/** Un message `autre` ou du chatbot : visité, doute tracé, aucune fiche. PUR. */
export function estDemandeATracer(l: LigneDemandeFiche): boolean {
  if (ecarte(l) || estDemandeAvecFiche(l)) return false;
  const u = champ(l.details, "unifiedType");
  return l.source === "chatbot" || u === "autre";
}

// ── Colonne absente ──────────────────────────────────────────────────────────

/**
 * Vrai si l'erreur dit que `fiche_client_id` n'existe pas encore (migration pas posée :
 * le worker atterrit ~50 min avant l'entrypoint de l'app). Un doublon (P2002) n'en est jamais une.
 */
export function estColonneFicheDemandeAbsente(e: unknown): boolean {
  if (e === null || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  if (o["code"] === "P2002") return false;
  const message = typeof o["message"] === "string" ? o["message"] : "";
  return /fiche_client_id|ficheClientId/i.test(message);
}

// ── Les traces ───────────────────────────────────────────────────────────────

/** Le marqueur « doute vu » : le message sort des candidats. */
export const ACTION_DOUTE_DEMANDE_VU = "dossier.fiche_demande_doute";
/** Le message s'est relié à une fiche qui existait déjà (la fiche n'est pas touchée). */
export const ACTION_DEMANDE_LIEE = "submission.fiche_liee_automatique";
/** Un refus de la porte unique (une trace par refus) : au 3e, le message est écarté. */
export const ACTION_REFUS_PORTE_DEMANDE = "dossier.fiche_demande_refus_porte";
/** Combien de refus de la porte avant d'écarter le message. */
export const REFUS_PORTE_MAX = 3;

export type RaisonDemande =
  | "adresse_illisible"
  | "sans_nom"
  | "plusieurs_fiches"
  | "type_a_confirmer"
  | "opposition"
  | "effacee"
  | "refus_porte";

export type IssueFicheDemande =
  | {
      readonly statut: "creee";
      readonly clientId: string;
      readonly proches: readonly ProcheLie[];
    }
  | { readonly statut: "liee"; readonly clientId: string }
  | { readonly statut: "creerait"; readonly doublon: boolean }
  | { readonly statut: "lierait" }
  | { readonly statut: "deja_liee" }
  | { readonly statut: "ignoree" }
  | { readonly statut: "doute"; readonly raison: RaisonDemande };

export type BaseFicheDemande = Tx & BaseTransactionnelle;

/** Le déchiffrement d'une colonne a échoué (clé absente ou fausse) : une panne, jamais un doute. */
export class ErreurDechiffrementDemande extends Error {
  override name = "ErreurDechiffrementDemande";
}

/** Le marqueur que l'effacement art. 17 écrit à la place du nom (`rgpd-erase.ts`, copie voulue). */
const MARQUE_EFFACEMENT = "[erased-rgpd-art17]";
const DOMAINE_EFFACE = "@erased.local";

/**
 * Les adresses exclues du CRM par l'environnement (`CRM_SYNC_EXCLUSIONS_SHA256`, empreintes
 * SHA-256 de l'adresse normalisée). Même règle que `crm-sync/exclusions.ts` (`estExclueDuCrm`),
 * recopiée ici pour éviter l'import DIRECT de `@/server/crm-sync` (garde PA-12
 * `le-dossier-client-ne-part-pas-au-crm`). Ce n'est PAS un cloisonnement de bout en bout :
 * `@/server/email/opposition`, importé plus haut, importe lui-même `crm-sync` ; PA-12 ne voit que
 * les imports directs (précédent : `src/server/qualiopi/documents/jeton.ts`). La parité des deux
 * règles est verrouillée par `tests/unit/ci/la-regle-d-exclusion-de-la-fiche-demande-est-celle-du-crm.spec.ts`.
 */
export function estExclueParEnvironnement(email: string): boolean {
  const exclues = (process.env["CRM_SYNC_EXCLUSIONS_SHA256"] ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => /^[0-9a-f]{64}$/.test(v));
  if (exclues.length === 0) return false;
  return exclues.includes(createHash("sha256").update(email.trim().toLowerCase()).digest("hex"));
}

export interface OptionsFicheDemande {
  /** À blanc : décide, n'écrit rien. */
  readonly essai?: boolean;
  /** À blanc : adresses déjà « créées » à ce passage (une seconde demande se relierait). */
  readonly adressesPrevues?: Set<string>;
  /** Date d'activation : un message reçu avant elle n'est jamais traité. */
  readonly depuis?: Date | null;
}

/** Les raisons sociales que le site met quand l'entreprise n'est pas connue. */
const ENTREPRISES_DE_REMPLISSAGE: ReadonlySet<string> = new Set(["—", "via chatbot"]);

function entrepriseDeLaDemande(nom: string | null | undefined): string | null {
  const n = (nom ?? "").trim();
  if (ENTREPRISES_DE_REMPLISSAGE.has(n.toLowerCase())) return null;
  return entrepriseUtilisable(n) ? n : null;
}

function villeDe(details: unknown): string | null {
  const v = champ(details, "ville");
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 120) : null;
}

/**
 * La valeur en clair, ou `null` si elle est vide. LÈVE `ErreurDechiffrementDemande` quand le
 * déchiffrement est impossible (clé absente : texte de remplacement ; clé fausse : erreur) : une
 * clé qui manque ne doit jamais faire passer toutes les demandes pour des « doutes permanents ».
 */
function enClair(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  let clair: string;
  try {
    clair = decryptPii(valeur);
  } catch {
    throw new ErreurDechiffrementDemande("déchiffrement impossible");
  }
  if (clair === PII_DECRYPT_PLACEHOLDER || clair.startsWith("enc:")) {
    throw new ErreurDechiffrementDemande("déchiffrement impossible");
  }
  return clair.trim() === "" ? null : clair.trim();
}

/** Traite UN message. Voir l'en-tête. */
export async function assurerFicheDemande(
  db: BaseFicheDemande,
  submissionId: string,
  options: OptionsFicheDemande = {},
): Promise<IssueFicheDemande> {
  const s = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      type: true,
      source: true,
      details: true,
      deletedAt: true,
      archivedAt: true,
      submittedAt: true,
      companyName: true,
      contactName: true,
      contactEmail: true,
      contactEmailHash: true,
      contactPhone: true,
      ficheClientId: true,
    },
  });
  if (s === null) return { statut: "ignoree" };
  if (s.ficheClientId !== null) return { statut: "deja_liee" };
  if (s.archivedAt) return { statut: "ignoree" };
  if (options.depuis && s.submittedAt.getTime() < options.depuis.getTime()) {
    return { statut: "ignoree" };
  }
  const avecFiche = estDemandeAvecFiche(s);
  if (!avecFiche && !estDemandeATracer(s)) return { statut: "ignoree" };

  // Un message effacé (art. 17) garde sa ligne anonymisée : jamais une fiche à partir d'elle.
  if (
    s.contactEmailHash === null ||
    s.contactEmail.endsWith(DOMAINE_EFFACE) ||
    s.contactName === MARQUE_EFFACEMENT
  ) {
    return { statut: "doute", raison: "effacee" };
  }
  if (!avecFiche) return { statut: "doute", raison: "type_a_confirmer" };

  const email = enClair(s.contactEmail)?.toLowerCase() ?? null;
  if (email === null || !isDecryptedEmailUsable(email)) {
    return { statut: "doute", raison: "adresse_illisible" };
  }
  if (estExclueParEnvironnement(email)) return { statut: "ignoree" };
  // Une adresse sous opposition : pas de fiche automatique, le message reste visible dans la boîte.
  if (await estOpposee(email)) return { statut: "doute", raison: "opposition" };

  const nom = enClair(s.contactName);
  const telephone = enClair(s.contactPhone);
  const entreprise = entrepriseDeLaDemande(s.companyName);
  const ville = villeDe(s.details);
  const indices: IndicesDeRattachement = {
    emailTitulaire: email,
    emailsInvites: [],
    entrepriseDeclaree: entreprise,
    clientDuReport: null,
    demandeLiee: null,
  };
  const fiches = await chargerFichesPourRattachement(db, indices);

  // 1. Exactement la même adresse → on relie, on n'écrit pas sur la fiche.
  const sure = ficheSure(email, null, fiches);
  if (sure?.statut === "ambigue") return { statut: "doute", raison: "plusieurs_fiches" };
  if (sure?.statut === "sure") {
    if (options.essai) return { statut: "lierait" };
    const { clientId, motif } = sure;
    await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: { ficheClientId: clientId },
      });
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: ACTION_DEMANDE_LIEE,
          targetType: "Submission",
          targetId: submissionId,
          changes: { origine: "automatique", clientId, motif },
        },
      });
    });
    return { statut: "liee", clientId };
  }

  // 2. Une nouvelle fiche : au nom de l'entreprise, sinon de la personne (particulier).
  const nomUtilisable = nomDePersonneUtilisable(nom) ? (nom as string).trim().slice(0, 200) : null;
  const identite =
    entreprise !== null
      ? { raisonSociale: entreprise, type: "entreprise" as const }
      : nomUtilisable !== null
        ? { raisonSociale: nomUtilisable, type: "particulier" as const }
        : null;
  if (identite === null) return { statut: "doute", raison: "sans_nom" };

  // Les fiches proches : un doute, jamais un blocage ni une écriture sur elles.
  const proches = new Map<string, string>();
  const proposition = calculerProposition(indices, fiches);
  if (proposition !== null) proches.set(proposition.clientId, proposition.motif);
  const domaines = domainesProDe(indices);
  for (const f of fiches) {
    if (f.domainesPro.some((d) => domaines.has(d)))
      proches.set(f.id, proches.get(f.id) ?? "domaine");
  }
  const candidat = preparerCandidat({
    type: identite.type,
    raisonSociale: identite.raisonSociale,
    emails: [email],
    ville,
  });
  for (const p of trouverFichesProches(candidat, await chargerFichesCandidates(db, candidat))) {
    proches.set(p.ficheId, p.signal);
  }
  for (const id of await fichesAuMemeTelephone(db, telephone)) {
    proches.set(id, proches.get(id) ?? "telephone");
  }
  const lies: ProcheLie[] = [...proches].map(([ficheId, signal]) => ({ ficheId, signal }));
  if (options.essai) {
    // À blanc, une seconde demande de la même adresse se relierait : elle ne compte pas « créerait ».
    if (options.adressesPrevues?.has(email)) return { statut: "lierait" };
    options.adressesPrevues?.add(email);
    return { statut: "creerait", doublon: lies.length > 0 };
  }

  const donnees: DonneesFiche = {
    type: identite.type,
    raisonSociale: identite.raisonSociale.slice(0, 250),
    ...(ville !== null ? { adresseVille: ville } : {}),
    source: "demande",
  };
  const personne: PersonneSaisie = {
    ...(nomUtilisable !== null ? { nom: nomUtilisable } : {}),
    email,
    ...(telephone !== null ? { telephone: telephone.slice(0, 40) } : {}),
  };

  const cree = await db.$transaction(async (tx) => {
    const r = await creerOuRetrouverClient(dansLaTransaction(tx), donnees, personne, {
      parAdminId: null,
      // Aucune origine ne dit « formulaire du site » : `saisie` est la valeur neutre (pas de migration).
      origineContact: "saisie",
    });
    if (r.statut !== "cree") return r;
    await tx.submission.update({ where: { id: submissionId }, data: { ficheClientId: r.id } });
    await tx.activityLog.create({
      data: {
        adminUserId: null,
        action: ACTION_CREATION_AUTOMATIQUE,
        targetType: "Client",
        targetId: r.id,
        changes: { origine: "automatique", origineFiche: "demande", submissionId },
      },
    });
    if (lies.length > 0) {
      await tx.activityLog.create({
        data: {
          adminUserId: null,
          action: ACTION_DOUBLON_POSSIBLE,
          targetType: "Client",
          targetId: r.id,
          changes: {
            origine: "automatique",
            origineFiche: "demande",
            submissionId,
            proches: lies.map((l) => ({ ...l })),
          },
        },
      });
      await tx.alerteSysteme.create({
        data: {
          code: CODES_ALERTES_VISIO.doublonPossible,
          niveau: "important",
          titre: "Fiche prospect créée : doublon possible",
          message:
            `Une fiche prospect a été créée toute seule pour une demande reçue par le site, ` +
            `mais ${lies.length} fiche(s) lui ressemble(nt). Le lien est dans son historique ; ` +
            `la fusion se fera quand le SIRET sera renseigné.`,
          cibleType: "Client",
          cibleId: r.id,
          metadata: { proches: lies.length },
        },
      });
    }
    return r;
  });

  if (cree.statut !== "cree") {
    // Un passage simultané a pu relier le message entre-temps : on relit avant de compter un doute.
    const maintenant = await db.submission.findUnique({
      where: { id: submissionId },
      select: { ficheClientId: true },
    });
    if (maintenant?.ficheClientId) return { statut: "deja_liee" };
    return { statut: "doute", raison: "refus_porte" };
  }
  return { statut: "creee", clientId: cree.id, proches: lies };
}

// ── Le passage ───────────────────────────────────────────────────────────────

export interface BilanFichesDemande {
  readonly mode: ModeFicheDemande;
  readonly creees: number;
  /** Messages reliés à une fiche qui existait déjà. */
  readonly liees: number;
  /** Doutes vus à CE passage (adresse illisible, sans nom, plusieurs fiches, refus de la porte). */
  readonly doutes: number;
  /** Messages dont le traitement a planté (réessayés au passage suivant). */
  readonly plantees: number;
  /** À blanc : ce qui serait fait. */
  readonly creeraient: number;
  readonly lieraient: number;
  /** Fiches créées à CE passage avec un doute d'identité. */
  readonly doublons: ReadonlyArray<{ readonly clientId: string; readonly proches: number }>;
  /** La colonne `fiche_client_id` n'est pas encore migrée : rien n'a été fait. */
  readonly colonneAbsente: boolean;
  /** Messages écartés à CE passage après trois refus de la porte (une alerte agrégée). */
  readonly refusAbandonnes: number;
  /** Mode allumé mais `DOSSIER_FICHE_DEMANDE_DEPUIS` absente ou invalide : l'étape est à l'arrêt. */
  readonly dateManquante: boolean;
}

const BILAN_VIDE: BilanFichesDemande = {
  mode: "coupe",
  creees: 0,
  liees: 0,
  doutes: 0,
  plantees: 0,
  creeraient: 0,
  lieraient: 0,
  doublons: [],
  colonneAbsente: false,
  refusAbandonnes: 0,
  dateManquante: false,
};

/** Combien de messages candidats sont relus par passage (les plus récents d'abord). */
const PLAFOND_MESSAGES = 500;

/**
 * Les doutes permanents déjà vus, depuis la borne seulement (un doute est écrit APRÈS la réception
 * du message, donc jamais avant la borne), les plus récents d'abord.
 */
async function doutesVus(db: Tx, borne: Date): Promise<string[]> {
  const lignes = await db.activityLog.findMany({
    where: {
      action: ACTION_DOUTE_DEMANDE_VU,
      targetType: "Submission",
      targetId: { not: null },
      createdAt: { gte: borne },
    },
    select: { targetId: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return lignes.flatMap((l) => (l.targetId ? [l.targetId] : []));
}

/** Un doute qui se règle tout seul au passage suivant n'est pas noté. */
const DOUTES_PERMANENTS: ReadonlySet<RaisonDemande> = new Set([
  "adresse_illisible",
  "sans_nom",
  "plusieurs_fiches",
  "type_a_confirmer",
  "opposition",
  "effacee",
]);

/** Les types visités : le filtre est en base, pour qu'un message ignoré n'occupe jamais une place. */
const FILTRE_TYPES = [...TYPES_DEMANDE_AVEC_FICHE, ...TYPES_A_CONFIRMER].map((t) => ({
  details: { path: ["unifiedType"], equals: t },
}));

/** Le passage : les messages reçus depuis l'activation, encore sans fiche. */
export async function assurerLesFichesDemande(
  db: BaseFicheDemande,
  options: {
    readonly env?: Env;
    readonly maintenant?: Date;
    /** L'alerte agrégée des refus de la porte (`creerOuDedup` par défaut) : injectée par les tests. */
    readonly creerAlerte?: CreerAlerte;
  } = {},
): Promise<BilanFichesDemande> {
  const mode = modeFicheDemande(options.env);
  if (mode === "coupe") return { ...BILAN_VIDE, mode };
  const activation = ficheDemandeDepuis(options.env);
  if (activation === null) {
    console.warn(
      "[fiche-demande] DOSSIER_FICHE_DEMANDE_DEPUIS absente ou invalide (AAAA-MM-JJ) : l'étape est à l'arrêt",
    );
    return { ...BILAN_VIDE, mode, dateManquante: true };
  }
  const depuis = borneEffective(activation, options.maintenant ?? new Date());
  const essai = mode === "essai";

  let candidats: Array<{ id: string }>;
  try {
    const vus = await doutesVus(db, depuis);
    candidats = await db.submission.findMany({
      where: {
        ficheClientId: null,
        deletedAt: null,
        archivedAt: null,
        submittedAt: { gte: depuis },
        OR: [{ source: "chatbot" as const }, ...FILTRE_TYPES],
        ...(vus.length > 0 ? { id: { notIn: vus } } : {}),
      },
      select: { id: true },
      orderBy: { submittedAt: "desc" },
      take: PLAFOND_MESSAGES,
    });
  } catch (e) {
    if (estColonneFicheDemandeAbsente(e)) return { ...BILAN_VIDE, mode, colonneAbsente: true };
    throw e;
  }

  const c = { creees: 0, liees: 0, doutes: 0, plantees: 0, cr: 0, li: 0, abandons: 0 };
  const doublons: Array<{ clientId: string; proches: number }> = [];
  let colonneAbsente = false;
  const adressesPrevues = new Set<string>();
  // Les plus anciens d'abord : une même adresse retombe sur la fiche du premier message.
  for (const cand of [...candidats].reverse()) {
    try {
      const issue = await assurerFicheDemande(db, cand.id, { essai, depuis, adressesPrevues });
      if (issue.statut === "creee") {
        c.creees += 1;
        if (issue.proches.length > 0) {
          doublons.push({ clientId: issue.clientId, proches: issue.proches.length });
        }
      } else if (issue.statut === "liee") c.liees += 1;
      else if (issue.statut === "creerait") c.cr += 1;
      else if (issue.statut === "lierait") c.li += 1;
      else if (issue.statut === "doute") {
        c.doutes += 1;
        let permanent = DOUTES_PERMANENTS.has(issue.raison);
        if (!essai && issue.raison === "refus_porte") {
          // Chaque refus laisse une trace ; au 3e le message est écarté (doute permanent).
          const avant = await db.activityLog.count({
            where: {
              action: ACTION_REFUS_PORTE_DEMANDE,
              targetType: "Submission",
              targetId: cand.id,
            },
          });
          await db.activityLog.create({
            data: {
              adminUserId: null,
              action: ACTION_REFUS_PORTE_DEMANDE,
              targetType: "Submission",
              targetId: cand.id,
              changes: { origine: "automatique", rang: avant + 1 },
            },
          });
          if (avant + 1 >= REFUS_PORTE_MAX) {
            permanent = true;
            c.abandons += 1;
          }
        }
        if (!essai && permanent) {
          await db.activityLog.create({
            data: {
              adminUserId: null,
              action: ACTION_DOUTE_DEMANDE_VU,
              targetType: "Submission",
              targetId: cand.id,
              changes: { origine: "automatique", raison: issue.raison },
            },
          });
        }
      }
    } catch (e) {
      if (estColonneFicheDemandeAbsente(e)) {
        colonneAbsente = true;
        break;
      }
      c.plantees += 1;
      // Le NOM ou le CODE de l'erreur seulement (jamais le message : il peut citer une donnée).
      const o = e as { name?: unknown; code?: unknown } | null;
      const nomErreur =
        typeof o?.code === "string" ? o.code : typeof o?.name === "string" ? o.name : "inconnue";
      console.warn(`[fiche-demande] traitement d'un message en échec : ${nomErreur}`);
    }
  }
  // UNE alerte agrégée pour tous les messages écartés à ce passage (dédupliquée par code, sans
  // cible, sans donnée de personne). Une panne d'alerte ne défait rien : les traces sont écrites.
  if (c.abandons > 0) {
    try {
      await (options.creerAlerte ?? creerOuDedupParDefaut)({
        code: CODES_ALERTES_VISIO.refusPorteDemande,
        niveau: "important",
        titre: "Messages du site sans fiche prospect : la porte a refusé trois fois",
        message:
          "Des messages reçus par le site n'ont pas de fiche prospect : la porte unique a refusé " +
          "trois fois de la créer. Ils sont écartés (plus de réessai) et restent visibles dans " +
          "la boîte des messages ; à traiter à la main.",
        metadata: { abandonnes: c.abandons },
      });
    } catch (e) {
      const o = e as { name?: unknown; code?: unknown } | null;
      const nomErreur =
        typeof o?.code === "string" ? o.code : typeof o?.name === "string" ? o.name : "inconnue";
      console.warn(`[fiche-demande] alerte des refus de la porte en échec : ${nomErreur}`);
    }
  }
  return {
    mode,
    creees: c.creees,
    liees: c.liees,
    doutes: c.doutes,
    plantees: c.plantees,
    creeraient: c.cr,
    lieraient: c.li,
    doublons,
    colonneAbsente,
    refusAbandonnes: c.abandons,
    dateManquante: false,
  };
}
