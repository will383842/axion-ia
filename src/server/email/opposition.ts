// Opposition à la prospection commerciale, en un geste, depuis n'importe quel
// e-mail — audit e-mails du 2026-09-02, lot 1b.
//
// 🔴 Ce qui manquait. Un prospect qui remplit le simulateur ROI, le formulaire
// de contact ou une demande de rappel n'avait AUCUN jeton : seule la newsletter
// en avait un. Rien dans la base ne savait dire « cette personne ne veut plus
// être sollicitée ». S'opposer, c'était répondre à l'e-mail, et quelqu'un
// devait le noter à la main — quelque part.
//
// Le mécanisme : un jeton SIGNÉ, dérivé de l'adresse, posé par le châssis dans
// le pied de chaque e-mail des familles B, C et D. Aucune table n'est écrite à
// l'envoi (44 gabarits, des milliers d'envois) : la signature suffit à prouver
// que le lien vient bien d'un e-mail que NOUS avons envoyé à CETTE adresse. La
// table `email_oppositions` n'est écrite qu'au clic — puis relue par la liste
// de suppression (`suppression.ts`) et poussée vers la liste d'opposition du
// CRM, qui gouverne la prospection humaine.
//
// Portée, à lire deux fois : « ne plus recevoir de SOLLICITATIONS
// COMMERCIALES ». Un stagiaire qui clique depuis son questionnaire de
// satisfaction continue de recevoir convocation et attestation ; un client qui
// clique depuis un devis continue de recevoir sa facture. Le libellé du lien
// le dit, et la suppression ne retient que les envois marketing. C'est la seule
// portée honnête pour un lien présent sur des e-mails de cycle client.
//
// Format du jeton : `op1.<adresse en base64url>.<HMAC-SHA256 tronqué>`. Le
// préfixe permet à `/api/unsubscribe` de le distinguer d'un jeton newsletter
// (une chaîne opaque en base). Clé HMAC dérivée d'`AUTH_SECRET` avec séparation
// de domaine : compromettre ce jeton ne donne rien d'autre qu'une opposition.

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { syncNewsletterOptOutToCrm } from "@/server/crm-sync";
import { isCrmSyncEnabled } from "@/server/crm-sync/config";
import { eventIdDeterministe } from "@/server/crm-sync/event-id";
import { lireJetonOpposition, normaliserAdresse } from "./opposition-jeton";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export {
  PREFIXE_JETON_OPPOSITION,
  jetonOpposition,
  estJetonOpposition,
  lireJetonOpposition,
  urlOpposition,
} from "./opposition-jeton";

/**
 * 🔴 2026-09-19 — retire les envois déjà PROGRAMMÉS pour cette adresse :
 * relances J+2 / J+7 et kit du dossier commencé. Ce sont des jobs retardés,
 * vérifiés à l'enfilage : sans ce retrait, ils attendaient leur échéance dans
 * la file, et seul le filet du worker les arrêtait au départ. Ici, ils sortent
 * de la file et leur ligne de journal se clôt en « annulé ».
 *
 * Import DYNAMIQUE : le module des relances tire les files BullMQ, qui tirent
 * la liste de suppression — l'import statique créerait un cycle sur un chemin
 * que le lien d'opposition n'a pas à charger d'avance. Best-effort : une file
 * indisponible ne doit jamais faire échouer l'opposition elle-même, déjà
 * enregistrée (et le filet du worker reste là).
 */
async function annulerEnvoisProgrammes(email: string): Promise<void> {
  try {
    const { annulerRelancesLeadApporteur } =
      await import("@/features/commercial-application/relances-lead-apporteur");
    await annulerRelancesLeadApporteur(
      email,
      "Envoi annulé : la personne s'est opposée aux sollicitations.",
    );
  } catch (e) {
    // Le nom seul : un message d'erreur peut recopier l'adresse.
    Sentry.captureException(
      { name: e instanceof Error ? e.name : "erreur" },
      { tags: { module: "email-opposition", step: "annuler-relances" } },
    );
  }
}

/** Le nom seul : un message d'erreur peut recopier l'adresse. */
function signaler(e: unknown, step: string): void {
  try {
    Sentry.captureException(
      { name: e instanceof Error ? e.name : "erreur" },
      { tags: { module: "email-opposition", step } },
    );
  } catch {
    /* l'observabilité ne casse jamais la réponse */
  }
}

