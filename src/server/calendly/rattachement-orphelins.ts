// Rattachement d'un échange apporteur ORPHELIN à sa fiche candidat (2026-11-27).
//
// ── La cause ──────────────────────────────────────────────────────────────
// Le rattachement automatique (`rattachement-apporteur.ts`) ne tournait qu'UNE fois, à
// l'enrichissement Calendly. Un rendez-vous pris AVANT que la fiche candidat existe (la
// personne réserve, puis remplit le formulaire), ou dont l'enrichissement n'a pas trouvé la
// fiche (empreinte d'e-mail absente de l'ancienne fiche, adresse différente mais même
// téléphone), restait orphelin pour toujours : « Absent » / aperçu de l'e-mail affichait
// « Ce rendez-vous n'est rattaché à aucune fiche candidat ».
//
// ── La règle ──────────────────────────────────────────────────────────────
// Trois points d'entrée, un seul comparateur :
//   · `rattacherRendezVousOrphelin(id)` — au clic (« Absent », aperçu, envoi) ;
//   · `rattacherOrphelinsDeLaFiche(id)` — quand une fiche candidat vient d'être créée ;
//   · l'enrichissement garde son moteur (`rattacherEchangeApporteur`).
// Comparaison : e-mail (trim + minuscules, lu EN CLAIR : indépendant de l'empreinte stockée),
// sinon téléphone normalisé. Plusieurs fiches possibles → RIEN n'est deviné.
// 🔴 On n'écrase jamais un rattachement : la condition « rattaché à rien » est dans l'écriture.
// Aucune dépendance Next : atteignable par le worker. Ne lève jamais.

import { prisma } from "@/lib/prisma";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { decryptPii } from "@/lib/pii-crypto";
import { normaliserTelephone } from "@/lib/telephone";
import { estRendezVousApporteur } from "./appel-apporteur";
import { rattacherEchangeApporteur } from "./rattachement-apporteur";

const PLAFOND = 600;

const mail = (v: string | null | undefined): string | null => {
  const s = v?.trim().toLowerCase();
  return s ? s : null;
};
const tel = (v: string | null | undefined): string | null => {
  const s = v?.trim();
  if (!s) return null;
  const n = normaliserTelephone(s).replace(/\s/g, "");
  return n.length >= 6 ? n : null;
};
const clair = (v: string | null | undefined): string | null => {
  if (!v) return null;
  try {
    return decryptPii(v);
  } catch {
    return null;
  }
};

interface FicheClaire {
  id: string;
  email: string | null;
  telephone: string | null;
}

/** Choisit LA fiche : e-mail d'abord, téléphone ensuite ; 0 ou plusieurs → `null`. */
function choisir(
  fiches: readonly FicheClaire[],
  email: string | null,
  telephone: string | null,
): string | null {
  if (email) {
    const m = fiches.filter((f) => f.email === email);
    if (m.length === 1) return m[0]!.id;
    if (m.length > 1) return null; // plusieurs fiches à cette adresse : on ne devine pas
  }
  if (telephone) {
    const m = fiches.filter((f) => f.telephone === telephone);
    if (m.length === 1) return m[0]!.id;
  }
  return null;
}

