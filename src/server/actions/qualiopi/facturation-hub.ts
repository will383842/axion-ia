/**
 * Hub facturation — Server Actions des factures LIBRES multi-activités.
 *
 * Wrappers Zod + RBAC + audit autour de `financements/facture-libre.ts` :
 *   - émission d'une facture libre (5 activités, lignes libres, TVA/ligne) ;
 *   - conversion devis accepté → facture ;
 *   - avoir (total ou partiel) ;
 *   - encaissement manuel (virement/chèque/espèces, partiel accepté).
 *
 * Le retour d'émission expose `chorusProRequis` : client secteur public →
 * dépôt Chorus Pro OBLIGATOIRE (obligation en vigueur, hors réforme 2026).
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  genererFactureLibre,
  genererAvoirFacture,
  enregistrerPaiementFacture,
} from "@/server/qualiopi/financements/facture-libre";
import {
  transitionnerDossier,
  creerDossierDepuisSession,
} from "@/server/qualiopi/financements/dossier-financement";
import { planifierFacturationDevis } from "@/server/qualiopi/financements/facture-libre-pur";
// SSOT du plafond légal (art. L6353-6) : la même constante que `calculerAcompte`
// applique. Ne pas la recopier en dur ici — c'est ainsi que deux règles divergent.
import {
  PLAFOND_ACOMPTE_PARTICULIER_PCT,
  DELAI_RETRACTATION_PARTICULIER_JOURS,
  dateEncaissablePartir,
  encaissementAutorise,
  dateEngagementParticulier,
} from "@/server/qualiopi/financements/acompte";
import type { LigneFacture } from "@/server/qualiopi/documents/templates/facture";

const ActiviteSchema = z.enum(["formation", "un_a_un", "audit", "implementation", "site_web"]);

const LigneSchema = z.object({
  designation: z.string().min(1).max(500),
  quantite: z.number().positive(),
  prixUnitaireHtCents: z.number().int(),
  tauxTvaPercent: z.number().min(0).max(30).optional(),
});

const GenererFactureLibreSchema = z.object({
  clientId: z.string().uuid(),
  activite: ActiviteSchema,
  lignes: z.array(LigneSchema).min(1).max(50),
  refClient: z.string().max(120).optional(),
  auditMissionId: z.string().uuid().optional(),
  periodePrestation: z.string().max(200).optional(),
});

export async function genererFactureLibreAction(
  rawInput: unknown,
): Promise<
  { data: { factureId: string; numero: string; chorusProRequis: boolean } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = GenererFactureLibreSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  // Garde d'appartenance : la mission d'audit facturée doit être celle du
  // client facturé (pas de rattachement croisé).
  if (input.auditMissionId !== undefined) {
    const mission = await prisma.auditMission.findUnique({
      where: { id: input.auditMissionId },
      select: { clientId: true },
    });
    if (!mission) return { error: "Mission d'audit introuvable." };
    if (mission.clientId !== null && mission.clientId !== input.clientId) {
      return { error: "Cette mission d'audit appartient à un autre client." };
    }
  }

  try {
    const result = await genererFactureLibre({
      clientId: input.clientId,
      activite: input.activite,
      lignes: input.lignes as LigneFacture[],
      ...(input.refClient !== undefined ? { refClient: input.refClient } : {}),
      ...(input.auditMissionId !== undefined ? { auditMissionId: input.auditMissionId } : {}),
      ...(input.periodePrestation !== undefined
        ? { periodePrestation: input.periodePrestation }
        : {}),
    });
    await logQualiopiActivity({
      action: "facturation.facture_libre.emettre",
      targetType: "FactureFormation",
      targetId: result.factureId,
      changes: { numero: result.numero, activite: input.activite, clientId: input.clientId },
      session,
    });
    return {
      data: {
        factureId: result.factureId,
        numero: result.numero,
        chorusProRequis: result.chorusProRequis,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Émission impossible." };
  }
}

const DepuisDevisSchema = z.object({
  devisId: z.string().uuid(),
  /**
   * Facture d'ACOMPTE de X % (document séparé, obligatoire fiscalement quand
   * un acompte est demandé à la commande). Absent = solde/totalité : lignes du
   * devis MOINS les acomptes déjà facturés (déduits au taux facturé).
   */
  acomptePercent: z.number().int().min(1).max(90).optional(),
});

