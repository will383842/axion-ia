// Cockpit — PIPELINE COMMERCIAL : logique PURE (aucune I/O, aucun Prisma).
//
// Le calendrier dit QUAND. Le prévisionnel dit COMBIEN j'encaisse. Le pipeline
// dit **où sont mes affaires, et où est-ce que je perds**.
//
// ── Ce que le chaînage permet réellement ─────────────────────────────────────
// La base relie `Devis → TrainingSession → FactureFormation` par de vraies clés
// étrangères (`devis_id`, `session_id`). On peut donc suivre une affaire de son
// devis à son encaissement.
//
// En revanche `Submission` (la demande entrante) ne pointe VERS RIEN d'aval :
// sa seule relation est `Booking`, vestige du module de réservation retiré. Le
// premier étage est donc un COMPTEUR, pas un maillon : on sait combien de
// demandes sont en cours, on ne sait pas lesquelles sont devenues des devis.
// `chaine: false` le porte dans le type, et l'UI l'affiche. Tracer une flèche
// qu'aucune donnée ne soutient serait un mensonge de plus.
//
// ── Pourquoi l'âge est le chiffre le plus utile ──────────────────────────────
// Un devis envoyé il y a 40 jours est un devis mort qui s'ignore. Un compte et
// un montant ne le disent pas ; `ageMaxJours` le crie. Idem pour une session
// réalisée que personne n'a facturée, ou une facture émise que personne ne paie.
//
// ── Les fuites sont comptées, jamais masquées ────────────────────────────────
// Une affaire qui disparaît de l'entonnoir sans qu'on sache pourquoi est un zéro
// silencieux de plus. `lost`, `refuse`, `expire`, `annulee` sont des sorties
// nommées : on les affiche.
//
// `maintenant` est un paramètre, jamais un `new Date()` caché — un pipeline dont
// les âges dépendent de l'heure du test ne se teste pas.

// `statuts-facture.ts` est lui-même un module PUR (un `import type` de l'enum,
// effacé à la compilation) : l'importer ne coûte pas la pureté de celui-ci, et
// évite de redéclarer une quatrième fois la liste des factures ouvertes — ce
// qui est précisément la faute que ce fichier avait commise.
import { estFactureOuverte } from "@/server/qualiopi/financements/statuts-facture";

/** Miroir des enums Prisma consommés. Types locaux : ce module reste pur. */
export type SubmissionStatusValue =
  | "new"
  | "in_progress"
  | "processed"
  | "archived"
  | "qualifying"
  | "negotiating"
  | "converted"
  | "lost";

export type DevisStatutValue =
  "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";

export type SessionStatutValue = "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";

export type FactureStatutValue =
  "brouillon" | "emise" | "partiellement_payee" | "en_retard" | "payee" | "annulee";

export type CodeEtage =
  "demande" | "devis_envoye" | "devis_accepte" | "a_facturer" | "facture_emise" | "facture_payee";

export interface Etage {
  code: CodeEtage;
  libelle: string;
  nb: number;
  /**
   * Montant HT cumulé. `null` quand l'étape ne porte PAS de montant : une
   * `Submission` n'a pas de prix. Un `0` laisserait croire à des affaires à 0 €.
   */
  montantHtCents: number | null;
  /** Âge, en jours, de la plus ancienne affaire bloquée à cet étage. */
  ageMaxJours: number | null;
  /** `false` = étage compté mais NON relié à l'aval par une clé étrangère. */
  chaine: boolean;
  /** Ce que l'étage veut dire, et ce qu'il faut en faire. */
  explication: string;
}

export type CodeFuite =
  "demande_perdue" | "devis_refuse" | "devis_expire" | "session_annulee" | "facture_annulee";

export interface Fuite {
  code: CodeFuite;
  libelle: string;
  nb: number;
  montantHtCents: number | null;
}

/* ── Entrées : formes minimales, lues par `pipeline-queries.ts` ─────────────── */

export interface DemandeRow {
  status: SubmissionStatusValue;
  createdAt: Date;
}

export interface DevisRow {
  statut: DevisStatutValue;
  montantTotalHtCents: number;
  /** Date d'envoi. `null` pour un brouillon jamais envoyé. */
  sentAt: Date | null;
  createdAt: Date;
}

export interface SessionRow {
  id: string;
  statut: SessionStatutValue;
  montantHtCents: number;
  dateFin: Date;
}

export interface FactureRow {
  /** `null` si la facture n'est rattachée à aucune session. */
  sessionId: string | null;
  statut: FactureStatutValue;
  montantHtCents: number;
  emiseAt: Date | null;
}

export interface PipelineEntrees {
  demandes: readonly DemandeRow[];
  devis: readonly DevisRow[];
  sessions: readonly SessionRow[];
  factures: readonly FactureRow[];
}

