/**
 * PREUVE DE L'ACCORD de la page « Recevoir le guide » — trois états (lot guide réseau 3).
 *
 * L'adresse saisie sur la page n'est qu'une SAISIE : n'importe qui peut taper l'adresse d'un tiers.
 * L'accord est donc écrit « en attente » (`page-confirmation.ts`), puis :
 *
 *   en_attente ── premier POST du bouton du lien du guide, APRÈS l'accord ──▶ confirmee
 *   en_attente ── N jours sans clic (mise à l'écart, JAMAIS une suppression) ─▶ non_verifiee
 *   non_verifiee ── clic tardif (le geste de la personne elle-même, décision D2) ─▶ confirmee
 *
 * `sans_objet` : MARQUE d'une adresse opposée (aucune donnée de personne) — jamais touchée.
 * Un statut NULL (ligne d'avant la migration) se lit « en_attente ».
 *
 * 🔴 RÈGLES. Aucune suppression (ni `delete`, ni `deleteMany`) : l'écart change un état, rien
 * d'autre. Le registre `consent_events` reste append-only (aucun UPDATE). Un « stop » n'est pas lu
 * ici et ne change pas l'état de preuve (c'est un fait passé) : il continue de tout bloquer
 * ailleurs (envois, CRM). Aucune transition ne déclenche jamais d'envoi. `merci_statut` n'est pas
 * touché. Rien de personnel dans les journaux : des compteurs.
 *
 * Les transitions sont des `updateMany` CONDITIONNELS : seul le passage qui change réellement
 * l'état écrit au registre (rejeu, double clic et concurrence n'écrivent rien de plus).
 */
import { FORM_REF_PAGE_GUIDE, FORM_REF_PAGE_GUIDE_INFOS } from "@/content/guides-reseau";
import { recordConsentEvent, type ConsentAction } from "@/lib/consents";
import { prisma } from "@/lib/prisma";
import { JOURS_AVANT_ECART_PREUVE, preuveEcartActif } from "./config";

export const PREUVE_EN_ATTENTE = "en_attente";
export const PREUVE_CONFIRMEE = "confirmee";
export const PREUVE_NON_VERIFIEE = "non_verifiee";
export const PREUVE_SANS_OBJET = "sans_objet";

/** Clé d'adresse d'une MARQUE (adresse opposée) : aucune donnée de personne. */
const CLE_MARQUE = "-";

/** Version écrite au registre : celle de la ligne elle-même (texte de la case + début de l'empreinte). */
function versionDeLaLigne(c: { versionConsentement: string; consentEmpreinte: string }): string {
  return `${c.versionConsentement}.${c.consentEmpreinte.slice(0, 32)}`;
}

/**
 * Version de la ligne « informations » (case facultative), ou null si la case n'était pas cochée
 * (`infosStatut` = « aucune ») ou si sa version n'est pas lisible.
 */
function versionInfosDeLaLigne(c: {
  infosStatut: string;
  infosVersion: string | null;
  infosEmpreinte: string | null;
}): string | null {
  if (c.infosStatut === "aucune" || !c.infosVersion || !c.infosEmpreinte) return null;
  return `${c.infosVersion}.${c.infosEmpreinte.slice(0, 32)}`;
}

function journal(transition: string, champs: Record<string, number>): void {
  console.warn(JSON.stringify({ event: "guides_reseau_preuve", transition, ...champs }));
}

/**
 * Premier clic (POST) sur le bouton du lien du guide : les accords « en attente » (ou NULL, ou
 * mis à l'écart) de CETTE demande, donnés AVANT le clic, passent « confirmée ». Traite TOUS les
 * contacts liés à la demande (la personne a pu utiliser la page deux fois pour le même guide).
 *
 * Ne lève jamais (même discipline que `recordConsentEvent`) : la personne a son PDF quoi qu'il
 * arrive ; si la base est en panne, la ligne reste « en attente » et se confirmera au clic suivant.
 */
