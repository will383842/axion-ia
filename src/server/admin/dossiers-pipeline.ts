/**
 * Vue « 📁 Dossiers » — dérivation du statut de pipeline (refonte console
 * phase 2, 2026-08-01, cf. `_PLANS/PLAN-REFONTE-CONSOLE-2026-08.md`).
 *
 * ## Pourquoi ce module
 *
 * Verdict de Will sur la console : « un client vit dans 6 onglets sans lien ».
 * La vue Dossiers répond à « où en est chaque affaire ? » : UNE ligne par
 * affaire, rangée dans une colonne de pipeline. Le statut n'est stocké NULLE
 * PART — il se DÉRIVE des données existantes (Devis, TrainingSession,
 * CoachingSession, AuditMission + leurs pièces, factures et dossiers de
 * financement). Une colonne stockée serait une deuxième source de vérité qui
 * divergerait un jour des tables qu'elle prétend résumer ; une colonne dérivée
 * est toujours juste, par construction.
 *
 * 🔴 Le cœur est une fonction PURE (`deriverStatutDossier`) : mêmes entrées →
 * même colonne, sans horloge implicite ni I/O. C'est elle qui porte les règles
 * métier, et c'est elle que le spec verrouille — notamment LE piège :
 * « réalisée mais impayée N'EST PAS soldée ».
 *
 * `lireDossiersPipeline()` fait le reste : requêtes minimales, mapping vers
 * des lignes affichables, groupage par colonne. Stub-safe (build GH Actions
 * sans DB, cf. ADR 0026) : chaque lecture retombe sur [] en cas d'erreur.
 */

import { prisma } from "@/lib/prisma";
import type {
  AuditMissionStatut,
  CoachingSessionStatut,
  DevisStatut,
  TrainingSessionStatut,
} from "../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Colonnes du pipeline
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiants des colonnes, dans l'ordre du cycle de vie d'une affaire. */
export type ColonnePipeline =
  | "devis_attente"
  | "signature_attente"
  | "a_preparer"
  | "en_cours"
  | "a_solder"
  | "soldes";

/**
 * Fenêtre d'affichage des dossiers soldés : au-delà, la ligne sort de la vue
 * (pas des données). Sans cette fenêtre, la colonne « Soldés » grossirait sans
 * fin et noierait les cinq colonnes qui demandent une action.
 */
export const FENETRE_SOLDES_JOURS = 30;

/** Plafond de lignes par SOURCE (devis / sessions / coachings / audits). */
export const TAKE_MAX = 200;

/**
 * Ordre + libellés des colonnes — consommés par la page pour le rendu.
 * L'ordre EST le cycle de vie : devis → signature → préparation → réalisation
 * → solde → clos. Lire la page de gauche à droite, c'est lire la vie d'une
 * affaire.
 */
