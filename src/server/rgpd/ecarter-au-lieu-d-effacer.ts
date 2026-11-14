/**
 * DEMANDE D'EFFACEMENT RGPD → MISE À L'ÉCART (décision de Williams du 11/11/2026, fait foi).
 *
 * 🔴 AUCUNE SUPPRESSION. Avant cette décision, `/api/gdpr-erase` et le bouton « Effacer (RGPD) »
 * de la console supprimaient ou anonymisaient une vingtaine de tables (`guide_requests`,
 * `newsletter_subscribers`, `email_outbox`, `crm_sync_outbox`…). Désormais, les deux chemins
 * passent ICI, et ici on ne fait que ceci :
 *
 *   1. l'adresse entre en liste d'OPPOSITION (`enregistrerOppositionPourAdresse`) : empreinte,
 *      CRM averti, envois programmés retirés. L'opposition interdit déjà toute (ré)inscription
 *      par un nouvel accord (`inscrireALaLettre`, `confirmerLettre`, demandes du guide réseau,
 *      rattrapage) ;
 *   2. la marque `email_oppositions.effacement_demande_le` est posée : plus AUCUN envoi, quel que
 *      soit le gabarit (`verdict-envoi.ts`, à l'enfilage ET au départ). Posée une fois, jamais
 *      retirée ;
 *   3. l'abonné à la lettre passe « désabonné » (mise à jour, jeton de réinscription retiré) ;
 *   4. les contacts de la page guide passent « écartés », les rapports avant audit aussi ;
 *   5. (retiré) le site n'envoie PLUS de demande `erase` au CRM : l'opposition (étape 1) le prévient
 *      déjà, et une suppression côté CRM serait contraire à la décision « aucune suppression » ;
 *   6. la PREUVE de la demande est gardée au journal (`gdpr.*`, empreintes seulement) ;
 *   7. Williams reçoit une alerte dans la CLOCHE de la console, niveau `critique` (« à traiter »),
 *      avec l'ÉCHÉANCE à J+30 dans le texte (RGPD art. 12.3). Le niveau `critique` déclenche le
 *      mécanisme d'e-mail d'alerte existant (`alertes/envoi-groupe.ts`) : aucun canal nouveau.
 *
 * L'effacement lui-même, s'il doit avoir lieu, est un geste humain.
 *
 * Chaque étape est en meilleur effort : une panne n'empêche ni la preuve ni l'alerte, et
 * l'alerte nomme les étapes en échec pour que Williams les reprenne à la main.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import { mettreContactsAEcart } from "@/server/guides-reseau/mise-a-l-ecart";
import { ecarterRapportsAvantAuditPourEmail } from "@/lib/rgpd-erase";

import {
  ACTION_DEMANDE_EFFACEMENT,
  CODE_ALERTE_EFFACEMENT,
  cibleIdAlerteDepuisEmpreinte,
} from "./constantes";

export { ACTION_DEMANDE_EFFACEMENT, CODE_ALERTE_EFFACEMENT };

export type OrigineDemandeEffacement =
  "libre-service" | "console-lettre" | "console" | "message-prive";

const LIBELLE_ORIGINE: Readonly<Record<OrigineDemandeEffacement, string>> = {
  "libre-service": "lien signé du site (/mes-donnees)",
  "console-lettre": "console › Lettre d'information",
  console: "console › Conformité RGPD (mise à l'écart d'une adresse)",
  "message-prive": "message privé reçu sur un réseau social",
};

/**
 * Origines dont l'adresse n'est PAS prouvée : n'importe qui peut écrire « effacez mes données :
 * <adresse d'un tiers> ». Pour elles, l'opposition, la trace et l'alerte sont posées, mais PAS la
 * marque (qui coupe aussi convocations et factures). Williams la pose après vérification, par le
 * geste « Mettre une adresse à l'écart » de la console (origine `console`).
 */
const ORIGINES_SANS_MARQUE: ReadonlySet<OrigineDemandeEffacement> = new Set(["message-prive"]);

export interface DemandeEcart {
  readonly email: string;
  readonly origine: OrigineDemandeEffacement;
  readonly adminUserId?: string | null;
  /** Motif saisi en console (sans adresse). */
  readonly motif?: string | null;
  /** Identifiant du jeton signé (libre-service). */
  readonly jti?: string | null;
  readonly ip?: string | null;
  /** Ligne visée par la console (abonné). */
  readonly cible?: { readonly type: string; readonly id: string } | null;
  readonly maintenant?: Date;
}

export type EtapeEcart =
  | "opposition"
  | "marque"
  | "lettre"
  | "contacts-guide"
  | "rapports-avant-audit"
  | "journal"
  | "alerte";

