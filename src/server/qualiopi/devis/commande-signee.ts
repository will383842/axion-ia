/**
 * Fait `commande.signee` — ce que le client a choisi en signant, destiné à la console des
 * automatisations (CONTRAT-DEVIS-VERS-CONSOLE). Module PUR : aucun accès base, aucune horloge.
 *
 * Montants en centimes HORS TAXE, taux en points de base. Jamais de mot « token », jamais
 * d'unité d'IA, jamais de prix fournisseur, jamais d'adresse IP ni de lien de signature : la
 * preuve technique reste dans le Hub. Le texte des CGV n'y figure pas, seulement sa version.
 *
 * Champs que ce module ne peut PAS remplir (ajoutés à l'ENVOI, jamais stockés ici) : `sequence`
 * (rang du message par client), `exemplaireSigne` (lien temporaire), `accordSousTraitance`,
 * `delaiPaiementJours`, `contactFacturation`.
 */
import { createHash } from "node:crypto";

import { canonicalJson } from "@/server/qualiopi/emargement/canonical";

import {
  echeancierPhases,
  prixMensuelNet,
  totauxFormule,
  type ChoixCanonique,
} from "./offre-calculs";
import type { OffreDevisV1 } from "./offre-devis";

export const TYPE_COMMANDE_SIGNEE = "commande.signee";

export interface EntreeCommandeSignee {
  readonly numeroDevis: string;
  readonly revision: number | null;
  /** Offre déjà validée (`offreDevisV1`) et dont l'empreinte est `offreSha256`. */
  readonly offre: OffreDevisV1;
  readonly offreSha256: string;
  readonly choix: ChoixCanonique;
  readonly choixOffreSha256: string;
  readonly cgvVersion: string | null;
  readonly versionSceau: number;
  readonly client: {
    readonly numero: string;
    readonly raisonSociale: string;
    readonly siren: string | null;
    readonly siret: string | null;
    readonly adresse: string | null;
  };
  readonly signataire: {
    readonly nom: string;
    readonly qualite: string | null;
    readonly signeAt: Date;
  };
  readonly contresigneAt: Date | null;
}

/**
 * Identifiant fixe du fait : le MÊME devis signé avec le MÊME choix donne toujours le même
 * identifiant (renvoi, deux onglets, reprise). SHA-256 de la forme canonique de
 * (type, numéro du devis, empreinte du choix).
 */
export function eventIdCommandeSignee(numeroDevis: string, choixOffreSha256: string): string {
  const canon = canonicalJson({
    type: TYPE_COMMANDE_SIGNEE,
    numeroDevis,
    choixOffreSha256,
  });
  return createHash("sha256").update(canon, "utf8").digest("hex");
}

export type PayloadCommandeSignee = Record<string, unknown>;

