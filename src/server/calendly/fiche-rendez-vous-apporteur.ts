// FICHE CANDIDAT NÉE D'UNE RÉSERVATION D'ÉCHANGE APPORTEUR (2026-10-07).
//
// ── Le défaut que ce module ferme ─────────────────────────────────────────
// Beaucoup d'apporteurs réservent l'échange (Calendly ou notre page
// `/appel/reserver`) SANS avoir rempli de formulaire. Le rendez-vous n'est alors
// rattaché à aucune fiche candidat, et « Retenu » ne peut ni envoyer l'e-mail,
// ni ouvrir le dossier en ligne (il lui faut une fiche).
//
// ── La règle (décision de Will, 07/10) ────────────────────────────────────
// Quand le rattachement automatique (`rattachement-apporteur.ts`) ne trouve
// AUCUNE fiche apporteur — ni à l'adresse, ni au nom —, on en CRÉE une, à partir
// de ce que Calendly confirme (nom, adresse, téléphone, réponses), puis on y
// rattache le rendez-vous.
//
// 🔴 JAMAIS DE DOUBLON. On ne crée rien :
//   · s'il existe une fiche apporteur à cette adresse (on rattache, c'est tout) ;
//   · s'il existe une ou PLUSIEURS fiches apporteur au même nom (adresse relais
//     Indeed : un humain choisit dans le sélecteur de la console) ;
//   · si une autre passe crée la fiche en même temps (verrou par empreinte).
// 🔴 AUCUN E-MAIL. La fiche n'a ni `source` « dossier complet », ni
// `creationAutomatique`, ni bloc `vsl` : aucun balayage d'invitation ni de rappel
// ne la reprend. Rien n'est effacé, rien n'est fusionné.
// 🔴 SEULE L'ADRESSE CONFIRMÉE PAR L'API CALENDLY crée une fiche (cf. `enrich.ts`) :
// la route publique de capture écrit une adresse que n'importe qui peut forger.
//
// Aucune dépendance Next : atteint par le worker (sondage `refresh.ts`).

