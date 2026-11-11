/**
 * LECTURE DU CLIC SUR LE LIEN DU GUIDE, côté page « Recevoir le guide » (lot S3, 2026-11-11).
 *
 * Appelée par `transmettreClicGuide` (`crm-sync/lettre-guide.ts`) DANS la transaction de la
 * réservation : elle relit ce que la page a laissé au POST (prénom chiffré, case cochée, origine de
 * ce dépôt) et construit l'événement v3 (`evenementPageGuideV3`). Aucune écriture ici.
 *
 * `sans_contact` : la demande ne vient pas de la page (aucun consentement enregistré) → l'appelant
 * émet l'événement SANS bloc v3, donc sans optin ni prénom. Toute autre raison (prénom illisible,
 * valeur hors format CRM, origine absente) a le même effet : le guide a été remis, le CRM reçoit
 * l'événement de base, jamais une charge que le CRM refuserait.
 */
import { decryptPii, PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import type { OrigineAEcrire } from "./origines";
import {
  evenementPageGuideV3,
  type EntreeEvenementPageGuide,
  type ErreurEvenementPageGuide,
  type EvenementPageGuideV3,
} from "./synchro-v3";

type OrigineLue = Omit<OrigineAEcrire, "cleIdempotence">;

/** Ce que la lecture demande à la transaction (méthodes : bivariantes, comme `CrmOutboxWriter`). */
export interface LecteurPageGuide {
  contactGuideReseau: {
    findFirst(args: {
      where: { guideRequestId: string };
      orderBy: { createdAt: "asc" };
      select: { prenom: true; consentiLe: true; versionConsentement: true };
    }): PromiseLike<{ prenom: string; consentiLe: Date; versionConsentement: string } | null>;
  };
  guideReseauOrigine: {
    findMany(args: {
      where: {
        emailKey: string;
        guide: string;
        famille: string;
        archiveeLe: null;
        occurredAt: Date;
      };
      select: { [K in keyof OrigineLue]: true };
    }): PromiseLike<OrigineLue[]>;
  };
}

export interface DemandePourClic {
  readonly id: string;
  readonly email: string;
  readonly emailKey: string;
  readonly aimant: string;
}

export type LectureClicPageGuide =
  | { ok: true; evenement: EvenementPageGuideV3 }
  | { ok: false; raison: "sans_contact" | ErreurEvenementPageGuide };

export async function evenementDuClicPageGuide(
  tx: LecteurPageGuide,
  d: DemandePourClic,
  clicLe: Date,
  /** Ce que v1 envoie déjà (consent, payload) : rien n'en est perdu en passant à v3. */
  complement: Pick<EntreeEvenementPageGuide, "consent" | "payloadBase"> = {},
): Promise<LectureClicPageGuide> {
  const contact = await tx.contactGuideReseau.findFirst({
    where: { guideRequestId: d.id },
    orderBy: { createdAt: "asc" },
    select: { prenom: true, consentiLe: true, versionConsentement: true },
  });
  if (contact === null) return { ok: false, raison: "sans_contact" };
  const prenom = decryptPii(contact.prenom);
  if (!prenom || prenom === PII_DECRYPT_PLACEHOLDER) return { ok: false, raison: "prenom" };
  // L'origine de CE dépôt : écrite par la page à la seconde de la case (même instant tronqué).
  const lignes = await tx.guideReseauOrigine.findMany({
    where: {
      emailKey: d.emailKey,
      guide: d.aimant,
      famille: "guide_reseau",
      archiveeLe: null,
      occurredAt: new Date(Math.floor(contact.consentiLe.getTime() / 1000) * 1000),
    },
    select: {
      mot: true,
      reseau: true,
      guide: true,
      postRef: true,
      postUrl: true,
      canal: true,
      famille: true,
      detail: true,
      compte: true,
      versionTexte: true,
      utmCampagne: true,
      commentaireRefHmac: true,
      occurredAt: true,
    },
  });
  const r = evenementPageGuideV3({
    demandeId: d.id,
    email: d.email,
    prenom,
    clicLe,
    consentiLe: contact.consentiLe,
    versionConsentement: contact.versionConsentement,
    guide: d.aimant,
    origines: lignes.map((o) => ({ ...o, cleIdempotence: "" })),
    ...complement,
  });
  return r.ok ? r : { ok: false, raison: r.erreur };
}
