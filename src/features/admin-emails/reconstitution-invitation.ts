// APERÇU RECONSTITUÉ d'une invitation apporteur partie AVANT la conservation
// des copies (2026-09-27, décision Will).
//
// ── Ce que c'est, et ce que ce n'est pas ──────────────────────────────────
// Ce n'est PAS la copie d'origine : rien de ce qui est parti n'a été gardé. On
// RE-REND le gabarit `apporteur-invitation-appel` avec ce que l'envoi a dû
// utiliser, relu aujourd'hui. L'écran le bande en conséquence.
//
// ── Les entrées, et d'où elles viennent ───────────────────────────────────
//   · le prénom : déchiffré de la fiche (`decryptPii`), comme à l'envoi ;
//   · le lien de réservation : `CALENDLY_APPORTEUR_URL` — le lien PAR DÉFAUT de
//     la console. L'administrateur pouvait le modifier au moment d'inviter :
//     l'aperçu le dit ;
//   · candidature / variante d'objet / offre : même règle que l'envoi
//     (`marqueDemarche` — offre d'emploi d'abord, puis toute fiche qui n'est
//     pas une saisie manuelle est une candidature ; `varianteObjet`) ;
//   · provenance (saisie manuelle seulement) : même règle que l'envoi ;
//   · le lien du dossier : `dossierDejaArrive`, évalué sur les lignes de la
//     personne qui existaient AU MOMENT DE L'ENVOI (un dossier arrivé depuis
//     ne doit pas faire disparaître un lien qui était dans le message).
//
// ── Les dates charnières — sinon l'aperçu ment ────────────────────────────
// Le gabarit a changé deux fois le 27/09 ; un e-mail se rend avec le code du
// worker qui l'envoie. Mesuré sur les runs de déploiement :
//   · #1184 (« ta candidature est retenue », 4 objets) — déploiement terminé à
//     15:31:04 UTC (run 36326511658). Avant : l'invitation ne parlait pas de
//     candidature, et le kit avait encore changé le 21/09 (#1125). On ne
//     reconstitue donc RIEN avant cette date : trop de versions, aucune preuve.
//   · #1187 (signature « fondateur-court ») — déploiement terminé à 18:12:21 UTC
//     (run 36336574601) ; les 31 premières invitations du 27/09, parties avant
//     ~18:15 UTC (20:15 heure de Paris), n'avaient PAS la signature.
// Le worker est rebâti par Coolify depuis les sources et peut basculer
// quelques minutes avant ou après l'app : un envoi à moins de 20 minutes d'une
// charnière est signalé « incertain ».

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { SITE_URL } from "@/lib/site-url";
import { renderEmailTemplate } from "@/lib/email/templates";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { DOSSIER_COMPLET_PATH } from "@/lib/commercial-application/lead-apporteur";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import {
  ORIGINES_ACCORD_REQUIS,
  ORIGINES_DIRECTES,
  PROVENANCE_ADRESSE,
} from "@/lib/commercial-application/saisie-manuelle";
import { ORIGINE_SAISIE_MANUELLE } from "@/lib/contact/accuse-attendu";
import {
  GABARIT_INVITATION_APPORTEUR,
  dossierDejaArrive,
  marqueDemarche,
  type Provenance,
} from "@/features/commercial-application/invitation-apporteur";
import type { DetailEmail } from "./detail";

/** Fin du déploiement de #1184 : avant, le gabarit était trop différent pour être reconstitué. */
export const CHARNIERE_CANDIDATURE = new Date("2026-09-27T15:31:04Z");
/** Fin du déploiement de #1187 (+ marge) : avant, l'invitation d'un candidat n'était pas signée. */
export const CHARNIERE_SIGNATURE = new Date("2026-09-27T18:15:00Z");
/** Écart en deçà duquel un envoi est trop proche d'une charnière pour être sûr. */
const MARGE_INCERTITUDE_MS = 20 * 60_000;

export interface ReglesDeRendu {
  reconstituable: boolean;
  signature: boolean;
  incertain: boolean;
}

/** Règle pure : ce que le gabarit rendait à cette date. */
export function reglesDeRenduInvitation(dateEnvoi: Date): ReglesDeRendu {
  const t = dateEnvoi.getTime();
  const pres = (c: Date): boolean => Math.abs(t - c.getTime()) < MARGE_INCERTITUDE_MS;
  return {
    reconstituable: t >= CHARNIERE_CANDIDATURE.getTime(),
    signature: t >= CHARNIERE_SIGNATURE.getTime(),
    incertain: pres(CHARNIERE_CANDIDATURE) || pres(CHARNIERE_SIGNATURE),
  };
}

export type ApercuReconstitue =
  | {
      ok: true;
      subject: string;
      html: string;
      text: string;
      regles: ReglesDeRendu;
      /** Ce que l'aperçu a dû supposer — dit sous le bandeau. */
      hypotheses: string[];
    }
  | { ok: false; motif: string };

interface DetailsFiche {
  unifiedType?: unknown;
  subType?: unknown;
  etape?: unknown;
  origine?: unknown;
  origineSaisie?: unknown;
}

function lireDetails(v: unknown): DetailsFiche {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as DetailsFiche) : {};
}

/** L'aperçu s'applique-t-il à cette ligne ? (sans copie, invitation, fiche liée, partie) */
export function estReconstituable(e: DetailEmail): boolean {
  return (
    e.copie === null &&
    e.template === GABARIT_INVITATION_APPORTEUR &&
    e.entityType === "Submission" &&
    typeof e.entityId === "string" &&
    e.entityId.length > 0 &&
    (e.status === "sent" || e.status === "bounced")
  );
}