export interface ResultatEcart {
  readonly opposition: "ok" | "echec";
  /** `non_posee` : origine non prouvée (message privé), marque posée plus tard en console. */
  readonly marque: "ok" | "echec" | "non_posee";
  readonly abonnesEcartes: number;
  readonly contactsGuideEcartes: number;
  readonly rapportsEcartes: number;
  readonly journalId: string | null;
  readonly etapesEnEchec: readonly EtapeEcart[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function estUuid(v: string | null): v is string {
  return v !== null && UUID_RE.test(v);
}

/** Délai légal de réponse : un mois (RGPD art. 12.3), compté 30 jours. */
const DELAI_REPONSE_JOURS = 30;

function nomErreur(e: unknown): string {
  return e instanceof Error ? e.name : "erreur";
}

/** Pose la marque ; crée la ligne d'opposition si l'étape 1 n'a pas pu le faire. */
async function poserMarque(emailHash: string, quand: Date, origine: string): Promise<void> {
  const r = await prisma.emailOpposition.updateMany({
    where: { emailHash, effacementDemandeLe: null },
    data: { effacementDemandeLe: quand },
  });
  if (r.count > 0) return;
  const existante = await prisma.emailOpposition.findUnique({
    where: { emailHash },
    select: { id: true },
  });
  if (existante !== null) return; // déjà marquée : la date de la PREMIÈRE demande reste
  try {
    await prisma.emailOpposition.create({
      data: { emailHash, source: origine.slice(0, 40), effacementDemandeLe: quand },
      select: { id: true },
    });
  } catch (e) {
    // Création simultanée : l'autre a posé la ligne ; on y pose la marque.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    await prisma.emailOpposition.updateMany({
      where: { emailHash, effacementDemandeLe: null },
      data: { effacementDemandeLe: quand },
    });
  }
}

