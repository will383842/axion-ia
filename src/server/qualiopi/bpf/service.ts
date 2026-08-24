/**
 * Qualiopi — Service BPF (Bilan Pédagogique et Financier) (AGENT A — T10 + T17).
 *
 * Le 1-to-1 (conseil) n'entre plus dans le BPF actions de formation — 2026-08-10.
 * L'agrégation coaching (CA CoachingContract + heures de séances AFEST) qui
 * gonflait le CA et les heures stagiaires déclarés à la DREETS a été supprimée :
 * le coaching 1-to-1 est une prestation de CONSEIL (décision Will 2026-07-17),
 * hors périmètre du bilan pédagogique et financier.
 *
 * computeBpf      : agrégats annuels via Prisma (sessions réalisées).
 * bpfToCsv        : export CSV `;`-séparé (pur).
 * listDepenses    : dépenses BPF par année.
 * ajouterDepense  : création d'une dépense BPF.
 */

import { prisma } from "@/lib/prisma";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
// SSOT des statuts de facture — l'en-tête de ce module liste les trois endroits
// où la recopie de cette liste a déjà produit un filtre vide.
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

export interface BpfFinanceurDetail {
  opco: number;
  cpf: number;
  france_travail: number;
  direct: number;
  mixte: number;
}

export interface BpfDepenseItem {
  id: string;
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
  createdAt: Date;
}

export interface BpfDepensesResult {
  totalHtCents: number;
  parCategorie: Record<string, number>;
  items: BpfDepenseItem[];
}

export interface BpfResult {
  annee: number;
  organisme: {
    raisonSociale: string;
    nda: string;
    siret: string;
  };
  nbSessions: number;
  nbStagiairesDistincts: number;
  /**
   * Heures stagiaires des sessions collectives (durée réelle × participants).
   *
   * ⚠️ « participants » = `nbParticipantsReels` **s'il est renseigné**, sinon le
   * nombre d'inscrits. Le repli n'est pas un raffinement : `nbParticipantsReels`
   * n'a AUCUN écrivain dans le code applicatif (constat `CONF-04` / `D9-3-01` de
   * l'audit du 2026-08-19), donc la colonne est toujours `null` en production et
   * ce total valait invariablement 0. Le BPF déposé à la DREETS annonçait un
   * chiffre d'affaires complet en face de « 0 heure stagiaire ».
   */
  nbHeuresStagiaires: number;
  /**
   * Sessions réalisées qu'on n'a PAS su chiffrer, par identifiant.
   *
   * 🔴 Le silence était le défaut d'origine : une session sans durée réelle était
   * absorbée dans le total sans laisser de trace, et le BPF affirmait une
   * exhaustivité qu'il n'avait pas. Les nommer permet à celui qui dépose de voir
   * ce qui manque avant de signer.
   */
  sessionsNonChiffrables: string[];
  /**
   * Sessions réalisées dont le CA DÉCLARÉ ne correspond pas à ce qui a été
   * FACTURÉ.
   *
   * 🔴 2026-08-24, cahier D9 — le BPF déclare `Σ session.montantHtCents` ;
   * l'assiette de TVA et le FEC déclarent `Σ facture.montantHtCents`. Un
   * contrôle croisé DREETS/DGFiP compare les deux, et **rien ne les rapprochait**
   * dans l'outil : le module BPF ne lisait aucune facture.
   *
   * ⚠️ « à RAPPROCHER », jamais « facturation manquante ». Un écart peut être
   * parfaitement légitime — acompte non encore soldé, prise en charge partielle
   * révisée par le financeur, facture OPCO émise avant le reste à charge. Aucun
   * champ ne distingue ces cas d'un oubli. Nommer l'écart « manquant » ferait
   * crier l'outil sur des dossiers sains, ce qui est PIRE que ne rien dire :
   * une alerte qu'on apprend à ignorer ne protège plus rien.
   */
  sessionsEcartFacturation: ReadonlyArray<{
    readonly sessionId: string;
    readonly montantSessionHtCents: number;
    readonly montantFactureHtCents: number;
    /** Session moins facturé. Positif = déclaré au BPF au-delà du facturé. */
    readonly ecartHtCents: number;
  }>;
  /** Somme des écarts ci-dessus. Sans total, la ligne du CSV ne dit rien. */
  ecartFacturationTotalHtCents: number;
  caTotalHtCents: number;
  caParFinanceur: BpfFinanceurDetail;
  nbFormateursInternes: number;
  nbFormateursExternes: number;
  depenses: BpfDepensesResult;
  calculeAt: Date;
}