import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { ERASED_PLACEHOLDER } from "@/lib/rgpd-erase";
import { estApporteur, FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "@/lib/commercial-application/model";
import { LEAD_APPORTEUR_ETAPE } from "@/lib/commercial-application/lead-apporteur";
import { estRendezVousApporteur } from "./appel-apporteur";
import { motsDuNom } from "@/lib/calendly/nom-fiche";
import {
  chargerFichesPourNoms,
  fichesAuNomDans,
  type FichePourNom,
} from "./rattachement-apporteur";

/** Valeur de `details.origine` des fiches nées d'une réservation. */
export const ORIGINE_RENDEZ_VOUS_APPORTEUR = "rendez-vous-apporteur";

/** Combien de rendez-vous le rattrapage reprend par passage. */
const RATTRAPAGE_PAR_PASSAGE = 50;

export type IssueFicheRendezVous =
  | { cree: true; submissionId: string }
  | {
      cree: false;
      motif:
        | "sans_adresse"
        | "annule"
        | "fiche_existante"
        | "meme_nom_a_verifier"
        | "nom_a_verifier"
        | "rattache_entre_temps";
      submissionId?: string;
    };

/**
 * Crée la fiche candidat d'un échange apporteur réservé sans formulaire, et y
 * rattache le rendez-vous. Idempotent. Peut lever (base injoignable) :
 * l'appelant l'enveloppe.
 */
export async function creerFicheDepuisRendezVous(e: {
  eventId: string;
  /** Adresse CONFIRMÉE par l'API Calendly. */
  email: string;
  nom: string | null;
  telephone: string | null;
  /** Réponses aux questions Calendly, en texte. */
  reponses: string | null;
  /** Fiches apporteur déjà chargées (rattrapage) : évite de relire la table à chaque ligne. */
  fichesPourNoms?: readonly FichePourNom[];
  /**
   * Création DEMANDÉE dans la console (2026-10-07, cas « Krafft ») : un humain a vu
   * le nom, l'adresse et le téléphone confirmés par Calendly et a confirmé. Les
   * gardes sur le NOM (un seul mot, homonyme) sont alors levées — c'est lui qui a
   * cherché et n'a rien trouvé. La garde sur l'ADRESSE reste : une fiche à la même
   * adresse n'est jamais doublée, et le rendez-vous n'y est PAS rattaché d'office
   * (la console propose de la choisir).
   */
  manuel?: { readonly adminId: string };
}): Promise<IssueFicheRendezVous> {
  const email = e.email.trim();
  const empreinte = hashEmailForLookup(email);
  if (!email || !empreinte) return { cree: false, motif: "sans_adresse" };

  // Une réservation déjà annulée au moment du traitement ne crée rien (statut relu ici :
  // l'enrichissement l'écrit avant d'appeler ce module).
  const rdv = await prisma.calendlyEvent.findUnique({
    where: { id: e.eventId },
    select: { status: true },
  });
  if (rdv?.status === "canceled") return { cree: false, motif: "annule" };

  // Nom trop court pour être comparé (un seul mot, ou des mots de moins de 3 lettres) : le
  // garde-fou « même nom » ne peut pas jouer, et un candidat Indeed (adresse relais) aurait
  // alors une deuxième fiche. On ne crée rien : le rendez-vous se rattache à la main.
  if (!e.manuel && motsDuNom(e.nom).length === 0) {
    console.warn("[fiche-rendez-vous] nom trop court pour comparer : rattachement à la main");
    return { cree: false, motif: "nom_a_verifier" };
  }

  const issue = await prisma.$transaction(
    async (tx) => {
      // Deux passes simultanées (webhook et sondage) pour la même personne : la
      // seconde attend la première, puis trouve sa fiche.
      // `$executeRaw`, pas `$queryRaw` : la fonction rend `void`, que Prisma 5.22 ne sait pas
      // désérialiser (« Failed to deserialize column of type 'void' »).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fiche-rdv:${empreinte}`}))`;
      const lignes = await tx.submission.findMany({
        where: { contactEmailHash: empreinte, deletedAt: null, ...FILTRE_APPORTEUR_PRISMA },
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: { id: true, details: true },
      });
      const existante = lignes.find((l) => estApporteur(l.details));
      if (existante) return { cree: false as const, submissionId: existante.id };
      if (e.manuel) return creerLaFiche(tx);
      // L'adresse d'abord, le nom ensuite : même nom, AUTRE adresse (relais Indeed) →
      // on ne crée pas un doublon, un humain choisit dans le sélecteur.
      const fiches = e.fichesPourNoms ?? (await chargerFichesPourNoms());
      if (fichesAuNomDans(fiches, e.nom).length > 0) return null;
      return creerLaFiche(tx);
    },
    { timeout: 15_000 },
  );

  if (issue === null) return { cree: false, motif: "meme_nom_a_verifier" };
  // Manuel : une fiche existe à cette adresse → on ne rattache rien d'office.
  if (e.manuel && !issue.cree)
    return { cree: false, motif: "fiche_existante", submissionId: issue.submissionId };

  // Le rendez-vous n'est rattaché qu'à une ligne libre : un lien posé à la main gagne.
  const { count } = await prisma.calendlyEvent.updateMany({
    where: { id: e.eventId, linkedSubmissionId: null, linkedJobApplicationId: null },
    data: { linkedSubmissionId: issue.submissionId },
  });
  if (!issue.cree)
    return { cree: false, motif: "fiche_existante", submissionId: issue.submissionId };
  if (count === 0) {
    return { cree: false, motif: "rattache_entre_temps", submissionId: issue.submissionId };
  }
  return issue;

  async function creerLaFiche(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  ): Promise<{ cree: true; submissionId: string }> {
    const nom = e.nom?.trim() ?? "";
    const telephone = e.telephone?.trim() ?? "";
    const reponses = e.reponses?.trim() ?? "";
    const fiche = await tx.submission.create({
      data: {
        type: "contact",
        locale: "fr",
        companyName: "—",
        contactName: encryptPii(nom),
        contactEmail: encryptPii(email),
        contactEmailHash: empreinte,
        contactPhone: telephone ? encryptPii(telephone) : null,
        source: "import",
        details: {
          unifiedType: "recrutement",
          subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
          // Comme la saisie manuelle et la fiche née d'une offre d'emploi : sans
          // étape, la console la prendrait pour un dossier complet arrivé.
          etape: LEAD_APPORTEUR_ETAPE,
          origine: ORIGINE_RENDEZ_VOUS_APPORTEUR,
          calendlyEventId: e.eventId,
          ...(reponses ? { reponsesCalendly: reponses.slice(0, 4000) } : {}),
          // 🔴 Le FAIT : la personne a réservé l'échange apporteur, sans formulaire.
          consentement:
            "réservation de l'échange apporteur (aucun formulaire rempli) — fiche créée automatiquement",
          saisiPar: e.manuel ? "console" : "automatique",
          message:
            "Échange réservé — fiche créée automatiquement à la réservation (aucun formulaire rempli).",
        } as object,
      },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: e.manuel?.adminId ?? null,
        action: "submission.depuis_rendez_vous_apporteur",
        targetType: "submission",
        targetId: fiche.id,
        changes: { calendlyEventId: e.eventId, contactEmailHash: empreinte },
      },
    });
    return { cree: true as const, submissionId: fiche.id };
  }
}

