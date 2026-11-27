/**
 * Changement d'IBAN d'un apporteur APRÈS la signature : le CŒUR SERVEUR (lot 4 du plan
 * `docs/plans/apporteurs-changement-iban-2026-11-25.md`).
 *
 * Demander, confirmer, s'opposer, annuler, valider, refuser. Aucun écran, aucune route : les
 * lots 5 (espace) et 6 (console) appellent ces fonctions et n'ont pas à re-vérifier ce qui l'est ici.
 *
 * ⛔ Règles dures (plan §2.2, §2.6) :
 *  - RIEN ne change sur la fiche à la demande ni à la confirmation : seule la validation écrit
 *    l'IBAN de la fiche, la pièce `rib` courante et l'historique, dans UNE transaction ;
 *  - l'adresse de l'e-mail est TOUJOURS celle de la fiche, jamais une valeur de la requête ;
 *  - AUCUN IBAN entier hors du chiffré : ni journal, ni e-mail, ni alerte, ni valeur de retour ;
 *    seule la fin (4 caractères) circule. L'IBAN que l'administrateur recopie n'est que comparé
 *    par empreinte, puis oublié ;
 *  - aucun appel à un modèle d'IA sur ce chemin (§2.6) ;
 *  - interrupteur éteint : rien n'est lu, écrit ni émis. Table absente (P2021) : « pas de demande ».
 *
 * Pas de `server-only` : ce module reste importable par les tests et par `tsx`.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { ibanValide } from "@/lib/iban";
import { empreinteIban, ibanNormalise } from "@/lib/iban-empreinte";
import { resumerNavigateur } from "@/lib/navigateur";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { peutEngager } from "@/server/auth/habilitations";
import { journaliser } from "@/server/journal/journaliser";
import { controlerPiece } from "@/server/pieces/depot-controle";
import { enqueueEmail } from "@/server/queue/queues";

import {
  LIMITES_DE_DEBIT,
  confirmationExpiree,
  delaiOppositionEcoule,
  demandePermiseSurLaFenetre,
  FENETRE_LIMITE_DEMANDES_MS,
  quatreDerniersCaracteres,
  seuilExpiration,
} from "./changement-iban-regles";
import { changementIbanActif, secretEmpreinteDisponible } from "./interrupteur-changement-iban";
import {
  lienBloquerDemande,
  lienConfirmerDemande,
  signatureBloquerValide,
  signatureConfirmerValide,
} from "./jeton-changement-iban";
import { urlDossier } from "./jeton";
import { chiffrerContenuPiece, lireContenuPiece } from "./pieces-chiffrement";
import { argentEnJeu, masquerCoordonnees, retraitDe } from "./retrait";
import { envoyer } from "./envois";
import { signalerErreurReseau } from "./signaler";

export type Refus = { readonly ok: false; readonly message: string };
export type Succes<T = object> = { readonly ok: true } & T;

const FERME: Refus = { ok: false, message: "Ce service est fermé pour le moment." };
/** La MÊME réponse pour toute erreur d'un lien : on ne dit jamais pourquoi (plan §2.2). */
const NEUTRE: Refus = { ok: false, message: "Ce lien n'est plus valable." };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refus = (message: string): Refus => ({ ok: false, message });

function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Le service est-il ouvert ? Vérifié AVANT toute lecture ou écriture. */
function ouvert(): boolean {
  return changementIbanActif() && secretEmpreinteDisponible();
}

type LimiteNom = keyof typeof LIMITES_DE_DEBIT;

/** Une limite de débit, FERMÉE en cas de panne : pas de compteur, pas d'action. */
async function sousLaLimite(nom: LimiteNom, variable: string): Promise<boolean> {
  const l = LIMITES_DE_DEBIT[nom];
  const cle = l.cle.replace("<ip>", variable).replace("<id>", variable);
  const r = await checkRateLimit(cle, {
    limit: l.essais,
    windowSec: l.fenetreSecondes,
    surPanne: "refuser",
  });
  return r.allowed;
}

const empreinteIp = (ip: string | null | undefined): string => hashIp(ip) ?? "inconnue";

