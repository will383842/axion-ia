/**
 * V1 — VÉRIFICATION DES FAITS EXTRAITS PAR P1 (`compte-rendu-et-extraction.md` §3.3, §4).
 *
 * Pour chaque fait, dans cet ordre, et le premier échec rejette le fait avec
 * son motif (jamais de correction silencieuse d'une valeur) :
 *
 *   G5  déduction permise pour ce type ;
 *   G1, G1b, G2  chaque preuve : segments réels, consécutifs, même piste,
 *                citation mot pour mot de 3 à 40 mots — la piste CLIENT est
 *                la source attendue : une phrase qu'on retrouve à l'identique
 *                sur les deux pistes est un signal « écho » ;
 *   G3  locuteur admis (confirmation du client dans les 90 s si besoin) ;
 *   G4  montants, quantités et date présents dans les citations, date
 *       RECALCULÉE par le code ;
 *   G7  référence du catalogue connue ;
 *   G8  passage sensible ⇒ fait MIS EN ATTENTE (pas rejeté : Will décide).
 *
 * Puis G6 (couverture corrigée) et G11 (suivi de l'historique seulement avec
 * une preuve du jour). Le code pose `citationVerifiee`, les horodatages, le
 * locuteur réel et la clé normalisée — jamais l'IA.
 *
 * ⚠️ Un fait REJETÉ ne garde pas sa citation : la vérification ne conserve
 * jamais le texte d'une citation rejetée (seulement le motif).
 *
 * Module PUR.
 */

import type { FaitType, MotifRejetFait } from "../../../../prisma/generated/client";
import type { ExtractionV1, FaitExtrait } from "../schemas/extraction";
import { TYPES_DE_FAITS } from "../types-de-faits";
import {
  normaliserPourCitation,
  rangsDansLaPiste,
  verifierPreuve,
  type SegmentDuJour,
  type VerdictPreuve,
} from "./g01-citation";
import { verifierLocuteur } from "./g03-locuteur";
import { verifierValeurs, type PrecisionCalculee } from "./g04-valeurs";
import { corrigerCouverture, type Couverture } from "./g06-couverture";
import {
  consigneDansLaConversation,
  deductionPermise,
  estSensible,
  normaliserCle,
  referenceConnue,
  suiviAdmis,
} from "./regles";

export interface FaitVerifie {
  readonly ref: string;
  readonly type: FaitType;
  readonly cle: string;
  readonly enonce: string;
  readonly statut: "propose" | "en_attente" | "rejete";
  readonly motif: MotifRejetFait | null;
  readonly certitude: "dit_explicitement" | "confirme_sur_reformulation" | "deduit";
  readonly confiance: "haute" | "moyenne" | "faible";
  readonly locuteur: "client" | "axion" | null;
  readonly etiquette: string | null;
  readonly citation: string | null;
  readonly citationDebutMs: number | null;
  readonly citationFinMs: number | null;
  readonly confirmationCitation: string | null;
  readonly confirmationDebutMs: number | null;
  readonly confirmationFinMs: number | null;
  readonly montantMinCents: number | null;
  readonly montantMaxCents: number | null;
  readonly baseMontant: "ht" | "ttc" | "non_precise" | null;
  readonly periodeMontant: "total" | "par_an" | "par_mois" | "par_personne" | "non_precise" | null;
  readonly dateCible: string | null;
  readonly precisionDate: PrecisionCalculee | null;
  readonly expressionTemporelle: string | null;
  readonly quantite: number | null;
  readonly unite: string | null;
  readonly refCatalogue: string | null;
  readonly texteCourt: string | null;
  readonly porteeDeclaree: "entreprise" | "projet";
  readonly projetRef: string | null;
  readonly personneSujetRef: string | null;
  readonly ambiguite: string | null;
  readonly sensible: boolean;
}

export interface SuiviVerifie {
  readonly connuRef: string;
  readonly statut: "tenu" | "repondu" | "en_cours" | "abandonne";
}

export interface BilanV1 {
  readonly faits: readonly FaitVerifie[];
  readonly couverture: Couverture;
  readonly correctionsCouverture: number;
  readonly suivis: readonly SuiviVerifie[];
  readonly suivisRejetes: number;
  readonly consentement: { readonly texte: string; readonly debutMs: number } | null;
  readonly demandeArretMs: number | null;
  readonly signaux: {
    readonly echo: number;
    readonly passagesEcartes: number;
    readonly consigneALOral: boolean;
    readonly sensibles: number;
  };
}