/** Un champ de l'invité que l'API Calendly a CONFIRMÉ (charge brute rafraîchie), ou `null`. */
function champConfirme(rawPayload: unknown, champ: string): string | null {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) return null;
  const invitee = (rawPayload as Record<string, unknown>)["invitee"];
  if (!invitee || typeof invitee !== "object" || Array.isArray(invitee)) return null;
  const v = (invitee as Record<string, unknown>)[champ];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** L'adresse que l'API Calendly a confirmée, ou `null`. */
export function adresseConfirmee(rawPayload: unknown): string | null {
  return champConfirme(rawPayload, "email");
}

export interface BilanRattrapage {
  examines: number;
  crees: number;
  rattaches: number;
  ignores: number;
}

/**
 * RATTRAPAGE : les échanges apporteur déjà en base (passés et à venir, non
 * annulés) rattachés à rien reçoivent leur fiche, de la même façon. Idempotent :
 * une ligne rattachée sort de la sélection. Ne lève pas.
 */
export async function rattraperFichesRendezVousApporteur(): Promise<BilanRattrapage> {
  const bilan: BilanRattrapage = { examines: 0, crees: 0, rattaches: 0, ignores: 0 };
  const lignes = await prisma.calendlyEvent.findMany({
    where: {
      status: "scheduled",
      linkedSubmissionId: null,
      linkedJobApplicationId: null,
      inviteeUri: { not: null },
      inviteeEmail: { not: null },
      // Une ligne effacée (RGPD) ne renaît jamais en fiche.
      NOT: { inviteeName: ERASED_PLACEHOLDER },
      OR: [{ typeRendezVous: "apporteur" }, { eventTypeName: { contains: "pporteur" } }],
    },
    // Les plus RÉCENTES d'abord : une ligne écartée à chaque passage (nom à vérifier, même
    // nom ailleurs) ne bloque jamais les réservations qui arrivent après elle.
    orderBy: { capturedAt: "desc" },
    take: RATTRAPAGE_PAR_PASSAGE,
    select: {
      id: true,
      eventTypeName: true,
      typeRendezVous: true,
      inviteeEmail: true,
      inviteeName: true,
      rawPayload: true,
    },
  });
  // Les fiches apporteur, lues une seule fois pour tout le passage.
  let fichesPourNoms: FichePourNom[] | null = null;
  for (const l of lignes) {
    bilan.examines += 1;
    const confirmee = adresseConfirmee(l.rawPayload);
    if (
      !estRendezVousApporteur(l) ||
      !confirmee ||
      confirmee.toLowerCase() !== (l.inviteeEmail ?? "").toLowerCase()
    ) {
      bilan.ignores += 1;
      continue;
    }
    try {
      fichesPourNoms ??= await chargerFichesPourNoms();
      // Nom et téléphone CONFIRMÉS par Calendly : jamais ceux de la ligne, que la route
      // publique de capture peut avoir écrits.
      const r = await creerFicheDepuisRendezVous({
        eventId: l.id,
        email: confirmee,
        nom: champConfirme(l.rawPayload, "name"),
        telephone: champConfirme(l.rawPayload, "text_reminder_number"),
        reponses: null,
        fichesPourNoms,
      });
      if (r.cree) bilan.crees += 1;
      else if (r.motif === "fiche_existante") bilan.rattaches += 1;
      else bilan.ignores += 1;
    } catch {
      bilan.ignores += 1;
    }
  }
  return bilan;
}
