/**
 * REPRISE DE L'HISTORIQUE Calendly (chantier visio, PR 4 ; plan V-07b).
 *
 * Qu'un prospect de juillet qui revient en novembre retrouve son premier
 * rendez-vous, ses réponses au formulaire Calendly et le point déjà fait —
 * SANS ~40 alertes « rendez-vous sans compte rendu » ni 40 lignes dans le
 * badge « à classer ».
 *
 * Pour chaque rendez-vous Calendly de la LISTE BLANCHE antérieur à la borne du
 * balayage :
 *   · sa rencontre, marquée `repriseHistorique` (hors alertes, rangée dans le
 *     filtre « Historique » de « À classer ») ; une fiche PROPOSÉE si une
 *     ressemble, jamais rangée (A4) ;
 *   · ses réponses au formulaire deviennent des FAITS `formulaire_calendly`,
 *     proposés, « à ranger », CHIFFRÉS, avec leur provenance (le participant
 *     titulaire) pour que l'effacement ciblé les retrouve ; la réponse « qui
 *     vous a recommandé ? » devient un fait `mise_en_relation` proposé (rien
 *     n'est envoyé à Axion Partners) ;
 *   · le point déjà fait (`RendezVousSuivi`) est repris dans `RencontreSuivi`
 *     PAR LA FONCTION UNIQUE `enregistrerSuivi()`.
 *
 * IDEMPOTENTE : une rencontre qui existe déjà ne reçoit ni fait ni suivi de
 * plus ; un second lancement ne crée rien. S'ARRÊTE si la clé de chiffrement
 * manque (aucune réponse en clair). Aucun échange apporteur, aucun entretien
 * (liste blanche). Rend des NOMBRES seulement.
 *
 * Module neutre : `scripts/visio/reprendre-historique-calendly.ts` l'appelle.
 */

import type { FaitType } from "../../../prisma/generated/client";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { lireBorneDuBalayage } from "@/server/visio/battement";
import { estRendezVousDuDossier } from "@/server/visio/liste-blanche-types";
import { dansLaTransaction, type BaseTransactionnelle, type Tx } from "./base";
import { cleDuFait } from "./note-manuelle";
import {
  estQuestionEntreprise,
  estQuestionTelephone,
  estQuestionVille,
  reponsesFormulaire,
} from "@/features/admin-rendezvous/a-venir";
import { assurerRencontrePourCalendly, limiteDeLHistorique } from "./rencontre-calendly";
import { enregistrerSuiviDansLaTransaction, ErreurSuivi } from "./suivi";

export interface BilanReprise {
  /** Rendez-vous de la liste blanche antérieurs à la borne. */
  readonly eligibles: number;
  /** Rencontres créées (0 à blanc). */
  readonly rencontresCreees: number;
  /** Déjà reprises (second lancement). */
  readonly dejaReprises: number;
  readonly faitsCrees: number;
  readonly suivisRepris: number;
  /** Suivis anciens incomplets (« a eu lieu » sans suite) : non repris. */
  readonly suivisIncomplets: number;
}

/** Le type d'un fait tiré d'une réponse au formulaire. PUR. `null` : à ne pas reprendre. */
export function typeDeLaReponse(question: string): FaitType | null {
  // L'identité (téléphone, ville, entreprise) n'est pas un fait : mêmes règles
  // que la carte « à venir » et le rattachement proposé (`a-venir.ts`).
  if (estQuestionTelephone(question) || estQuestionVille(question)) return null;
  if (estQuestionEntreprise(question)) return null;
  if (/recommand|recommend|parrain/i.test(question)) return "mise_en_relation";
  if (/besoin|projet|attente|objectif/i.test(question)) return "besoin";
  return "autre";
}

