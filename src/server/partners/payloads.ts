/**
 * payloads.ts — le CONTENU des événements axionia → Axion Partners (INT-T01b).
 *
 * REQ-INT-005 (`paiement.recu`), REQ-INT-006 (`devis.signe`), REQ-INT-032 (les payloads
 * manquants et les deux formes de remboursement), REQ-DM-018 (le HT fourni, jamais
 * inféré), REQ-DM-039 (`destinataire` + `echeanceFinanceurAt` + K-18 `payers[]`),
 * REQ-DM-040 (les lignes de devis), REQ-ARG-005 / REQ-DM-021 (le bénéficiaire résolu,
 * jamais un silence), REQ-CPL-015 (`source`, `utm`, `campagneId`), REQ-INT-029 (la
 * frontière), REQ-DM-041 (aucune donnée personnelle).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔑 CE QUI TIENT CE FICHIER À LA RÉALITÉ, ET POURQUOI C'EST LE CŒUR DE LA TÂCHE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Chaque type d'entrée est un `Pick<>` d'un modèle GÉNÉRÉ par Prisma, jamais une forme
 * réécrite à la main. Ce n'est pas une coquetterie de typage : c'est le seul mécanisme
 * qui fasse échouer ce dépôt le jour où une colonne disparaît. Quatre documents de ce
 * chantier ont bâti le contrat sur `Invoice` et `Refund`, deux modèles supprimés le
 * 2026-08-26 ; ils sont restés lisibles, cohérents et faux pendant un mois, parce que
 * rien dans leur texte ne touchait au schéma. Ici, `pnpm typecheck` rougit.
 *
 * ⚠️ AUCUNE FONCTION DE CE FICHIER NE « COMPLÈTE » UN CHAMP. Pas de `?? 0`, pas de
 * `?? ""`, pas de valeur par défaut sur une donnée absente. Quand la donnée manque, on
 * LÈVE. La raison est concrète et se lit sur une fiche de paie : un `?? 0` sur un HT
 * produit une commission de zéro euro que personne ne distingue d'une commission
 * légitimement nulle, et l'apporteur découvre l'écart trois mois plus tard. Le seul
 * `null` qu'on écrit est un null MESURÉ — un champ dont on a vérifié qu'aucun
 * producteur n'existe dans ce dépôt (`campagneId`, `parrainCodeCapture`), et il est
 * commenté comme tel.
 */
import { createHash } from "node:crypto";

import { SCORE_POIDS } from "@/lib/commercial-application/scoring";

import type {
  Client,
  Devis,
  DossierPayeur,
  FactureFormation,
  Payment,
  Submission,
} from "../../../prisma/generated/client";
import {
  resoudreCommission,
  type ActiviteFacturation,
  type ResolutionCommission,
} from "./commission";
import { champsInterditsSelonFrontiere } from "./frontiere";
import { derivationHt } from "./ht";

// ─────────────────────────────────────────────────────────────────────────────
// Les formes d'entrée — toutes dérivées des modèles réels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le client, réduit à ce qui traverse.
 *
 * ⚠️ `contactNom`, `contactEmail`, `contactTelephone`, `adresse*` ne sont PAS dans ce
 * `Pick`, et leur absence est le dispositif : un champ qu'on ne sélectionne pas ne peut
 * pas être émis par distraction. La frontière de REQ-INT-029 est la seconde barrière,
 * pas la première.
 */
export type ClientPourEvenement = Pick<
  Client,
  | "id"
  | "numero"
  | "type"
  | "raisonSociale"
  | "siren"
  | "nafCode"
  | "secteur"
  | "taille"
  | "createdAt"
  | "updatedAt"
>;

/** Le noyau de facture dont dépendent `facture.emise`, `avoir.emis` et les paiements. */
export type FacturePourEvenement = Pick<
  FactureFormation,
  | "id"
  | "numero"
  | "activite"
  | "clientId"
  | "sessionId"
  | "enrollmentId"
  | "coachingContractId"
  | "dossierFinancementId"
  | "destinataire"
  | "destinataireSiret"
  | "montantHtCents"
  | "montantTvaCents"
  | "montantTtcCents"
  | "regimeTva"
  | "subrogation"
  | "avoirDeId"
  | "statut"
  | "emiseAt"
  | "echeanceAt"
  | "paidAt"
  | "createdAt"
  | "updatedAt"
> & {
  /** Relations chargées par l'appelant pour la résolution de REQ-ARG-005. */
  readonly session?: { readonly clientId: string | null } | null;
  readonly enrollment?: { readonly clientId: string | null } | null;
  readonly dossierFinancement?: { readonly clientId: string | null } | null;
};

export type FactureAvecClient = FacturePourEvenement & {
  readonly client: ClientPourEvenement | null;
};

export type PaiementPourEvenement = Pick<
  Payment,
  | "id"
  | "factureFormationId"
  | "provider"
  | "amountCents"
  | "currency"
  | "status"
  | "type"
  | "paidAt"
  | "createdAt"
>;