export interface Pipeline {
  etages: Etage[];
  fuites: Fuite[];
  /**
   * Devis acceptés / devis ayant reçu une réponse (acceptés + refusés + expirés).
   * `null` si aucun devis n'a été tranché — un taux sur zéro n'a pas de sens, et
   * afficher « 0 % » ferait croire à un échec plutôt qu'à une absence de donnée.
   */
  tauxAcceptationDevisPct: number | null;
}

/* ────────────────────────────────────────────────────────────────────────────── */

const JOUR_MS = 86_400_000;

/** Ancienneté en jours PLEINS. Une date future donne 0, jamais un négatif. */
export function ageEnJours(depuis: Date, maintenant: Date): number {
  const ms = maintenant.getTime() - depuis.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / JOUR_MS);
}

/** Âge de la plus ancienne date de la liste. `null` si la liste est vide. */
function ageMax(dates: readonly Date[], maintenant: Date): number | null {
  if (dates.length === 0) return null;
  return Math.max(...dates.map((d) => ageEnJours(d, maintenant)));
}

/** Statuts d'une demande encore « en jeu » (ni gagnée, ni perdue, ni classée). */
const DEMANDES_EN_COURS: readonly SubmissionStatusValue[] = [
  "new",
  "in_progress",
  "qualifying",
  "negotiating",
];

/** Un devis accepté, qu'il ait déjà été transformé en convention ou non. */
const DEVIS_ACCEPTES: readonly DevisStatutValue[] = ["accepte", "transforme_convention"];

/** Une facture qui prouve que la session est facturée (émise ou déjà payée,
 * y compris partiellement payée ou en retard — elle existe et court). */
const FACTURES_EMISES: readonly FactureStatutValue[] = [
  "emise",
  "partiellement_payee",
  "en_retard",
  "payee",
];

/**
 * Construit l'entonnoir.
 *
 * L'étage `a_facturer` est DÉRIVÉ : les sessions réalisées dont aucun `sessionId`
 * de facture (émise ou payée) ne porte la trace. C'est le trou le plus coûteux
 * du cycle — du travail livré que personne n'a facturé — et il n'apparaît sur
 * aucun autre écran.
 */