export interface EntreeV1 {
  readonly extraction: ExtractionV1;
  /** Les segments du jour, dans l'ordre du dialogue (S0001…). */
  readonly segments: readonly SegmentDuJour[];
  readonly catalogue: ReadonlySet<string>;
  /** Références `H…` des faits déjà connus envoyés dans `deja_connu`. */
  readonly connus: ReadonlySet<string>;
  readonly dateEchange: Date;
}

function rejete(f: FaitExtrait, motif: MotifRejetFait): FaitVerifie {
  return {
    ref: f.ref,
    type: f.type,
    cle: normaliserCle(f.type, f.cle, f.valeur.ref_catalogue),
    enonce: f.enonce,
    statut: "rejete",
    motif,
    certitude: f.certitude,
    confiance: f.confiance,
    locuteur: null,
    etiquette: null,
    // Jamais la citation d'un fait rejeté.
    citation: null,
    citationDebutMs: null,
    citationFinMs: null,
    confirmationCitation: null,
    confirmationDebutMs: null,
    confirmationFinMs: null,
    montantMinCents: null,
    montantMaxCents: null,
    baseMontant: null,
    periodeMontant: null,
    dateCible: null,
    precisionDate: null,
    expressionTemporelle: null,
    quantite: null,
    unite: null,
    refCatalogue: null,
    texteCourt: null,
    porteeDeclaree: f.portee,
    projetRef: f.projet_ref,
    personneSujetRef: f.personne_sujet_ref,
    ambiguite: null,
    sensible: false,
  };
}

function verifierUnFait(
  f: FaitExtrait,
  e: EntreeV1,
  parId: ReadonlyMap<string, SegmentDuJour>,
  rangs: ReadonlyMap<string, number>,
): { fait: FaitVerifie; echo: boolean } {
  if (!(f.type in TYPES_DE_FAITS)) return { fait: rejete(f, "segment_inconnu"), echo: false };
  // G5
  if (!deductionPermise(f.type, f.certitude))
    return { fait: rejete(f, "deduction_interdite"), echo: false };
  // G1, G1b, G2 — toutes les preuves.
  if (f.preuves.length === 0) return { fait: rejete(f, "citation_introuvable"), echo: false };
  const verdicts = f.preuves.map((p) => verifierPreuve(p, parId, rangs));
  const echec = verdicts.find((v): v is Extract<VerdictPreuve, { ok: false }> => !v.ok);
  if (echec) return { fait: rejete(f, echec.motif), echo: false };
  const premiere = verdicts[0] as Extract<VerdictPreuve, { ok: true }>;
  // G3
  const confirmation =
    f.confirmation_client === null ? null : verifierPreuve(f.confirmation_client, parId, rangs);
  const loc = verifierLocuteur({
    type: f.type,
    locuteurDeclare: f.locuteur_declare,
    preuve: premiere,
    confirmation,
  });
  if (!loc.ok) return { fait: rejete(f, "locuteur_non_admis"), echo: false };
  // G4
  const citations = [
    ...f.preuves.map((p) => p.citation),
    ...(confirmation?.ok && f.confirmation_client ? [f.confirmation_client.citation] : []),
  ];
  const valeurs = verifierValeurs(f.valeur, citations, e.dateEchange);
  if (!valeurs.ok) return { fait: rejete(f, "valeur_non_prouvee"), echo: false };
  // G7
  const ref = f.valeur.ref_catalogue;
  if (ref !== null && !referenceConnue(ref, e.catalogue)) {
    return { fait: rejete(f, "reference_catalogue_inconnue"), echo: false };
  }
  // Écho : la même phrase sur l'autre piste.
  const autrePiste = premiere.piste === "client" ? "axion" : "client";
  const cherche = normaliserPourCitation(f.preuves[0]!.citation);
  const echo = e.segments.some(
    (s) =>
      s.piste === autrePiste && ` ${normaliserPourCitation(s.texte)} `.includes(` ${cherche} `),
  );
  // G8
  const sensible = estSensible(f.enonce, f.valeur.texte_court);
  const confirmationOk = confirmation !== null && confirmation.ok ? confirmation : null;
  const certitude = f.certitude === "deduit" ? "deduit" : loc.certitude;
  return {
    echo,
    fait: {
      ref: f.ref,
      type: f.type,
      cle: normaliserCle(f.type, f.cle, ref),
      enonce: f.enonce,
      statut: sensible ? "en_attente" : "propose",
      motif: null,
      certitude,
      confiance: f.confiance,
      locuteur: premiere.piste,
      etiquette: premiere.etiquette,
      citation: f.preuves.map((p) => p.citation).join(" … "),
      citationDebutMs: premiere.debutMs,
      citationFinMs: premiere.finMs,
      confirmationCitation: confirmationOk ? f.confirmation_client!.citation : null,
      confirmationDebutMs: confirmationOk ? confirmationOk.debutMs : null,
      confirmationFinMs: confirmationOk ? confirmationOk.finMs : null,
      montantMinCents: f.valeur.montant_min_cents,
      montantMaxCents: f.valeur.montant_max_cents,
      baseMontant: f.valeur.base_montant,
      periodeMontant: f.valeur.periode_montant,
      dateCible: valeurs.date?.date ?? null,
      precisionDate: valeurs.date?.precision ?? null,
      expressionTemporelle: f.valeur.expression_temporelle,
      quantite: f.valeur.quantite,
      unite: f.valeur.unite,
      refCatalogue: ref,
      texteCourt: f.valeur.texte_court,
      porteeDeclaree: f.portee,
      projetRef: f.projet_ref,
      personneSujetRef: f.personne_sujet_ref,
      ambiguite: valeurs.dateNonLue
        ? [f.ambiguite, "date non recalculée par le site"].filter(Boolean).join(" ; ")
        : f.ambiguite,
      sensible,
    },
  };
}