export async function confirmerPreuvesAuClic(guideRequestId: string, clicLe: Date): Promise<void> {
  try {
    const passees = await prisma.contactGuideReseau.updateMany({
      where: {
        guideRequestId,
        OR: [
          { preuveStatut: PREUVE_EN_ATTENTE },
          { preuveStatut: null },
          { preuveStatut: PREUVE_NON_VERIFIEE },
        ],
        // Un clic antérieur à la case (ancien e-mail de la même demande) ne vérifie pas CET accord.
        consentiLe: { lte: clicLe },
      },
      data: { preuveStatut: PREUVE_CONFIRMEE, preuveConfirmeeLe: clicLe },
    });
    if (passees.count === 0) return;

    // Les lignes réellement passées par CE clic : même demande, même instant de confirmation.
    const lignes = await prisma.contactGuideReseau.findMany({
      where: { guideRequestId, preuveStatut: PREUVE_CONFIRMEE, preuveConfirmeeLe: clicLe },
      select: {
        emailKey: true,
        versionConsentement: true,
        consentEmpreinte: true,
        infosStatut: true,
        infosVersion: true,
        infosEmpreinte: true,
      },
    });
    // L'adresse vient de la demande, jamais d'un journal.
    const demande = await prisma.guideRequest.findUnique({
      where: { id: guideRequestId },
      select: { email: true },
    });
    let ecrites = 0;
    if (demande?.email) {
      for (const l of lignes) {
        if (l.emailKey === CLE_MARQUE) continue;
        const ok = await recordConsentEvent({
          email: demande.email,
          formRef: FORM_REF_PAGE_GUIDE,
          consentVersion: versionDeLaLigne(l),
          action: "consent_confirme",
          occurredAt: clicLe,
        }).catch(() => false);
        if (ok) ecrites += 1;
        // Case facultative « informations » cochée : sa preuve passe aussi « confirmée ».
        const versionInfos = versionInfosDeLaLigne(l);
        if (versionInfos !== null) {
          const okInfos = await recordConsentEvent({
            email: demande.email,
            formRef: FORM_REF_PAGE_GUIDE_INFOS,
            consentVersion: versionInfos,
            action: "consent_confirme",
            occurredAt: clicLe,
          }).catch(() => false);
          if (okInfos) ecrites += 1;
        }
      }
    }
    journal(PREUVE_CONFIRMEE, { lignes: passees.count, registre: ecrites });
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "guides_reseau_preuve_echec",
        transition: PREUVE_CONFIRMEE,
        erreur: err instanceof Error ? err.name : "erreur",
      }),
    );
  }
}

const JOUR_MS = 24 * 3_600_000;
const TAILLE_LOT = 500;
/** Fenêtre de la réparation du registre : les transitions des 30 derniers jours. */
const JOURS_REPARATION = 30;

export interface ResultatEcart {
  /** Lignes passées « non vérifiée » par ce passage. */
  readonly lignes: number;
  /** Lignes passées SANS ligne de registre (aucune demande liée, donc aucune adresse). */
  readonly sansAdresse: number;
  /** Le worker a tourné avant la migration (Prisma P2022) : rien n'a été fait. */
  readonly colonneAbsente: boolean;
}

function estColonneAbsente(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2022";
}

/** L'état « en attente » : la valeur écrite OU NULL (ligne d'avant la migration). */
const SEULEMENT_EN_ATTENTE = [{ preuveStatut: PREUVE_EN_ATTENTE }, { preuveStatut: null }];

/**
 * MISE À L'ÉCART : les accords « en attente » donnés il y a plus de N jours passent « non vérifiée ».
 * Aucune suppression : prénom chiffré, empreinte du texte et dates restent. Le registre reçoit un
 * `consent_ecarte` par ligne réellement passée (l'adresse est lue via la demande liée).
 *
 * Éteint par défaut (`PREUVE_PAGE_GUIDE_ECART_ENABLED`) : le job sort SANS lire la base. Idempotent
 * (`updateMany` conditionnel). Une colonne absente (worker plus récent que la migration) est
 * journalisée et sans effet ; toute autre panne remonte, pour que le job échoue et se voie.
 */
