/**
 * TRANSMISSION DE L'ORIGINE v3 AU CRM — derrière `SYNCHRO_CRM_V3` (ADR contrat v3, §3).
 *
 * 🔴 ÉTEINT PAR DÉFAUT : tant que `SYNCHRO_CRM_V3` n'est pas exactement `"true"`, rien n'est
 * construit ni écrit. Retour arrière = éteindre l'interrupteur (v1/v2 continuent). Allumé
 * seulement après une charge v3 de test acceptée (2xx) par le CRM. Soumis en plus aux verrous
 * habituels de la synchro (`CRM_SYNC_ENABLED`, flux guide) posés dans `enqueue.ts`.
 *
 * La charge ne porte ni pseudo, ni texte, ni jeton de commentaire (même en HMAC), ni adresse
 * en dehors du bloc `person` habituel. Au plus 20 entrées, sinon `too_many_origines`.
 */
import { createHash } from "node:crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { enqueueCrmSyncEvent } from "@/server/crm-sync/enqueue";
import {
  eventIdDemandeGuide,
  eventIdDeterministe as eventIdDuNom,
} from "@/server/crm-sync/event-id";
import { estExclueDuCrm } from "@/server/crm-sync/exclusions";
import type { CrmSyncEvent } from "@/server/crm-sync/types";
import { prisma } from "@/lib/prisma";
import { estOpposee } from "@/server/email/opposition";
import { isCrmSyncEnabled, isCrmSyncGuideEnabled } from "@/server/crm-sync/config";
import { mettreEnFileCrm } from "@/server/crm-sync/enqueue";
import { lireOriginesActives, MAX_ORIGINES_PAR_CHARGE, type OrigineAEcrire } from "./origines";

export { MAX_ORIGINES_PAR_CHARGE };
export const VERSION_SCHEMA_CRM_V3 = 3;

export function synchroCrmV3Active(): boolean {
  return process.env.SYNCHRO_CRM_V3 === "true";
}

interface EntreeCharge {
  mot: string;
  reseau: string;
  guide: string;
  date: string;
  post_ref?: string;
  post_url?: string;
  canal?: string;
  famille?: string;
  detail?: string;
  compte?: string;
  version_texte?: string;
  utm_campaign?: string;
}

export interface ChargeCrmV3 {
  schema_version: 3;
  /** « La plus récente gagne » (la date d'origine fait foi ; égalité : la première l'emporte). */
  origine_contenu: { mot: string; reseau: string; guide: string; date: string };
  origines: EntreeCharge[];
}

function entree(o: OrigineAEcrire): EntreeCharge {
  const e: EntreeCharge = {
    mot: o.mot,
    reseau: o.reseau,
    guide: o.guide,
    date: o.occurredAt.toISOString(),
  };
  if (o.postRef) e.post_ref = o.postRef;
  if (o.postUrl) e.post_url = o.postUrl;
  if (o.canal) e.canal = o.canal;
  if (o.famille) e.famille = o.famille;
  if (o.detail) e.detail = o.detail;
  if (o.compte) e.compte = o.compte;
  if (o.versionTexte) e.version_texte = o.versionTexte;
  if (o.utmCampagne) e.utm_campaign = o.utmCampagne;
  return e;
}

export function chargeCrmV3(
  origines: readonly OrigineAEcrire[],
):
  | { ok: true; charge: ChargeCrmV3 }
  | { ok: false; erreur: "too_many_origines" | "aucune_origine" } {
  if (origines.length > MAX_ORIGINES_PAR_CHARGE) return { ok: false, erreur: "too_many_origines" };
  const tri = [...origines].sort((a, b) => +a.occurredAt - +b.occurredAt);
  const derniere = tri.reduce<OrigineAEcrire | null>(
    (g, o) => (g === null || +o.occurredAt > +g.occurredAt ? o : g),
    null,
  );
  if (derniere === null) return { ok: false, erreur: "aucune_origine" };
  return {
    ok: true,
    charge: {
      schema_version: VERSION_SCHEMA_CRM_V3,
      origine_contenu: {
        mot: derniere.mot,
        reseau: derniere.reseau,
        guide: derniere.guide,
        date: derniere.occurredAt.toISOString(),
      },
      origines: tri.map(entree),
    },
  };
}

