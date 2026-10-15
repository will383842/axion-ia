// Banc @formateurs — les DÉBUTS de parcours que plusieurs scénarios partagent.
//
// 🔑 Une candidature « reçue il y a 20 minutes ». Le balayage F1 n'invite qu'une
// candidature déposée depuis plus de 15 minutes, et la campagne F2 compte ses
// relances par la date RÉELLE de leur journal, comparée à la date d'invitation.
// Inviter avec un `maintenant` dans le futur ferait donc dater F1 APRÈS les
// relances qu'elle déclenche — un ordre que la production ne connaît jamais. Le
// banc range plutôt la candidature 20 minutes dans le passé (une donnée, pas
// l'horloge du serveur) et passe F1 à l'instant réel : la suite du parcours
// avance ensuite par `maintenant`, dans l'ordre de la production.

import { randomInt } from "node:crypto";

import { expect } from "@playwright/test";

import { SLUG_OFFRE_BANC } from "./allumage";
import { prisma } from "./base";
import { eventUriDe, rendezVousFictif } from "./calendly-simule";
import { etape } from "./etapes";
import { corpsDuMessage, messagesCaptes } from "./puits-smtp";
import { SIRET_BANC } from "./registre-entreprises";
import { attendreLeWorker, candidaturesDe, plus } from "./scenario";

/**
 * Une adresse IP par dépôt, tirée dans la plage réservée aux bancs d'essai
 * (198.18.0.0/15, RFC 2544) : le formulaire compte les dépôts aboutis PAR
 * ADRESSE (8 par heure), et deux runs du banc dans l'heure ne doivent pas se
 * partager ce compteur.
 */
export function ipSuivante(): string {
  const n = randomInt(0, 2 * 256 * 256);
  return `198.${18 + (n >> 16)}.${(n >> 8) & 255}.${n & 255}`;
}

/** Dépose une candidature freelance par le vrai formulaire ; rend la ligne. */
export async function deposerCandidature(email: string, prenom: string) {
  const depot = await etape<{ ok: boolean; error?: string }>({
    etape: "deposer-candidature",
    args: { offre: SLUG_OFFRE_BANC, prenom, nom: "Banc-Essai", email },
    ip: ipSuivante(),
  });
  expect(depot.valeur.ok, depot.valeur.error).toBe(true);
  const [cand] = await candidaturesDe(email);
  if (!cand) throw new Error("banc @formateurs : candidature absente après le dépôt");
  return cand;
}

/** Candidature déposée, rangée 20 min dans le passé, puis invitée (F1 parti, `sent`). */
export async function candidatureInvitee(email: string, prenom: string) {
  const cand = await deposerCandidature(email, prenom);
  await prisma.jobApplication.update({
    where: { id: cand.id },
    data: { submittedAt: plus(cand.submittedAt, { minutes: -20 }) },
  });
  await etape({ etape: "passage-invitations", args: { maintenant: new Date().toISOString() } });
  await attendreLeWorker(email);
  const invitee = await prisma.jobApplication.findUniqueOrThrow({ where: { id: cand.id } });
  expect(invitee.invitationFormateurAt, "F1 est partie").not.toBeNull();
  return invitee;
}

/** Le nom d'un type d'échange formateur (classé par son nom, comme en production). */
export const TYPE_ECHANGE_FORMATEUR = "Échange formateur indépendant (20 min)";

/**
 * Une réservation d'échange formateur par le lien de F1 (`depuis=fa-<id>` devenu
 * `utm_content`), reçue par le webhook signé. Rend le rendez-vous simulé et sa ligne.
 */
export async function reserverEchange(
  candidatureId: string | null,
  email: string,
  prenom: string,
  debut: Date,
  options: { nomType?: string; sansMarqueur?: boolean } = {},
) {
  const rdv = rendezVousFictif({
    nomType: options.nomType ?? TYPE_ECHANGE_FORMATEUR,
    typeConnu: null,
    prenom,
    email,
    debut: debut.toISOString(),
    dureeMinutes: 20,
    ...(candidatureId && !options.sansMarqueur
      ? { tracking: { utm_content: `formateur:fa-${candidatureId}` } }
      : {}),
  });
  const livraison = await etape<{ statut: number }>({
    etape: "livrer-webhook",
    args: { cle: rdv.cle },
    calendly: [rdv],
  });
  expect(livraison.valeur.statut).toBe(200);
  const ligne = await prisma.calendlyEvent.findFirstOrThrow({
    where: { eventUri: eventUriDe(rdv) },
  });
  return { rdv, ligne, reseau: livraison.reseau };
}