export async function ecarterPourDemandeEffacement(d: DemandeEcart): Promise<ResultatEcart> {
  const quand = d.maintenant ?? new Date();
  const email = d.email.trim().toLowerCase();
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) throw new Error("[rgpd] empreinte d'adresse indisponible");
  const origineOpposition = `effacement-${d.origine}`;
  const enEchec: EtapeEcart[] = [];
  const echec = (etape: EtapeEcart) => (e: unknown) => {
    enEchec.push(etape);
    console.error(`[rgpd] mise à l'écart, étape « ${etape} » en échec : ${nomErreur(e)}`);
  };

  // 1. Opposition (empreinte, CRM averti, envois programmés retirés).
  let opposition: "ok" | "echec" = "echec";
  try {
    const r = await enregistrerOppositionPourAdresse(email, { origine: origineOpposition });
    if (r.ok) opposition = "ok";
    else enEchec.push("opposition");
  } catch (e) {
    echec("opposition")(e);
  }

  // 2. Marque « effacement demandé » : plus AUCUN envoi.
  let marque: "ok" | "echec" | "non_posee" = "echec";
  if (ORIGINES_SANS_MARQUE.has(d.origine)) {
    marque = "non_posee";
  } else {
    await poserMarque(empreinte, quand, origineOpposition)
      .then(() => {
        marque = "ok";
      })
      .catch(echec("marque"));
  }

  // 3 et 4. Mises à l'écart, en parallèle : aucune ne dépend des autres.
  // 🔴 Adresse NON prouvée (message privé) : on ne lance QUE les contacts de la page guide, comme
  // avant. Désabonner la lettre et annuler les rapports avant audit sur la seule parole d'un tiers
  // permettrait de nuire à une autre personne. Ces deux étapes se font à la vérification (console).
  const prouvee = !ORIGINES_SANS_MARQUE.has(d.origine);
  const [lettre, contacts, rapports] = await Promise.all([
    prouvee
      ? prisma.newsletterSubscriber
          .updateMany({
            // La colonne `email` est `citext` (schema.prisma) : la comparaison ignore déjà la casse,
            // une ligne écrite avec des majuscules est donc trouvée sans `mode: "insensitive"`.
            where: { email, status: { notIn: ["unsubscribed", "bounced"] } },
            data: { status: "unsubscribed", unsubscribedAt: quand, confirmToken: null },
          })
          .then((r) => r.count)
          .catch((e: unknown) => {
            echec("lettre")(e);
            return 0;
          })
      : Promise.resolve(0),
    mettreContactsAEcart(email)
      .then((r) => r.ecartes)
      .catch((e: unknown) => {
        echec("contacts-guide")(e);
        return 0;
      }),
    prouvee
      ? ecarterRapportsAvantAuditPourEmail(email, quand)
          .then((r) => r.ecartes)
          .catch((e: unknown) => {
            echec("rapports-avant-audit")(e);
            return 0;
          })
      : Promise.resolve(0),
  ]);

  // 6. Preuve de la demande (aucune adresse en clair).
  const reference = d.cible?.id ?? d.jti ?? null;
  let journalId: string | null = null;
  try {
    const ligne = await prisma.activityLog.create({
      data: {
        adminUserId: d.adminUserId ?? null,
        action: ACTION_DEMANDE_EFFACEMENT,
        targetType: d.cible?.type ?? (d.origine === "libre-service" ? "self_service" : "console"),
        // `activity_logs.target_id` est une colonne UUID : une clé d'idempotence ou un jti qui n'en
        // est pas un ferait échouer la trace. La référence est TOUJOURS dans `changes.reference`
        // (même si c'est un UUID) : c'est là que la garde de rejeu (`guides-reseau/effacement.ts`)
        // la cherche. `targetId` n'est qu'un doublon quand elle a la forme d'un UUID.
        targetId: estUuid(reference) ? reference : null,
        changes: {
          origine: d.origine,
          ...(reference ? { reference } : {}),
          ...(d.motif ? { reason: d.motif } : {}),
          // Empreinte HMAC du site, et SHA-256 de l'adresse normalisée (relu par la liste de
          // suppression exportée, `server/newsletter/exports.ts`).
          emailHash: empreinte,
          emailSha256: createHash("sha256").update(email).digest("hex"),
          rienSupprime: true,
          opposition,
          marque,
          abonnesEcartes: lettre,
          contactsGuideEcartes: contacts,
          rapportsAvantAuditEcartes: rapports,
          etapesEnEchec: [...enEchec],
        },
        ipAddress: d.ip ?? null,
      },
      select: { id: true },
    });
    journalId = ligne.id;
  } catch (e) {
    echec("journal")(e);
  }

  // 7. Alerte dans la cloche. Import DYNAMIQUE : le service tire `next-auth`.
  try {
    const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
    const pannes =
      enEchec.length > 0
        ? ` ⚠️ Étapes en échec, à reprendre à la main : ${enEchec.join(", ")}.`
        : "";
    const sansMarque =
      marque === "non_posee"
        ? " L'adresse n'est pas prouvée (message reçu d'un tiers) : elle est en liste d'opposition " +
          "(plus de prospection) et ses contacts de la page guide sont écartés. Rien d'autre n'est " +
          "touché : ni l'abonnement à la lettre, ni les rapports avant audit, ni les envois de " +
          "service. Après vérification, la mettre à l'écart dans Conformité RGPD › « Mettre une adresse à l'écart »."
        : " La personne est mise à l'écart : plus aucun envoi, plus aucune réinscription.";
    // Le message porte la référence de la trace (ou l'heure) : une alerte résolue ne peut donc
    // jamais être confondue avec une NOUVELLE demande du même jour, même origine, même motif.
    const refAlerte = journalId ?? quand.toISOString();
    const echeance = new Date(quand.getTime() + DELAI_REPONSE_JOURS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const message =
      `Adresse : ${email}. Reçue le ${quand.toISOString().slice(0, 10)} par ${LIBELLE_ORIGINE[d.origine]}` +
      `${d.motif ? ` (motif : ${d.motif})` : ""}.${sansMarque} ` +
      "Rien n'a été supprimé. À faire : décider ce qui doit être effacé (art. 17 RGPD) et " +
      `répondre à la personne AVANT LE ${echeance} (un mois, art. 12.3 RGPD). Réf. ${refAlerte}.${pannes}`;
    const creee = await creerOuDedup({
      code: CODE_ALERTE_EFFACEMENT,
      niveau: "critique",
      titre: `Demande d'effacement RGPD à traiter avant le ${echeance}`,
      message,
      cibleType: "EmailOpposition",
      cibleId: cibleIdAlerteDepuisEmpreinte(empreinte),
      metadata: { journalId, origine: d.origine, echeance },
    });
    // Demande dédoublonnée (alerte déjà OUVERTE pour cette personne) : aucune alerte neuve. On inscrit cette trace sur l'alerte existante pour que
    // la demande puisse se fermer avec elle (`metadata.journalIds`, lu par `demandes.ts`).
    if (creee === null && journalId !== null) {
      const existante = await prisma.alerteSysteme.findFirst({
        where: {
          code: CODE_ALERTE_EFFACEMENT,
          cibleId: cibleIdAlerteDepuisEmpreinte(empreinte),
          // Seulement une alerte encore OUVERTE : une alerte résolue ferait afficher la nouvelle
          // demande « faite » avec une date de traitement antérieure à la demande.
          resolue: false,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, metadata: true },
      });
      if (existante) {
        const meta =
          existante.metadata && typeof existante.metadata === "object"
            ? (existante.metadata as Record<string, unknown>)
            : {};
        const deja = Array.isArray(meta["journalIds"])
          ? (meta["journalIds"] as unknown[]).filter((v): v is string => typeof v === "string")
          : [];
        await prisma.alerteSysteme.update({
          where: { id: existante.id },
          data: { metadata: { ...meta, journalIds: [...new Set([...deja, journalId])] } as never },
        });
      }
    }
  } catch (e) {
    echec("alerte")(e);
  }

  return {
    opposition,
    marque,
    abonnesEcartes: lettre,
    contactsGuideEcartes: contacts,
    rapportsEcartes: rapports,
    journalId,
    etapesEnEchec: enEchec,
  };
}