/**
 * Signatures du/des CONTRAT(S) de formation rattaché(s) à ce devis.
 *
 * ## Le chemin de rattachement, et pourquoi il est étroit
 *
 * `DocumentGenere` ne porte pas de `devisId`. Le seul lien fiable est
 * `Devis → TrainingSession.devisId → DocumentGenere(type: "contrat")` : le
 * contrat individuel est généré depuis une inscription, avec
 * `refs: { sessionId, traineeId }` (cf. `genererContratFormationAction`).
 *
 * 🔴 On NE remonte PAS par `clientId`. Ce serait plus large — et donc plus
 * PERMISSIF : un contrat ancien du même client, signé il y a six mois, ferait
 * expirer le délai d'un tout autre engagement. Un rattachement approximatif sur
 * une règle légale vaut moins que pas de rattachement du tout : sans lien de
 * session, on retombe sur le repli `acceptedAt`, c'est-à-dire le comportement
 * d'avant ce correctif.
 *
 * ⚠️ Les lignes RÉVOQUÉES sont volontairement RAMENÉES, pas filtrées en SQL :
 * la règle « une révocation ne fait courir aucun délai » vit dans
 * `dateEngagementParticulier`, et elle doit y vivre SEULE. La dupliquer dans un
 * `where` laisserait les deux diverger sans que rien ne le signale.
 *
 * Plusieurs stagiaires ⇒ plusieurs contrats : la fonction pure retient la
 * signature valable la plus tardive, donc le délai de tous est écoulé.
 */
async function lireSignaturesContratDuDevis(
  devisId: string,
): Promise<Array<{ signeAt: Date; revokedAt: Date | null }>> {
  return prisma.documentSignature.findMany({
    where: {
      documentGenere: { type: "contrat", session: { devisId } },
    },
    select: { signeAt: true, revokedAt: true },
  });
}

/**
 * Facture un devis ACCEPTÉ : acompte de X %, ou solde/totalité (les acomptes
 * déjà facturés sont déduits). Le devis doit porter une activité — c'est elle
 * qui pilote le régime TVA. La décision des lignes est un planificateur PUR
 * (`planifierFacturationDevis`, testé isolément).
 */