async function reprendreUn(
  tx: Tx,
  ev: { id: string; startTime: Date | null; rawPayload: unknown },
  maintenant: Date,
): Promise<{ creee: boolean; faits: number; suivi: "repris" | "incomplet" | "aucun" }> {
  const r = await assurerRencontrePourCalendly(dansLaTransaction(tx), ev.id, {
    maintenant,
    repriseHistorique: true,
  });
  if (r.statut !== "creee") return { creee: false, faits: 0, suivi: "aucun" };

  const titulaire = await tx.rencontreParticipant.findFirst({
    where: { rencontreId: r.rencontreId, role: "client" },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  let faits = 0;
  for (const { question, reponse } of reponsesFormulaire(ev.rawPayload)) {
    const type = typeDeLaReponse(question);
    if (type === null) continue;
    const fait = await tx.fait.create({
      data: {
        clientId: null,
        portee: "a_ranger",
        type,
        cle: cleDuFait(type),
        enonce: chiffrerParole(reponse.slice(0, 2000)),
        texteCourt: chiffrerParole(question.slice(0, 300)),
        certitude: "dit_explicitement",
        confiance: "moyenne",
        source: "formulaire_calendly",
        rencontreId: r.rencontreId,
        locuteur: "client",
        participantLocuteurId: titulaire?.id ?? null,
        constateLe: ev.startTime ?? maintenant,
        statut: "propose",
      },
      select: { id: true },
    });
    await tx.faitEvenement.create({
      data: { faitId: fait.id, action: "propose", nouveauPortee: "a_ranger", parAdminId: null },
    });
    faits += 1;
  }

  const ancien = await tx.rendezVousSuivi.findUnique({
    where: { calendlyEventId: ev.id },
    select: { issue: true, suite: true, suiteLe: true, note: true, renseignePar: true },
  });
  if (ancien === null) return { creee: true, faits, suivi: "aucun" };
  try {
    await enregistrerSuiviDansLaTransaction(tx, {
      rencontreId: r.rencontreId,
      issue: ancien.issue,
      suite: ancien.suite,
      suiteLe: ancien.suiteLe,
      note: ancien.note,
      renseignePar: ancien.renseignePar,
      // Repris par la machine : pas encore « validé » par un humain dans le dossier.
      auteurId: null,
      maintenant,
    });
    return { creee: true, faits, suivi: "repris" };
  } catch (e) {
    if (e instanceof ErreurSuivi) return { creee: true, faits, suivi: "incomplet" };
    throw e;
  }
}

export async function reprendreHistoriqueCalendly(
  db: Tx & BaseTransactionnelle,
  options: { readonly appliquer: boolean; readonly maintenant?: Date },
): Promise<BilanReprise> {
  const maintenant = options.maintenant ?? new Date();
  // Aucune réponse en clair : sans clé, on s'arrête avant d'écrire quoi que ce soit.
  chiffrerParole("vérification de la clé");

  // Jamais un rendez-vous à venir : l'historique s'arrête à la borne du
  // balayage ET à maintenant (garde
  // `un-rendez-vous-futur-n-est-jamais-repris-comme-historique.spec.ts`).
  const limite = limiteDeLHistorique(await lireBorneDuBalayage(db), maintenant);
  const evs = (
    await db.calendlyEvent.findMany({
      where: { startTime: { lt: limite } },
      select: {
        id: true,
        eventTypeName: true,
        linkedJobApplicationId: true,
        startTime: true,
        rawPayload: true,
      },
      orderBy: { startTime: "asc" },
    })
  ).filter((ev) => estRendezVousDuDossier(ev));

  const existantes = new Set(
    (
      await db.rencontre.findMany({
        where: { calendlyEventId: { in: evs.map((e) => e.id) } },
        select: { calendlyEventId: true },
      })
    ).map((r) => r.calendlyEventId),
  );

  let rencontresCreees = 0;
  let faitsCrees = 0;
  let suivisRepris = 0;
  let suivisIncomplets = 0;
  if (options.appliquer) {
    for (const ev of evs) {
      if (existantes.has(ev.id)) continue;
      const r = await db.$transaction((tx) => reprendreUn(tx, ev, maintenant));
      if (r.creee) rencontresCreees += 1;
      faitsCrees += r.faits;
      if (r.suivi === "repris") suivisRepris += 1;
      if (r.suivi === "incomplet") suivisIncomplets += 1;
    }
  }
  return {
    eligibles: evs.length,
    rencontresCreees,
    dejaReprises: evs.filter((e) => existantes.has(e.id)).length,
    faitsCrees,
    suivisRepris,
    suivisIncomplets,
  };
}