export async function computeBpf(annee: number): Promise<BpfResult> {
  const identite = await getOrganismeIdentite();

  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyBpf(annee, identite);
  }

  const plage = {
    gte: new Date(`${annee}-01-01T00:00:00.000Z`),
    lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
  };

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateDebut: plage,
    },
    select: {
      id: true,
      dureeReelleHeures: true,
      nbParticipantsReels: true,
      montantHtCents: true,
      financementType: true,
      // 🔴 Requis par le rapprochement de facturation : en INTER, le montant de
      // la session est un PRIX DE SIÈGE, pas un total — la facturation s'y fait
      // par inscription. Comparer les deux ferait crier +300 % sur chaque
      // session inter.
      interEntreprises: true,
      enrollments: {
        select: { traineeId: true },
      },
    },
  });

  const nbSessions = sessions.length;

  const traineeIds = new Set<string>();
  for (const session of sessions) {
    for (const enrollment of session.enrollments) {
      traineeIds.add(enrollment.traineeId);
    }
  }
  const nbStagiairesDistincts = traineeIds.size;

  // 🔴 `nbParticipantsReels ?? enrollments.length` — cf. le commentaire de
  // `BpfResult.nbHeuresStagiaires`. La colonne n'a aucun écrivain applicatif ;
  // exiger qu'elle soit non nulle rendait ce total invariablement égal à 0.
  //
  // ⚠️ L'ordre compte : une constatation humaine explicite (`nbParticipantsReels`)
  // fait foi CONTRE le nombre d'inscrits. Le repli ne l'écrase jamais — il ne
  // sert que lorsque personne n'a constaté l'effectif.
  //
  // ⚠️ La durée, elle, n'a PAS de repli. Substituer la durée catalogue à une
  // durée réelle absente inventerait des heures ; c'est exactement ce que
  // `duree-reelle.ts` refuse de faire, et pour la même raison. La session est
  // alors NOMMÉE plutôt que comptée pour zéro.
  let nbHeuresStagiaires = 0;
  const sessionsNonChiffrables: string[] = [];
  for (const session of sessions) {
    const participants = session.nbParticipantsReels ?? session.enrollments.length;
    if (session.dureeReelleHeures === null || participants === 0) {
      sessionsNonChiffrables.push(session.id);
      continue;
    }
    nbHeuresStagiaires += session.dureeReelleHeures * participants;
  }

  // ── Rapprochement BPF ↔ factures ────────────────────────────────────────
  //
  // 🔴 2026-08-24, cahier D9 — le module BPF ne lisait AUCUNE facture. Il
  // déclarait `Σ session.montantHtCents` pendant que le FEC déclarait
  // `Σ facture.montantHtCents`, et rien ne rapprochait les deux.
  //
  // ⚠️ Le piège de ce rapprochement, c'est le FAUX POSITIF. Cinq situations
  // produisent un écart parfaitement normal, et chacune est exclue ci-dessous
  // pour une raison distincte. Un écart qui crie sur des dossiers sains est
  // pire que pas d'écart du tout : on apprend à l'ignorer, et il cesse de
  // protéger le jour où il compte.
  const facturesDesSessions =
    sessions.length === 0
      ? []
      : await prisma.factureFormation.findMany({
          where: {
            sessionId: { in: sessions.map((s) => s.id) },
            // Un avoir porte des montants NÉGATIFS : l'additionner au facturé
            // fabriquerait un écart de toutes pièces.
            avoirDeId: null,
            // Reprise d'historique : hors séquence AXI-FACT, et hors périmètre
            // du rapprochement.
            estImportee: false,
          },
          select: { sessionId: true, statut: true, montantHtCents: true },
        });

  const factureParSession = new Map<string, number>();
  for (const f of facturesDesSessions) {
    if (f.sessionId === null) continue;
    // SSOT `statuts-facture.ts`, jamais recopié : un brouillon ou une facture
    // annulée ne facture rien ; une facture en retard ou partiellement payée,
    // SI — sans quoi la même session serait comptée deux fois.
    if (!estFactureOuverte(f.statut) && f.statut !== "payee") continue;
    factureParSession.set(
      f.sessionId,
      (factureParSession.get(f.sessionId) ?? 0) + f.montantHtCents,
    );
  }

  const sessionsEcartFacturation: Array<{
    sessionId: string;
    montantSessionHtCents: number;
    montantFactureHtCents: number;
    ecartHtCents: number;
  }> = [];
  for (const session of sessions) {
    // ① INTER — `montantHtCents` est un prix de SIÈGE, pas un total : la
    //    facturation se fait par inscription. L'écart serait de +300 % sur
    //    chaque session inter, systématiquement.
    if (session.interEntreprises) continue;
    // ② GRATUIT — 0 € facturé pour 0 € déclaré. L'écart est nul, mais une
    //    session gratuite n'a pas à figurer dans une liste d'anomalies.
    if (session.montantHtCents === 0) continue;
    // ③ CPF — la Caisse des Dépôts règle l'organisme APRÈS service fait, sur
    //    pièces déposées dans EDOF. Le titulaire ne verse rien : une session
    //    CPF réalisée peut légitimement n'avoir aucune facture dans l'outil.
    if (session.financementType === "cpf") continue;

    const facture = factureParSession.get(session.id) ?? 0;
    const ecart = session.montantHtCents - facture;
    if (ecart === 0) continue;
    sessionsEcartFacturation.push({
      sessionId: session.id,
      montantSessionHtCents: session.montantHtCents,
      montantFactureHtCents: facture,
      ecartHtCents: ecart,
    });
  }
  const ecartFacturationTotalHtCents = sessionsEcartFacturation.reduce(
    (acc, e) => acc + e.ecartHtCents,
    0,
  );

  const caTotalHtCents = sessions.reduce((acc, s) => acc + s.montantHtCents, 0);

  const caParFinanceur: BpfFinanceurDetail = {
    opco: 0,
    cpf: 0,
    france_travail: 0,
    direct: 0,
    mixte: 0,
  };
  for (const session of sessions) {
    const type = session.financementType ?? "direct";
    if (type in caParFinanceur) {
      caParFinanceur[type as keyof BpfFinanceurDetail] += session.montantHtCents;
    }
  }

  // Le 1-to-1 (conseil) n'entre plus dans le BPF actions de formation —
  // 2026-08-10. L'ancien `aggregateCoaching` (CA contrats + heures de séances)
  // a été supprimé : seules les sessions de FORMATION alimentent le bilan.

  const [nbFormateursInternes, nbFormateursExternes, depenses] = await Promise.all([
    // Internes = salariés + dirigeant-formateur (l'OF anime lui-même). Externes = sous-traitants.
    prisma.trainer.count({ where: { statut: { in: ["salarie", "dirigeant"] }, actif: true } }),
    prisma.trainer.count({ where: { statut: "sous_traitant", actif: true } }),
    listDepenses(annee),
  ]);

  return {
    annee,
    organisme: {
      raisonSociale: identite.raisonSociale,
      nda: identite.nda,
      siret: identite.siret,
    },
    nbSessions,
    nbStagiairesDistincts,
    nbHeuresStagiaires,
    sessionsNonChiffrables,
    sessionsEcartFacturation,
    ecartFacturationTotalHtCents,
    caTotalHtCents,
    caParFinanceur,
    nbFormateursInternes,
    nbFormateursExternes,
    depenses,
    calculeAt: new Date(),
  };
}