/** L'entreprise individuelle du formateur au registre simulé (nom de la fiche). */
export function registreDe(
  prenom: string,
  reponse: "vert" | "orange" | "muet" = "vert",
  nda: string | null = NDA_BANC,
) {
  return {
    reponse,
    profil: { titulaire: { prenom, nom: "Banc-Essai" }, ...(nda ? { nda } : {}) },
  } as const;
}

/** Numéro de déclaration d'activité fictif (11 chiffres). */
export const NDA_BANC = "84691234569";

export interface LienDossier {
  readonly id: string;
  readonly jeton: string;
}

/**
 * Le chemin d'entrée complet jusqu'à « Retenu » : candidature, échange passé
 * rattaché, issue notée par la direction. Rend la fiche et le LIEN DU DOSSIER lu
 * dans F5 tel que le puits SMTP l'a reçu.
 */
export async function formateurRetenu(
  email: string,
  prenom: string,
  admin: import("./protocole").SessionBanc,
) {
  const cand = await deposerCandidature(email, prenom);
  const { ligne } = await reserverEchange(
    cand.id,
    email,
    prenom,
    plus(new Date(), { minutes: -40 }),
  );
  const retenu = await etape<{ etat: string; message?: string }>({
    etape: "enregistrer-issue",
    args: { calendlyEventId: ligne.id, issue: "retenu", confirmer: true },
    session: admin,
  });
  expect(retenu.valeur.etat, retenu.valeur.message).not.toBe("erreur");
  await attendreLeWorker(email);
  const fiche = await prisma.trainer.findFirstOrThrow({ where: { candidatureId: cand.id } });
  const lien = await lienDuDernierMessage(
    email,
    /\/formateur\/dossier\/([0-9a-f-]{36})\/([^"'\s<>?#]+)/,
  );
  expect(lien.id).toBe(fiche.id);
  return { cand, fiche, lien };
}

/**
 * Le lien de dossier porté par le dernier message capté pour cette adresse (le
 * puits rend les plus récents d'abord), ou par le dernier message d'un gabarit.
 */
export async function lienDuDernierMessage(
  email: string,
  motif: RegExp,
  gabarit?: string,
): Promise<LienDossier> {
  let messages = await messagesCaptes(email);
  if (gabarit) {
    const copies = await prisma.emailLogContent.findMany({
      where: { emailLog: { recipient: email, template: gabarit } },
      select: { subject: true },
    });
    const sujets = new Set(copies.map((c) => c.subject));
    messages = messages.filter((m) => sujets.has(m.sujet));
  }
  for (const m of messages) {
    const { html } = await corpsDuMessage(m.id);
    const t = motif.exec(html.replace(/&amp;/g, "&"));
    if (t?.[1] && t[2]) return { id: t[1], jeton: decodeURIComponent(t[2]) };
  }
  throw new Error(`banc @formateurs : aucun lien de dossier capté pour ${email}`);
}

/** Un PDF minimal et valide (signature `%PDF`), pour les pièces du dossier. */
export function pdfFictif(titre: string) {
  const corps = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n% ${titre}\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
  return {
    nom: `${titre}.pdf`,
    type: "application/pdf",
    base64: Buffer.from(corps).toString("base64"),
  };
}

/** Une action publique du dossier, avec le lien. */
export function actionDossier(
  lien: LienDossier,
  action: "vous" | "activite" | "piece" | "urssaf" | "envoyer" | "code" | "signer",
  champs: Record<string, string>,
  decor: {
    registre?: ReturnType<typeof registreDe>;
    fichier?: ReturnType<typeof pdfFictif>;
    ip?: string;
  } = {},
) {
  return etape<{ ok: boolean; message?: string; adresse?: string }>({
    etape: "action-dossier",
    args: {
      action,
      champs: { id: lien.id, jeton: lien.jeton, ...champs },
      ...(decor.fichier ? { fichier: decor.fichier } : {}),
    },
    ...(decor.registre ? { registre: decor.registre } : {}),
    ip: decor.ip ?? ipSuivante(),
  });
}

/** IBAN fictif valide (clé de contrôle juste), jamais celui d'une personne. */
export const IBAN_BANC = "FR7630006000011234567890189";

/** Le code F17 lu dans l'objet du dernier « code de signature » capté. */
export async function codeCapte(email: string): Promise<string> {
  const { sujetsCaptes } = await import("./scenario");
  const code = (await sujetsCaptes(email))
    .map((s) => /^(\d{6}) : /.exec(s)?.[1])
    .find((c): c is string => c !== undefined);
  if (!code) throw new Error(`banc @formateurs : aucun code F17 capté pour ${email}`);
  return code;
}

/**
 * Les étapes 1 à 3 du dossier, puis « Recevoir mon code » (F17). Rend le registre
 * simulé utilisé, pour les étapes suivantes.
 */
export async function preparerDossier(
  lien: LienDossier,
  prenom: string,
  options: { ndaEnCours?: boolean; registre?: ReturnType<typeof registreDe> } = {},
) {
  const registre =
    options.registre ?? registreDe(prenom, "vert", options.ndaEnCours ? null : NDA_BANC);
  const pas = async (r: Promise<{ valeur: { ok: boolean; message?: string } }>) => {
    const v = (await r).valeur;
    expect(v.ok, v.message).toBe(true);
  };
  await pas(actionDossier(lien, "vous", { telephone: "0600000000", codePostal: "69003" }));
  await pas(
    actionDossier(
      lien,
      "activite",
      {
        siret: SIRET_BANC,
        ...(options.ndaEnCours ? { ndaEnCours: "1" } : { nda: NDA_BANC }),
        regimeTva: "franchise_293b",
        iban: IBAN_BANC,
      },
      { registre },
    ),
  );
  const pieces = options.ndaEnCours
    ? ["rib", "cv", "recepisse_declaration_activite"]
    : ["rib", "cv"];
  for (const type of pieces) {
    await pas(actionDossier(lien, "piece", { type }, { fichier: pdfFictif(type) }));
  }
  return registre;
}

/** « Recevoir mon code » : rend le code F17 capté par le puits. */
export async function demanderCode(
  lien: LienDossier,
  email: string,
  registre: ReturnType<typeof registreDe>,
): Promise<string> {
  const demande = await actionDossier(lien, "code", {}, { registre });
  expect(demande.valeur.ok, demande.valeur.message).toBe(true);
  await attendreLeWorker(email);
  return codeCapte(email);
}

/** « Signer et envoyer » avec ce code. */
export async function signerAvecCode(
  lien: LienDossier,
  email: string,
  registre: ReturnType<typeof registreDe>,
  code: string,
  sauf: readonly string[] = [],
) {
  const signe = await actionDossier(
    lien,
    "signer",
    { certifie: "1", accepte: "1", code },
    { registre },
  );
  expect(signe.valeur.ok, signe.valeur.message).toBe(true);
  await attendreLeWorker(email, sauf);
}

/** « Recevoir mon code » puis « Signer et envoyer » avec le code capté. */
export async function signerDossier(
  lien: LienDossier,
  email: string,
  registre: ReturnType<typeof registreDe>,
) {
  const code = await demanderCode(lien, email, registre);
  await signerAvecCode(lien, email, registre, code);
  return code;
}

/** Le dossier où le stockage R2 simulé du banc garde ses objets. */
export const OBJETS_R2_BANC = "/tmp/banc-formateurs/r2/objets";

/**
 * Une formation ACTIVE du catalogue (et son offre), pour l'habilitation de W-4 ;
 * rend son identifiant et la fonction qui l'efface.
 */
export async function formationDuBanc(cle: string) {
  const offre = await prisma.offreSite.create({
    data: {
      code: `BANC-${cle}`,
      titreFr: "Offre du banc d'essai",
      slug: `banc-offre-${cle}`,
      formatPedagogique: "collectif_1jour",
      publicViseFr: "Équipes administratives (banc).",
      dureeHeuresMin: 7,
      dureeHeuresMax: 7,
      tarifType: "sur_devis",
      promessePrincipaleFr: "Offre fictive du banc @formateurs.",
      anglePedagogiqueFr: "Banc d'essai.",
    },
    select: { id: true },
  });
  const formation = await prisma.formation.create({
    data: {
      numero: `BANC-F-${cle}`,
      titre: "Formation du banc d'essai",
      slug: `banc-formation-${cle}`,
      offreSiteId: offre.id,
      dureeHeures: 7,
      statut: "actif",
    },
    select: { id: true },
  });
  return {
    id: formation.id,
    async effacer() {
      await prisma.trainerHabilitation.deleteMany({ where: { formationId: formation.id } });
      await prisma.formation.deleteMany({ where: { id: formation.id } });
      await prisma.offreSite.deleteMany({ where: { id: offre.id } });
    },
  };
}