/** V1 complète. */
export function verifierFaits(e: EntreeV1): BilanV1 {
  const parId = new Map(e.segments.map((s) => [s.id, s]));
  const rangs = rangsDansLaPiste(e.segments);
  const vus = new Set<string>();
  const faits: FaitVerifie[] = [];
  let echo = 0;
  for (const f of e.extraction.faits) {
    // Une référence en double : la seconde est rejetée (jamais deux faits pour un « F07 »).
    if (vus.has(f.ref)) {
      faits.push(rejete(f, "doublon"));
      continue;
    }
    vus.add(f.ref);
    const r = verifierUnFait(f, e, parId, rangs);
    if (r.echo) echo += 1;
    faits.push(r.fait);
  }
  const retenus = new Map(faits.filter((f) => f.statut !== "rejete").map((f) => [f.ref, f.type]));
  const { couverture, corrections } = corrigerCouverture(e.extraction.couverture, retenus);

  const suivis: SuiviVerifie[] = [];
  let suivisRejetes = 0;
  for (const s of e.extraction.suivi_du_connu) {
    const v = verifierPreuve(s.preuve, parId, rangs);
    if (suiviAdmis(s.connu_ref, e.connus, v.ok))
      suivis.push({ connuRef: s.connu_ref, statut: s.statut });
    else suivisRejetes += 1;
  }

  let consentement: BilanV1["consentement"] = null;
  if (e.extraction.consentement) {
    const v = verifierPreuve(e.extraction.consentement, parId, rangs);
    if (v.ok && v.piste === "client") {
      consentement = { texte: e.extraction.consentement.citation, debutMs: v.debutMs };
    }
  }
  let demandeArretMs: number | null = null;
  if (e.extraction.demande_arret_enregistrement) {
    const v = verifierPreuve(e.extraction.demande_arret_enregistrement, parId, rangs);
    if (v.ok) demandeArretMs = v.debutMs;
  }

  return {
    faits,
    couverture,
    correctionsCouverture: corrections,
    suivis,
    suivisRejetes,
    consentement,
    demandeArretMs,
    signaux: {
      echo,
      passagesEcartes: e.extraction.passages_ecartes.length,
      consigneALOral: consigneDansLaConversation(e.segments.map((s) => s.texte)),
      sensibles: faits.filter((f) => f.sensible).length,
    },
  };
}
