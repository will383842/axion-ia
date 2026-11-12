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
import { MERCI_STATUTS_ECARTES_LUS } from "./merci-statut";
import { lireOriginesActives, type LecteurOrigines } from "./origines";
import {
  evenementConversationV3,
  evenementPageGuideV3,
  type EntreeEvenementPageGuide,
  type ErreurEvenementPageGuide,
  type EvenementPageGuideV3,
} from "./synchro-v3";

/** Ce que la lecture demande à la transaction (méthodes : bivariantes, comme `CrmOutboxWriter`). */
export interface LecteurPageGuide extends LecteurOrigines {
  contactGuideReseau: {
    findFirst(args: {
      where: { guideRequestId: string; merciStatut: { notIn: string[] } };
      orderBy: { createdAt: "asc" };
      select: {
        prenom: true;
        consentiLe: true;
        versionConsentement: true;
        infosVersion: true;
        infosConsentiLe: true;
      };
    }): PromiseLike<{
      prenom: string;
      consentiLe: Date;
      versionConsentement: string;
      infosVersion: string | null;
      infosConsentiLe: Date | null;
    } | null>;
  };
}

export interface DemandePourClic {
  readonly id: string;
  readonly email: string;
  readonly emailKey: string;
  readonly aimant: string;
}

export type LectureClicPageGuide =
  /** `origineIds` : les origines portées par l'événement, que l'appelant marque « transmise ». */
  | { ok: true; evenement: EvenementPageGuideV3; origineIds: string[] }
  | { ok: false; raison: "sans_contact" | "sans_origine" | ErreurEvenementPageGuide };

export async function evenementDuClicPageGuide(
  tx: LecteurPageGuide,
  d: DemandePourClic,
  clicLe: Date,
  /** Ce que v1 envoie déjà (consent, payload) : rien n'en est perdu en passant à v3. */
  complement: Pick<EntreeEvenementPageGuide, "consent" | "payloadBase"> = {},
  /** Source de la demande ; défaut `guide-reseau` (une demande née du formulaire garde la sienne). */
  sourceSlug?: string,
): Promise<LectureClicPageGuide> {
  // Toutes les origines ACTIVES de la personne pour ce guide (les 20 plus récentes), pas seulement
  // celle écrite à la seconde de la case : un second dépôt, un autre post, voyagent aussi.
  const lues = await lireOriginesActives(tx, d.emailKey, d.aimant);
  const origines = lues.map((o) => ({ ...o, cleIdempotence: "" }));
  const origineIds = lues.map((o) => o.id);
  const contact = await tx.contactGuideReseau.findFirst({
    // Un contact écarté (STOP) ne donne jamais son prénom ni son accord « infos ».
    where: { guideRequestId: d.id, merciStatut: { notIn: [...MERCI_STATUTS_ECARTES_LUS] } },
    orderBy: { createdAt: "asc" },
    select: {
      prenom: true,
      consentiLe: true,
      versionConsentement: true,
      infosVersion: true,
      infosConsentiLe: true,
    },
  });
  if (contact === null) {
    // Adresse tapée dans la conversation : aucune case cochée → origine sans consentement ni prénom.
    if (lues.length === 0) return { ok: false, raison: "sans_contact" };
    const c = evenementConversationV3({
      demandeId: d.id,
      email: d.email,
      clicLe,
      guide: d.aimant,
      origines,
      ...(sourceSlug ? { sourceSlug } : {}),
      ...complement,
    });
    return c.ok
      ? { ok: true, evenement: c.evenement, origineIds }
      : { ok: false, raison: c.erreur };
  }
  const prenom = decryptPii(contact.prenom);
  if (!prenom || prenom === PII_DECRYPT_PLACEHOLDER) return { ok: false, raison: "prenom" };
  const r = evenementPageGuideV3({
    demandeId: d.id,
    email: d.email,
    prenom,
    clicLe,
    infos:
      contact.infosConsentiLe && contact.infosVersion
        ? { consentiLe: contact.infosConsentiLe, version: contact.infosVersion }
        : null,
    guide: d.aimant,
    origines,
    ...(sourceSlug ? { sourceSlug } : {}),
    ...complement,
  });
  return r.ok ? { ok: true, evenement: r.evenement, origineIds } : { ok: false, raison: r.erreur };
}