export type DevisPourEvenement = Pick<
  Devis,
  | "id"
  | "numero"
  | "activite"
  | "clientId"
  | "montantTotalHtCents"
  | "statut"
  | "acceptedAt"
  | "createdAt"
  | "updatedAt"
> & {
  /** `Devis.lignes` est du JSON LIBRE en base : rien n'en garantit la forme. */
  readonly lignes: unknown;
};

/**
 * Un payeur du dossier, réduit au TYPE et au MONTANT.
 *
 * 🔴 `payeurNom` existe en base et n'est PAS ici. C'est le nom d'une personne morale, et
 * la frontière de REQ-INT-029 échoue fermé sur tout ce qui ressemble à une identité. La
 * ventilation B13 a besoin de savoir COMBIEN attend QUEL TYPE de payeur ; le nom du
 * financeur ne lui apporte rien qu'elle ne puisse déduire du type.
 */
export type PayeurPourEvenement = Pick<DossierPayeur, "payeurType" | "montantAttenduCents">;

export type SubmissionPourEvenement = Pick<Submission, "id" | "type" | "submittedAt"> & {
  readonly details: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// Les outils de lecture — ils VÉRIFIENT, ils ne fabriquent pas
// ─────────────────────────────────────────────────────────────────────────────

function exige<T>(valeur: T | null | undefined, quoi: string): T {
  if (valeur === null || valeur === undefined) {
    throw new Error(
      `[partners] ${quoi} est absent : impossible de construire ce payload. Aucun repli n'est ` +
        "appliqué à dessein — une valeur inventée ici devient un montant faux chez le récepteur.",
    );
  }
  return valeur;
}

function objet(valeur: unknown, quoi: string): Record<string, unknown> {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) {
    throw new Error(
      `[partners] ${quoi} n'est pas un objet JSON : ${JSON.stringify(valeur)?.slice(0, 120)}`,
    );
  }
  return valeur as Record<string, unknown>;
}

function nombre(valeur: unknown, quoi: string): number {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) {
    throw new Error(
      `[partners] ${quoi} n'est pas un nombre exploitable : ${JSON.stringify(valeur)}`,
    );
  }
  return valeur;
}