export function construirePipeline(entrees: PipelineEntrees, maintenant: Date): Pipeline {
  const demandesEnCours = entrees.demandes.filter((d) => DEMANDES_EN_COURS.includes(d.status));

  const devisEnvoyes = entrees.devis.filter((d) => d.statut === "envoye");
  const devisAcceptes = entrees.devis.filter((d) => DEVIS_ACCEPTES.includes(d.statut));

  const sessionsRealisees = entrees.sessions.filter((s) => s.statut === "realisee");
  const sessionsFacturees = new Set(
    entrees.factures
      .filter((f) => f.sessionId !== null && FACTURES_EMISES.includes(f.statut))
      .map((f) => f.sessionId as string),
  );
  const aFacturer = sessionsRealisees.filter((s) => !sessionsFacturees.has(s.id));

  // 🔴 QUATRIÈME OCCURRENCE DU MÊME BUG, et la note de `statuts-facture.ts` en
  // décrivait déjà trois. Cet étage ne retenait que `emise` : au lendemain de
  // chaque échéance, le cron de 06:30 UTC bascule la facture en `en_retard` et
  // elle DISPARAISSAIT de l'entonnoir. Elle n'était pourtant nulle part
  // ailleurs : ni dans « Encaissé » (elle n'est pas payée), ni en amont (elle
  // compte comme facturée). De l'argent en retard devenu invisible — sur la
  // page qui existe précisément pour montrer les fuites, et d'autant plus
  // invisible qu'il était en retard depuis plus longtemps.
  const facturesEmises = entrees.factures.filter((f) => estFactureOuverte(f.statut));
  const facturesPayees = entrees.factures.filter((f) => f.statut === "payee");

  // Deux formes de montant coexistent : `Devis.montantTotalHtCents` et
  // `montantHtCents` ailleurs. Un accès par nom de champ deviné produirait des
  // `NaN` silencieux — on somme donc par SÉLECTEUR explicite.
  const somme = <T>(xs: readonly T[], montant: (x: T) => number): number =>
    xs.reduce((t, x) => t + montant(x), 0);
  const htDevis = (d: DevisRow): number => d.montantTotalHtCents;
  const ht = (x: { montantHtCents: number }): number => x.montantHtCents;

  const etages: Etage[] = [
    {
      code: "demande",
      libelle: "Demandes en cours",
      nb: demandesEnCours.length,
      // Une `Submission` ne porte aucun prix. `0` laisserait croire à des
      // affaires à 0 € ; `null` dit qu'on ne sait pas, ce qui est la vérité.
      montantHtCents: null,
      ageMaxJours: ageMax(
        demandesEnCours.map((d) => d.createdAt),
        maintenant,
      ),
      // `Submission` ne pointe vers aucun devis : on compte, on ne suit pas.
      chaine: false,
      explication:
        "Comptées, mais non reliées aux devis : aucune clé étrangère ne relie une demande à ce qu'elle devient.",
    },
    {
      code: "devis_envoye",
      libelle: "Devis en attente de réponse",
      nb: devisEnvoyes.length,
      montantHtCents: somme(devisEnvoyes, htDevis),
      // `sentAt` est la vraie date d'envoi ; `createdAt` sert de repli pour un
      // devis passé en `envoye` sans que l'horodatage ait été posé.
      ageMaxJours: ageMax(
        devisEnvoyes.map((d) => d.sentAt ?? d.createdAt),
        maintenant,
      ),
      chaine: true,
      explication: "Un devis qui dort depuis des semaines est un devis mort qui s'ignore.",
    },
    {
      code: "devis_accepte",
      libelle: "Devis acceptés",
      nb: devisAcceptes.length,
      montantHtCents: somme(devisAcceptes, htDevis),
      ageMaxJours: ageMax(
        devisAcceptes.map((d) => d.sentAt ?? d.createdAt),
        maintenant,
      ),
      chaine: true,
      explication: "Signés, en attente de planification ou déjà transformés en convention.",
    },
    {
      code: "a_facturer",
      libelle: "Réalisé, à facturer",
      nb: aFacturer.length,
      montantHtCents: somme(aFacturer, ht),
      ageMaxJours: ageMax(
        aFacturer.map((s) => s.dateFin),
        maintenant,
      ),
      chaine: true,
      explication:
        "Sessions terminées dont aucune facture n'a été émise. Le trou le plus coûteux du cycle.",
    },
    {
      code: "facture_emise",
      libelle: "Factures émises, impayées",
      nb: facturesEmises.length,
      montantHtCents: somme(facturesEmises, ht),
      ageMaxJours: ageMax(
        facturesEmises.flatMap((f) => (f.emiseAt !== null ? [f.emiseAt] : [])),
        maintenant,
      ),
      chaine: true,
      explication: "Argent facturé qui n'est pas rentré.",
    },
    {
      code: "facture_payee",
      libelle: "Encaissé",
      nb: facturesPayees.length,
      montantHtCents: somme(facturesPayees, ht),
      // Une facture payée n'est plus « bloquée » : son âge n'apprend rien.
      ageMaxJours: null,
      chaine: true,
      explication: "Fin du cycle.",
    },
  ];

  const fuitesToutes: Fuite[] = [
    {
      code: "demande_perdue",
      libelle: "Demandes perdues",
      nb: entrees.demandes.filter((d) => d.status === "lost").length,
      montantHtCents: null,
    },
    {
      code: "devis_refuse",
      libelle: "Devis refusés",
      nb: entrees.devis.filter((d) => d.statut === "refuse").length,
      montantHtCents: somme(
        entrees.devis.filter((d) => d.statut === "refuse"),
        htDevis,
      ),
    },
    {
      code: "devis_expire",
      libelle: "Devis expirés",
      nb: entrees.devis.filter((d) => d.statut === "expire").length,
      montantHtCents: somme(
        entrees.devis.filter((d) => d.statut === "expire"),
        htDevis,
      ),
    },
    {
      code: "session_annulee",
      libelle: "Sessions annulées",
      nb: entrees.sessions.filter((s) => s.statut === "annulee").length,
      montantHtCents: somme(
        entrees.sessions.filter((s) => s.statut === "annulee"),
        ht,
      ),
    },
    {
      code: "facture_annulee",
      libelle: "Factures annulées",
      nb: entrees.factures.filter((f) => f.statut === "annulee").length,
      montantHtCents: somme(
        entrees.factures.filter((f) => f.statut === "annulee"),
        ht,
      ),
    },
  ];
  const fuites = fuitesToutes.filter((f) => f.nb > 0);

  return { etages, fuites, tauxAcceptationDevisPct: tauxAcceptation(entrees.devis) };
}

/**
 * Taux d'acceptation des devis TRANCHÉS. Un devis encore en attente n'est ni un
 * succès ni un échec : l'inclure au dénominateur ferait baisser le taux à chaque
 * devis envoyé, ce qui punirait l'activité commerciale.
 */
export function tauxAcceptation(devis: readonly DevisRow[]): number | null {
  const acceptes = devis.filter((d) => DEVIS_ACCEPTES.includes(d.statut)).length;
  const tranches =
    acceptes + devis.filter((d) => d.statut === "refuse" || d.statut === "expire").length;
  if (tranches === 0) return null;
  return Math.round((acceptes / tranches) * 100);
}