export const COLONNES_PIPELINE: ReadonlyArray<{
  id: ColonnePipeline;
  label: string;
  description: string;
}> = [
  {
    id: "devis_attente",
    label: "📥 Devis en attente",
    description: "Devis envoyés au client, sans réponse — à relancer ou à statuer.",
  },
  {
    id: "signature_attente",
    label: "✍️ Signature en attente",
    description: "Session planifiée dont une pièce attend une signature ou un contreseing.",
  },
  {
    id: "a_preparer",
    label: "📅 À préparer",
    description: "Prestations planifiées, pièces signées — préparer le jour J.",
  },
  {
    id: "en_cours",
    label: "▶️ En cours",
    description: "Prestations en cours de réalisation — suivre les émargements.",
  },
  {
    id: "a_solder",
    label: "🧾 À solder",
    description: "Réalisées mais PAS payées : facture impayée ou financement non clos.",
  },
  {
    id: "soldes",
    label: "✅ Soldés",
    description: `Réalisées et payées — ${FENETRE_SOLDES_JOURS} derniers jours seulement.`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Badge d'activité
// ─────────────────────────────────────────────────────────────────────────────

/** Famille d'activité d'une ligne (badge visuel de la vue). */
export type ActiviteDossier = "formation" | "coaching" | "audit";

export const ACTIVITE_LABELS: Record<ActiviteDossier, string> = {
  formation: "🎓 Formation",
  coaching: "🤝 Coaching",
  audit: "🔍 Audit",
};

// ─────────────────────────────────────────────────────────────────────────────
// Fonction pure de dérivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrées de la dérivation — une variante par source, chacune réduite aux
 * SEULS faits dont les règles ont besoin. Les booléens (`signatureEnAttente`,
 * `factureImpayee`, `financementNonSolde`) sont calculés en amont par les
 * requêtes : la fonction pure ne connaît ni Prisma ni la forme des tables,
 * elle ne juge que des faits.
 */
export type DossierSource =
  | { source: "devis"; statut: DevisStatut }
  | {
      source: "session";
      statut: TrainingSessionStatut;
      /** Une pièce de la session porte `statutSignature` ∈ {en_attente, partielle}. */
      signatureEnAttente: boolean;
      /** Une facture liée est émise / partiellement payée / en retard. */
      factureImpayee: boolean;
      /** Un dossier de financement existe et n'est ni `paiement_recu` ni `clos`. */
      financementNonSolde: boolean;
      updatedAt: Date;
    }
  | {
      source: "coaching";
      statut: CoachingSessionStatut;
      factureImpayee: boolean;
      updatedAt: Date;
    }
  | {
      source: "audit";
      statut: AuditMissionStatut;
      factureImpayee: boolean;
      updatedAt: Date;
    };

/** La ligne soldée est-elle encore assez récente pour rester affichée ? */
function estDansFenetreSoldes(updatedAt: Date, maintenant: Date): boolean {
  const ageMs = maintenant.getTime() - updatedAt.getTime();
  return ageMs <= FENETRE_SOLDES_JOURS * 24 * 60 * 60 * 1000;
}

/**
 * Règle « réalisée » commune aux trois prestations (session / coaching /
 * audit) : payée → soldée (si récente), sinon → à solder.
 *
 * 🔴 LE piège métier que cette factorisation verrouille : une prestation
 * réalisée mais IMPAYÉE n'est JAMAIS soldée — et elle ne sort JAMAIS de la
 * vue, quel que soit son âge. La fenêtre de 30 jours ne s'applique qu'aux
 * dossiers réellement clos : faire vieillir une créance hors de l'écran,
 * c'est exactement comme ça qu'on oublie de se faire payer.
 */
function colonneRealisee(
  resteASolder: boolean,
  updatedAt: Date,
  maintenant: Date,
): ColonnePipeline | null {
  if (resteASolder) return "a_solder";
  return estDansFenetreSoldes(updatedAt, maintenant) ? "soldes" : null;
}

/**
 * Dérive la colonne de pipeline d'une affaire — ou `null` si l'affaire n'a pas
 * sa place dans la vue (devis brouillon, session annulée, soldée trop vieille…).
 *
 * PURE : `maintenant` est un paramètre explicite, jamais `new Date()` interne
 * — sans quoi les tests de la fenêtre des 30 jours dépendraient de l'horloge
 * de la CI (et la machine de prod est en UTC, pas en heure de Paris).
 *
 * Règles (une par branche, chacune testée dans `dossiers-pipeline.spec.ts`) :
 * - Devis `envoye` → « Devis en attente ». `brouillon` = pas encore une
 *   affaire ; `accepte`/`transforme_convention` → l'affaire continue via sa
 *   session ; `refuse`/`expire` → terminée. Tous → null.
 * - Session `planifiee` + pièce en attente de signature → « Signature en
 *   attente » ; `planifiee` sinon → « À préparer » ; `en_cours` → « En cours »
 *   (même avec une signature en retard : le jour J prime) ; `realisee` →
 *   règle commune ci-dessus ; `annulee`/`reportee` → null (exclues de la vue,
 *   pas des données — la session reportée revit via sa session de
 *   remplacement).
 * - Coaching / Audit : logique simplifiée (pas de circuit de signature suivi
 *   ici) — `planifiee` → « À préparer », `realisee` → règle commune,
 *   `en_cours` (audit seulement) → « En cours ».
 */
export function deriverStatutDossier(
  dossier: DossierSource,
  maintenant: Date,
): ColonnePipeline | null {
  switch (dossier.source) {
    case "devis":
      return dossier.statut === "envoye" ? "devis_attente" : null;

    case "session":
      switch (dossier.statut) {
        case "planifiee":
          return dossier.signatureEnAttente ? "signature_attente" : "a_preparer";
        case "en_cours":
          return "en_cours";
        case "realisee":
          return colonneRealisee(
            dossier.factureImpayee || dossier.financementNonSolde,
            dossier.updatedAt,
            maintenant,
          );
        case "annulee":
        case "reportee":
          return null;
      }
      // Exhaustivité garantie par le switch — jamais atteint.
      return null;

    case "coaching":
      switch (dossier.statut) {
        case "planifiee":
          return "a_preparer";
        case "realisee":
          return colonneRealisee(dossier.factureImpayee, dossier.updatedAt, maintenant);
        case "annulee":
        case "reportee":
          return null;
      }
      return null;

    case "audit":
      switch (dossier.statut) {
        case "planifiee":
          return "a_preparer";
        case "en_cours":
          return "en_cours";
        case "realisee":
          return colonneRealisee(dossier.factureImpayee, dossier.updatedAt, maintenant);
        case "annulee":
        case "reportee":
          return null;
      }
      return null;
  }
}

/**
 * Prochaine action HUMAINE d'une ligne, selon sa colonne. C'est ce qui
 * distingue un pipeline d'une liste : chaque ligne dit quoi faire ensuite.
 */
export function libellerProchaineAction(
  colonne: ColonnePipeline,
  activite: ActiviteDossier,
): string {
  switch (colonne) {
    case "devis_attente":
      return "Relancer le client, ou marquer la réponse (accepté / refusé)";
    case "signature_attente":
      return "Faire signer la pièce en attente (ou poser le contreseing)";
    case "a_preparer":
      return activite === "formation"
        ? "Préparer la session : convocations, émargement, formateur"
        : activite === "coaching"
          ? "Préparer la séance : protocole, convocation"
          : "Préparer la mission : cadrage, lettre de mission";
    case "en_cours":
      return "Suivre la réalisation (émargements, incidents)";
    case "a_solder":
      return "Encaisser : vérifier la facture et le dossier de financement";
    case "soldes":
      return "Rien à faire — dossier soldé";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture + groupage
// ─────────────────────────────────────────────────────────────────────────────

/** Une ligne affichable de la vue Dossiers. */
export interface LigneDossier {
  /** Clé React stable, préfixée par la source (`devis:…`, `session:…`). */
  cle: string;
  colonne: ColonnePipeline;
  activite: ActiviteDossier;
  /** Raison sociale du client, ou « — » si l'affaire n'est pas rattachée. */
  client: string;
  intitule: string;
  /** Numéro métier (AXI-DEV-…, AXI-SESS-…) — null pour un coaching (pas de numéro). */
  reference: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  prochaineAction: string;
  /**
   * Chemin de la fiche pertinente, RELATIF à la base admin (`/${locale}/${adminPrefix}`)
   * — le module ignore volontairement locale et adminPrefix (résolus par la page).
   */
  cheminFiche: string;
}

/** Les lignes groupées par colonne — toujours les 6 clés, listes vides incluses. */
export type DossiersPipeline = Record<ColonnePipeline, LigneDossier[]>;

/** Statuts de facture qui signifient « de l'argent est attendu ». `brouillon`
 *  n'est pas encore une créance ; `annulee` n'en sera jamais une. */
const STATUTS_FACTURE_IMPAYEE = ["emise", "partiellement_payee", "en_retard"] as const;

/** Statuts de dossier de financement considérés SOLDÉS. Tout le reste (y
 *  compris `refuse` : un refus se solde en clôturant le dossier) retient
 *  l'affaire en « À solder » — c'est voulu, un dossier refusé non clos est un
 *  reste à charge à refacturer, pas un dossier terminé. */
const STATUTS_FINANCEMENT_SOLDE = ["paiement_recu", "clos"] as const;

/**
 * Badge d'activité d'un devis, déduit de son activité de facturation.
 * `implementation`/`site_web`/null retombent sur « Formation » : la vue n'a
 * que trois badges (décision de la phase 2) et un mauvais badge vaut mieux
 * qu'une affaire invisible.
 */
function activiteDevis(activite: string | null): ActiviteDossier {
  if (activite === "un_a_un") return "coaching";
  if (activite === "audit") return "audit";
  return "formation";
}

/** Devis envoyés (colonne « Devis en attente »). Stub-safe → []. */
async function lireDevisEnvoyes() {
  try {
    return await prisma.devis.findMany({
      where: { statut: "envoye" },
      // Les plus anciens d'abord : ce sont eux qu'on relance en premier.
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: TAKE_MAX,
      select: {
        id: true,
        numero: true,
        activite: true,
        statut: true,
        sentAt: true,
        dateValidite: true,
        client: { select: { raisonSociale: true } },
      },
    });
  } catch {
    return [];
  }
}

/**
 * Sessions vivantes (planifiée / en cours / réalisée) avec, pour chacune, les
 * TROIS faits dont la dérivation a besoin — chaque sous-liste est bornée à
 * `take: 1` : on ne veut pas les pièces, seulement savoir s'il en EXISTE une.
 * Stub-safe → [].
 */
async function lireSessionsVivantes() {
  try {
    return await prisma.trainingSession.findMany({
      where: { statut: { in: ["planifiee", "en_cours", "realisee"] } },
      // Activité récente d'abord : sous plafond, on sacrifie les dossiers
      // dormants, jamais ceux qui bougent.
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: TAKE_MAX,
      select: {
        id: true,
        numero: true,
        titreSession: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        updatedAt: true,
        client: { select: { raisonSociale: true } },
        documents: {
          where: { statutSignature: { in: ["en_attente", "partielle"] } },
          select: { id: true },
          take: 1,
        },
        facturesFormation: {
          where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
          select: { id: true },
          take: 1,
        },
        dossiersFinancement: {
          where: { statut: { notIn: [...STATUTS_FINANCEMENT_SOLDE] } },
          select: { id: true },
          take: 1,
        },
      },
    });
  } catch {
    return [];
  }
}

/**
 * Parcours de coaching vivants. Les factures d'un coaching vivent au niveau du
 * CONTRAT (`CoachingContract.factures`), pas de la séance — c'est là qu'on
 * regarde. Stub-safe → [].
 */
async function lireCoachingsVivants() {
  try {
    return await prisma.coachingSession.findMany({
      where: { statut: { in: ["planifiee", "realisee"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: TAKE_MAX,
      select: {
        id: true,
        interventionSlug: true,
        statut: true,
        dateSeance: true,
        dateSeanceFin: true,
        updatedAt: true,
        beneficiaireNom: true,
        beneficiaireEntreprise: true,
        coachingContract: {
          select: {
            client: { select: { raisonSociale: true } },
            factures: {
              where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
  } catch {
    return [];
  }
}

/** Missions d'audit vivantes. Stub-safe → []. */
async function lireAuditsVivants() {
  try {
    return await prisma.auditMission.findMany({
      where: { statut: { in: ["planifiee", "en_cours", "realisee"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: TAKE_MAX,
      select: {
        id: true,
        numero: true,
        titre: true,
        statut: true,
        dateDebut: true,
        dateFin: true,
        updatedAt: true,
        client: { select: { raisonSociale: true } },
        facturesFormation: {
          where: { statut: { in: [...STATUTS_FACTURE_IMPAYEE] } },
          select: { id: true },
          take: 1,
        },
      },
    });
  } catch {
    return [];
  }
}

/** Pipeline vide — les 6 colonnes présentes, aucune ligne. */
function pipelineVide(): DossiersPipeline {
  return {
    devis_attente: [],
    signature_attente: [],
    a_preparer: [],
    en_cours: [],
    a_solder: [],
    soldes: [],
  };
}

/**
 * Lit les quatre sources en parallèle, dérive la colonne de chaque affaire et
 * groupe. `maintenant` est injectable pour les tests ; en production, l'appel
 * sans argument prend l'instant courant (UTC — la fenêtre des 30 jours se
 * moque du fuseau à ±2 h près).
 */
export async function lireDossiersPipeline(
  maintenant: Date = new Date(),
): Promise<DossiersPipeline> {
  const [devis, sessions, coachings, audits] = await Promise.all([
    lireDevisEnvoyes(),
    lireSessionsVivantes(),
    lireCoachingsVivants(),
    lireAuditsVivants(),
  ]);

  const pipeline = pipelineVide();
  const ajouter = (ligne: LigneDossier) => pipeline[ligne.colonne].push(ligne);

  for (const d of devis) {
    const colonne = deriverStatutDossier({ source: "devis", statut: d.statut }, maintenant);
    if (!colonne) continue;
    const activite = activiteDevis(d.activite);
    ajouter({
      cle: `devis:${d.id}`,
      colonne,
      activite,
      client: d.client.raisonSociale,
      intitule: `Devis ${d.numero}`,
      reference: d.numero,
      dateDebut: d.sentAt,
      // La « fin » d'un devis envoyé, c'est sa date de validité : après elle,
      // il expire — l'afficher rend la relance urgente visible d'un coup d'œil.
      dateFin: d.dateValidite,
      prochaineAction: libellerProchaineAction(colonne, activite),
      cheminFiche: `/qualiopi/devis/${d.id}`,
    });
  }

  for (const s of sessions) {
    const colonne = deriverStatutDossier(
      {
        source: "session",
        statut: s.statut,
        signatureEnAttente: s.documents.length > 0,
        factureImpayee: s.facturesFormation.length > 0,
        financementNonSolde: s.dossiersFinancement.length > 0,
        updatedAt: s.updatedAt,
      },
      maintenant,
    );
    if (!colonne) continue;
    ajouter({
      cle: `session:${s.id}`,
      colonne,
      activite: "formation",
      client: s.client?.raisonSociale ?? "—",
      intitule: s.titreSession,
      reference: s.numero,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      prochaineAction: libellerProchaineAction(colonne, "formation"),
      cheminFiche: `/qualiopi/sessions/${s.id}`,
    });
  }

  for (const c of coachings) {
    const colonne = deriverStatutDossier(
      {
        source: "coaching",
        statut: c.statut,
        factureImpayee: (c.coachingContract?.factures.length ?? 0) > 0,
        updatedAt: c.updatedAt,
      },
      maintenant,
    );
    if (!colonne) continue;
    ajouter({
      cle: `coaching:${c.id}`,
      colonne,
      activite: "coaching",
      // Le « client » d'un coaching : le client du contrat s'il existe, sinon
      // l'entreprise du bénéficiaire, sinon le bénéficiaire lui-même (ad hoc).
      client:
        c.coachingContract?.client?.raisonSociale ??
        c.beneficiaireEntreprise ??
        c.beneficiaireNom ??
        "—",
      // Le slug d'intervention est la seule désignation portée par la séance ;
      // dé-slugifié pour rester lisible sans jointure sur le catalogue.
      intitule: c.interventionSlug.replace(/-/g, " "),
      reference: null,
      dateDebut: c.dateSeance,
      dateFin: c.dateSeanceFin,
      prochaineAction: libellerProchaineAction(colonne, "coaching"),
      cheminFiche: `/coaching/seances/${c.id}`,
    });
  }

  for (const a of audits) {
    const colonne = deriverStatutDossier(
      {
        source: "audit",
        statut: a.statut,
        factureImpayee: a.facturesFormation.length > 0,
        updatedAt: a.updatedAt,
      },
      maintenant,
    );
    if (!colonne) continue;
    ajouter({
      cle: `audit:${a.id}`,
      colonne,
      activite: "audit",
      client: a.client?.raisonSociale ?? "—",
      intitule: a.titre,
      reference: a.numero,
      dateDebut: a.dateDebut,
      dateFin: a.dateFin,
      prochaineAction: libellerProchaineAction(colonne, "audit"),
      cheminFiche: `/qualiopi/audits/${a.id}`,
    });
  }

  return pipeline;
}