function chaine(valeur: unknown, quoi: string): string {
  if (typeof valeur !== "string" || valeur.length === 0) {
    throw new Error(`[partners] ${quoi} n'est pas une chaîne non vide : ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

/** L'horodatage sur le fil. Une date absente LÈVE — `occurred_at` ne s'invente pas. */
function instant(valeur: Date | null | undefined, quoi: string): string {
  return exige(valeur, quoi).toISOString();
}

function instantOuNul(valeur: Date | null | undefined): string | null {
  return valeur === null || valeur === undefined ? null : valeur.toISOString();
}

/**
 * La dernière barrière avant l'émission : REQ-INT-029 jouée sur le payload construit.
 *
 * Appelée par CHAQUE constructeur, y compris ceux dont on « sait » qu'ils sont propres.
 * Un constructeur qu'on dispense de cette vérification est exactement celui qui laissera
 * passer le champ ajouté dans six mois par quelqu'un qui n'aura pas lu ce fichier.
 */
function verifieLaFrontiere<T>(type: string, payload: T): T {
  const interdits = champsInterditsSelonFrontiere(type, payload);
  if (interdits.length > 0) {
    throw new Error(
      `[partners] « ${type} » porte ${interdits.length} champ(s) que REQ-INT-029 refuse à la ` +
        `frontière : ${interdits.map((c) => `${c.chemin} (${c.famille})`).join(", ")}.`,
    );
  }
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-ARG-005 / REQ-DM-021 — le client BÉNÉFICIAIRE
// ─────────────────────────────────────────────────────────────────────────────

export type OrigineBeneficiaire = "facture" | "session" | "enrollment" | "dossier" | "non_resolue";

export type ResolutionBeneficiaire = {
  readonly clientId: string | null;
  readonly origine: OrigineBeneficiaire;
};

/**
 * Le client BÉNÉFICIAIRE d'une facture — `facture ?? session ?? enrollment ?? dossier`.
 *
 * 🔴 `destinataireSiret` N'APPARAÎT NULLE PART DANS CETTE FONCTION, et REQ-ARG-005
 * l'exige mot pour mot : « jamais par `destinataireSiret` ». Sur une facture subrogée le
 * destinataire est l'OPCO ; commissionner l'OPCO au lieu de l'entreprise formée
 * attribuerait la vente au FINANCEUR. Les deux valeurs se ressemblent — un SIRET, sur la
 * même ligne — et c'est précisément pour ça que la confusion est facile.
 *
 * 🔑 Un bénéficiaire introuvable rend `non_resolue`, JAMAIS une exception. REQ-DM-021 :
 * « jamais un silence ». L'événement doit partir ; c'est chez le récepteur qu'il devient
 * une ligne alertée en console. Lever ici ferait DISPARAÎTRE l'encaissement du canal, et
 * un encaissement qui n'arrive pas ne s'alerte nulle part.
 */
export function resoudreClientBeneficiaire(facture: FacturePourEvenement): ResolutionBeneficiaire {
  if (facture.clientId !== null) return { clientId: facture.clientId, origine: "facture" };

  const parLaSession = facture.session?.clientId ?? null;
  if (parLaSession !== null) return { clientId: parLaSession, origine: "session" };

  const parLInscription = facture.enrollment?.clientId ?? null;
  if (parLInscription !== null) return { clientId: parLInscription, origine: "enrollment" };

  const parLeDossier = facture.dossierFinancement?.clientId ?? null;
  if (parLeDossier !== null) return { clientId: parLeDossier, origine: "dossier" };

  return { clientId: null, origine: "non_resolue" };
}

// ─────────────────────────────────────────────────────────────────────────────
// `client.cree` / `client.mis_a_jour`
// ─────────────────────────────────────────────────────────────────────────────

export type PayloadClient = {
  clientId: string;
  numero: string;
  type: string;
  raisonSociale: string | null;
  siren: string | null;
  nafCode: string | null;
  secteur: string | null;
  taille: string | null;
  creeLe: string;
  misAJourLe: string;
};

/**
 * 🔴 LA RAISON SOCIALE D'UN PARTICULIER NE TRAVERSE PAS.
 *
 * `schema.prisma` l'écrit : « Pour un particulier, raisonSociale = "Prénom Nom" ». Le
 * champ n'est donc pas une donnée d'entreprise SELON LA LIGNE, mais selon le TYPE de la
 * ligne — une même colonne porte tantôt une personne morale, tantôt une personne
 * physique. Émettre sans regarder `type` ferait traverser une identité en toute
 * conformité apparente : la clé ne ressemble à rien d'interdit, la valeur non plus.
 * Aucune frontière lexicale ne peut attraper ça ; seul le producteur le sait.
 */
function payloadClient(client: ClientPourEvenement): PayloadClient {
  const estUnParticulier = client.type === "particulier";
  return {
    clientId: client.id,
    numero: client.numero,
    type: client.type,
    raisonSociale: estUnParticulier ? null : client.raisonSociale,
    siren: client.siren,
    nafCode: client.nafCode,
    secteur: client.secteur,
    taille: client.taille,
    creeLe: instant(client.createdAt, "Client.createdAt"),
    misAJourLe: instant(client.updatedAt, "Client.updatedAt"),
  };
}

export function payloadClientCree({ client }: { client: ClientPourEvenement }): PayloadClient {
  return verifieLaFrontiere("client.cree", payloadClient(client));
}

export function payloadClientMisAJour({ client }: { client: ClientPourEvenement }): PayloadClient {
  return verifieLaFrontiere("client.mis_a_jour", payloadClient(client));
}

/**
 * REQ-CPL-014 — `client.fusionne {survivorId, absorbedId}`.
 *
 * ⚠️ HORS CONTRAT v1 (`HORS_CONTRAT_V1` de `contrat.ts`) : construit et testé, jamais
 * émis tant que Partners n'a pas republié une `schema_version` qui le porte.
 */
export function payloadClientFusionne({
  survivorId,
  absorbedId,
}: {
  survivorId: string;
  absorbedId: string;
}): { survivorId: string; absorbedId: string } {
  if (survivorId === absorbedId) {
    throw new Error("[partners] client.fusionne : survivorId et absorbedId sont identiques.");
  }
  return verifieLaFrontiere("client.fusionne", { survivorId, absorbedId });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-INT-006 + REQ-DM-040 — `devis.signe`
// ─────────────────────────────────────────────────────────────────────────────

export type LigneDevisEvenement = {
  designation: string;
  activite: string | null;
  /** IDENTIFIE le palier. N'est JAMAIS un multiplicateur (REQ-DM-015, A-2). */
  jours: number | null;
  montantHtCents: number;
  offreCode: string | null;
  commissionId: string | null;
  commission: ResolutionCommission;
};

export type PayloadDevisSigne = {
  devisId: string;
  numero: string;
  clientId: string;
  activite: string | null;
  montantTotalHtCents: number;
  signeLe: string;
  lignes: LigneDevisEvenement[];
};

/**
 * Une ligne de devis, LUE et vérifiée.
 *
 * `Devis.lignes` est une colonne `Json` : la base ne garantit rien de sa forme, et le
 * commentaire du schéma avertit que les lignes émises avant 2026-07 portent un
 * `offreTierId` MIXTE. Une ligne illisible LÈVE au lieu d'être sautée — sauter, ce
 * serait faire disparaître une commission du payload sans que rien ne l'annonce, et le
 * total du devis ne le trahirait même pas puisqu'il est stocké à part.
 */
function ligneDevis(
  brute: unknown,
  index: number,
  activite: ActiviteFacturation | null,
): LigneDevisEvenement {
  const o = objet(brute, `Devis.lignes[${index}] : ligne de devis`);
  const designation = chaine(
    o["designation"],
    `Devis.lignes[${index}].designation : ligne de devis`,
  );
  const quantite = nombre(o["quantite"], `Devis.lignes[${index}].quantite : ligne de devis`);
  const prixUnitaireHtCents = nombre(
    o["prixUnitaireHtCents"],
    `Devis.lignes[${index}].prixUnitaireHtCents : ligne de devis`,
  );

  // `offreCode` est OPTIONNEL au schéma : absent, il vaut null — c'est une absence
  // constatée dans la donnée, pas un champ complété.
  const offreCodeBrut = o["offreCode"];
  const offreCode =
    typeof offreCodeBrut === "string" && offreCodeBrut.length > 0 ? offreCodeBrut : null;

  // 🔑 `jours` ne se lit pas : il N'EXISTE PAS en base. Le schéma décrit les lignes comme
  // `{designation, quantite, prixUnitaireHtCents, offreCode?, offreTierId?}` — la
  // quantité EST le nombre de journées pour une formation, et n'a aucun sens de durée
  // pour les autres activités. REQ-DM-040 demande une dérivation « côté axionia » : la
  // voici, explicite, plutôt qu'un champ qu'on aurait inventé au schéma.
  const jours = activite === "formation" ? quantite : null;

  const montantHtCents = quantite * prixUnitaireHtCents;
  const commission = resoudreCommission({ activite, jours, montantHtCents });

  return {
    designation,
    activite,
    jours,
    montantHtCents,
    offreCode,
    commissionId: commission.commissionId,
    commission,
  };
}

export function payloadDevisSigne({
  devis,
  client,
}: {
  devis: DevisPourEvenement;
  client: ClientPourEvenement;
}): PayloadDevisSigne {
  // `devis.signe` n'est pas `devis.envoye`. Sans date d'acceptation, il n'y a pas de
  // fait à raconter — et l'`occurred_at` de l'enveloppe n'aurait rien à porter.
  const signeLe = instant(devis.acceptedAt, "Devis.acceptedAt : un devis non signé");

  if (!Array.isArray(devis.lignes)) {
    throw new Error(
      `[partners] Devis.lignes n'est pas un tableau : aucune ligne de devis exploitable.`,
    );
  }
  if (devis.lignes.length === 0) {
    throw new Error(
      "[partners] Devis.lignes est vide : un devis signé sans ligne n'a aucune commission à porter.",
    );
  }

  const activite = devis.activite as ActiviteFacturation | null;

  return verifieLaFrontiere("devis.signe", {
    devisId: devis.id,
    numero: devis.numero,
    clientId: client.id,
    activite,
    montantTotalHtCents: devis.montantTotalHtCents,
    signeLe,
    lignes: devis.lignes.map((brute, i) => ligneDevis(brute, i, activite)),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-DM-039 + K-18 — `facture.emise`
// ─────────────────────────────────────────────────────────────────────────────

export type PayeurEvenement = { payeurType: string; montantAttenduCents: number };

export type PayloadFactureEmise = {
  factureId: string;
  numero: string;
  activite: string | null;
  clientId: string | null;
  origineClient: OrigineBeneficiaire;
  siren: string | null;
  destinataire: string;
  subrogation: boolean;
  montantHtCents: number;
  montantTvaCents: number;
  montantTtcCents: number;
  regimeTva: string;
  emiseLe: string;
  echeanceLe: string | null;
  echeanceFinanceurAt: string | null;
  payers: PayeurEvenement[];
};

function payers(liste: ReadonlyArray<PayeurPourEvenement>): PayeurEvenement[] {
  return liste.map((p) => ({
    payeurType: p.payeurType,
    montantAttenduCents: p.montantAttenduCents,
  }));
}

/**
 * `facture.emise`.
 *
 * 🔑 LE TTC ET LE RÉGIME VOYAGENT AVEC LE HT, et c'est REQ-DM-018 qui l'impose :
 * « Partners n'infère jamais un taux de TVA ». Une facture peut être assujettie (20 %),
 * exonérée (261-4-4°) ou en franchise (293 B) ; le régime est SNAPSHOTÉ sur la ligne.
 * Reconstituer un taux depuis deux montants marcherait — jusqu'à la première facture à
 * taux mixte, où il donnerait un chiffre plausible et faux.
 *
 * ⚠️ `destinataireSiret` et `destinataireNom` ne traversent pas. Le premier parce que
 * REQ-ARG-005 interdit qu'on résolve le bénéficiaire par lui, et qu'un champ transporté
 * finit par être utilisé ; le second parce que c'est un nom.
 */
export function payloadFactureEmise({
  facture,
  payeurs,
  echeanceFinanceurAt,
}: {
  facture: FactureAvecClient;
  payeurs: ReadonlyArray<PayeurPourEvenement>;
  echeanceFinanceurAt: Date | null;
}): PayloadFactureEmise {
  const beneficiaire = resoudreClientBeneficiaire(facture);
  const montantTtcCents =
    facture.montantTtcCents ?? facture.montantHtCents + facture.montantTvaCents;

  return verifieLaFrontiere("facture.emise", {
    factureId: facture.id,
    numero: facture.numero,
    activite: facture.activite,
    clientId: beneficiaire.clientId,
    origineClient: beneficiaire.origine,
    siren: facture.client?.siren ?? null,
    destinataire: facture.destinataire,
    subrogation: facture.subrogation,
    montantHtCents: facture.montantHtCents,
    montantTvaCents: facture.montantTvaCents,
    montantTtcCents,
    regimeTva: facture.regimeTva,
    emiseLe: instant(facture.emiseAt, "FactureFormation.emiseAt : une facture non émise"),
    echeanceLe: instantOuNul(facture.echeanceAt),
    echeanceFinanceurAt: instantOuNul(echeanceFinanceurAt),
    payers: payers(payeurs),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// `avoir.emis` et `facture.annulee`
// ─────────────────────────────────────────────────────────────────────────────

export type PayloadAvoirEmis = {
  avoirId: string;
  numero: string;
  avoirDeFactureId: string;
  clientId: string | null;
  siren: string | null;
  montantHtCents: number;
  montantTvaCents: number;
  montantTtcCents: number;
  regimeTva: string;
  emisLe: string;
};

/**
 * Un avoir DÉCLARE la facture qu'il rectifie.
 *
 * Une `FactureFormation` sans `avoirDeId` n'est pas un avoir, c'est une facture — et
 * l'émettre sous `avoir.emis` créerait chez le récepteur une reprise de commission sur
 * une vente qui n'a jamais été annulée. Le montant serait retiré à l'apporteur.
 */
export function payloadAvoirEmis({ avoir }: { avoir: FactureAvecClient }): PayloadAvoirEmis {
  const avoirDeFactureId = exige(
    avoir.avoirDeId,
    "FactureFormation.avoirDeId : cette facture n'est pas un avoir (aucune facture rectifiée)",
  );
  const beneficiaire = resoudreClientBeneficiaire(avoir);

  return verifieLaFrontiere("avoir.emis", {
    avoirId: avoir.id,
    numero: avoir.numero,
    avoirDeFactureId,
    clientId: beneficiaire.clientId,
    siren: avoir.client?.siren ?? null,
    montantHtCents: avoir.montantHtCents,
    montantTvaCents: avoir.montantTvaCents,
    montantTtcCents: avoir.montantTtcCents ?? avoir.montantHtCents + avoir.montantTvaCents,
    regimeTva: avoir.regimeTva,
    emisLe: instant(avoir.emiseAt, "FactureFormation.emiseAt : un avoir non émis"),
  });
}

/**
 * REQ-INT-032 — `facture.annulee {factureId, motif}`.
 *
 * ⚠️ HORS CONTRAT v1. REQ-ARG-010 : « recalcule l'attendu sans créer de reprise » — une
 * annulation n'est pas un avoir, et la distinction est ce que le récepteur doit voir.
 */
export function payloadFactureAnnulee({
  facture,
  motif,
}: {
  facture: FactureAvecClient;
  motif: string;
}): { factureId: string; motif: string; clientId: string | null } {
  return verifieLaFrontiere("facture.annulee", {
    factureId: facture.id,
    motif: chaine(motif, "facture.annulee : le motif d'annulation"),
    clientId: resoudreClientBeneficiaire(facture).clientId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-INT-005 + REQ-DM-018 — `paiement.recu`
// ─────────────────────────────────────────────────────────────────────────────

export type PayloadPaiementRecu = {
  paymentId: string;
  factureId: string;
  clientId: string | null;
  origineClient: OrigineBeneficiaire;
  siren: string | null;
  montantEncaisseTtcCents: number;
  factureMontantHtCents: number;
  factureMontantTtcCents: number;
  regimeTva: string;
  totalEncaisseTtcCents: number;
  paidAt: string;
  provider: string;
  /** REQ-DM-018 — le HT encaissé est FOURNI, pas laissé à déduire. */
  amountHtCents: number;
  /** Vrai si cet encaissement solde la facture : c'est lui qui absorbe le reliquat. */
  soldeLaFacture: boolean;
};

/**
 * `paiement.recu`, avec les onze champs que REQ-INT-005 énumère, plus le HT dérivé.
 *
 * 🔴 UN ENCAISSEMENT SANS FACTURE LÈVE. Il ne peut porter ni HT (rien sur quoi
 * proratiser) ni bénéficiaire (rien à qui rattacher). Fabriquer un payload à trous
 * serait exactement le « helper qui complète » que cette tâche existe pour interdire :
 * le récepteur recevrait un montant nul qu'aucune console ne distinguerait d'un
 * remboursement intégral.
 */
export function payloadPaiementRecu({
  paiement,
  facture,
  totalEncaisseTtcCents,
}: {
  paiement: PaiementPourEvenement;
  facture: FactureAvecClient | null;
  totalEncaisseTtcCents: number;
}): PayloadPaiementRecu {
  const f = exige(
    facture,
    `Payment.factureFormationId (${paiement.factureFormationId ?? "null"}) : la facture encaissée`,
  );
  const paidAt = instant(paiement.paidAt, "Payment.paidAt : un encaissement sans date");

  const beneficiaire = resoudreClientBeneficiaire(f);
  const { amountHtCents, soldeLaFacture } = derivationHt({
    facture: f,
    montantEncaisseTtcCents: paiement.amountCents,
    totalEncaisseTtcCents,
  });

  return verifieLaFrontiere("paiement.recu", {
    paymentId: paiement.id,
    factureId: f.id,
    clientId: beneficiaire.clientId,
    origineClient: beneficiaire.origine,
    siren: f.client?.siren ?? null,
    montantEncaisseTtcCents: paiement.amountCents,
    factureMontantHtCents: f.montantHtCents,
    factureMontantTtcCents: f.montantTtcCents ?? f.montantHtCents + f.montantTvaCents,
    regimeTva: f.regimeTva,
    totalEncaisseTtcCents,
    paidAt,
    provider: paiement.provider,
    amountHtCents,
    soldeLaFacture,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-INT-032 — `paiement.rembourse`, ses SIX motifs et ses DEUX formes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Les six motifs, dans l'ordre de REQ-INT-032, mot pour mot.
 *
 * 🔑 CE N'EST PAS UNE LISTE DE CAS DE REMBOURSEMENT VOLONTAIRE. L'exigence est
 * explicite : « l'événement couvre TOUTE annulation d'encaissement […] axionia doit donc
 * l'émettre aussi sur un rejet bancaire ou un litige tranché ». Un prélèvement rejeté
 * retire de l'argent déjà comptabilisé exactement comme un remboursement décidé ; ne pas
 * l'émettre laisserait chez le récepteur une commission due sur un encaissement qui
 * n'existe plus.
 */
export const MOTIFS_REMBOURSEMENT = [
  "remboursement",
  "avoir",
  "litige_tranche",
  "rejet_prelevement",
  "virement_rappele",
  "autre",
] as const;

export type MotifRemboursement = (typeof MOTIFS_REMBOURSEMENT)[number];

/**
 * Les DEUX formes que prend une annulation d'encaissement dans ce dépôt — pas une de
 * plus, et c'est une propriété MESURÉE du schéma, pas une hypothèse.
 *
 * `AFFIRMATIONS-AXIONIA.md` (AFF-02) : `Refund` n'est pas un modèle de ce dépôt, c'est
 * une VALEUR d'énumération. Quatre documents du chantier ont décrit un contrat sur un
 * modèle `Refund` supprimé le 2026-08-26. Les deux formes réelles sont :
 *
 *   1. `payment_type_refund`   — un `Payment` NEUF de `type = refund` (Stripe en crée un).
 *   2. `payment_status_refunded` — le `Payment` d'origine passé à `status = refunded`.
 *
 * Elles ne sont pas interchangeables pour le récepteur : la première ajoute une ligne,
 * la seconde en annule une existante.
 */
export type FormeRemboursement = "payment_type_refund" | "payment_status_refunded";

export type PayloadPaiementRembourse = {
  paymentId: string;
  factureId: string;
  clientId: string | null;
  siren: string | null;
  montantHtCents: number;
  montantEncaisseTtcCents: number;
  motif: MotifRemboursement;
  forme: FormeRemboursement;
  rembourseLe: string;
  provider: string;
};

function motifValide(motif: string): MotifRemboursement {
  if (!(MOTIFS_REMBOURSEMENT as readonly string[]).includes(motif)) {
    throw new Error(
      `[partners] motif de remboursement « ${motif} » hors énumération REQ-INT-032 ` +
        `(${MOTIFS_REMBOURSEMENT.join(", ")}). Aucun repli sur « autre » : « autre » veut dire ` +
        "« on a regardé et ça n'entre dans aucune case », pas « personne n'a regardé ».",
    );
  }
  return motif as MotifRemboursement;
}

function formeDuRemboursement(paiement: PaiementPourEvenement): FormeRemboursement {
  if (paiement.type === "refund") return "payment_type_refund";
  if (paiement.status === "refunded") return "payment_status_refunded";
  throw new Error(
    `[partners] Payment ${paiement.id} n'est ni de type « refund » ni au statut « refunded » ` +
      `(type=${paiement.type}, status=${paiement.status}) : ce n'est pas une annulation d'encaissement.`,
  );
}

export function payloadPaiementRembourse({
  paiement,
  facture,
  totalEncaisseTtcCents,
  motif,
}: {
  paiement: PaiementPourEvenement;
  facture: FactureAvecClient | null;
  totalEncaisseTtcCents: number;
  motif: MotifRemboursement;
}): PayloadPaiementRembourse {
  // Le motif est vérifié AVANT tout le reste : c'est le seul champ que l'appelant
  // apporte de l'extérieur du schéma, donc le seul qui puisse être n'importe quoi.
  const motifRetenu = motifValide(motif);
  const forme = formeDuRemboursement(paiement);
  const f = exige(facture, `Payment.factureFormationId : la facture remboursée`);
  const rembourseLe = instant(paiement.paidAt, "Payment.paidAt : un remboursement sans date");

  const { amountHtCents } = derivationHt({
    facture: f,
    montantEncaisseTtcCents: paiement.amountCents,
    totalEncaisseTtcCents,
  });

  return verifieLaFrontiere("paiement.rembourse", {
    paymentId: paiement.id,
    factureId: f.id,
    clientId: resoudreClientBeneficiaire(f).clientId,
    siren: f.client?.siren ?? null,
    montantHtCents: amountHtCents,
    montantEncaisseTtcCents: paiement.amountCents,
    motif: motifRetenu,
    forme,
    rembourseLe,
    provider: paiement.provider,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-INT-032 — `financement.mis_a_jour`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `financement.mis_a_jour {factureId, payers[], echeanceFinanceurAt}` — EXACTEMENT ces
 * trois clés, et rien d'autre. L'exigence les énumère ; en ajouter une quatrième
 * « utile » ferait diverger le payload du texte qui le décrit, et c'est le texte qui
 * arbitre. ⚠️ HORS CONTRAT v1.
 */
export function payloadFinancementMisAJour({
  factureId,
  payeurs,
  echeanceFinanceurAt,
}: {
  factureId: string;
  payeurs: ReadonlyArray<PayeurPourEvenement>;
  echeanceFinanceurAt: Date | null;
}): { factureId: string; payers: PayeurEvenement[]; echeanceFinanceurAt: string | null } {
  return verifieLaFrontiere("financement.mis_a_jour", {
    factureId,
    payers: payers(payeurs),
    echeanceFinanceurAt: instantOuNul(echeanceFinanceurAt),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-INT-032 + REQ-CPL-015 — `candidature.recue`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La version du barème de score, DÉRIVÉE de ses poids.
 *
 * REQ-INT-032 demande un `scoreBaremeVersion`. Un numéro à incrémenter à la main est
 * mis à jour par la même personne, dans le même geste, que le barème qu'il est censé
 * dater : toujours juste quand on y pense, faux dès qu'on l'oublie. Une empreinte du
 * contenu change parce que le barème a changé — jamais parce que quelqu'un s'en est
 * souvenu. Deux scores de versions différentes deviennent alors comparables chez le
 * récepteur, et un reclassement rétroactif devient visible.
 */
export function versionDuBareme(poids: Readonly<Record<string, number>> = SCORE_POIDS): string {
  const canonique = Object.entries(poids)
    .map(([critere, poidsMax]) => `${critere}=${poidsMax}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonique, "utf8").digest("hex").slice(0, 12);
}

/**
 * LES RÉPONSES QUI TRAVERSENT — une liste FERMÉE, et fermée dans les deux sens.
 *
 * REQ-DM-041 borne ce qu'un payload peut porter : « identifiants, hashes, enums,
 * montants, horodatages — JAMAIS nom, e-mail, téléphone, IBAN, adresse ». Le bloc
 * `details.candidature` d'une candidature commerciale mélange les deux : des réponses
 * structurées (a-t-il déjà vendu en B2B, est-il mobile) et de la prose libre (le pitch,
 * le message libre) où la personne écrit ce qu'elle veut — son adresse, son numéro.
 *
 * 🔑 POURQUOI DEUX LISTES ET PAS UN FILTRE. Un filtre qui garde ce qu'il connaît laisse
 * passer en silence une question ajoutée demain au formulaire ; un filtre qui retire ce
 * qu'il connaît la laisse traverser. Les deux échouent sans bruit. Ici, une clé qui
 * n'est dans AUCUNE des deux listes fait LEVER : quiconque ajoute une question au
 * formulaire est forcé de dire de quel côté de la frontière elle tombe. C'est le
 * cliquet — il ne se contourne pas, il se tranche.
 */
const REPONSES_QUI_TRAVERSENT: readonly string[] = [
  "version",
  "b2b",
  "ia",
  "informatique",
  "zone",
  "deplacement",
  "disponibilite",
  "permisVehicule",
  "statut",
];

/** Ce qui reste dans axionia — et la raison, pour chacun. */
const REPONSES_QUI_RESTENT: readonly string[] = [
  "dateNaissance", // donnée personnelle, sans usage chez le récepteur
  "nationalite", // donnée sensible au sens large, aucun usage commission
  "ville", // localisation d'une personne physique
  "codePostal", // idem
  "experiences", // noms d'employeurs et historique professionnel
  "pitch", // prose libre : la personne y écrit ce qu'elle veut
  "messageLibre", // idem
  "linkedin", // URL nominative
  "sourceConnaissance", // déclaratif libre, non normalisé
];

/** Les sous-clés qui traversent, par bloc. Même règle : inconnue = on lève. */
const SOUS_REPONSES: Readonly<
  Record<string, { traversent: readonly string[]; restent: readonly string[] }>
> = {
  b2b: { traversent: ["dejaVendu", "annees"], restent: [] },
  ia: { traversent: ["utilise", "outils"], restent: ["outilAutre", "usage"] },
  informatique: { traversent: ["utilise", "usages"], restent: ["usageAutre", "autre"] },
  zone: { traversent: ["mobile", "zones"], restent: [] },
};

function trierLesReponses(candidature: Record<string, unknown>): Record<string, unknown> {
  const retenues: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(candidature)) {
    if (REPONSES_QUI_RESTENT.includes(cle)) continue;
    if (!REPONSES_QUI_TRAVERSENT.includes(cle)) {
      throw new Error(
        `[partners] candidature.recue : la réponse « ${cle} » n'est déclarée ni traversante ni ` +
          "retenue. Une question ajoutée au formulaire ne franchit pas la frontière par défaut : " +
          "l'inscrire dans REPONSES_QUI_TRAVERSENT ou REPONSES_QUI_RESTENT (payloads.ts).",
      );
    }
    const sous = SOUS_REPONSES[cle];
    if (
      sous === undefined ||
      valeur === null ||
      typeof valeur !== "object" ||
      Array.isArray(valeur)
    ) {
      retenues[cle] = valeur;
      continue;
    }
    const bloc: Record<string, unknown> = {};
    for (const [sousCle, sousValeur] of Object.entries(valeur as Record<string, unknown>)) {
      if (sous.restent.includes(sousCle)) continue;
      if (!sous.traversent.includes(sousCle)) {
        throw new Error(
          `[partners] candidature.recue : la sous-réponse « ${cle}.${sousCle} » n'est déclarée ` +
            "ni traversante ni retenue (SOUS_REPONSES, payloads.ts).",
        );
      }
      bloc[sousCle] = sousValeur;
    }
    retenues[cle] = bloc;
  }
  return retenues;
}

export type PayloadCandidatureRecue = {
  candidatureId: string;
  reponsesJson: Record<string, unknown>;
  scoreInitial: number;
  scorePartsJson: Record<string, unknown>;
  scoreBaremeVersion: string;
  sourceCanal: string;
  utm: Record<string, unknown> | null;
  campagneId: string | null;
  parrainCodeCapture: string | null;
};

/**
 * `candidature.recue` — REQ-INT-032, et le `source / utm / campagneId` de REQ-CPL-015.
 * ⚠️ HORS CONTRAT v1.
 *
 * 🔴 UN SCORE ABSENT LÈVE, IL N'EST PAS REMPLACÉ PAR 0. Un score à zéro se lit
 * « candidat sans aucun atout » et l'envoie au vivier — séquence e-mail, pas d'appel. Un
 * score absent veut dire « on ne sait pas ». Les confondre trie un vrai candidat dans la
 * mauvaise file, définitivement, et sans que rien ne le signale : la file « vivier » est
 * exactement celle que personne ne relit.
 */
export function payloadCandidatureRecue({
  submission,
}: {
  submission: SubmissionPourEvenement;
}): PayloadCandidatureRecue {
  const details = objet(submission.details, "Submission.details");

  // La clé du filtre de la vue console (« NE PAS RENOMMER », dit `actions.ts`). Une
  // submission qui n'est pas une candidature commerciale n'a ni score ni barème : la
  // traiter comme telle produirait un payload de zéros parfaitement valide.
  if (
    details["unifiedType"] !== "recrutement" ||
    details["subType"] !== "candidature-commerciale"
  ) {
    throw new Error(
      `[partners] Submission ${submission.id} n'est pas une candidature commerciale ` +
        `(unifiedType=${String(details["unifiedType"])}, subType=${String(details["subType"])}).`,
    );
  }

  const scoreInitial = nombre(details["score"], "details.score : le score de candidature");
  const scorePartsJson = objet(details["scoreParts"], "details.scoreParts : le détail du score");
  const sourceCanal = chaine(
    details["source"],
    "details.source : le canal de la candidature (REQ-CPL-015)",
  );

  const funnel = details["funnel"];
  const utm =
    funnel !== null && typeof funnel === "object" && !Array.isArray(funnel)
      ? (((funnel as Record<string, unknown>)["utm"] as Record<string, unknown> | undefined) ??
        null)
      : null;

  const candidature = objet(details["candidature"], "details.candidature : le bloc de réponses");

  return verifieLaFrontiere("candidature.recue", {
    candidatureId: submission.id,
    reponsesJson: trierLesReponses(candidature),
    scoreInitial,
    scorePartsJson,
    scoreBaremeVersion: versionDuBareme(),
    sourceCanal,
    utm,
    // 🔴 NULL MESURÉ, PAS NULL PAR PARESSE (relevé le 2026-09-05 sur ce dépôt).
    // REQ-CPL-015 exige un `campagneId` et un modèle `CampagneRecrutement {canal, coût,
    // période}`. Ce modèle N'EXISTE PAS dans `schema.prisma`, et aucun producteur ne
    // pose de campagne dans `src/`. Le champ est donc explicitement nul — et surtout PAS
    // rempli avec `utm_campaign`, qui est une étiquette publicitaire déclarative, pas
    // l'identifiant d'une campagne budgétée. Les confondre rendrait faux le « € / actif »
    // que l'exigence veut calculable, sans que le chiffre ait l'air faux.
    campagneId: null,
    // 🔴 Idem : aucun code de parrainage n'est capturé par le formulaire de candidature
    // aujourd'hui. Le champ est au contrat parce que REQ-INT-032 le nomme et que son
    // arbitrage de frontière est tranché (`EXEMPTIONS_NOMMEES`, frontiere.ts) ; son
    // producteur reste à écrire, et ce sera un autre lot.
    parrainCodeCapture: null,
  });
}