export function bpfToCsv(bpf: BpfResult): string {
  const lignes: string[] = [];

  lignes.push(`Bilan Pédagogique et Financier — Année ${bpf.annee}`);
  lignes.push(`Organisme;${bpf.organisme.raisonSociale}`);
  lignes.push(`NDA;${bpf.organisme.nda}`);
  lignes.push(`SIRET;${bpf.organisme.siret}`);
  lignes.push(`Généré le;${bpf.calculeAt.toLocaleDateString("fr-FR")}`);
  lignes.push("");
  lignes.push("Indicateur;Valeur");
  lignes.push(`Nombre de sessions réalisées;${bpf.nbSessions}`);
  lignes.push(`Nombre de stagiaires distincts;${bpf.nbStagiairesDistincts}`);
  lignes.push(`Nombre d'heures stagiaires;${bpf.nbHeuresStagiaires}`);
  lignes.push(`Chiffre d'affaires total HT (€);${centimesEnEuros(bpf.caTotalHtCents)}`);
  // 🔴 La ligne n'apparaît QUE s'il y a quelque chose à dire. Une ligne
  // « 0 session non chiffrable » sur tous les bilans deviendrait du décor et
  // cesserait d'être lue le jour où elle compte. Mais quand elle apparaît, elle
  // est juste sous le total d'heures qu'elle nuance — pas reléguée en annexe.
  if (bpf.sessionsNonChiffrables.length > 0) {
    lignes.push(
      `⚠️ Sessions réalisées non chiffrables (durée réelle ou effectif absent);${bpf.sessionsNonChiffrables.length}`,
    );
  }
  // 🔴 2026-08-24 — même doctrine que la ligne ci-dessus : elle n'apparaît QUE
  // s'il y a quelque chose à dire. Une ligne « 0 écart » sur tous les bilans
  // deviendrait du décor et cesserait d'être lue le jour où elle compte.
  //
  // ⚠️ Le libellé dit « À RAPPROCHER », jamais « manquante » : un acompte non
  // soldé, une prise en charge révisée ou une facture OPCO émise avant le reste
  // à charge produisent un écart parfaitement légitime.
  if (bpf.sessionsEcartFacturation.length > 0) {
    lignes.push(
      `⚠️ Sessions dont le CA déclaré diffère du facturé — À RAPPROCHER (acompte, prise en charge partielle, solde non émis);${bpf.sessionsEcartFacturation.length}`,
    );
    lignes.push(`⚠️ Écart total HT (€);${centimesEnEuros(bpf.ecartFacturationTotalHtCents)}`);
  }
  lignes.push("");
  lignes.push("Financeur;CA HT (€)");
  lignes.push(`OPCO;${centimesEnEuros(bpf.caParFinanceur.opco)}`);
  lignes.push(`CPF;${centimesEnEuros(bpf.caParFinanceur.cpf)}`);
  lignes.push(`France Travail;${centimesEnEuros(bpf.caParFinanceur.france_travail)}`);
  lignes.push(`Financement direct;${centimesEnEuros(bpf.caParFinanceur.direct)}`);
  lignes.push(`Mixte;${centimesEnEuros(bpf.caParFinanceur.mixte)}`);
  lignes.push("");
  lignes.push("Formateurs;Nombre");
  lignes.push(`Formateurs internes (salariés + dirigeant);${bpf.nbFormateursInternes}`);
  lignes.push(`Formateurs externes (sous-traitants);${bpf.nbFormateursExternes}`);

  // Section dépenses
  if (bpf.depenses.items.length > 0) {
    lignes.push("");
    lignes.push("Dépenses BPF;Montant HT (€)");
    lignes.push(`Total dépenses;${centimesEnEuros(bpf.depenses.totalHtCents)}`);
    lignes.push("");
    lignes.push("Catégorie;Montant HT (€)");
    for (const [categorie, montant] of Object.entries(bpf.depenses.parCategorie)) {
      lignes.push(`${categorie};${centimesEnEuros(montant)}`);
    }
    lignes.push("");
    lignes.push("Libellé;Catégorie;Montant HT (€)");
    for (const d of bpf.depenses.items) {
      lignes.push(`${d.libelle};${d.categorie};${centimesEnEuros(d.montantHtCents)}`);
    }
  }

  return lignes.join("\n");
}