function memeEmpreinte(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Lit la demande ; `null` si absente OU si la table n'existe pas encore. */
async function lireDemande(demandeId: string) {
  if (!UUID.test(demandeId)) return null;
  try {
    return await prisma.apporteurChangementIban.findUnique({ where: { id: demandeId } });
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

/** Ce qu'il faut de la fiche pour écrire à l'apporteur : TOUJOURS lu en base. */
async function coordonneesFiche(apporteurId: string) {
  const f = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { prenom: true, email: true, versionLien: true },
  });
  if (!f) return null;
  const email = decryptPii(f.email);
  if (!email) return null;
  return { email, prenom: decryptPii(f.prenom) ?? "", versionLien: f.versionLien };
}

/** Les cinq e-mails et le lien neuf : jamais le lien personnel dans un e-mail de sécurité. */
async function envoyerLienNeuf(apporteurId: string, demandeId: string, etape: string) {
  const f = await coordonneesFiche(apporteurId);
  if (!f) return;
  const lien = urlDossier(apporteurId, f.versionLien);
  if (!lien) return;
  await envoyer({
    gabarit: "apporteur-lien-espace",
    destinataire: f.email,
    payload: { prenom: f.prenom, lien },
    entityType: "ApporteurReseau",
    entityId: apporteurId,
    jobId: `apporteur-compte-lien-${etape}-${demandeId}`,
  });
}

async function journalSansIban(
  action: string,
  apporteurId: string,
  changes: Record<string, unknown>,
  userId: string | null,
): Promise<void> {
  await journaliser(prisma, {
    action: `apporteur.changement_iban.${action}`,
    targetType: "ApporteurReseau",
    targetId: apporteurId,
    changes,
    session: userId ? { userId } : null,
  });
}

// ─────────────────────────────────────────────── demande

export interface EntreeDemande {
  readonly apporteurId: string;
  /** L'IBAN saisi par l'apporteur : chiffré tout de suite, jamais rendu. */
  readonly iban: string;
  readonly rib: { readonly nom: string; readonly octets: Uint8Array };
  readonly ip: string | null;
  readonly userAgent: string | null;
  /**
   * Lot 9 : `console` = la demande est ouverte par un administrateur au nom d'un apporteur retiré
   * ou résilié avec de l'argent encore dû. Mêmes barrières ensuite (confirmation par e-mail à la fiche,
   * 72 h, rappel, validation `super_admin`). Absent = `espace`.
   */
  readonly origine?: "espace" | "console";
  readonly acteur?: ActeurConsole;
}

/** Une fiche retirée ou résiliée n'est ouverte à une demande que depuis la console, et seulement si de l'argent est dû. */
async function ficheOuverteAuChangement(
  fiche: { statut: string; resilieAt: Date | null; refuseAt: Date | null },
  apporteurId: string,
  origine: "espace" | "console",
): Promise<boolean> {
  if (fiche.refuseAt) return false;
  if (origine === "console") {
    if (fiche.statut !== "signe" && fiche.statut !== "resilie") return false;
    return argentEnJeu(apporteurId);
  }
  if (fiche.statut !== "signe" || fiche.resilieAt) return false;
  return !(await retraitDe(apporteurId));
}

export async function demanderChangementIban(
  e: EntreeDemande,
): Promise<Succes<{ demandeId: string; fin4: string }> | Refus> {
  if (!ouvert()) return FERME;
  const origine = e.origine ?? "espace";
  if (origine === "console" && !peutEngager(e.acteur?.role ?? null, "facturer")) {
    return refus("Réservé aux administrateurs.");
  }
  const maintenant = new Date();
  const ipH = empreinteIp(e.ip);
  if (
    !(await sousLaLimite("demandeParIp", ipH)) ||
    !(await sousLaLimite("demandeParApporteur", e.apporteurId))
  ) {
    return refus("Trop de demandes. Réessayez plus tard.");
  }

  const fiche = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: {
      statut: true,
      email: true,
      telephone: true,
      iban: true,
      prenom: true,
      resilieAt: true,
      refuseAt: true,
    },
  });
  if (!fiche || !(await ficheOuverteAuChangement(fiche, e.apporteurId, origine))) {
    return refus("Cette demande n'est pas possible pour ce dossier.");
  }
  if (!decryptPii(fiche.telephone)?.trim()) {
    return refus("Votre fiche n'a pas de numéro de téléphone. Écrivez-nous.");
  }
  const ancien = decryptPii(fiche.iban);
  const ancienEmpreinte = ancien ? empreinteIban(ancien) : null;
  if (!ancien || !ancienEmpreinte)
    return refus("Cette demande n'est pas possible pour ce dossier.");

  const nouveau = ibanNormalise(e.iban);
  if (!ibanValide(nouveau)) return refus("Cet IBAN n'est pas valide.");
  const empreinte = empreinteIban(nouveau);
  const fin4 = quatreDerniersCaracteres(nouveau);
  if (!empreinte || !fin4) return refus("Cet IBAN n'est pas valide.");
  if (memeEmpreinte(empreinte, ancienEmpreinte)) {
    return refus("C'est déjà le compte de votre fiche.");
  }

  let passees: Array<{ demandeeAt: Date }> = [];
  try {
    passees = await prisma.apporteurChangementIban.findMany({
      where: {
        apporteurId: e.apporteurId,
        demandeeAt: { gt: new Date(maintenant.getTime() - FENETRE_LIMITE_DEMANDES_MS) },
      },
      select: { demandeeAt: true },
    });
  } catch (err) {
    if (tableAbsente(err)) return FERME;
    throw err;
  }
  if (
    !demandePermiseSurLaFenetre(
      passees.map((p) => p.demandeeAt),
      maintenant,
    )
  ) {
    return refus("Vous avez déjà fait trois demandes ce mois-ci. Écrivez-nous.");
  }

  const controle = await controlerPiece(`rib.${extension(e.rib.nom)}`, e.rib.octets, {
    alerterAntivirusIndisponible: () =>
      signalerErreurReseau(
        "antivirus muet (RIB d'un changement de compte)",
        new Error("indisponible"),
      ),
  });
  if (!controle.ok) return refus(controle.message);

  const id = randomUUID();
  // Les liens d'abord : sans secret de signature, rien n'est écrit.
  const lienConfirmer = lienConfirmerDemande(id, e.apporteurId, maintenant);
  const lienBloquer = lienBloquerDemande(id, e.apporteurId);
  if (!lienConfirmer || !lienBloquer) return FERME;

  try {
    await prisma.$transaction(async (tx) => {
      // « Expirer avant d'insérer » : une demande jamais confirmée ne bloque pas l'apporteur à vie.
      await tx.apporteurChangementIban.updateMany({
        where: {
          apporteurId: e.apporteurId,
          statut: "a_confirmer",
          demandeeAt: { lt: seuilExpiration(maintenant) },
        },
        data: { statut: "expiree" },
      });
      await tx.apporteurChangementIban.create({
        data: {
          id,
          apporteurId: e.apporteurId,
          iban: encryptPii(nouveau, { aad: `changement-iban:${id}`, cleExigee: true }),
          ibanEmpreinte: empreinte,
          ibanFin4: fin4,
          ancienIbanEmpreinte: ancienEmpreinte,
          ancienIbanFin4: quatreDerniersCaracteres(ancien),
          origine,
          demandeIpHash: hashIp(e.ip),
          demandeNavigateur: resumerNavigateur(e.userAgent),
        },
      });
      await tx.apporteurChangementIbanRib.create({
        data: {
          demandeId: id,
          octets: chiffrerContenuPiece(e.rib.octets),
          sha256: controle.sha256,
          typeMime: controle.typeMime,
          taille: controle.taille,
          // Nom NEUTRE : celui d'origine peut contenir l'IBAN.
          nomFichier: `rib.${extension(e.rib.nom)}`,
        },
      });
    });
  } catch (err) {
    if (tableAbsente(err)) return FERME;
    if ((err as { code?: unknown })?.code === "P2002") {
      return refus("Vous avez déjà une demande en cours.");
    }
    signalerErreurReseau("demande de changement d'IBAN", err);
    return refus("La demande n'a pas pu être enregistrée. Réessayez.");
  }

  // L'adresse vient de la FICHE (lue plus haut), jamais de la requête.
  const email = decryptPii(fiche.email);
  if (email) {
    await envoyer({
      gabarit: "apporteur-compte-a-confirmer",
      destinataire: email,
      payload: {
        prenom: decryptPii(fiche.prenom) ?? "",
        nouveauFin: fin4,
        lienConfirmer,
        lienBloquer,
      },
      entityType: "ApporteurReseau",
      entityId: e.apporteurId,
      jobId: `apporteur-compte-a-confirmer-${id}`,
    });
  }
  await journalSansIban("demandee", e.apporteurId, { demandeId: id, fin4 }, null);
  return { ok: true, demandeId: id, fin4 };
}

