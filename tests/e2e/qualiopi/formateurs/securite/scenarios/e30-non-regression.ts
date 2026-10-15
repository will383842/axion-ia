// E30 — Non-régression : ce que le chantier formateurs ne doit PAS changer.
//
//   1. rendez-vous client : webhook signé → ligne classée « diagnostic »,
//      événement CRM, ET la confirmation e-mail du passage réel (restreint à
//      CE rendez-vous pour ne rien envoyer aux fixtures des autres specs) ;
//   2. tunnel apporteur : candidature → dossier ouvert → lien envoyé → lien
//      lisible (et un faux, non) → coordonnées et activité enregistrées →
//      signature (bloquée au banc : pas de stockage R2) ; aucun CRM ;
//   4. offre monteur « poste pourvu » : toujours EXCLUE de la réponse
//      automatique (comme l'offre formateur freelance) ; une offre témoin, non ;
//   5. convention client : l'objet « Convention à signer — … » ;
//   6. autofacture apporteur : données de la pièce et numérotation, figées.
// (Le 3 — relevé d'un salarié au centime — est le spec existant
// `tests/e2e/qualiopi/formateurs/releve-salarie-au-centime.spec.ts`.)

import type { NextRequest } from "next/server";

// eslint-disable-next-line no-restricted-imports
import { POST as recevoirWebhookCalendly } from "@/app/api/calendly/webhook/route";
import { construireDonneesAutofacture } from "@/features/apporteurs-reseau/autofacture-donnees";
import { formaterAutofacture } from "@/features/apporteurs-reseau/commissions";
import {
  enregistrerActivite,
  enregistrerCoordonnees,
  lireDossierParLien,
  ouvrirDossierDepuisCandidature,
} from "@/features/apporteurs-reseau/donnees";
import { jetonDossier } from "@/features/apporteurs-reseau/jeton";
import { signerContrat } from "@/features/apporteurs-reseau/signature";
import { envoyerLien } from "@/features/apporteurs-reseau/verification";
import { conventionEnvoiSubject } from "@/lib/email/templates/convention-envoi";
import { encryptPii } from "@/lib/pii-crypto";
import { critereEligible } from "@/server/careers/reponse-poste-pourvu";
import { executerPassage, PASSAGES } from "@/server/calendly/rappels-appel";

import {
  corpsInviteeCreated,
  eventUriDe,
  rendezVousFictif,
} from "../../../../fixtures/formateurs/calendly-simule";
import { installerReseauSimule } from "../../../../fixtures/formateurs/reseau-simule";
import { apiCalendlySimulee } from "../../../../fixtures/formateurs/serveur/api-calendly-simulee";
import { signerLivraisonCalendly } from "../../../../fixtures/formateurs/serveur/webhook-signe";
import { aNettoyer, adresse, attendre, CLE, menage, prisma } from "../donnees";

const CLE_WEBHOOK = "banc-formateurs-cle-webhook-fictive";

