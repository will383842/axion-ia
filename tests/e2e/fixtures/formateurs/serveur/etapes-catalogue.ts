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
import { ajouterCandidatFormateurAction } from "@/features/admin-job-applications/candidat-formateur-actions";
import { passerReponsesEntrantesCandidats } from "@/features/admin-job-applications/reponses-entrantes-candidature";
import {
  apercuIssueFormateurAction,
  enregistrerIssueFormateurAction,
} from "@/features/admin-rendezvous/issue-formateur-actions";
import { listRendezVousAFaireLePoint } from "@/features/admin-rendezvous/suivi-queries";
import { submitJobApplicationAction } from "@/features/job-application/actions";
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
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import type { ClientZohoMail } from "@/server/zoho-mail/client";

import {
  corpsInviteeCanceled,
  corpsInviteeCreated,
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

export const ETAPES: Readonly<Record<string, Etape>> = {
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
        (m["entetes"] ?? {}) as Record<string, string>,
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