export async function genererFactureDepuisDevisAction(
  rawInput: unknown,
): Promise<
  { data: { factureId: string; numero: string; chorusProRequis: boolean } } | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = DepuisDevisSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };

  const devis = await prisma.devis.findUnique({
    where: { id: parsed.data.devisId },
    select: {
      id: true,
      numero: true,
      statut: true,
      activite: true,
      refClient: true,
      clientId: true,
      lignes: true,
      // Date d'engagement du particulier : fait courir le délai de rétractation
      // de 10 jours (art. L6353-5). Sans elle dans le select, le garde-fou
      // ci-dessous lirait `undefined` et laisserait passer TOUTES les factures —
      // un garde-fou qui n'en est pas un.
      acceptedAt: true,
      // Nature du client : le plafond d'acompte de 30 % (art. L6353-6) est une
      // règle de droit, pas un réglage commercial. Elle doit vivre au serveur —
      // le template du contrat la « rattrape » par un Math.min(…, 30), ce qui
      // corrige l'affichage du PDF mais n'empêche nullement d'ÉMETTRE la facture.
      client: { select: { type: true } },
      facturesFormation: {
        where: { statut: { not: "annulee" }, avoirDeId: null },
        select: { numero: true, montantHtCents: true, montantTvaCents: true },
      },
    },
  });
  if (!devis) return { error: "Devis introuvable." };
  if (devis.statut !== "accepte" && devis.statut !== "transforme_convention") {
    return { error: "Seul un devis accepté se facture." };
  }
  if (devis.activite === null) {
    return { error: "Renseigner l'activité du devis avant facturation (pilote le régime TVA)." };
  }

  const lignesParsed = z.array(LigneSchema).safeParse(devis.lignes);
  if (!lignesParsed.success || lignesParsed.data.length === 0) {
    return { error: "Lignes du devis illisibles — corriger le devis." };
  }

  // Taux effectivement facturé sur chaque facture liée (le régime a pu évoluer).
  const facturesLiees = devis.facturesFormation.map((f) => ({
    numero: f.numero,
    montantHtCents: f.montantHtCents,
    tauxEffectifPercent:
      f.montantHtCents > 0 ? Math.round((f.montantTvaCents / f.montantHtCents) * 100) : 0,
  }));

  // ── Art. L6353-6 — plafond de l'acompte demandé à un PARTICULIER ──
  //
  // Le plafond porte sur la SOMME déjà appelée, pas sur le taux d'un appel :
  // « il ne peut être payé une somme supérieure à 30 % du prix convenu ».
  // Tester `acomptePercent > 30` ne suffit donc pas — `planifierFacturationDevis`
  // ne refuse un acompte que s'il dépasse le RESTANT à facturer, si bien que
  // trois factures d'acompte de 30 % passaient l'une après l'autre et portaient
  // le total à 90 %. Le schéma Zod, lui, autorise jusqu'à 90 % en un seul appel
  // (borne commerciale, valable entre professionnels).
  //
  // Assiette = le TOTAL HT du devis, c'est-à-dire le « prix convenu » de
  // l'article — pas `resteAChargeCents`, que le PDF déclare lui-même
  // « estimation indicative, non contractuelle », et qu'un particulier n'a de
  // toute façon pas (pas d'OPCO).
  // ── Art. L6353-6 (1) — délai de rétractation NON EXPIRÉ ──
  //
  // 🔴 Le trou : « aucune somme ne peut être exigée NI VERSÉE avant l'expiration
  // du délai de rétractation » (10 j, L6353-5). Le calcul existait
  // (`encaissableAPartirDu`) mais n'était **lu nulle part** dans `src/` — un
  // contrôle en trompe-l'œil : le contrat annonçait une date que rien
  // n'appliquait. Rien n'empêchait donc de facturer un particulier le jour même.
  //
  // Le refus est AU SERVEUR, pas dans l'UI : une Server Action est appelable
  // directement, et un garde-fou d'UI ne protège que celui qui passe par l'UI.
  //
  // ✅ 2026-07-29 — le délai court désormais depuis la SIGNATURE DU CONTRAT.
  //
  // Le dépôt le faisait courir depuis `Devis.acceptedAt`, faute de mieux : c'était
  // l'intrant le plus fiable disponible, et il était documenté comme provisoire.
  // Il ne l'est plus. L6353-5 fait courir les dix jours à compter de la conclusion
  // du CONTRAT de formation (L6353-3) ; l'acceptation d'un devis n'existe nulle
  // part dans le code du travail. Le registre `DocumentSignature` rend cette date
  // lisible : la règle s'applique enfin à l'intrant que la loi désigne.
  //
  // `acceptedAt` reste le REPLI quand aucun contrat n'est signé — ce qui est le
  // cas de tout l'historique antérieur au registre. Sans lui, ce correctif
  // bloquerait d'un coup toute facturation de particulier ; avec lui, le
  // comportement des dossiers sans contrat signé est INCHANGÉ.
  //
  // ⚠️ Cas d'inversion (contrat signé AVANT l'acceptation du devis) : la signature
  // l'emporte quand même, et c'est assumé. C'est la seule date que L6353-5
  // mentionne ; `acceptedAt` n'a jamais eu de portée légale, ce n'était qu'une
  // approximation. Retenir la plus tardive des deux ferait attendre l'organisme
  // au-delà de ce que la loi exige, sur la foi d'une donnée sans valeur juridique.
  if (devis.client.type === "particulier") {
    const engagement = dateEngagementParticulier({
      signaturesContrat: await lireSignaturesContratDuDevis(devis.id),
      devisAcceptedAt: devis.acceptedAt,
    });
    if (!encaissementAutorise(engagement.date, new Date())) {
      const prefixe = `Facturation refusée : l'article L6353-6 interdit d'exiger ou de percevoir une somme d'un particulier avant l'expiration du délai de rétractation de ${DELAI_RETRACTATION_PARTICULIER_JOURS} jours (art. L6353-5).`;
      // Le message NOMME la source de la date : un admin doit pouvoir recouper le
      // refus avec une pièce du dossier. Annoncer « accepté le … » alors qu'on a
      // lu une signature de contrat rendrait le garde-fou inauditable.
      if (engagement.date !== null) {
        const encaissableLe = dateEncaissablePartir(engagement.date);
        const origine =
          engagement.source === "signature_contrat"
            ? `Le contrat de formation a été signé le ${engagement.date.toLocaleDateString("fr-FR")}`
            : `Aucun contrat de formation signé n'est rattaché à ce devis : le délai court, à titre de repli, depuis l'acceptation du devis le ${engagement.date.toLocaleDateString("fr-FR")}`;
        return {
          error: `${prefixe} ${origine} — facturation possible à partir du ${encaissableLe.toLocaleDateString("fr-FR")}.`,
        };
      }
      return {
        error: `${prefixe} Ni signature du contrat de formation, ni date d'acceptation du devis : le délai est incalculable, et une date manquante ne vaut pas autorisation. Faites signer le contrat (ou renseignez l'acceptation du devis) avant de facturer un particulier.`,
      };
    }
  }

  if (parsed.data.acomptePercent !== undefined && devis.client.type === "particulier") {
    const totalHtCents = lignesParsed.data.reduce(
      (acc, l) => acc + Math.round(l.quantite * l.prixUnitaireHtCents),
      0,
    );
    const dejaFactureHtCents = devis.facturesFormation.reduce(
      (acc, f) => acc + f.montantHtCents,
      0,
    );
    const plafondHtCents = Math.floor((totalHtCents * PLAFOND_ACOMPTE_PARTICULIER_PCT) / 100);
    const demandeHtCents = Math.round((totalHtCents * parsed.data.acomptePercent) / 100);
    if (dejaFactureHtCents + demandeHtCents > plafondHtCents) {
      const eur = (c: number): string => (c / 100).toFixed(2);
      return {
        error: `Acompte refusé : l'article L6353-6 plafonne à ${PLAFOND_ACOMPTE_PARTICULIER_PCT} % du prix convenu la somme appelée à un particulier (déjà facturé ${eur(dejaFactureHtCents)} € HT + ${eur(demandeHtCents)} € HT demandés > plafond ${eur(plafondHtCents)} € HT). Le solde s'échelonne au fur et à mesure du déroulement de l'action.`,
      };
    }
  }

  const plan = planifierFacturationDevis({
    lignesDevis: lignesParsed.data as LigneFacture[],
    facturesLiees,
    devisNumero: devis.numero,
    ...(parsed.data.acomptePercent !== undefined
      ? { acomptePercent: parsed.data.acomptePercent }
      : {}),
  });
  if (!plan.ok) return { error: plan.erreur };

  try {
    const result = await genererFactureLibre({
      clientId: devis.clientId,
      activite: devis.activite,
      lignes: plan.lignes,
      devisId: devis.id,
      ...(devis.refClient !== null ? { refClient: devis.refClient } : {}),
    });
    await logQualiopiActivity({
      action: plan.estAcompte ? "facturation.devis.facturer_acompte" : "facturation.devis.facturer",
      targetType: "Devis",
      targetId: devis.id,
      changes: {
        devisNumero: devis.numero,
        factureNumero: result.numero,
        acomptePercent: parsed.data.acomptePercent ?? null,
      },
      session,
    });
    return {
      data: {
        factureId: result.factureId,
        numero: result.numero,
        chorusProRequis: result.chorusProRequis,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Facturation impossible." };
  }
}

const GenererAvoirSchema = z.object({
  factureId: z.string().uuid(),
  /** Absent = avoir TOTAL. Sinon montant HT partiel en centimes. */
  montantPartielHtCents: z.number().int().positive().optional(),
  motif: z.string().min(5).max(500),
});

export async function genererAvoirAction(
  rawInput: unknown,
): Promise<{ data: { avoirId: string; numero: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = GenererAvoirSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide (motif : 5 caractères minimum)." };

  try {
    const result = await genererAvoirFacture({
      factureId: parsed.data.factureId,
      motif: parsed.data.motif,
      ...(parsed.data.montantPartielHtCents !== undefined
        ? { montantPartielHtCents: parsed.data.montantPartielHtCents }
        : {}),
    });
    await logQualiopiActivity({
      action: "facturation.avoir.emettre",
      targetType: "FactureFormation",
      targetId: parsed.data.factureId,
      changes: {
        avoirNumero: result.numero,
        motif: parsed.data.motif,
        montantPartielHtCents: parsed.data.montantPartielHtCents ?? null,
      },
      session,
    });
    return { data: { avoirId: result.avoirId, numero: result.numero } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Avoir impossible." };
  }
}

const EnregistrerPaiementSchema = z.object({
  factureId: z.string().uuid(),
  montantCents: z.number().int().positive(),
  paidAt: z.coerce.date(),
  mode: z.enum(["manual_wire", "manual_check", "manual_cash"]),
  reference: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function enregistrerPaiementFactureAction(
  rawInput: unknown,
): Promise<
  | { data: { paymentId: string; statut: "partiellement_payee" | "payee"; resteACents: number } }
  | { error: string }
> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnregistrerPaiementSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    const result = await enregistrerPaiementFacture({
      factureId: input.factureId,
      montantCents: input.montantCents,
      paidAt: input.paidAt,
      mode: input.mode,
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      recordedByAdminId: session.userId,
    });
    await logQualiopiActivity({
      action: "facturation.paiement.enregistrer",
      targetType: "FactureFormation",
      targetId: input.factureId,
      changes: {
        montantCents: input.montantCents,
        mode: input.mode,
        statut: result.statut,
        resteACents: result.resteACents,
      },
      session,
    });
    return { data: result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Encaissement impossible." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — dossiers de financement + reprise d'historique
// ─────────────────────────────────────────────────────────────────────────────

const CreerDossierSchema = z.object({
  /// Depuis une session (reprend les champs OPCO existants)…
  trainingSessionId: z.string().uuid().optional(),
  /// …ou dossier libre rattaché à un client.
  clientId: z.string().uuid().optional(),
  type: z.enum(["opco", "france_travail", "cpf", "mixte"]).optional(),
  financeurNom: z.string().max(120).optional(),
  montantDemandeCents: z.number().int().positive().optional(),
  subrogation: z.boolean().optional(),
});

export async function creerDossierFinancementAction(
  rawInput: unknown,
): Promise<{ data: { dossierId: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = CreerDossierSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    let dossierId: string;
    if (input.trainingSessionId !== undefined) {
      const result = await creerDossierDepuisSession(input.trainingSessionId);
      dossierId = result.id;
    } else {
      if (input.clientId === undefined || input.type === undefined) {
        return { error: "Dossier libre : clientId et type sont requis." };
      }
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { raisonSociale: true },
      });
      if (!client) return { error: "Client introuvable." };
      const dossier = await prisma.dossierFinancement.create({
        data: {
          type: input.type,
          clientId: input.clientId,
          ...(input.financeurNom !== undefined ? { financeurNom: input.financeurNom } : {}),
          ...(input.montantDemandeCents !== undefined
            ? { montantDemandeCents: input.montantDemandeCents }
            : {}),
          ...(input.subrogation !== undefined ? { subrogation: input.subrogation } : {}),
        },
        select: { id: true },
      });
      dossierId = dossier.id;
    }
    await logQualiopiActivity({
      action: "facturation.dossier.creer",
      targetType: "DossierFinancement",
      targetId: dossierId,
      changes: { source: input.trainingSessionId !== undefined ? "session" : "libre" },
      session,
    });
    return { data: { dossierId } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Création du dossier impossible." };
  }
}

const TransitionDossierSchema = z.object({
  dossierId: z.string().uuid(),
  vers: z.enum(["a_monter", "envoye", "accord_recu", "refuse", "facture", "paiement_recu", "clos"]),
  montantAccordeCents: z.number().int().positive().optional(),
  echeanceFinanceurAt: z.coerce.date().optional(),
});

export async function transitionnerDossierAction(
  rawInput: unknown,
): Promise<{ data: { statut: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = TransitionDossierSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    const result = await transitionnerDossier({
      dossierId: input.dossierId,
      vers: input.vers,
      ...(input.montantAccordeCents !== undefined
        ? { montantAccordeCents: input.montantAccordeCents }
        : {}),
      ...(input.echeanceFinanceurAt !== undefined
        ? { echeanceFinanceurAt: input.echeanceFinanceurAt }
        : {}),
    });
    await logQualiopiActivity({
      action: "facturation.dossier.transition",
      targetType: "DossierFinancement",
      targetId: input.dossierId,
      changes: { vers: input.vers, montantAccordeCents: input.montantAccordeCents ?? null },
      session,
    });
    return { data: { statut: result.statut } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Transition impossible." };
  }
}

const ImportHistoriqueSchema = z.object({
  factures: z
    .array(
      z.object({
        numero: z.string().min(3).max(40),
        dateEmission: z.coerce.date(),
        clientNom: z.string().min(1).max(250),
        montantHtCents: z.number().int(),
        montantTtcCents: z.number().int().optional(),
        statut: z.enum(["emise", "payee"]),
        activite: ActiviteSchema.optional(),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * Reprise d'historique (C9) : importe des factures émises HORS système pour
 * que dashboards et balance âgée soient exhaustifs dès le jour 1. Les numéros
 * `AXI-FACT-*`/`AXI-AVO-*` sont REFUSÉS (protection de la séquence légale) ;
 * les doublons de numéro sont ignorés (idempotent, re-import sans effet).
 */
export async function importerFacturesHistoriqueAction(
  rawInput: unknown,
): Promise<{ data: { importees: number; ignorees: number } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = ImportHistoriqueSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide (max 500 lignes par import)." };

  const collision = parsed.data.factures.find(
    (f) => f.numero.startsWith("AXI-FACT-") || f.numero.startsWith("AXI-AVO-"),
  );
  if (collision !== undefined) {
    return {
      error: `Numéro « ${collision.numero} » refusé : les préfixes AXI-FACT/AXI-AVO sont réservés à la séquence du système.`,
    };
  }
  // Cohérence des montants (le FEC exige Σ débits = Σ crédits) : hors avoirs
  // (tout négatif), la TVA ne peut pas être négative → TTC ≥ HT.
  const incoherente = parsed.data.factures.find((f) => {
    const ttc = f.montantTtcCents ?? f.montantHtCents;
    return f.montantHtCents >= 0 ? ttc < f.montantHtCents : ttc > f.montantHtCents;
  });
  if (incoherente !== undefined) {
    return {
      error: `Facture « ${incoherente.numero} » : TTC < HT (TVA négative) — corriger le fichier d'import.`,
    };
  }

  let importees = 0;
  let ignorees = 0;
  for (const f of parsed.data.factures) {
    try {
      await prisma.factureFormation.create({
        data: {
          numero: f.numero,
          estImportee: true,
          ...(f.activite !== undefined ? { activite: f.activite } : {}),
          destinataire: "entreprise",
          destinataireNom: f.clientNom,
          montantHtCents: f.montantHtCents,
          montantTtcCents: f.montantTtcCents ?? f.montantHtCents,
          montantTvaCents: (f.montantTtcCents ?? f.montantHtCents) - f.montantHtCents,
          tvaExoneree: (f.montantTtcCents ?? f.montantHtCents) === f.montantHtCents,
          lignes: [] as never,
          statut: f.statut,
          emiseAt: f.dateEmission,
          ...(f.statut === "payee" ? { paidAt: f.dateEmission } : {}),
        },
      });
      importees++;
    } catch (err) {
      const isP2002 =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (isP2002) {
        ignorees++;
        continue;
      }
      throw err;
    }
  }

  await logQualiopiActivity({
    action: "facturation.historique.importer",
    targetType: "FactureFormation",
    changes: { importees, ignorees },
    session,
  });
  return { data: { importees, ignorees } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — traitement des relances proposées (envoi = TOUJOURS un clic admin)
// ─────────────────────────────────────────────────────────────────────────────

const TraiterRelanceSchema = z.object({
  relanceId: z.string().uuid(),
  action: z.enum(["ignorer", "reporter"]),
  /// Report : nombre de jours (défaut 7).
  reportJours: z.number().int().min(1).max(90).optional(),
});

export async function traiterRelanceAction(
  rawInput: unknown,
): Promise<{ data: { statut: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = TraiterRelanceSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const statut = input.action === "ignorer" ? "ignoree" : "reportee";
  const reporteeJusqua =
    input.action === "reporter"
      ? new Date(Date.now() + (input.reportJours ?? 7) * 86_400_000)
      : null;

  // Une relance `reportee` reste traitable (revue M2 : elle revient à l'échéance
  // du report — re-reporter ou ignorer doit rester possible).
  const { count } = await prisma.relanceProposee.updateMany({
    where: { id: input.relanceId, statut: { in: ["a_traiter", "reportee"] } },
    data: {
      statut,
      traiteeAt: new Date(),
      traiteeParAdminId: session.userId,
      ...(reporteeJusqua !== null ? { reporteeJusqua } : {}),
    },
  });
  if (count === 0) return { error: "Relance introuvable ou déjà traitée." };

  await logQualiopiActivity({
    action: `facturation.relance.${input.action}`,
    targetType: "RelanceProposee",
    targetId: input.relanceId,
    changes: { reportJours: input.reportJours ?? null },
    session,
  });
  return { data: { statut } };
}

const EnvoyerRelanceSchema = z.object({
  relanceId: z.string().uuid(),
  to: z.string().email().optional(),
  messagePersonnalise: z.string().max(4000).optional(),
});

/**
 * Envoie la relance d'une facture CRM (email manuel avec PDF joint) puis
 * marque la proposition `envoyee`. Les relances de factures BOOKING et de
 * devis booking se traitent depuis leurs écrans dédiés (ignorer/reporter ici).
 */
export async function envoyerRelanceAction(
  rawInput: unknown,
): Promise<{ data: { to: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EnvoyerRelanceSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  const relance = await prisma.relanceProposee.findUnique({
    where: { id: input.relanceId },
    select: { id: true, statut: true, factureFormationId: true, suggestion: true },
  });
  if (!relance) return { error: "Relance introuvable." };
  if (relance.statut !== "a_traiter" && relance.statut !== "reportee") {
    return { error: "Relance déjà traitée." };
  }
  if (relance.factureFormationId === null) {
    return {
      error:
        "Cette relance concerne un document booking — la traiter depuis son écran dédié (ou l'ignorer ici).",
    };
  }

  const { envoyerFactureEmailAction } =
    await import("@/server/actions/qualiopi/facturation-emails");
  const envoi = await envoyerFactureEmailAction({
    factureId: relance.factureFormationId,
    ...(input.to !== undefined ? { to: input.to } : {}),
    messagePersonnalise:
      input.messagePersonnalise ??
      relance.suggestion ??
      "Sauf erreur de notre part, cette facture reste en attente de règlement.",
  });
  if ("error" in envoi) return { error: envoi.error };

  await prisma.relanceProposee.updateMany({
    where: { id: relance.id, statut: { in: ["a_traiter", "reportee"] } },
    data: { statut: "envoyee", traiteeAt: new Date(), traiteeParAdminId: session.userId },
  });
  await logQualiopiActivity({
    action: "facturation.relance.envoyer",
    targetType: "RelanceProposee",
    targetId: relance.id,
    changes: { to: envoi.data.to },
    session,
  });
  return { data: { to: envoi.data.to } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — plans récurrents (brouillons proposés, émission manuelle)
// ─────────────────────────────────────────────────────────────────────────────

const CreerPlanSchema = z.object({
  clientId: z.string().uuid(),
  activite: ActiviteSchema,
  lignes: z.array(LigneSchema).min(1).max(50),
  refClient: z.string().max(120).optional(),
  periodiciteMois: z.number().int().min(1).max(12).optional(),
  premiereGenerationAt: z.coerce.date(),
  finAt: z.coerce.date().optional(),
  nbMaxFactures: z.number().int().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function creerPlanRecurrentAction(
  rawInput: unknown,
): Promise<{ data: { planId: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = CreerPlanSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };
  const input = parsed.data;

  try {
    const plan = await prisma.planRecurrent.create({
      data: {
        clientId: input.clientId,
        activite: input.activite,
        lignes: input.lignes as never,
        ...(input.refClient !== undefined ? { refClient: input.refClient } : {}),
        periodiciteMois: input.periodiciteMois ?? 1,
        prochaineGenerationAt: input.premiereGenerationAt,
        ...(input.finAt !== undefined ? { finAt: input.finAt } : {}),
        ...(input.nbMaxFactures !== undefined ? { nbMaxFactures: input.nbMaxFactures } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: { id: true },
    });
    await logQualiopiActivity({
      action: "facturation.plan_recurrent.creer",
      targetType: "PlanRecurrent",
      targetId: plan.id,
      changes: { clientId: input.clientId, activite: input.activite },
      session,
    });
    return { data: { planId: plan.id } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Création du plan impossible." };
  }
}

const ChangerStatutPlanSchema = z.object({
  planId: z.string().uuid(),
  statut: z.enum(["actif", "pause", "clos"]),
});

export async function changerStatutPlanAction(
  rawInput: unknown,
): Promise<{ data: { statut: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = ChangerStatutPlanSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };

  // Un plan clos ne se rouvre pas (historique figé — recréer un plan).
  const { count } = await prisma.planRecurrent.updateMany({
    where: { id: parsed.data.planId, statut: { not: "clos" } },
    data: { statut: parsed.data.statut },
  });
  if (count === 0) return { error: "Plan introuvable ou déjà clos (recréer un plan)." };

  await logQualiopiActivity({
    action: "facturation.plan_recurrent.statut",
    targetType: "PlanRecurrent",
    targetId: parsed.data.planId,
    changes: { statut: parsed.data.statut },
    session,
  });
  return { data: { statut: parsed.data.statut } };
}

const EmettreBrouillonSchema = z.object({ factureId: z.string().uuid() });

/**
 * Émet une facture en BROUILLON (récurrente ou libre) : régime TVA re-snapshoté
 * à l'émission, échéance posée, PDF généré. C'est LE clic qui rend la facture
 * définitive — jusqu'ici, rien n'était figé ni envoyé.
 */
export async function emettreFactureBrouillonAction(
  rawInput: unknown,
): Promise<{ data: { numero: string } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = EmettreBrouillonSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Entrée invalide." };

  try {
    const { emettreFactureBrouillon } =
      await import("@/server/qualiopi/financements/plan-recurrent");
    const result = await emettreFactureBrouillon(parsed.data.factureId);
    await logQualiopiActivity({
      action: "facturation.brouillon.emettre",
      targetType: "FactureFormation",
      targetId: parsed.data.factureId,
      changes: { numero: result.numero },
      session,
    });
    return { data: { numero: result.numero } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Émission impossible." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 — export FEC (contrôle fiscal / expert-comptable)
// ─────────────────────────────────────────────────────────────────────────────

const ExporterFecSchema = z.object({ annee: z.number().int().min(2020).max(2100) });

/**
 * Exporte le FEC de l'exercice (factures CRM émises + encaissements).
 * Retourne le contenu texte (TAB-séparé) — le client télécharge en
 * `AXIONIA_FEC_{annee}.txt`.
 *
 * 🔴 Audit certification 2026-07-26 (F46). C'était `requireAdminRead`, qui ne
 * filtre RIEN : n'importe quelle session admin passait, y compris un rôle
 * `reader` — et `_guards.ts` retombe précisément sur `reader` quand le jeton ne
 * porte pas de claim de rôle, or c'est la valeur par défaut de `AdminUser.role`.
 * Le FEC est le grand livre comptable intégral. `exportComptaCsvAction` et
 * `exportPilotageCsvAction`, dans le même fichier, exigeaient déjà
 * `requireAdminWrite` : il n'y avait pas de doctrine, juste une omission.
 * (rôle comptable).
 */
export async function exporterFecAction(
  rawInput: unknown,
): Promise<{ data: { contenu: string; nbFactures: number } } | { error: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { error: "Indisponible au build." };
  }
  const session = await requireAdminWrite();
  const parsed = ExporterFecSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "Année invalide." };
  const annee = parsed.data.annee;
  const debut = new Date(Date.UTC(annee, 0, 1));
  const fin = new Date(Date.UTC(annee + 1, 0, 1));

  const [factures, paiements] = await Promise.all([
    prisma.factureFormation.findMany({
      where: {
        statut: { in: ["emise", "partiellement_payee", "en_retard", "payee"] },
        emiseAt: { gte: debut, lt: fin },
      },
      orderBy: { emiseAt: "asc" },
      select: {
        numero: true,
        emiseAt: true,
        destinataireNom: true,
        montantHtCents: true,
        montantTvaCents: true,
        montantTtcCents: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        factureFormationId: { not: null },
        status: "succeeded",
        paidAt: { gte: debut, lt: fin },
      },
      orderBy: { paidAt: "asc" },
      select: {
        amountCents: true,
        paidAt: true,
        receivedReference: true,
        factureFormation: { select: { numero: true, destinataireNom: true } },
      },
    }),
  ]);

  const { genererFec } = await import("@/server/qualiopi/financements/fec");
  const contenu = genererFec(
    factures.map((f) => ({
      numero: f.numero,
      dateEmission: f.emiseAt ?? debut,
      clientNom: f.destinataireNom,
      montantHtCents: f.montantHtCents,
      montantTvaCents: f.montantTvaCents,
      montantTtcCents: f.montantTtcCents ?? f.montantHtCents,
    })),
    paiements
      .filter((p) => p.factureFormation !== null && p.paidAt !== null)
      .map((p) => ({
        factureNumero: p.factureFormation?.numero ?? "",
        clientNom: p.factureFormation?.destinataireNom ?? "",
        date: p.paidAt ?? debut,
        montantCents: p.amountCents,
        ...(p.receivedReference !== null ? { reference: p.receivedReference } : {}),
      })),
  );

  await logQualiopiActivity({
    action: "facturation.fec.exporter",
    targetType: "FactureFormation",
    changes: { annee, nbFactures: factures.length },
    session,
  });
  return { data: { contenu, nbFactures: factures.length } };
}