/**
 * Pose (`true`) ou retire (`false`) la marque « le CRM n'a pas encore été prévenu ». Requête
 * SÉPARÉE, jamais dans le `create` ; son échec ne bloque jamais l'opposition. Le retrait ne
 * touche jamais une ligne dont le CRM est interdit (effacement).
 */
async function marquerAttenteCrm(oppositionId: string, enAttente: boolean): Promise<void> {
  try {
    await prisma.emailOpposition.updateMany({
      where: enAttente
        ? { id: oppositionId, crmInterditLe: null }
        : { id: oppositionId, crmInterditLe: null, crmEnAttenteDepuis: { not: null } },
      data: { crmEnAttenteDepuis: enAttente ? new Date() : null },
    });
  } catch (e) {
    signaler(e, enAttente ? "poser-attente-crm" : "lever-attente-crm");
  }
}

/**
 * Réessai IDEMPOTENT de l'avertissement du CRM. `syncNewsletterOptOutToCrm` ne lève jamais (il
 * avale l'erreur) : seule la présence d'une ligne dans la file prouve que le CRM sera prévenu.
 * Identifiants fixes (subjectRef + eventId déterministe) : rappeler ne crée jamais de doublon.
 * Rend vrai si la ligne est présente (ou si la synchro CRM est coupée, ou s'il n'y a rien à rattraper).
 *
 * 🔴 RGPD — FERMÉ PAR DÉFAUT. Une adresse DÉJÀ en base n'est renvoyée au CRM que si la ligne porte
 * `crm_en_attente_depuis` ET pas `crm_interdit_le` ET qu'aucune ligne de file n'existe. Une ligne
 * ancienne, posée par la rétention, ou dont la file a été purgée/effacée, n'a pas d'attente : le CRM
 * n'est PAS rappelé (il recevrait l'adresse en clair). Lecture des marques en erreur : pas d'appel.
 * `creation` : premier avertissement de la ligne qu'on vient de poser — pas un réessai.
 */
async function assurerAvertissementCrm(
  oppositionId: string,
  email: string,
  origine: string,
  template: string | null | undefined,
  creation = false,
): Promise<boolean> {
  if (!isCrmSyncEnabled()) return true;
  const subjectRef = `site:email_opposition:${oppositionId}`;
  const eventId = eventIdDeterministe(`newsletter_optout:${subjectRef}`);
  const lignePresente = async (): Promise<boolean> => {
    try {
      return (
        (await prisma.crmSyncOutbox.findFirst({ where: { subjectRef }, select: { id: true } })) !==
        null
      );
    } catch (e) {
      signaler(e, "lire-file-crm");
      throw e;
    }
  };
  try {
    if (await lignePresente()) {
      await marquerAttenteCrm(oppositionId, false);
      return true;
    }
    if (!creation) {
      let marques: { crmEnAttenteDepuis: Date | null; crmInterditLe: Date | null } | null;
      try {
        marques = await prisma.emailOpposition.findUnique({
          where: { id: oppositionId },
          select: { crmEnAttenteDepuis: true, crmInterditLe: true },
        });
      } catch (e) {
        signaler(e, "lire-marques-crm");
        return false;
      }
      if (
        marques === null ||
        marques.crmEnAttenteDepuis === null ||
        marques.crmInterditLe !== null
      ) {
        return true;
      }
    }
    try {
      await syncNewsletterOptOutToCrm({
        subjectRef,
        eventId,
        person: { email },
        payload: { reason: origine, template: template ?? null },
      });
    } catch (e) {
      console.error(
        "[email-opposition] avertissement CRM en échec :",
        e instanceof Error ? e.name : "erreur",
      );
      return false;
    }
    if (!(await lignePresente())) return false;
    await marquerAttenteCrm(oppositionId, false);
    return true;
  } catch {
    return false;
  }
}

export type ResultatOpposition =
  | {
      readonly ok: true;
      readonly email: string;
      readonly dejaOpposee: boolean;
      readonly crmAverti: boolean;
    }
  | { readonly ok: false; readonly error: "invalid_token" | "internal" };

/**
 * Enregistre l'opposition portée par un jeton. Idempotent : cliquer deux fois
 * ne crée qu'une ligne, et la seconde réponse le dit.
 */