function extension(nom: string): string {
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(nom);
  return (m?.[1] ?? "pdf").toLowerCase();
}

// ─────────────────────────────────────────────── confirmation

export async function confirmerDemande(e: {
  demandeId: string;
  signature: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<Succes | Refus> {
  if (!ouvert()) return FERME;
  if (!(await sousLaLimite("confirmerParIp", empreinteIp(e.ip)))) return NEUTRE;
  const d = await lireDemande(e.demandeId);
  if (!d || !signatureConfirmerValide(d.id, d.apporteurId, e.signature)) return NEUTRE;
  const maintenant = new Date();
  if (d.statut !== "a_confirmer") return NEUTRE;
  if (confirmationExpiree({ statut: "a_confirmer", demandeeAt: d.demandeeAt }, maintenant)) {
    return NEUTRE;
  }
  // Le lien n'est livré que par l'e-mail : son usage prouve que l'avis est arrivé (`avisEnvoyeAt`, lot 4).
  const r = await prisma.apporteurChangementIban.updateMany({
    where: { id: d.id, statut: "a_confirmer" },
    data: {
      statut: "confirmee",
      avisEnvoyeAt: maintenant,
      confirmationIpHash: hashIp(e.ip),
      confirmationNavigateur: resumerNavigateur(e.userAgent),
    },
  });
  if (r.count !== 1) return NEUTRE;
  await journalSansIban("confirmee", d.apporteurId, { demandeId: d.id }, null);
  return { ok: true };
}

// ─────────────────────────────────────────────── opposition

export async function sOpposerALaDemande(e: {
  demandeId: string;
  signature: string;
  ip: string | null;
}): Promise<Succes | Refus> {
  if (!ouvert()) return FERME;
  if (
    !(await sousLaLimite("bloquerParIp", empreinteIp(e.ip))) ||
    !(UUID.test(e.demandeId) && (await sousLaLimite("bloquerParDemande", e.demandeId)))
  ) {
    return NEUTRE;
  }
  const d = await lireDemande(e.demandeId);
  if (!d || !signatureBloquerValide(d.id, d.apporteurId, e.signature)) return NEUTRE;

  const coupee = await prisma.$transaction(async (tx) => {
    const r = await tx.apporteurChangementIban.updateMany({
      where: { id: d.id, statut: { in: ["a_confirmer", "confirmee"] } },
      data: { statut: "opposee" },
    });
    // Déjà décidée ou déjà opposée : on ne recoupe pas le lien (un tiers ne coupe pas l'accès en boucle).
    if (r.count !== 1) return false;
    await tx.apporteurReseau.update({
      where: { id: d.apporteurId },
      data: { versionLien: { increment: 1 } },
    });
    return true;
  });
  if (!coupee) return { ok: true };

  const f = await coordonneesFiche(d.apporteurId);
  if (f) {
    await envoyer({
      gabarit: "apporteur-compte-demande-bloquee",
      destinataire: f.email,
      payload: { prenom: f.prenom },
      entityType: "ApporteurReseau",
      entityId: d.apporteurId,
      jobId: `apporteur-compte-demande-bloquee-${d.id}`,
    });
    await envoyerLienNeuf(d.apporteurId, d.id, "opposition");
  }
  // Alerte interne : ni IBAN, ni adresse, ni nom.
  await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "critique",
      code: "apporteur_changement_iban_oppose",
      titre: "Changement de compte bancaire contesté par l'apporteur",
      message:
        "Un apporteur dit ne pas être à l'origine d'une demande de changement de compte. La demande est annulée et son lien d'espace est coupé. Le rappeler au numéro de sa fiche.",
      cibleType: "ApporteurReseau",
      cibleId: d.apporteurId,
      createdAt: new Date().toLocaleDateString("fr-FR"),
      rubrique: "apporteurs",
      chemin: `apporteurs/${d.apporteurId}`,
    },
    {
      jobId: `apporteur-compte-opposition-alerte-${d.id}`,
      entityType: "ApporteurReseau",
      entityId: d.apporteurId,
    },
  );
  await journalSansIban("opposee", d.apporteurId, { demandeId: d.id }, null);
  return { ok: true };
}