export async function ecarterPreuvesNonVerifiees(maintenant: Date): Promise<ResultatEcart> {
  let lignes = 0;
  let sansAdresse = 0;
  if (!preuveEcartActif()) return { lignes, sansAdresse, colonneAbsente: false };
  try {
    const limite = new Date(maintenant.getTime() - JOURS_AVANT_ECART_PREUVE * JOUR_MS);
    let curseur: { consentiLe: Date; id: string } | null = null;
    for (;;) {
      const lot: Array<{
        id: string;
        consentiLe: Date;
        emailKey: string;
        versionConsentement: string;
        consentEmpreinte: string;
        infosStatut: string;
        infosVersion: string | null;
        infosEmpreinte: string | null;
        guideRequest: { email: string } | null;
      }> = await prisma.contactGuideReseau.findMany({
        where: {
          AND: [
            { OR: SEULEMENT_EN_ATTENTE },
            { consentiLe: { lte: limite } },
            ...(curseur
              ? [
                  {
                    OR: [
                      { consentiLe: { gt: curseur.consentiLe } },
                      { consentiLe: curseur.consentiLe, id: { gt: curseur.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ consentiLe: "asc" }, { id: "asc" }],
        take: TAILLE_LOT,
        select: {
          id: true,
          consentiLe: true,
          emailKey: true,
          versionConsentement: true,
          consentEmpreinte: true,
          infosStatut: true,
          infosVersion: true,
          infosEmpreinte: true,
          guideRequest: { select: { email: true } },
        },
      });
      if (lot.length === 0) break;
      const dernier = lot[lot.length - 1]!;
      curseur = { consentiLe: dernier.consentiLe, id: dernier.id };

      // Conditionnel : si le clic est passé entre la lecture et l'écriture, la ligne n'est plus
      // « en attente » et n'est pas touchée.
      const passees = await prisma.contactGuideReseau.updateMany({
        where: {
          id: { in: lot.map((l) => l.id) },
          OR: SEULEMENT_EN_ATTENTE,
          consentiLe: { lte: limite },
        },
        data: { preuveStatut: PREUVE_NON_VERIFIEE, preuveEcarteeLe: maintenant },
      });
      if (passees.count > 0) {
        const ecartees = await prisma.contactGuideReseau.findMany({
          where: {
            id: { in: lot.map((l) => l.id) },
            preuveStatut: PREUVE_NON_VERIFIEE,
            preuveEcarteeLe: maintenant,
          },
          select: { id: true },
        });
        const ids = new Set(ecartees.map((e) => e.id));
        for (const l of lot) {
          if (!ids.has(l.id)) continue;
          lignes += 1;
          if (l.emailKey === CLE_MARQUE || !l.guideRequest?.email) {
            sansAdresse += 1;
            continue;
          }
          await recordConsentEvent({
            email: l.guideRequest.email,
            formRef: FORM_REF_PAGE_GUIDE,
            consentVersion: versionDeLaLigne(l),
            action: "consent_ecarte",
            occurredAt: maintenant,
          }).catch(() => false);
          const versionInfos = versionInfosDeLaLigne(l);
          if (versionInfos !== null) {
            await recordConsentEvent({
              email: l.guideRequest.email,
              formRef: FORM_REF_PAGE_GUIDE_INFOS,
              consentVersion: versionInfos,
              action: "consent_ecarte",
              occurredAt: maintenant,
            }).catch(() => false);
          }
        }
      }
      if (lot.length < TAILLE_LOT) break;
    }
    if (lignes > 0) journal(PREUVE_NON_VERIFIEE, { lignes, sans_adresse: sansAdresse });
    return { lignes, sansAdresse, colonneAbsente: false };
  } catch (err) {
    if (estColonneAbsente(err)) {
      console.warn(
        JSON.stringify({ event: "guides_reseau_preuve", transition: "colonne_absente" }),
      );
      return { lignes: 0, sansAdresse: 0, colonneAbsente: true };
    }
    throw err;
  }
}

/**
 * RÉPARATION du registre : `recordConsentEvent` est best-effort. Pour les lignes « confirmée » /
 * « non vérifiée » des 30 derniers jours sans ligne de registre correspondante (même personne,
 * même référence, même action, même instant), on l'écrit. Append-only : on n'ajoute que ce qui
 * manque. Sous le même interrupteur que l'écart ; au plus un lot par passage.
 */
export async function reparerRegistrePreuves(maintenant: Date): Promise<number> {
  if (!preuveEcartActif()) return 0;
  try {
    const depuis = new Date(maintenant.getTime() - JOURS_REPARATION * JOUR_MS);
    const candidates = await prisma.contactGuideReseau.findMany({
      where: {
        OR: [
          { preuveStatut: PREUVE_CONFIRMEE, preuveConfirmeeLe: { gte: depuis } },
          { preuveStatut: PREUVE_NON_VERIFIEE, preuveEcarteeLe: { gte: depuis } },
        ],
      },
      orderBy: [{ consentiLe: "asc" }, { id: "asc" }],
      take: TAILLE_LOT,
      select: {
        emailKey: true,
        versionConsentement: true,
        consentEmpreinte: true,
        preuveStatut: true,
        preuveConfirmeeLe: true,
        preuveEcarteeLe: true,
        infosStatut: true,
        infosVersion: true,
        infosEmpreinte: true,
        guideRequest: { select: { email: true } },
      },
    });
    let reparees = 0;
    for (const c of candidates) {
      if (c.emailKey === CLE_MARQUE || !c.guideRequest?.email) continue;
      const confirmee = c.preuveStatut === PREUVE_CONFIRMEE;
      const action: ConsentAction = confirmee ? "consent_confirme" : "consent_ecarte";
      const quand = confirmee ? c.preuveConfirmeeLe : c.preuveEcarteeLe;
      if (quand === null) continue;
      const existante = await prisma.consentEvent.findFirst({
        where: { personKey: c.emailKey, formRef: FORM_REF_PAGE_GUIDE, action, occurredAt: quand },
        select: { id: true },
      });
      if (existante === null) {
        const ok = await recordConsentEvent({
          email: c.guideRequest.email,
          formRef: FORM_REF_PAGE_GUIDE,
          consentVersion: versionDeLaLigne(c),
          action,
          occurredAt: quand,
        }).catch(() => false);
        if (ok) reparees += 1;
      }
      // Case facultative « informations » : sa ligne se vérifie à part (elle peut manquer seule).
      const versionInfos = versionInfosDeLaLigne(c);
      if (versionInfos !== null) {
        const infosExistante = await prisma.consentEvent.findFirst({
          where: {
            personKey: c.emailKey,
            formRef: FORM_REF_PAGE_GUIDE_INFOS,
            action,
            occurredAt: quand,
          },
          select: { id: true },
        });
        if (infosExistante === null) {
          const okInfos = await recordConsentEvent({
            email: c.guideRequest.email,
            formRef: FORM_REF_PAGE_GUIDE_INFOS,
            consentVersion: versionInfos,
            action,
            occurredAt: quand,
          }).catch(() => false);
          if (okInfos) reparees += 1;
        }
      }
    }
    if (reparees > 0) journal("reparation", { lignes: reparees });
    return reparees;
  } catch (err) {
    if (estColonneAbsente(err)) return 0;
    throw err;
  }
}