export async function enregistrerOpposition(
  token: string,
  source: { template?: string | null } = {},
): Promise<ResultatOpposition> {
  const email = lireJetonOpposition(token);
  if (email === null) return { ok: false, error: "invalid_token" };
  return enregistrerOppositionPourAdresse(email, { origine: "lien-email", ...source });
}

/**
 * Le MEME enregistrement, pour une adresse deja connue.
 *
 * 🔑 EXTRAIT, JAMAIS RECOPIE. Une opposition posee depuis la console devait
 * faire exactement ce que fait le lien de desinscription : poser l'empreinte,
 * prevenir le CRM (la prospection HUMAINE ne lit que lui), et retirer les
 * envois deja programmes. Une seconde implementation aurait oublie l'un des
 * trois — et c'est precisement celui qu'on oublie qui se voit chez la personne.
 *
 * Elle existe parce que Will recoit des oppositions AU TELEPHONE : sans ce
 * geste, il n'avait aucun moyen de les enregistrer autrement qu'en attendant
 * que la personne clique sur un lien qu'elle ne veut plus recevoir.
 */
export async function enregistrerOppositionPourAdresse(
  email: string,
  source: { template?: string | null; origine?: string } = {},
): Promise<ResultatOpposition> {
  if (estStub()) return { ok: false, error: "internal" };
  const origine = source.origine ?? "console-admin";
  try {
    // La table ne porte QUE l'empreinte : voir le modèle Prisma pour le
    // raisonnement (une liste d'opposition survit à l'effacement, donc elle ne
    // contient rien de lisible).
    const emailHash = hashEmailForLookup(email);
    if (emailHash === null) return { ok: false, error: "invalid_token" };

    const dejaEnBase = async (): Promise<ResultatOpposition | null> => {
      const existante = await prisma.emailOpposition.findUnique({
        where: { emailHash },
        select: { id: true },
      });
      if (existante === null) return null;
      // Un second appel rattrape un CRM resté sans ligne de file ET un envoi resté en file.
      const crmAverti = await assurerAvertissementCrm(
        existante.id,
        email,
        origine,
        source.template,
      );
      await annulerEnvoisProgrammes(email);
      return { ok: true, email, dejaOpposee: true, crmAverti };
    };

    const avant = await dejaEnBase();
    if (avant !== null) return avant;

    let ligne: { id: string };
    try {
      ligne = await prisma.emailOpposition.create({
        data: {
          emailHash,
          source: origine.slice(0, 40),
          ...(source.template ? { template: source.template.slice(0, 60) } : {}),
        },
        select: { id: true },
      });
    } catch (e) {
      // Deux appels simultanés : l'autre a posé la ligne entre notre lecture et notre création.
      if ((e as { code?: unknown } | null)?.code === "P2002") {
        const apres = await dejaEnBase();
        if (apres !== null) return apres;
      }
      throw e;
    }

    // La prospection HUMAINE est gouvernée par la liste d'opposition du CRM, pas par notre file
    // d'envoi. Les envois programmés sont annulés TOUJOURS, même si le CRM a échoué.
    await marquerAttenteCrm(ligne.id, true);
    const crmAverti = await assurerAvertissementCrm(
      ligne.id,
      email,
      origine,
      source.template,
      true,
    );
    await annulerEnvoisProgrammes(email);
    return { ok: true, email, dejaOpposee: false, crmAverti };
  } catch (e) {
    try {
      Sentry.captureException(
        { name: e instanceof Error ? e.name : "erreur" },
        { tags: { module: "email-opposition", step: "enregistrer" } },
      );
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[email-opposition] enregistrement impossible :",
      e instanceof Error ? e.name : "erreur",
    );
    return { ok: false, error: "internal" };
  }
}

/** Vrai si l'adresse s'est opposée à la prospection commerciale. */
export async function estOpposee(
  email: string,
  /** Client de transaction : le contrôle se fait alors dans la MÊME transaction (lot S3). */
  db: Pick<typeof prisma, "emailOpposition"> = prisma,
): Promise<boolean> {
  if (estStub()) return false;
  const emailHash = hashEmailForLookup(normaliserAdresse(email));
  if (emailHash === null) return false;
  const ligne = await db.emailOpposition.findUnique({
    where: { emailHash },
    select: { id: true },
  });
  return ligne !== null;
}