// ─────────────────────────────────────────────── annulation (par l'apporteur, dans son espace)

export async function annulerDemande(e: {
  apporteurId: string;
  demandeId: string;
  ip: string | null;
}): Promise<Succes | Refus> {
  if (!ouvert()) return FERME;
  if (!(await sousLaLimite("annulerParIp", empreinteIp(e.ip)))) {
    return refus("Trop d'essais. Réessayez dans un instant.");
  }
  if (!UUID.test(e.demandeId)) return NEUTRE;
  const r = await prisma.apporteurChangementIban.updateMany({
    where: {
      id: e.demandeId,
      apporteurId: e.apporteurId,
      statut: { in: ["a_confirmer", "confirmee"] },
    },
    data: { statut: "annulee" },
  });
  if (r.count !== 1) return NEUTRE;
  await journalSansIban("annulee", e.apporteurId, { demandeId: e.demandeId }, null);
  return { ok: true };
}

// ─────────────────────────────────────────────── validation (super_admin seul)

export interface ActeurConsole {
  readonly id: string;
  readonly role: string | null;
}

export interface CasesValidation {
  readonly titulaire: boolean;
  readonly iban: boolean;
  readonly rappel: boolean;
}

class RefusValidation extends Error {}

export async function validerDemande(e: {
  demandeId: string;
  acteur: ActeurConsole;
  cases: CasesValidation;
  /** L'IBAN que l'administrateur a lu sur le RIB : comparé par empreinte, jamais rendu ni journalisé. */
  ibanRecopie: string;
}): Promise<Succes | Refus> {
  if (!ouvert()) return FERME;
  if (!peutEngager(e.acteur.role, "valider_changement_iban")) {
    return refus("Seul le super administrateur peut décider.");
  }
  if (!e.cases.titulaire || !e.cases.iban || !e.cases.rappel) {
    return refus("Les trois contrôles doivent être cochés.");
  }
  const d = await lireDemande(e.demandeId);
  if (!d) return refus("Demande introuvable.");
  const maintenant = new Date();
  if (d.statut !== "confirmee" || !d.confirmeeAt) {
    return refus("Cette demande n'a pas été confirmée par l'apporteur.");
  }
  if (!d.avisEnvoyeAt) return refus("L'e-mail de confirmation n'est pas parti.");
  if (!delaiOppositionEcoule(d.confirmeeAt, maintenant)) {
    return refus("Le délai d'opposition de 72 heures n'est pas écoulé.");
  }
  const fiche = await prisma.apporteurReseau.findUnique({
    where: { id: d.apporteurId },
    select: { statut: true, iban: true, resilieAt: true, refuseAt: true },
  });
  if (
    !fiche ||
    !(await ficheOuverteAuChangement(
      fiche,
      d.apporteurId,
      d.origine === "console" ? "console" : "espace",
    ))
  ) {
    return refus("Le dossier n'est plus dans un état qui permet ce changement.");
  }
  // Contrôle par saisie : l'empreinte seule parle.
  const saisi = empreinteIban(ibanNormalise(e.ibanRecopie));
  if (!memeEmpreinte(saisi, d.ibanEmpreinte)) {
    await journalSansIban("controle_iban_echoue", d.apporteurId, { demandeId: d.id }, e.acteur.id);
    return refus("L'IBAN recopié n'est pas celui de la demande.");
  }
  const ancien = decryptPii(fiche.iban);
  if (!ancien || !memeEmpreinte(empreinteIban(ancien), d.ancienIbanEmpreinte)) {
    return refus(
      "Le compte de la fiche a changé depuis la demande. Refusez-la et refaites-en une.",
    );
  }
  const nouveau = decryptPii(d.iban, { aad: `changement-iban:${d.id}`, cleExigee: true });

  try {
    await prisma.$transaction(async (tx) => {
      const rib = await tx.apporteurChangementIbanRib.findUnique({ where: { demandeId: d.id } });
      if (!rib || !rib.octets) throw new RefusValidation("Le RIB de la demande est absent.");

      const r = await tx.apporteurChangementIban.updateMany({
        where: { id: d.id, statut: "confirmee" },
        data: {
          statut: "validee",
          traiteePar: e.acteur.id,
          controles: { ...e.cases },
        },
      });
      if (r.count !== 1) throw new RefusValidation("Cette demande est déjà décidée.");

      const ancienneRib = await tx.pieceApporteur.findFirst({
        where: { apporteurId: d.apporteurId, type: "rib", remplaceeAt: null },
        orderBy: { deposeeAt: "desc" },
        select: { id: true },
      });
      // Les octets de l'ancienne pièce sont GARDÉS (preuve du compte payé jusque-là).
      await tx.pieceApporteur.updateMany({
        where: { apporteurId: d.apporteurId, type: "rib", remplaceeAt: null },
        data: { remplaceeAt: maintenant },
      });
      const pieceNeuve = await tx.pieceApporteur.create({
        data: {
          apporteurId: d.apporteurId,
          type: "rib",
          statut: "conforme",
          nomFichier: rib.nomFichier,
          typeMime: rib.typeMime,
          taille: rib.taille,
          sha256: rib.sha256,
          verifieeAt: maintenant,
          contenu: { create: { octets: chiffrerContenuPiece(lireContenuPiece(rib.octets)) } },
        },
        select: { id: true },
      });

      // Historique : un compte par ligne, ajout seul ; l'ancien IBAN n'est jamais perdu.
      const existantes = await tx.apporteurIbanHistorique.findMany({
        where: { apporteurId: d.apporteurId },
        select: { ibanEmpreinte: true },
      });
      await tx.apporteurIbanHistorique.updateMany({
        where: { apporteurId: d.apporteurId, enVigueurJusqua: null },
        data: { enVigueurJusqua: maintenant },
      });
      if (!existantes.some((l) => memeEmpreinte(l.ibanEmpreinte, d.ancienIbanEmpreinte))) {
        const idAncien = randomUUID();
        await tx.apporteurIbanHistorique.create({
          data: {
            id: idAncien,
            apporteurId: d.apporteurId,
            iban: encryptPii(ibanNormalise(ancien), {
              aad: `iban-historique:${idAncien}`,
              cleExigee: true,
            }),
            ibanEmpreinte: d.ancienIbanEmpreinte!,
            ibanFin4: d.ancienIbanFin4!,
            enVigueurJusqua: maintenant,
            origine: existantes.length === 0 ? "dossier_initial" : "changement",
            pieceRibId: ancienneRib?.id ?? null,
          },
        });
      }
      const idNeuf = randomUUID();
      await tx.apporteurIbanHistorique.create({
        data: {
          id: idNeuf,
          apporteurId: d.apporteurId,
          iban: encryptPii(nouveau, { aad: `iban-historique:${idNeuf}`, cleExigee: true }),
          ibanEmpreinte: d.ibanEmpreinte,
          ibanFin4: d.ibanFin4,
          enVigueurDe: maintenant,
          origine: "changement",
          demandeId: d.id,
          pieceRibId: pieceNeuve.id,
        },
      });

      // La fiche : format de l'existant (`enc:v1`, lu sans donnée liée par le worker) ; lien personnel renouvelé.
      await tx.apporteurReseau.update({
        where: { id: d.apporteurId },
        data: { iban: encryptPii(ibanNormalise(nouveau)), versionLien: { increment: 1 } },
      });

      // Sans trace, pas de changement : le journal est exigé dans la même transaction.
      // (Fins de compte seulement, jamais d'IBAN ; variable à part : la garde statique du dépôt
      // refuse tout littéral de journal dont le nom de champ évoque l'IBAN, même pour 4 caractères.)
      const tracesDeLaValidation = {
        demandeId: d.id,
        ancienFin: d.ancienIbanFin4,
        nouveauFin: d.ibanFin4,
      };
      await journaliser(
        tx,
        {
          action: "apporteur.changement_iban.validee",
          targetType: "ApporteurReseau",
          targetId: d.apporteurId,
          changes: tracesDeLaValidation,
          session: { userId: e.acteur.id },
        },
        { exiger: true },
      );
    });
  } catch (err) {
    if (err instanceof RefusValidation) return refus(err.message);
    signalerErreurReseau("validation de changement d'IBAN", err);
    return refus("La validation a échoué ; rien n'a été changé.");
  }

  const f = await coordonneesFiche(d.apporteurId);
  if (f) {
    await envoyer({
      gabarit: "apporteur-compte-change",
      destinataire: f.email,
      payload: {
        prenom: f.prenom,
        nouveauFin: d.ibanFin4,
        ancienFin: d.ancienIbanFin4 ?? "",
        effetLe: maintenant.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
      },
      entityType: "ApporteurReseau",
      entityId: d.apporteurId,
      jobId: `apporteur-compte-change-${d.id}`,
    });
    // Le lien neuf part À PART : l'e-mail de sécurité n'en porte jamais.
    await envoyerLienNeuf(d.apporteurId, d.id, "validation");
  }
  return { ok: true };
}

