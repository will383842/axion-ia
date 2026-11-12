/**
 * EXPORT ART. 15 — le contact laissé sur la page « Recevoir le guide » (lot S2, 2026-11-08).
 *
 * Appelé par `src/app/api/gdpr-export/route.ts`. Rend à une personne, par son adresse, ce que la
 * table `contacts_guide_reseau` détient SUR ELLE : son prénom (déchiffré), le mot et le réseau
 * d'où elle est venue, la version et l'empreinte du texte de la case qu'elle a cochée, la date de
 * son accord, l'état du remerciement, l'état de la PREUVE de son accord (en attente, confirmée,
 * non vérifiée) et ses deux dates.
 *
 * Rend aussi ses ORIGINES (`guide_reseau_origines`, même empreinte d'adresse) : mot, réseau, guide,
 * référence du post, compte, famille, date de l'origine et date de mise en archive éventuelle.
 *
 * Ce qui n'est PAS rendu, et pourquoi : l'empreinte du jeton du lien (un identifiant technique
 * d'usage unique, sans information sur elle), la référence de la conversation et l'empreinte HMAC
 * du commentaire (empreintes à clé serveur d'identifiants opaques du réseau, qui ne se relisent
 * pas), ni la clé de dédoublonnage (technique).
 *
 * Ne lève pas : une lecture impossible devient un avertissement.
 */
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export interface ContactGuideReseauExporte {
  readonly prenom: string | null;
  readonly mot: string | null;
  readonly reseau: string | null;
  readonly postRef: string | null;
  readonly versionTexteCase: string;
  readonly empreinteTexteCase: string;
  readonly consentiLe: Date;
  readonly remerciement: string;
  /**
   * Preuve de l'accord : `en_attente` (adresse saisie, pas encore vérifiée), `confirmee` (clic sur
   * le bouton du lien du guide), `non_verifiee` (mise à l'écart, rien n'est supprimé) ou
   * `sans_objet`. Une ligne d'avant la migration (NULL) se lit `en_attente`.
   */
  readonly preuve: string;
  readonly preuveConfirmeeLe: Date | null;
  readonly preuveEcarteeLe: Date | null;
}

export interface OrigineGuideReseauExportee {
  readonly mot: string;
  readonly reseau: string;
  readonly guide: string;
  readonly postRef: string | null;
  readonly compte: string | null;
  readonly famille: string | null;
  readonly occurredAt: Date;
  readonly archiveeLe: Date | null;
}

export interface ExportGuideReseau {
  readonly contacts: readonly ContactGuideReseauExporte[];
  readonly origines: readonly OrigineGuideReseauExportee[];
  readonly avertissements: readonly string[];
}

export async function exporterGuideReseauPour(email: string): Promise<ExportGuideReseau> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { contacts: [], origines: [], avertissements: [] };
  try {
    const lignes = await prisma.contactGuideReseau.findMany({
      where: { emailKey: empreinte },
      orderBy: { consentiLe: "asc" },
      select: {
        prenom: true,
        mot: true,
        reseau: true,
        postRef: true,
        versionConsentement: true,
        consentEmpreinte: true,
        consentiLe: true,
        merciStatut: true,
        preuveStatut: true,
        preuveConfirmeeLe: true,
        preuveEcarteeLe: true,
      },
    });
    const origines = await prisma.guideReseauOrigine.findMany({
      where: { emailKey: empreinte },
      orderBy: { occurredAt: "asc" },
      select: {
        mot: true,
        reseau: true,
        guide: true,
        postRef: true,
        compte: true,
        famille: true,
        occurredAt: true,
        archiveeLe: true,
      },
    });
    return {
      origines: origines.map((o) => ({
        mot: o.mot,
        reseau: o.reseau,
        guide: o.guide,
        postRef: o.postRef,
        compte: o.compte,
        famille: o.famille,
        occurredAt: o.occurredAt,
        archiveeLe: o.archiveeLe,
      })),
      contacts: lignes.map((l) => ({
        prenom: decryptPii(l.prenom) ?? null,
        mot: l.mot,
        reseau: l.reseau,
        postRef: l.postRef,
        versionTexteCase: l.versionConsentement,
        empreinteTexteCase: l.consentEmpreinte,
        consentiLe: l.consentiLe,
        remerciement: l.merciStatut,
        preuve: l.preuveStatut ?? "en_attente",
        preuveConfirmeeLe: l.preuveConfirmeeLe,
        preuveEcarteeLe: l.preuveEcarteeLe,
      })),
      avertissements: [],
    };
  } catch {
    return {
      contacts: [],
      origines: [],
      avertissements: [
        "guideReseau : lecture impossible au moment de l'export — cette rubrique peut être incomplète. " +
          "Écrivez à contact@axion-ia.com pour une vérification manuelle.",
      ],
    };
  }
}