async function rdvClient() {
  process.env["CALENDLY_WEBHOOK_SIGNING_KEY"] = CLE_WEBHOOK;
  process.env["CALENDLY_API_TOKEN"] = "banc-formateurs-jeton-fictif";
  process.env["CRM_SYNC_ENABLED"] = "true";
  const rdv = rendezVousFictif({
    nomType: "Diagnostic IA",
    typeConnu: "diagnostic",
    prenom: "Ondine",
  });
  const reseau = installerReseauSimule([apiCalendlySimulee([rdv])]);
  let statut: number;
  try {
    const corps = corpsInviteeCreated(rdv);
    const signature = signerLivraisonCalendly(corps, CLE_WEBHOOK, Math.floor(Date.now() / 1000));
    const r = await recevoirWebhookCalendly(
      new Request("http://localhost:3000/api/calendly/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "Calendly-Webhook-Signature": signature },
        body: corps,
      }) as unknown as NextRequest,
    );
    statut = r.status;
  } finally {
    reseau.restaurer();
  }
  const ligne = await prisma.calendlyEvent.findFirstOrThrow({
    where: { eventUri: eventUriDe(rdv) },
    select: { id: true, typeRendezVous: true },
  });
  aNettoyer(async () => {
    await prisma.crmSyncOutbox.deleteMany({
      where: { subjectRef: `site:calendly_event:${ligne.id}` },
    });
    await prisma.emailLog.deleteMany({ where: { recipient: rdv.invite.email } });
    await prisma.calendlyEvent.delete({ where: { id: ligne.id } });
  });
  const crm = await prisma.crmSyncOutbox.findMany({
    where: { subjectRef: `site:calendly_event:${ligne.id}` },
    select: { eventType: true, universe: true },
  });
  // Le passage RÉEL de confirmation, borné à CE rendez-vous.
  const confirmation = PASSAGES.find((p) => p.job === "appel-confirme");
  if (!confirmation) throw new Error("banc : passage de confirmation introuvable");
  const borne = { ...confirmation, filtres: [...confirmation.filtres, { id: ligne.id }] };
  const passage = await executerPassage(borne as typeof confirmation, Date.now());
  const repassage = await executerPassage(borne as typeof confirmation, Date.now());
  const envois = await attendre(
    () =>
      prisma.emailLog.findMany({
        where: { recipient: rdv.invite.email },
        select: { template: true, status: true },
      }),
    (l) => l.length > 0 && l.every((x) => x.status !== "pending"),
  );
  return {
    adresse: rdv.invite.email,
    statut,
    type: ligne.typeRendezVous,
    crm,
    passage: { candidats: passage.candidats, envoyes: passage.envoyes },
    repassage: { envoyes: repassage.envoyes },
    envois,
  };
}

async function tunnelApporteur() {
  const email = adresse("apporteur");
  const sub = await prisma.submission.create({
    data: {
      type: "contact",
      companyName: "Banc-Sécu",
      contactName: encryptPii(`Camille Banc-Sécu-${CLE}`) ?? "",
      contactEmail: encryptPii(email) ?? "",
      details: {},
    } as never,
    select: { id: true },
  });
  aNettoyer(async () => {
    const a = await prisma.apporteurReseau.findFirst({
      where: { submissionId: sub.id },
      select: { id: true },
    });
    if (a) {
      await prisma.activityLog.deleteMany({ where: { targetId: a.id } });
      await prisma.apporteurReseau.delete({ where: { id: a.id } });
    }
    await prisma.emailLog.deleteMany({ where: { recipient: email } });
    await prisma.crmSyncOutbox.deleteMany({ where: { subjectRef: { contains: sub.id } } });
    await prisma.activityLog.deleteMany({ where: { targetId: sub.id } });
    await prisma.submission.delete({ where: { id: sub.id } });
  });
  const ouvert = await ouvrirDossierDepuisCandidature(sub.id, { creer: true });
  if (!ouvert.ok) return { ouvert };
  const lien = await envoyerLien(ouvert.apporteurId, null);
  const jeton = jetonDossier(ouvert.apporteurId, ouvert.versionLien) ?? "";
  const lisible = (await lireDossierParLien(ouvert.apporteurId, jeton)) !== null;
  const faux = (await lireDossierParLien(ouvert.apporteurId, `${jeton.slice(0, -2)}xx`)) !== null;
  const coordonnees = await enregistrerCoordonnees(ouvert.apporteurId, { telephone: "0600000017" });
  const activite = await enregistrerActivite(ouvert.apporteurId, {
    siren: "987654324",
    denomination: "ATELIER BANC-ESSAI FORMATION",
    adresse: "1 RUE DU BANC D'ESSAI 69000 LYON",
    statutJuridique: "micro_entrepreneur",
    regimeTva: "franchise_293b",
    numeroTva: null,
    codeNaf: "85.59A",
    iban: null,
    registreIndisponible: true,
  });
  let signature: unknown;
  try {
    signature = await signerContrat({
      apporteurId: ouvert.apporteurId,
      jeton,
      nomTape: `Camille Banc-Sécu-${CLE}`,
      declarations: [],
      acceptations: [],
      ipHash: null,
      userAgent: "banc",
    });
  } catch (e) {
    signature = { leve: e instanceof Error ? e.message : String(e) };
  }
  const envois = await attendre(
    () =>
      prisma.emailLog.findMany({
        where: { recipient: email },
        select: { template: true, status: true },
      }),
    (l) => l.every((x) => x.status !== "pending"),
  );
  const fin = await prisma.apporteurReseau.findUniqueOrThrow({
    where: { id: ouvert.apporteurId },
    select: { statut: true },
  });
  const crm = await prisma.crmSyncOutbox.count({
    where: { subjectRef: { contains: ouvert.apporteurId } },
  });
  return {
    adresse: email,
    ouvert: { ok: ouvert.ok, statut: ouvert.statut },
    lien: (lien as { ok?: boolean }).ok ?? lien,
    lisible,
    faux,
    coordonnees,
    activite,
    signature,
    statutFinal: fin.statut,
    envois,
    crm,
  };
}

