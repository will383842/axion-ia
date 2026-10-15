// Banc @formateurs — le CATALOGUE des étapes d'un scénario.
//
// Chaque étape appelle le code RÉEL du dépôt, sans en recopier la logique :
//   · une action de la console → l'action elle-même (session déclarée par le spec) ;
//   · un passage planifié → la fonction que le worker appelle, avec le `maintenant`
//     fourni par le spec (jamais une horloge truquée) ;
//   · une lecture de console (tuile, liste) → la requête de l'écran.
// Une étape ne constate rien : elle rend ce que le code a rendu, et le spec
// constate en base.

import type { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { POST as recevoirWebhookCalendly } from "@/app/api/calendly/webhook/route";
// eslint-disable-next-line no-restricted-imports
import { POST as capterClientEvent } from "@/app/api/calendly/client-event/route";
import { ajouterCandidatFormateurAction } from "@/features/admin-job-applications/candidat-formateur-actions";
import { passerReponsesEntrantesCandidats } from "@/features/admin-job-applications/reponses-entrantes-candidature";
import {
  apercuIssueFormateurAction,
  enregistrerIssueFormateurAction,
} from "@/features/admin-rendezvous/issue-formateur-actions";
import { listRendezVousAFaireLePoint } from "@/features/admin-rendezvous/suivi-queries";
import { submitJobApplicationAction } from "@/features/job-application/actions";
// Les portes PUBLIQUES du dossier, telles que la page les appelle (comme la route
// webhook, plus haut) : le banc appelle l'action, pas une copie de sa logique.
// eslint-disable-next-line no-restricted-imports
import * as dossier from "@/app/formateur/dossier/[id]/[jeton]/actions";
import { contresignerEtOuvrirEspaceAction } from "@/server/actions/qualiopi/formateurs-verifier-contresigner";
import { setQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { renvoyerLienDossierFormAction } from "@/server/actions/qualiopi/formateur-dossier-envois";
import { setTrainerActifAction, updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { setFormateurActifAction } from "@/server/actions/coaching-admin/formateurs.actions";
import { changerActivationFormateur } from "@/server/qualiopi/formateurs-independants/activation";
import { verifierCodeSignature } from "@/server/qualiopi/documents/signature/code-signature";
import { enqueueEmail } from "@/server/queue/queues";
import { lireDossierParLien } from "@/server/qualiopi/formateurs-independants/dossier";
import { lireEcranVerifierContresigner } from "@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture";
import { modeFormateurFreelance } from "@/lib/careers/formulaire-formateur-freelance";
import { prisma } from "@/lib/prisma";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";
import { enrichCalendlyEvent } from "@/server/calendly/enrich";
import {
  listerEchangesDuPont,
  relireEchangesDuPont,
} from "@/server/calendly/pont-echanges-formateur";
import { envoyerMessagesEchangeFormateur } from "@/server/calendly/rappels-echange-formateur";
import { reinitialiserCacheTypesRendezVous } from "@/server/calendly/type-rendez-vous";
import { lireEtatsEntree } from "@/server/qualiopi/formateurs-independants/etats-entree";
import { passerInvitationsFormateurs } from "@/server/qualiopi/formateurs-independants/invitation-formateurs";
import {
  listerInvitationsADecider,
  resumeInvitationDeLaFiche,
} from "@/server/qualiopi/formateurs-independants/suivi-invitations";
import { lireReponsesAVerifier } from "@/features/admin-job-applications/reponses-recues";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import type { ClientZohoMail } from "@/server/zoho-mail/client";

import {
  corpsInviteeCanceled,
  corpsInviteeCreated,
  eventUriDe,
  inviteeUriDe,
  type RendezVousSimule,
} from "../calendly-simule";
import type { EntreeEtape } from "../protocole";
import { signerLivraisonCalendly } from "./webhook-signe";

type Args = Readonly<Record<string, unknown>>;
export type Etape = (args: Args, entree: EntreeEtape) => Promise<unknown>;

const date = (v: unknown): Date => {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime()))
    throw new Error(`banc @formateurs : date illisible (${String(v)})`);
  return d;
};

function formulaire(champs: Readonly<Record<string, string | undefined>>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) if (v !== undefined) fd.set(k, v);
  return fd;
}