/** Identifiant d'événement DÉTERMINISTE (même clé d'idempotence = même événement : pas de doublon). */
function eventIdDeterministe(cleIdempotence: string): string {
  const h = createHash("sha256").update(`origine-v3:${cleIdempotence}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Met la charge v3 en file vers le CRM. No-op tant que l'interrupteur est éteint. Ne lève jamais :
 * la personne attend son guide, le CRM n'est qu'une copie (la reprise est celle de l'outbox).
 */
export async function transmettreOriginesV3(args: {
  email: string;
  cleIdempotence: string;
  origines: readonly OrigineAEcrire[];
  quand: Date;
}): Promise<"eteinte" | "mise_en_file" | "ignoree"> {
  if (!synchroCrmV3Active()) return "eteinte";
  // Exclusion persistante (décision D4) : une adresse de la maison n'entre jamais au CRM.
  if (estExclueDuCrm(args.email)) return "ignoree";
  try {
    const personKey = hashEmailForLookup(args.email);
    const c = chargeCrmV3(args.origines);
    if (!personKey || !c.ok) return "ignoree";
    // 🔴 CAST DOCUMENTÉ : `CrmSyncEvent.schema_version` est typé sur `CRM_SYNC_SCHEMA_VERSION` (1),
    // alors que le CRM accepte [1, 2, 3] (ADR §3) et que cette charge porte 3. Élargir ce type
    // toucherait toute la synchro (miroir exact du CRM) : on assume donc UN cast, ici, et le test
    // « charge conforme » (fixture JSON partagée) verrouille la forme réellement émise.
    const event = {
      schema_version: VERSION_SCHEMA_CRM_V3,
      event_id: eventIdDeterministe(args.cleIdempotence),
      event_type: "lead_magnet_requested",
      occurred_at: args.quand.toISOString(),
      subject_ref: `site:guide-reseau:${args.cleIdempotence}`,
      person: { person_key: personKey, email: args.email },
      payload: c.charge,
    } as unknown as CrmSyncEvent;
    const id = await enqueueCrmSyncEvent(event);
    return id === null ? "ignoree" : "mise_en_file";
  } catch {
    return "ignoree";
  }
}

// ── Lot S3 (2026-11-11) : l'événement de la page « Recevoir le guide » part AU CLIC ─────────────
//
// 🔴 DÉCISION (plan S3 révisé du 11/11) : `lead_magnet_requested` v3 part au CLIC (POST du bouton
// de la page du lien, adresse vérifiée, `verifie: true`), JAMAIS au POST de la page « Recevoir le
// guide » : à ce moment l'adresse n'est qu'une saisie, que n'importe qui peut faire. Le POST ne
// laisse que des traces côté site. L'émission est écrite par `transmettreClicGuide`
// (`crm-sync/lettre-guide.ts`) DANS la transaction qui pose la réservation `crm_emitted_at`.
// Tout reste derrière `SYNCHRO_CRM_V3` (éteint) puis les verrous de la synchro.

/** `source_slug` gouverné côté CRM pour les demandes venues d'un réseau (tag `src:guide-reseau`). */
export const SOURCE_SLUG_GUIDE_RESEAU = "guide-reseau";
/** Source du consentement recueilli par la page. */
export const SOURCE_CONSENTEMENT_PAGE_GUIDE = "page-guide-reseau";
/** La page est atteinte depuis une réponse à un commentaire : canal par défaut d'une origine sans canal. */
export const CANAL_PAR_DEFAUT_PAGE_GUIDE = "commentaire";

/**
 * Interrupteur de l'accord `optin` de la page : ÉTEINT. Il ne s'allumera qu'après la validation d'un
 * juriste. Il ne gouverne que la case FACULTATIVE des informations (jamais celle du guide). Aucune ligne
 * `newsletter_subscribers` n'est écrite par ce lot, interrupteur ouvert ou non.
 */
export function newsletterOptinPageGuideActif(): boolean {
  return process.env.SYNCHRO_CRM_V3_NEWSLETTER_OPTIN === "true";
}

/** Formats exigés par le CRM (valeurs vérifiées AVANT d'émettre, pas laissées au refus 422). */
const COMPTE_CRM = /^[a-z0-9_]{2,40}$/;
const POST_REF_CRM = /^[A-Za-z0-9_-]{8,80}$/;
const VERSION_TEXTE_CRM = /^[A-Za-z0-9._-]{3,64}$/;
const PRENOM_MAX_CRM = 50;

function originesAuFormatCrm(origines: readonly OrigineAEcrire[]): boolean {
  return origines.every(
    (o) =>
      (o.compte === null || COMPTE_CRM.test(o.compte)) &&
      (o.postRef === null || POST_REF_CRM.test(o.postRef)) &&
      (o.versionTexte === null || VERSION_TEXTE_CRM.test(o.versionTexte)),
  );
}

export interface EntreeEvenementPageGuide {
  readonly demandeId: string;
  readonly email: string;
  readonly prenom: string;
  /** Instant du clic humain (`first_click_at`). */
  readonly clicLe: Date;
  /**
   * Case FACULTATIVE « informations d'Axion-IA » (colonnes `infos_*` du contact de la page), ou
   * `null` si elle n'a pas été cochée. Le bloc `consentements` (optin) n'est émis que si elle l'est
   * ET que l'interrupteur `newsletter_optin` est allumé : la case du guide ne vaut JAMAIS optin.
   */
  readonly infos: { readonly consentiLe: Date; readonly version: string } | null;
  readonly guide: string;
  readonly origines: readonly OrigineAEcrire[];
  /** Bloc `consent` de v1 (adresse perso inscrite par consentement), à ne pas perdre. */
  readonly consent?: { readonly version?: string | null; readonly at?: Date | null };
  /**
   * Clés du payload v1 (aimant, placement, locale, email_nature, base_legale, lettre,
   * version_mention…) : fusionnées, la charge v3 (origines, verifie…) l'emporte en cas de doublon.
   */
  readonly payloadBase?: Readonly<Record<string, unknown>>;
  /** Source de la demande ; défaut `guide-reseau`. */
  readonly sourceSlug?: string;
}

export type EvenementPageGuideV3 = Omit<CrmSyncEvent, "schema_version"> & {
  schema_version: typeof VERSION_SCHEMA_CRM_V3;
};

export type ErreurEvenementPageGuide =
  "adresse" | "prenom" | "aucune_origine" | "origine_invalide" | "too_many_origines";

/**
 * Construit l'événement du clic (fonction PURE, aucune écriture). `event_id` = celui de la demande
 * (`eventIdDemandeGuide`) : le chemin v1, le chemin v3 et le rattrapage posent le MÊME identifiant,
 * donc jamais deux événements pour une demande.
 */
export function evenementPageGuideV3(
  e: EntreeEvenementPageGuide,
): { ok: true; evenement: EvenementPageGuideV3 } | { ok: false; erreur: ErreurEvenementPageGuide } {
  const email = e.email.trim();
  const personKey = email ? hashEmailForLookup(email) : null;
  if (!email || !personKey) return { ok: false, erreur: "adresse" };
  const prenom = e.prenom.trim();
  if (prenom.length === 0 || [...prenom].length > PRENOM_MAX_CRM) {
    return { ok: false, erreur: "prenom" };
  }
  if (!originesAuFormatCrm(e.origines)) return { ok: false, erreur: "origine_invalide" };
  const c = chargeCrmV3(
    e.origines.map((o) => ({ ...o, canal: o.canal ?? CANAL_PAR_DEFAUT_PAGE_GUIDE })),
  );
  if (!c.ok) return { ok: false, erreur: c.erreur };
  return {
    ok: true,
    evenement: {
      schema_version: VERSION_SCHEMA_CRM_V3,
      event_id: eventIdDemandeGuide(e.demandeId),
      event_type: "lead_magnet_requested",
      occurred_at: e.clicLe.toISOString(),
      source_slug: e.sourceSlug ?? SOURCE_SLUG_GUIDE_RESEAU,
      // Même référence que le chemin v1 : le rapprochement outbox ↔ demande (`aPuEntrer…`) la lit.
      subject_ref: `site:guide_request:${e.demandeId}`,
      person: { person_key: personKey, email, first_name: prenom },
      ...(e.infos && newsletterOptinPageGuideActif()
        ? {
            consentements: [
              {
                nature: "optin",
                date: e.infos.consentiLe.toISOString(),
                source: SOURCE_CONSENTEMENT_PAGE_GUIDE,
                version: e.infos.version,
              },
            ],
          }
        : {}),
      guides_recus: [{ guide: e.guide, date: e.clicLe.toISOString() }],
      ...(e.consent
        ? {
            consent: {
              ...(e.consent.version ? { version: e.consent.version } : {}),
              ...(e.consent.at ? { at: e.consent.at.toISOString() } : {}),
            },
          }
        : {}),
      payload: { ...e.payloadBase, ...c.charge, verifie: true },
    },
  };
}

// ── Lot guide réseau 4 : la demande venue de la CONVERSATION (aucune case cochée) ───────────────

export interface EntreeEvenementConversation {
  readonly demandeId: string;
  readonly email: string;
  /** Instant du clic humain (`first_click_at`). */
  readonly clicLe: Date;
  readonly guide: string;
  readonly origines: readonly OrigineAEcrire[];
  readonly consent?: EntreeEvenementPageGuide["consent"];
  readonly payloadBase?: EntreeEvenementPageGuide["payloadBase"];
  /** Source de la demande ; défaut `guide-reseau`. Une demande née du formulaire garde la sienne. */
  readonly sourceSlug?: string;
}

/**
 * Événement du clic pour une demande SANS page : l'origine complète, mais NI `consentements` NI
 * `first_name` (rien n'a été coché ni saisi : information M1 seulement). Fonction PURE.
 * `event_id` = celui de la demande, comme `evenementPageGuideV3`.
 */
export function evenementConversationV3(
  e: EntreeEvenementConversation,
): { ok: true; evenement: EvenementPageGuideV3 } | { ok: false; erreur: ErreurEvenementPageGuide } {
  const email = e.email.trim();
  const personKey = email ? hashEmailForLookup(email) : null;
  if (!email || !personKey) return { ok: false, erreur: "adresse" };
  if (!originesAuFormatCrm(e.origines)) return { ok: false, erreur: "origine_invalide" };
  const c = chargeCrmV3(e.origines);
  if (!c.ok) return { ok: false, erreur: c.erreur };
  return {
    ok: true,
    evenement: {
      schema_version: VERSION_SCHEMA_CRM_V3,
      event_id: eventIdDemandeGuide(e.demandeId),
      event_type: "lead_magnet_requested",
      occurred_at: e.clicLe.toISOString(),
      source_slug: e.sourceSlug ?? SOURCE_SLUG_GUIDE_RESEAU,
      subject_ref: `site:guide_request:${e.demandeId}`,
      person: { person_key: personKey, email },
      guides_recus: [{ guide: e.guide, date: e.clicLe.toISOString() }],
      ...(e.consent
        ? {
            consent: {
              ...(e.consent.version ? { version: e.consent.version } : {}),
              ...(e.consent.at ? { at: e.consent.at.toISOString() } : {}),
            },
          }
        : {}),
      payload: { ...e.payloadBase, ...c.charge, verifie: true },
    },
  };
}

// ── Lot guide réseau 4 (O4) : les origines SUIVANTES, après le premier clic ─────────────────────

/** Interrupteur des origines suivantes (O4-O5) : exactement `"true"`, éteint par défaut, lu à l'exécution. */
export function originesSuivantesActives(): boolean {
  return process.env.SYNCHRO_CRM_V3_ORIGINES_SUIVANTES === "true";
}

export type IssueOriginesSuivantes =
  "eteinte" | "exclue" | "pas_clique" | "opposee" | "rien" | "transmise" | "echec";

class RienEcritOrigines extends Error {
  constructor() {
    super("rien écrit");
    this.name = "RienEcritOrigines";
  }
}

function journaliser(resultat: IssueOriginesSuivantes, n: number): void {
  // Agrégat seulement : jamais d'adresse, d'empreinte, de post_ref ni de clé de dédoublonnage.
  console.warn(JSON.stringify({ event: "guides_reseau_origines_crm", resultat, n }));
}

/**
 * Transmet au CRM les origines d'une personne pour un guide, en charge CUMULATIVE (les 20 actives
 * les plus récentes), APRÈS son premier clic seulement (D1 du lot S3). Ne lève jamais.
 *
 * Écriture de l'outbox et passage `crm_statut = 'transmise'` dans UNE transaction, sous le verrou
 * consultatif de la personne, avec l'opposition relue DANS la transaction : un stop l'emporte
 * (origines `ecartee`, jamais supprimées). `event_id` déterministe de l'origine déclenchante :
 * rejouer = même identifiant = pas de doublon.
 */
export async function transmettreOriginesSuivantes(args: {
  email: string;
  emailKey: string;
  guide: string;
  /** Clé de dédoublonnage de l'origine déclenchante ; défaut : la plus récente encore en attente. */
  declenchante?: string;
}): Promise<IssueOriginesSuivantes> {
  if (
    !synchroCrmV3Active() ||
    !originesSuivantesActives() ||
    !isCrmSyncEnabled() ||
    !isCrmSyncGuideEnabled()
  ) {
    return "eteinte";
  }
  try {
    if (estExclueDuCrm(args.email)) {
      journaliser("exclue", 0);
      return "exclue";
    }
    const personKey = hashEmailForLookup(args.email);
    if (!personKey) return "echec";
    const maintenant = new Date();
    const issue = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"origines:" + args.emailKey}))`;
      // La personne a-t-elle déjà cliqué ? Lu APRÈS le verrou, DANS la transaction : le clic prend
      // le même verrou, donc on voit son état validé ou on attend sa fin. Sinon la charge partira
      // au premier clic (jamais avant).
      const demande = await tx.guideRequest.findUnique({
        where: { emailKey_aimant: { emailKey: args.emailKey, aimant: args.guide } },
        select: { id: true, firstClickAt: true, crmEmittedAt: true },
      });
      if (demande === null || demande.firstClickAt === null || demande.crmEmittedAt === null) {
        return { issue: "pas_clique" as const, n: 0, id: null };
      }
      if (await estOpposee(args.email, tx)) {
        const r = await tx.guideReseauOrigine.updateMany({
          where: { emailKey: args.emailKey, archiveeLe: null, crmStatut: null },
          data: { crmStatut: "ecartee", crmTraiteeLe: maintenant },
        });
        return { issue: "opposee" as const, n: r.count, id: null };
      }
      const lues = await lireOriginesActives(tx, args.emailKey, args.guide);
      const enAttente = lues.filter((o) => o.crmStatut === null);
      if (enAttente.length === 0) return { issue: "rien" as const, n: 0, id: null };
      const declenchante =
        enAttente.find((o) => o.cleDedoublonnage === args.declenchante) ?? enAttente[0]!;
      // Même contrôle de format que le clic : vérifié AVANT d'émettre, pas laissé au refus 422
      // (les origines sont marquées « transmise » dès l'outbox). Annule la transaction, rien d'écrit.
      const aEcrire = lues.map((o) => ({ ...o, cleIdempotence: "" }));
      if (!originesAuFormatCrm(aEcrire)) throw new RienEcritOrigines();
      const c = chargeCrmV3(aEcrire);
      if (!c.ok) throw new RienEcritOrigines();
      const cle = declenchante.cleDedoublonnage;
      const event = {
        schema_version: VERSION_SCHEMA_CRM_V3,
        event_id: eventIdDuNom(`origine-v3:o-${cle}`),
        event_type: "lead_magnet_requested",
        occurred_at: maintenant.toISOString(),
        subject_ref: `site:guide-reseau:o-${cle.slice(0, 40)}`,
        person: { person_key: personKey, email: args.email },
        payload: c.charge,
      } as unknown as CrmSyncEvent;
      const id = await enqueueCrmSyncEvent(event, { tx, mettreEnFile: false });
      if (id === null) throw new RienEcritOrigines();
      const r = await tx.guideReseauOrigine.updateMany({
        where: { id: { in: lues.map((o) => o.id) }, crmStatut: null },
        data: { crmStatut: "transmise", crmTraiteeLe: maintenant },
      });
      return { issue: "transmise" as const, n: r.count, id };
    });
    if (issue.id !== null) mettreEnFileCrm(issue.id);
    journaliser(issue.issue, issue.n);
    return issue.issue;
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "guides_reseau_origines_crm",
        resultat: "echec",
        erreur: e instanceof Error ? e.name : "erreur",
      }),
    );
    return "echec";
  }
}