function centimesEnEuros(centimes: number): string {
  return (centimes / 100).toFixed(2);
}

function buildEmptyBpf(
  annee: number,
  identite: Awaited<ReturnType<typeof getOrganismeIdentite>>,
): BpfResult {
  return {
    annee,
    organisme: {
      raisonSociale: identite.raisonSociale,
      nda: identite.nda,
      siret: identite.siret,
    },
    nbSessions: 0,
    nbStagiairesDistincts: 0,
    nbHeuresStagiaires: 0,
    sessionsNonChiffrables: [],
    sessionsEcartFacturation: [],
    ecartFacturationTotalHtCents: 0,
    caTotalHtCents: 0,
    caParFinanceur: { opco: 0, cpf: 0, france_travail: 0, direct: 0, mixte: 0 },
    nbFormateursInternes: 0,
    nbFormateursExternes: 0,
    depenses: { totalHtCents: 0, parCategorie: {}, items: [] },
    calculeAt: new Date(),
  };
}

// ─── Helpers dépenses BPF ────────────────────────────────────────────────────

/**
 * Liste les dépenses BPF d'une année, agrégées (total + par catégorie).
 * Stub-aware : retourne un résultat vide si DATABASE_URL contient "stub.invalid".
 */
export async function listDepenses(annee: number): Promise<BpfDepensesResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return { totalHtCents: 0, parCategorie: {}, items: [] };
  }

  const rows = await prisma.bpfDepense.findMany({
    where: { annee },
    orderBy: [{ categorie: "asc" }, { createdAt: "asc" }],
  });

  const parCategorie: Record<string, number> = {};
  let totalHtCents = 0;

  for (const row of rows) {
    totalHtCents += row.montantHtCents;
    parCategorie[row.categorie] = (parCategorie[row.categorie] ?? 0) + row.montantHtCents;
  }

  return {
    totalHtCents,
    parCategorie,
    items: rows.map((r) => ({
      id: r.id,
      annee: r.annee,
      categorie: r.categorie,
      libelle: r.libelle,
      montantHtCents: r.montantHtCents,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Crée une nouvelle dépense BPF.
 * Stub-aware : no-op si DATABASE_URL contient "stub.invalid".
 */
export async function ajouterDepense(input: {
  annee: number;
  categorie: string;
  libelle: string;
  montantHtCents: number;
}): Promise<BpfDepenseItem> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      id: "stub-id",
      annee: input.annee,
      categorie: input.categorie,
      libelle: input.libelle,
      montantHtCents: input.montantHtCents,
      createdAt: new Date(),
    };
  }

  const row = await prisma.bpfDepense.create({
    data: {
      annee: input.annee,
      categorie: input.categorie.slice(0, 80),
      libelle: input.libelle.slice(0, 250),
      montantHtCents: input.montantHtCents,
    },
  });

  return {
    id: row.id,
    annee: row.annee,
    categorie: row.categorie,
    libelle: row.libelle,
    montantHtCents: row.montantHtCents,
    createdAt: row.createdAt,
  };
}

/**
 * Supprime une dépense BPF par id.
 * Stub-aware : no-op si DATABASE_URL contient "stub.invalid".
 */
export async function supprimerDepense(id: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return;
  await prisma.bpfDepense.delete({ where: { id } });
}