async function monteur() {
  const maintenant = new Date();
  const ilYaHuitJours = new Date(maintenant.getTime() - 8 * 86_400_000);
  const creer = async (offerTitleSnap: string) => {
    const c = await prisma.jobApplication.create({
      data: {
        offerTitleSnap,
        firstName: "Banc",
        lastName: `Sécu-${CLE}`,
        email: encryptPii(adresse("candidat")) ?? "",
        phone: "0600000000",
        consentVersion: "banc",
        status: "new",
        submittedAt: ilYaHuitJours,
      } as never,
      select: { id: true },
    });
    aNettoyer(() => prisma.jobApplication.delete({ where: { id: c.id } }));
    return c.id;
  };
  const ids = {
    monteur: await creer("Monteur vidéo freelance (à distance)"),
    formateurFreelance: await creer("Formateur IA freelance"),
    temoin: await creer("Assistant administratif"),
  };
  const eligibles = await prisma.jobApplication.findMany({
    where: {
      AND: [
        critereEligible(maintenant, [], { natureOffreLue: true }),
        { id: { in: Object.values(ids) } },
      ],
    },
    select: { id: true },
  });
  const set = new Set(eligibles.map((e) => e.id));
  return Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, set.has(id)]));
}

function autofacture() {
  const r = construireDonneesAutofacture({
    numero: formaterAutofacture(2026, 7),
    periodeLibelle: "commissions exigibles au 6 octobre 2026",
    dateEmission: new Date("2026-10-06T10:00:00Z"),
    apporteur: {
      nom: "Camille Banc-Essai",
      denomination: "ATELIER BANC-ESSAI FORMATION",
      siren: "987654324",
      siret: null,
      adresse: "1 RUE DU BANC D'ESSAI 69000 LYON",
      regimeTva: "assujetti",
      numeroTva: "FR00987654324",
      email: "camille@example.test",
    },
    commissions: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        activite: "Formation IA — 2 jours",
        palier: "Palier 1",
        parrainage: false,
        montantCents: 123_45,
        prixPublicHtCents: 1_900_00,
        factureHtCents: 1_710_00,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        activite: "Diagnostic IA",
        palier: null,
        parrainage: true,
        montantCents: 50_00,
      },
    ],
    organisme: {
      raisonSociale: "ORGANISME BANC",
      nda: "84691234569",
      qualiopi: "BANC-QUALIOPI",
      siret: "98765432400019",
      adresseSiege: "1 rue du Banc 69000 Lyon",
      adresseExercice: "1 rue du Banc 69000 Lyon",
      email: "contact@example.test",
      telephone: "0400000000",
      site: "https://example.test",
    } as never,
    totalAttenduCents: 173_45,
  });
  return r;
}

export default async function e30(): Promise<unknown> {
  try {
    return {
      rdvClient: await rdvClient(),
      tunnelApporteur: await tunnelApporteur(),
      monteur: await monteur(),
      convention: {
        fr: conventionEnvoiSubject("fr", { titreFormation: "IA pour l'immobilier" }),
        en: conventionEnvoiSubject("en", { titreFormation: "AI for real estate" }),
      },
      autofacture: autofacture(),
    };
  } finally {
    await menage();
  }
}