async function livrer(rdv: RendezVousSimule, annulation: boolean) {
  const cle = process.env["CALENDLY_WEBHOOK_SIGNING_KEY"] ?? "";
  const corps = annulation ? corpsInviteeCanceled(rdv) : corpsInviteeCreated(rdv);
  // L'instant RÉEL : la route borne la fraîcheur d'une livraison contre sa propre horloge.
  const signature = signerLivraisonCalendly(corps, cle, Math.floor(Date.now() / 1000));
  const requete = new Request("http://localhost:3000/api/calendly/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Calendly-Webhook-Signature": signature,
      "x-forwarded-for": "192.0.2.10",
    },
    body: corps,
  });
  const reponse = await recevoirWebhookCalendly(requete as unknown as NextRequest);
  return { statut: reponse.status, corps: await reponse.text() };
}

/** Les portes PUBLIQUES du dossier en ligne, telles que la page les appelle. */
const ACTIONS_DOSSIER = {
  vous: dossier.enregistrerVousAction,
  activite: dossier.enregistrerActiviteAction,
  piece: dossier.deposerPieceAction,
  urssaf: dossier.enregistrerCodeUrssafAction,
  envoyer: dossier.envoyerDossierAction,
  code: dossier.demanderCodeContratAction,
  signer: dossier.signerEtEnvoyerDossierAction,
} as const;