export function construireCommandeSignee(e: EntreeCommandeSignee): {
  eventId: string;
  payload: PayloadCommandeSignee;
} {
  const { offre, choix } = e;
  const formule = choix.formule;
  const bloc = formule === "achat" ? offre.achat : offre.abonnement;
  if (!offre.formulesProposees.includes(formule) || bloc === undefined) {
    throw new RangeError(`Formule « ${formule} » absente de l'offre : fait non construit.`);
  }
  const retenues = choix.automatisationsRetenues;
  const totaux = totauxFormule(offre, formule, retenues);

  const lignes = formule === "achat" ? offre.achat!.lignes : offre.abonnement!.miseEnServiceLignes;
  const tauxUtilises = [
    ...lignes.map((l) => l.tauxTvaBps),
    ...offre.automatisations.filter((a) => retenues.includes(a.code)).map((a) => a.tauxTvaBps),
  ];
  const tauxUnique = new Set(tauxUtilises).size === 1 ? tauxUtilises[0]! : null;

  const phases = (formule === "achat" ? offre.achat!.phases : offre.abonnement!.phases).slice();
  const paliers = echeancierPhases(totaux.totalHtCents, phases, tauxUtilises);
  const phasesPayload = [...phases]
    .sort((a, b) => a.rang - b.rang)
    .map((p, i) => ({
      rang: p.rang,
      libelle: p.libelle,
      pourcentage: p.pourcentage,
      declencheur: p.declencheur,
      montantHtCentimes: paliers[i]!.montantHtCents,
      dateEstimee: p.dateEstimee ?? null,
    }));

  let abonnement: Record<string, unknown> | null = null;
  if (formule === "abonnement") {
    const a = offre.abonnement!;
    const periode = a.periodes.find((p) => p.mois === choix.periodiciteMois);
    if (periode === undefined) {
      throw new RangeError("Durée retenue absente de l'offre : fait non construit.");
    }
    abonnement = {
      prixMensuelCatalogueHtCentimes: a.mensuelCatalogueHtCents,
      periodeMois: periode.mois,
      remiseBps: periode.remiseBps,
      prixMensuelNetHtCentimes: prixMensuelNet(a.mensuelCatalogueHtCents, periode.remiseBps),
      modeAvance: a.modeAvance,
      terme: a.terme,
      engagementMois: a.engagementMois,
      reconduction: a.reconduction,
      preavisMois: a.preavisMois,
      tauxTvaBps: a.tauxTvaBps,
    };
  }

  let maintenance: Record<string, unknown> | null = null;
  if (formule === "achat") {
    const m = offre.achat!.maintenance;
    maintenance = {
      regle: m.regle,
      retenue: choix.maintenanceRetenue,
      moisOfferts: m.moisOfferts,
      prixMensuelHtCentimes: choix.maintenanceRetenue ? m.mensuelHtCents : null,
      periodeMois: choix.maintenanceRetenue ? choix.periodiciteMois : null,
    };
  }

  const eventId = eventIdCommandeSignee(e.numeroDevis, e.choixOffreSha256);
  const payload: PayloadCommandeSignee = {
    type: TYPE_COMMANDE_SIGNEE,
    eventId,
    sujet: { axiCli: e.client.numero },
    typeClient: offre.client,
    client: {
      raisonSociale: e.client.raisonSociale,
      siren: e.client.siren,
      siret: e.client.siret,
      adresse: e.client.adresse,
    },
    signataire: {
      nom: e.signataire.nom,
      fonction: e.signataire.qualite,
      signeAt: e.signataire.signeAt.toISOString(),
    },
    contresignature: e.contresigneAt === null ? null : { signeAt: e.contresigneAt.toISOString() },
    numeroDevis: e.numeroDevis,
    revision: e.revision,
    offreSha256: e.offreSha256,
    choixOffreSha256: e.choixOffreSha256,
    versionSceau: e.versionSceau,
    cgvVersion: e.cgvVersion,
    formule,
    hebergement: formule === "achat" ? offre.achat!.hebergement : null,
    prixHebergementMensuelHtCentimes:
      formule === "achat" && offre.achat!.hebergement === "axion"
        ? (offre.achat!.hebergementMensuelHtCents ?? null)
        : null,
    automatisations: offre.automatisations.map((a) => ({
      codeAutomatisation: a.code,
      libelle: a.libelle,
      facultative: a.facultative,
      retenue: retenues.includes(a.code),
      dependDe: a.dependDe,
      prixHtCentimes: a.prixHtCents,
      palier: a.palier ?? null,
      modeIA: a.modeIA,
      moisIAInclus: a.moisIAInclus ?? null,
      modeIAApres: a.modeIAApres ?? null,
    })),
    abonnement,
    maintenance,
    phases: phasesPayload,
    totalPonctuelHtCentimes: totaux.totalHtCents,
    tauxTvaBps: tauxUnique,
    garantie: { jours: offre.garantie.jours },
    servicesTiers: offre.servicesTiers.map((s) => ({
      nom: s.nom,
      obligatoire: s.obligatoire,
      estimationHtCentimes: s.estimationHtCents,
      rythme: s.rythme,
    })),
    plafondFraisAConfirmerHtCentimes: offre.plafondAConfirmer?.montantHtCents ?? null,
  };
  return { eventId, payload };
}