/**
 * Reconstitue l'invitation. Ne lève pas : un échec rend `{ ok: false, motif }`,
 * que la page affiche tel quel.
 */
export async function reconstituerInvitation(e: DetailEmail): Promise<ApercuReconstitue> {
  if (!estReconstituable(e) || !e.entityId) {
    return { ok: false, motif: "Cet envoi ne se prête pas à une reconstitution." };
  }
  const dateEnvoi = e.sentAt ?? e.createdAt;
  const regles = reglesDeRenduInvitation(dateEnvoi);
  if (!regles.reconstituable) {
    return {
      ok: false,
      motif:
        "Pas d'aperçu reconstitué : cette invitation est partie avant le 27/09/2026 15:31 UTC, " +
        "et le gabarit a changé depuis — un re-rendu montrerait un message qui n'a pas été envoyé.",
    };
  }
  if (e.recipient.endsWith("@erased.local")) {
    return { ok: false, motif: "Pas d'aperçu : la personne a obtenu l'effacement de ses données." };
  }
  const calendlyUrl = process.env["CALENDLY_APPORTEUR_URL"]?.trim() ?? "";
  if (!estLienCalendlyValide(calendlyUrl)) {
    return {
      ok: false,
      motif: "Pas d'aperçu : CALENDLY_APPORTEUR_URL n'est pas posé (ou invalide) sur ce serveur.",
    };
  }

  try {
    const fiche = await prisma.submission.findUnique({
      where: { id: e.entityId },
      select: {
        id: true,
        contactName: true,
        contactEmailHash: true,
        details: true,
        deletedAt: true,
      },
    });
    if (!fiche || fiche.deletedAt) {
      return { ok: false, motif: "Pas d'aperçu : la fiche liée n'existe plus." };
    }
    let nom = "";
    try {
      nom = decryptPii(fiche.contactName) ?? "";
    } catch {
      nom = "";
    }
    if (nom === ERASED_PLACEHOLDER) {
      return {
        ok: false,
        motif: "Pas d'aperçu : la personne a obtenu l'effacement de ses données.",
      };
    }

    const details = lireDetails(fiche.details);
    const locale = e.locale === "en" ? "en" : "fr";
    const hypotheses: string[] = [
      "Lien de réservation : celui proposé par défaut (CALENDLY_APPORTEUR_URL). S'il a été modifié au moment d'inviter, le message en portait un autre.",
    ];

    // Provenance — même règle que `envoyerInvitationApporteur` : seule une
    // saisie manuelle en porte une (une invitation n'a pu partir qu'avec
    // l'accord requis, donc l'accord n'est pas re-vérifié ici).
    let provenance: Provenance | undefined;
    if (details.origine === ORIGINE_SAISIE_MANUELLE) {
      const origine = typeof details.origineSaisie === "string" ? details.origineSaisie : "";
      const fragment = PROVENANCE_ADRESSE[origine];
      if (fragment && ORIGINES_ACCORD_REQUIS.includes(origine)) {
        provenance = { mode: "indirecte", libelle: fragment[locale] };
      } else if (fragment && ORIGINES_DIRECTES.includes(origine)) {
        provenance = { mode: "directe", libelle: fragment[locale] };
      }
    }

    // Le dossier : les lignes de la personne qui existaient AU MOMENT DE L'ENVOI.
    const lignes = fiche.contactEmailHash
      ? await prisma.submission.findMany({
          where: {
            contactEmailHash: fiche.contactEmailHash,
            deletedAt: null,
            submittedAt: { lte: dateEnvoi },
          },
          select: { id: true, details: true },
          take: 20,
        })
      : [];
    const avecFiche = lignes.some((l) => l.id === fiche.id)
      ? lignes
      : [{ id: fiche.id, details: fiche.details }, ...lignes];
    const dossierUrl = dossierDejaArrive(avecFiche)
      ? undefined
      : `${SITE_URL}/${locale}${DOSSIER_COMPLET_PATH}`;

    const payload: Record<string, unknown> = {
      contactName: nom,
      calendlyUrl,
      // 🔴 Ces invitations sont parties AVANT le 2026-10-05, avec le lien Calendly
      // brut dans le bouton : l'aperçu ne doit pas montrer la page du site, qui n'a
      // pas été envoyée. `lienBrut` coupe la traduction du gabarit.
      lienBrut: true,
      ...(dossierUrl ? { dossierUrl } : {}),
      ...(provenance ? { provenance } : {}),
      // Même règle que l'envoi : `offre` (fiche née d'une candidature à une
      // offre d'emploi, 2026-09-28), sinon `candidature` hors saisie manuelle.
      ...marqueDemarche(fiche.details, fiche.id),
      ...(regles.signature ? {} : { sansSignature: true }),
    };

    const rendu = await renderEmailTemplate(GABARIT_INVITATION_APPORTEUR, locale, payload, {
      destinataire: e.recipient,
    });
    // Mêmes liens personnels masqués qu'une vraie copie : l'aperçu ne doit pas
    // montrer ce que la copie cache (lien d'opposition du pied de page).
    const masque = masquerSecretsEmail(rendu);
    return {
      ok: true,
      subject: masque.subject,
      html: masque.html,
      text: masque.text,
      regles,
      hypotheses,
    };
  } catch (err) {
    return {
      ok: false,
      motif: `Pas d'aperçu : la reconstitution a échoué (${err instanceof Error ? err.message : String(err)}).`,
    };
  }
}