export const ETAPES: Readonly<Record<string, Etape>> = {
  /**
   * Une action du dossier en ligne, avec le lien de la personne (`id`, `jeton`) et
   * les champs du formulaire. Un fichier (`fichier`) part en base64.
   */
  async "action-dossier"(a) {
    const nom = String(a["action"]) as keyof typeof ACTIONS_DOSSIER;
    const action = ACTIONS_DOSSIER[nom];
    if (!action) throw new Error(`banc @formateurs : action du dossier inconnue « ${nom} »`);
    const fd = formulaire(a["champs"] as Record<string, string>);
    const f = a["fichier"] as { nom: string; type: string; base64: string } | undefined;
    if (f) fd.set("fichier", new File([Buffer.from(f.base64, "base64")], f.nom, { type: f.type }));
    return action(fd);
  },

  /** Ce que la page du dossier lit par le lien : `null` = la page neutre (404). */
  async "lire-dossier"(a) {
    const d = await lireDossierParLien(String(a["id"]), String(a["jeton"]));
    return d === null ? null : { etat: d.etat, statut: d.statut, ibanSaisi: d.ibanSaisi };
  },

  /**
   * L'identité de l'organisme que le contrat-cadre imprime, écrite par le service de
   * la console (`setQualiopiConfig`, schémas compris). Le spec remet l'état d'avant.
   */
  async "configurer-organisme"(a, entree) {
    const valeurs = a["valeurs"] as Record<string, string>;
    const session = { userId: entree.session?.id ?? "", role: entree.session?.role ?? "" };
    for (const [cle, valeur] of Object.entries(valeurs)) {
      await setQualiopiConfig(cle as never, valeur as never, session as never);
    }
    return Object.keys(valeurs);
  },

  /** « Renvoyer le lien » (fiche du formateur) : F8, l'ancien lien révoqué. */
  async "renvoyer-lien"(a) {
    const fd = formulaire({ trainerId: String(a["trainerId"]), id: String(a["trainerId"]) });
    try {
      await renvoyerLienDossierFormAction(fd);
      return { redirige: null };
    } catch (e) {
      // L'action termine par `redirect()` : Next le signale en levant `NEXT_REDIRECT`.
      const digest = (e as { digest?: unknown }).digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        return { redirige: digest.split(";")[2] ?? "" };
      }
      throw e;
    }
  },

  /** La fiche formateur modifiée en console (ici : son adresse e-mail). */
  async "modifier-fiche"(a) {
    return updateTrainerAction(a["champs"] as never);
  },

  /** Les anciennes portes d'activation (fiche formateur, coaching). */
  async "porte-activation"(a) {
    const id = String(a["trainerId"]);
    return a["porte"] === "coaching"
      ? setFormateurActifAction({ id, actif: true } as never)
      : setTrainerActifAction({ id, actif: true } as never);
  },

  /** Une activation demandée par un traitement automatique (le worker, un cron). */
  async "activer-par-le-systeme"(a) {
    return changerActivationFormateur({
      trainerId: String(a["trainerId"]),
      actif: true,
      motif: "Activation demandée par un traitement planifié (banc)",
      acteur: { type: "systeme", source: "banc-formateurs" },
    } as never);
  },

  /** Le code de signature, vérifié une seconde fois par le moteur commun. */
  async "verifier-code"(a) {
    return verifierCodeSignature({
      documentGenereId: String(a["documentGenereId"]),
      partie: "sous_traitant",
      code: String(a["code"]),
    });
  },

  /**
   * Une relance F9 déjà EN FILE (retard BullMQ) : posée par le passage, pas encore
   * partie — l'état que la relecture au départ doit rattraper.
   */
  async "enfiler-relance-dossier"(a) {
    return enqueueEmail(
      "formateur-dossier-relance",
      String(a["email"]),
      "fr",
      { prenom: String(a["prenom"]), lien: String(a["lien"]), etape: 1 },
      {
        entityType: "Trainer",
        entityId: String(a["trainerId"]),
        delayMs: Number(a["delaiMs"]),
        jobId: `banc-f9-${String(a["trainerId"])}`,
      },
    );
  },

  /** L'écran W-4 « Vérifier et contresigner », tel que la console le lit. */
  async "ecran-w4"(a) {
    return lireEcranVerifierContresigner(String(a["trainerId"]));
  },

  /** « Contresigner et ouvrir son espace » — l'action de la console. */
  async "contresigner-w4"(a) {
    return contresignerEtOuvrirEspaceAction(a["saisie"] as never);
  },

  /** Le formulaire public de l'offre, en mode « formateur indépendant » (4 blocs). */
  async "deposer-candidature"(a) {
    const offre = await prisma.jobOffer.findUnique({
      where: { slug: String(a["offre"]) },
      select: { id: true },
    });
    if (!offre) throw new Error("banc @formateurs : offre du banc absente");
    return submitJobApplicationAction(
      { ok: false, error: "" } as never,
      formulaire({
        offerId: offre.id,
        formulaire: "formateur-freelance",
        firstName: String(a["prenom"]),
        lastName: String(a["nom"]),
        email: String(a["email"]),
        phone: "06 00 00 00 00",
        consent: "true",
        codePostal: "69003",
        siret: a["siret"] as string | undefined,
        numeroDeclaration: a["numeroDeclaration"] as string | undefined,
        pasEncoreDeNumero: a["numeroDeclaration"] ? undefined : "on",
        formations: "Initiation à l'IA générative pour les équipes administratives.",
        locale: "fr",
      }),
    );
  },

  /** Le balayage F1 du worker (toutes les 5 minutes en production). */
  async "passage-invitations"(a) {
    return passerInvitationsFormateurs(date(a["maintenant"]));
  },

  /** La phrase « Invitation à l'échange » de la fiche candidature (motif d'attente, « à décider »). */
  async "resume-invitation"(a) {
    return resumeInvitationDeLaFiche(String(a["candidatureId"]), date(a["maintenant"]));
  },

  /** La tuile « Invitées, à décider » du suivi des candidatures. */
  async "a-decider"(a) {
    return listerInvitationsADecider(date(a["maintenant"]));
  },

  /** La file « Réponses à vérifier » (adresses relais) du suivi des candidatures. */
  async "reponses-a-verifier"(a) {
    return lireReponsesAVerifier({ role: "super_admin" }, date(a["maintenant"]));
  },

  /** Le passage des campagnes de relance (F2, F9, F21…), tel que le worker l'appelle. */
  async "passage-campagnes"(a) {
    return passerCampagnes(date(a["maintenant"]));
  },

  /** Confirmation F3 et rappels F4 des échanges formateur rattachés. */
  async "passage-echanges-formateur"(a) {
    return envoyerMessagesEchangeFormateur(date(a["maintenant"]));
  },

  /** Une livraison webhook Calendly SIGNÉE, reçue par la vraie route. */
  async "livrer-webhook"(a, entree) {
    reinitialiserCacheTypesRendezVous();
    const rdv = (entree.calendly ?? []).find((r) => r.cle === a["cle"]);
    if (!rdv) throw new Error("banc @formateurs : rendez-vous à livrer absent du décor");
    return livrer(rdv, a["annulation"] === true);
  },

  /**
   * La capture par l'IFRAME de la page de réservation (`CalendlyEventCapture`) : le
   * navigateur n'envoie que les deux URI, le slug et les UTM de la page ; la route
   * relit le reste à l'API Calendly (simulée).
   */
  async "capter-iframe"(a, entree) {
    reinitialiserCacheTypesRendezVous();
    const rdv = (entree.calendly ?? []).find((r) => r.cle === a["cle"]);
    if (!rdv) throw new Error("banc @formateurs : rendez-vous à capter absent du décor");
    const corps = JSON.stringify({
      eventName: "calendly.event_scheduled",
      payload: { event: { uri: eventUriDe(rdv) }, invitee: { uri: inviteeUriDe(rdv) } },
      eventTypeSlug: String(a["slug"]),
      ...(a["utmContent"] ? { utmContent: String(a["utmContent"]) } : {}),
      pageUrl: String(a["pageUrl"]),
    });
    const requete = new Request("https://axion-ia.com/api/calendly/client-event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://axion-ia.com",
        "x-forwarded-for": entree.ip ?? "192.0.2.10",
      },
      body: corps,
    });
    const reponse = await capterClientEvent(requete as unknown as NextRequest);
    return { statut: reponse.status, corps: await reponse.text() };
  },

  /** « Ajouter un candidat formateur » — l'action de la console. */
  async "ajouter-candidat-console"(a) {
    return ajouterCandidatFormateurAction(a["saisie"]);
  },

  /** L'aperçu de l'issue, tel que la console le montre avant tout envoi. */
  async "apercu-issue"(a) {
    return apercuIssueFormateurAction({
      calendlyEventId: String(a["calendlyEventId"]),
      issue: String(a["issue"]),
    });
  },

  /** « Enregistrer l'issue » — avec ou sans la confirmation de l'aperçu. */
  async "enregistrer-issue"(a) {
    return enregistrerIssueFormateurAction(
      { etat: "repos" } as never,
      formulaire({
        calendlyEventId: String(a["calendlyEventId"]),
        issue: String(a["issue"]),
        confirmer: a["confirmer"] === true ? "oui" : undefined,
        rappelLe: a["rappelLe"] as string | undefined,
        justification: a["justification"] as string | undefined,
      }),
    );
  },

  /** Le relevé des réponses aux candidatures, sur une boîte SIMULÉE. */
  async "releve-reponses"(a) {
    const messages = (a["messages"] as Array<Record<string, unknown>>).map((m, i) => ({
      messageId: `banc-${String(m["cle"] ?? i)}`,
      folderId: "banc-boite",
      fromAddress: String(m["de"]),
      subject: String(m["sujet"] ?? "Re: votre invitation"),
      summary: String(m["resume"] ?? "Bonjour, merci pour votre message."),
      receivedAt: date(m["recuLe"]),
    }));
    const entetes = new Map(
      (a["messages"] as Array<Record<string, unknown>>).map((m, i) => [
        `banc-${String(m["cle"] ?? i)}`,
        // En-têtes au format du client Zoho : nom en minuscules → valeurs.
        Object.fromEntries(
          Object.entries((m["entetes"] ?? {}) as Record<string, string>).map(([k, v]) => [
            k.toLowerCase(),
            [v],
          ]),
        ),
      ]),
    );
    const client: ClientZohoMail = {
      listerMessagesRecus: () => Promise.resolve({ messages, complet: true }),
      lireEntetes: (_dossier, id) => Promise.resolve((entetes.get(id) ?? {}) as never),
    };
    // Le curseur du relevé est partagé : remis à l'état d'avant après le passage.
    const CLE = "candidatures.reponses-entrantes.curseur";
    const avant = await prisma.setting.findUnique({ where: { key: CLE } });
    try {
      return await passerReponsesEntrantesCandidats({ maintenant: date(a["maintenant"]), client });
    } finally {
      if (avant)
        await prisma.setting.update({ where: { key: CLE }, data: { value: avant.value as never } });
      else await prisma.setting.deleteMany({ where: { key: CLE } });
    }
  },

  /** La tuile « À faire le point » de l'onglet Rendez-vous. */
  async "a-faire-le-point"(a) {
    return listRendezVousAFaireLePoint({ maintenant: date(a["maintenant"]) });
  },

  /** La liste des échanges du pont (`/echanges-du-pont`). */
  async "lister-pont"(a) {
    return listerEchangesDuPont(date(a["maintenant"]));
  },

  /** « Relire les échanges du pont » — par l'enrichissement normal (API Calendly). */
  async "relire-pont"(a) {
    reinitialiserCacheTypesRendezVous();
    return relireEchangesDuPont(date(a["maintenant"]), enrichCalendlyEvent);
  },

  /** L'opposition aux sollicitations, comme le lien de désinscription la pose. */
  async opposer(a) {
    return enregistrerOppositionPourAdresse(String(a["email"]), {
      origine: "lien-desinscription",
    });
  },

  /** Les données Google de l'offre, calculées comme la page de l'offre les calcule. */
  async "json-ld-offre"(a) {
    const offre = await prisma.jobOffer.findUnique({ where: { slug: String(a["offre"]) } });
    if (!offre) throw new Error("banc @formateurs : offre du banc absente");
    const entree = await lireEtatsEntree();
    const formateurFreelance = modeFormateurFreelance({
      formulaireAllume: entree.formulaire_freelance,
      natureLue: entree.nature_offre,
      offre,
    });
    return buildJobPostingJsonLd(
      offre,
      "fr",
      formateurFreelance ? { formateurFreelance: true } : {},
    );
  },
};