/** Le rendez-vous orphelin est-il rattaché maintenant ? Ne lève jamais. */
export async function rattacherRendezVousOrphelin(eventId: string): Promise<string | null> {
  try {
    const evt = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        eventTypeName: true,
        typeRendezVous: true,
        inviteeEmail: true,
        inviteeName: true,
        inviteePhone: true,
        linkedSubmissionId: true,
        linkedJobApplicationId: true,
      },
    });
    if (!evt) return null;
    if (evt.linkedSubmissionId) return evt.linkedSubmissionId;
    if (evt.linkedJobApplicationId || !estRendezVousApporteur(evt)) return null;

    // 1. Le moteur de l'enrichissement (empreinte, puis nom unique).
    const r = await rattacherEchangeApporteur(evt);
    if (r.rattache) return r.submissionId;
    if (r.motif === "rattache_entre_temps") {
      const relu = await prisma.calendlyEvent.findUnique({
        where: { id: eventId },
        select: { linkedSubmissionId: true },
      });
      return relu?.linkedSubmissionId ?? null;
    }

    // 2. Repli : e-mail lu en clair (fiche sans empreinte), puis téléphone normalisé.
    const lignes = await prisma.submission.findMany({
      where: { deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
      orderBy: { submittedAt: "desc" },
      take: PLAFOND,
      select: { id: true, details: true, contactEmail: true, contactPhone: true },
    });
    const fiches: FicheClaire[] = lignes
      .filter((l) => estApporteur(l.details))
      .map((l) => ({
        id: l.id,
        email: mail(clair(l.contactEmail)),
        telephone: tel(clair(l.contactPhone)),
      }));
    const cible = choisir(fiches, mail(evt.inviteeEmail), tel(evt.inviteePhone));
    if (!cible) return null;
    const { count } = await prisma.calendlyEvent.updateMany({
      where: { id: eventId, linkedSubmissionId: null, linkedJobApplicationId: null },
      data: { linkedSubmissionId: cible },
    });
    if (count === 1) return cible;
    const relu = await prisma.calendlyEvent.findUnique({
      where: { id: eventId },
      select: { linkedSubmissionId: true },
    });
    return relu?.linkedSubmissionId ?? null;
  } catch {
    return null; // un rattachement raté laisse le message actuel, jamais une exception
  }
}

/**
 * Une fiche candidat vient d'être créée : rattache les échanges apporteur orphelins de la même
 * personne (même e-mail, sinon même téléphone). Rend le nombre de rendez-vous rattachés.
 * Ne lève jamais.
 */
export async function rattacherOrphelinsDeLaFiche(submissionId: string): Promise<number> {
  try {
    const fiche = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, details: true, contactEmail: true, contactPhone: true, deletedAt: true },
    });
    if (!fiche || fiche.deletedAt || !estApporteur(fiche.details)) return 0;
    const email = mail(clair(fiche.contactEmail));
    const telephone = tel(clair(fiche.contactPhone));
    if (!email && !telephone) return 0;

    const orphelins = await prisma.calendlyEvent.findMany({
      where: {
        linkedSubmissionId: null,
        linkedJobApplicationId: null,
        OR: [
          ...(email ? [{ inviteeEmail: { equals: email, mode: "insensitive" as const } }] : []),
          ...(telephone ? [{ inviteePhone: { not: null } }] : []),
        ],
      },
      orderBy: { capturedAt: "desc" },
      take: PLAFOND,
      select: {
        id: true,
        eventTypeName: true,
        typeRendezVous: true,
        inviteeEmail: true,
        inviteePhone: true,
      },
    });
    const miens = orphelins.filter((o) => {
      if (!estRendezVousApporteur(o)) return false;
      if (email && mail(o.inviteeEmail) === email) return true;
      return !!telephone && tel(o.inviteePhone) === telephone;
    });
    if (miens.length === 0) return 0;

    // Une autre fiche porte la même adresse : ambigu, on ne devine pas.
    if (email) {
      const memeAdresse = await prisma.submission.findMany({
        where: { deletedAt: null, id: { not: fiche.id }, ...FILTRE_APPORTEUR_PRISMA },
        orderBy: { submittedAt: "desc" },
        take: PLAFOND,
        select: { details: true, contactEmail: true },
      });
      if (
        memeAdresse.some((l) => estApporteur(l.details) && mail(clair(l.contactEmail)) === email)
      ) {
        return 0;
      }
    }
    const { count } = await prisma.calendlyEvent.updateMany({
      where: {
        id: { in: miens.map((o) => o.id) },
        linkedSubmissionId: null,
        linkedJobApplicationId: null,
      },
      data: { linkedSubmissionId: fiche.id },
    });
    return count;
  } catch {
    return 0;
  }
}