// ─────────────────────────────────────────────── refus (super_admin seul)

export async function refuserDemande(e: {
  demandeId: string;
  acteur: ActeurConsole;
  motif: string;
}): Promise<Succes | Refus> {
  if (!ouvert()) return FERME;
  if (!peutEngager(e.acteur.role, "valider_changement_iban")) {
    return refus("Seul le super administrateur peut décider.");
  }
  const motif = masquerCoordonnees(e.motif.trim());
  if (motif.length < 3) return refus("Le motif du refus est obligatoire.");
  const d = await lireDemande(e.demandeId);
  if (!d) return refus("Demande introuvable.");
  const r = await prisma.apporteurChangementIban.updateMany({
    where: { id: d.id, statut: "confirmee" },
    data: { statut: "refusee", traiteePar: e.acteur.id, motifRefus: motif },
  });
  if (r.count !== 1) return refus("Cette demande n'est plus à décider.");
  await journalSansIban("refusee", d.apporteurId, { demandeId: d.id }, e.acteur.id);
  const f = await coordonneesFiche(d.apporteurId);
  if (f) {
    await envoyer({
      gabarit: "apporteur-compte-refuse",
      destinataire: f.email,
      payload: { prenom: f.prenom, motif, ancienFin: d.ancienIbanFin4 ?? "" },
      entityType: "ApporteurReseau",
      entityId: d.apporteurId,
      jobId: `apporteur-compte-refuse-${d.id}`,
    });
  }
  return { ok: true };
}

// ─────────────────────────────────────────────── expiration écrite (ouverture de l'espace)

/** Écrit l'expiration des demandes non confirmées de plus de 24 h et envoie l'e-mail 5, une fois par demande. */
export async function expirerEtAvertir(apporteurId: string): Promise<number> {
  if (!ouvert()) return 0;
  try {
    const seuil = seuilExpiration(new Date());
    const ou = { apporteurId, statut: "a_confirmer", demandeeAt: { lt: seuil } };
    const perimees = await prisma.apporteurChangementIban.findMany({
      where: ou,
      select: { id: true, ancienIbanFin4: true },
    });
    if (perimees.length === 0) return 0;
    await prisma.apporteurChangementIban.updateMany({ where: ou, data: { statut: "expiree" } });
    const f = await coordonneesFiche(apporteurId);
    if (f) {
      for (const p of perimees) {
        await envoyer({
          gabarit: "apporteur-compte-expire",
          destinataire: f.email,
          payload: { prenom: f.prenom },
          entityType: "ApporteurReseau",
          entityId: apporteurId,
          jobId: `apporteur-compte-expire-${p.id}`,
        });
      }
    }
    return perimees.length;
  } catch (err) {
    if (tableAbsente(err)) return 0;
    throw err;
  }
}
