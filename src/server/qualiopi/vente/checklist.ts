/**
 * Qualiopi — Checklist du parcours « Nouvelle vente » (module PUR).
 *
 * Zéro Prisma, zéro I/O : ce module TRADUIT en items lisibles un état déjà
 * chargé par l'appelant (page RSC ou wizard client). Il ne recalcule AUCUN des
 * états d'alerte — le moteur de règles (`alertes/evaluateur.ts`) reste la seule
 * source : la checklist se contente de RENDRE les alertes ouvertes qu'on lui
 * passe, en regard de la pièce concernée.
 *
 * Ordre métier imposé : devis accepté → session → convention. Tant que le
 * maillon amont manque, les pièces aval sont `bloque` (pas `a_faire`) : il n'y
 * a rien à faire dessus, il y a autre chose à faire d'abord.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types d'entrée (sérialisables RSC → client : dates en ISO string)
// ─────────────────────────────────────────────────────────────────────────────

export type VenteFinancement = "direct" | "opco" | "cpf" | "france_travail";

export interface ChecklistDevisInput {
  statut: "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";
  fichierPdfUrl: string | null;
  docusealSubmissionId: string | null;
  /** Date d'envoi ISO — n'alimente que le détail affiché. */
  sentAt: string | null;
}

export interface ChecklistSessionInput {
  statut: "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";
  financementType: VenteFinancement | "mixte" | null;
  opcoSubrogation: boolean;
}

export interface ChecklistVenteInput {
  devis: ChecklistDevisInput | null;
  session: ChecklistSessionInput | null;
  /** Types des DocumentGenere déjà rattachés à la session. */
  documentsGeneres: ReadonlyArray<{ type: string }>;
  /** Inscriptions actives (statut planifiee/presente). */
  enrollmentsActifs: number;
  /** Alertes NON résolues ciblant la session (codes de l'évaluateur). */
  alertesOuvertes: ReadonlyArray<{ code: string }>;
}

export type ChecklistEtat = "a_faire" | "fait" | "bloque" | "sans_objet";

export interface ChecklistVenteItem {
  key: string;
  libelle: string;
  etat: ChecklistEtat;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table déclarative : financement → pièces attendues, dans l'ordre
// ─────────────────────────────────────────────────────────────────────────────

type PieceKey =
  | "devis"
  | "session"
  | "convention"
  | "convention_tripartite"
  | "convocation"
  | "emargement"
  | "certificat_realisation"
  | "facture"
  | "kit_opco"
  | "kit_cpf"
  | "kit_france_travail";

const PIECES_COMMUNES: ReadonlyArray<PieceKey> = [
  "convocation",
  "emargement",
  "certificat_realisation",
  "facture",
];

/**
 * Pièces attendues par financement. La convention est remplacée par la
 * convention TRIPARTITE quand la session est en subrogation OPCO (l'OPCO paie
 * directement l'organisme : il est partie à la convention).
 */
export const PIECES_PAR_FINANCEMENT: Record<VenteFinancement, ReadonlyArray<PieceKey>> = {
  direct: ["devis", "session", "convention", ...PIECES_COMMUNES],
  opco: ["devis", "session", "convention", ...PIECES_COMMUNES, "kit_opco"],
  cpf: ["devis", "session", "convention", ...PIECES_COMMUNES, "kit_cpf"],
  france_travail: ["devis", "session", "convention", ...PIECES_COMMUNES, "kit_france_travail"],
};

const LIBELLES: Record<PieceKey, string> = {
  devis: "Devis",
  session: "Session de formation",
  convention: "Convention de formation",
  convention_tripartite: "Convention tripartite (OPCO)",
  convocation: "Convocations",
  emargement: "Feuilles d'émargement",
  certificat_realisation: "Certificats de réalisation",
  facture: "Facture",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF",
  kit_france_travail: "Kit France Travail",
};

/**
 * Codes d'alerte de l'évaluateur affichés en regard d'une pièce. La checklist
 * ne juge pas — elle relaie ce que le moteur de règles a déjà levé.
 */
const ALERTES_PAR_PIECE: Partial<Record<PieceKey, ReadonlyArray<string>>> = {
  convention: ["convention_formation_manquante"],
  convention_tripartite: ["convention_formation_manquante", "convention_tripartite_manquante"],
  emargement: ["emargement_manquant"],
  kit_opco: ["opco_sans_accord", "opco_formation_demarree_sans_accord"],
};

const SESSION_STATUT_LABELS: Record<ChecklistSessionInput["statut"], string> = {
  planifiee: "planifiée",
  en_cours: "en cours",
  realisee: "réalisée",
  annulee: "annulée",
  reportee: "reportée",
};

// ─────────────────────────────────────────────────────────────────────────────
// Construction
// ─────────────────────────────────────────────────────────────────────────────

function dateFr(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR");
}

function itemDevis(devis: ChecklistDevisInput | null): ChecklistVenteItem {
  const libelle = LIBELLES.devis;
  if (devis === null) {
    return { key: "devis", libelle, etat: "a_faire", detail: "Créez le devis (étape 3 du parcours)." };
  }
  switch (devis.statut) {
    case "brouillon":
      return { key: "devis", libelle, etat: "a_faire", detail: "Devis en brouillon — envoyez-le au client." };
    case "envoye": {
      // Trois sous-états d'« envoyé » : la pièce lisible manque (bloquant), le
      // client ne peut pas signer en ligne, ou l'attente normale de signature.
      if (devis.fichierPdfUrl === null) {
        return {
          key: "devis",
          libelle,
          etat: "bloque",
          detail:
            "Devis marqué envoyé mais PDF non généré : le client n'a rien à lire ni à signer. Régénérez la pièce depuis la fiche devis.",
        };
      }
      const envoi = dateFr(devis.sentAt);
      const prefixe = envoi !== null ? `Envoyé le ${envoi}` : "Envoyé";
      if (devis.docusealSubmissionId === null) {
        return {
          key: "devis",
          libelle,
          etat: "a_faire",
          detail: `${prefixe} — le client ne peut pas signer en ligne (aucune soumission de signature). Réémettez un lien de signature ou recueillez un bon pour accord par retour d'e-mail.`,
        };
      }
      return { key: "devis", libelle, etat: "a_faire", detail: `${prefixe} — en attente de signature du client.` };
    }
    case "accepte":
      return { key: "devis", libelle, etat: "fait", detail: "Devis accepté — la session peut être créée." };
    case "transforme_convention":
      return { key: "devis", libelle, etat: "fait", detail: "Devis accepté et transformé en convention." };
    case "refuse":
      return { key: "devis", libelle, etat: "bloque", detail: "Devis refusé par le client — révisez l'offre ou clôturez l'affaire." };
    case "expire":
      return { key: "devis", libelle, etat: "bloque", detail: "Devis expiré — émettez une révision avant toute suite." };
  }
}

export function construireChecklistVente(input: ChecklistVenteInput): ChecklistVenteItem[] {
  const { devis, session } = input;
  const devisAccepte = devis?.statut === "accepte" || devis?.statut === "transforme_convention";
  const sessionInactive = session?.statut === "annulee" || session?.statut === "reportee";
  const typesPresents = new Set(input.documentsGeneres.map((d) => d.type));
  const codesOuverts = new Set(input.alertesOuvertes.map((a) => a.code));

  // Financement effectif : sans session on présume « direct » (liste minimale) ;
  // « mixte » est traité comme OPCO — c'est le financement qui exige le plus de
  // pièces, mieux vaut en afficher une de trop qu'en cacher une due.
  const financementBrut = session?.financementType ?? "direct";
  const financement: VenteFinancement = financementBrut === "mixte" ? "opco" : financementBrut;

  const pieces: PieceKey[] = PIECES_PAR_FINANCEMENT[financement].map((p) =>
    p === "convention" && session?.opcoSubrogation === true ? "convention_tripartite" : p,
  );

  const items: ChecklistVenteItem[] = [];

  for (const piece of pieces) {
    if (piece === "devis") {
      items.push(itemDevis(devis));
      continue;
    }

    if (piece === "session") {
      if (session !== null) {
        items.push({
          key: "session",
          libelle: LIBELLES.session,
          etat: "fait",
          detail: `Session ${SESSION_STATUT_LABELS[session.statut]}.`,
        });
      } else if (devisAccepte) {
        items.push({
          key: "session",
          libelle: LIBELLES.session,
          etat: "a_faire",
          detail: "Devis accepté : créez la session (dates, participants, financement).",
        });
      } else {
        items.push({
          key: "session",
          libelle: LIBELLES.session,
          etat: "bloque",
          detail: "La session se crée quand le devis est accepté.",
        });
      }
      continue;
    }

    // ── Pièces aval : exigent une session ────────────────────────────────────
    const libelle = LIBELLES[piece];

    if (typesPresents.has(piece)) {
      items.push({ key: piece, libelle, etat: "fait", detail: "Pièce générée." });
      continue;
    }

    if (session === null) {
      items.push({
        key: piece,
        libelle,
        etat: "bloque",
        detail: "Créez d'abord la session (ordre : devis accepté → session → convention).",
      });
      continue;
    }

    // Session annulée / reportée : ce qui sanctionne la RÉALISATION n'a plus
    // d'objet (certificat, facture). Le reste garde son état pour l'audit.
    if (sessionInactive && (piece === "certificat_realisation" || piece === "facture")) {
      items.push({
        key: piece,
        libelle,
        etat: "sans_objet",
        detail: `Session ${SESSION_STATUT_LABELS[session.statut]} : pièce sans objet.`,
      });
      continue;
    }

    let detail: string;
    switch (piece) {
      case "convention":
        detail = "À générer et faire signer avant le démarrage (L.6353-1).";
        break;
      case "convention_tripartite":
        detail = typesPresents.has("convention")
          ? "Une convention simple existe, mais la subrogation OPCO exige une convention TRIPARTITE (l'OPCO est partie)."
          : "Subrogation OPCO : générez la convention tripartite avant le démarrage.";
        break;
      case "convocation":
        detail =
          input.enrollmentsActifs === 0
            ? "Inscrivez d'abord les stagiaires : aucune inscription active."
            : `À envoyer aux ${input.enrollmentsActifs} inscrit(s) avant le démarrage.`;
        break;
      case "emargement":
        detail = "À générer avant le premier jour de la session.";
        break;
      case "certificat_realisation":
        detail =
          session.statut === "realisee"
            ? "Session réalisée : émettez les certificats de réalisation."
            : "S'émet à l'issue de la session.";
        break;
      case "facture":
        detail = "S'émet à l'issue de la session (ou selon l'échéancier convenu).";
        break;
      case "kit_opco":
        detail = "Dossier de prise en charge OPCO (demande, accord, justificatifs).";
        break;
      case "kit_cpf":
        detail = "Dossier CPF/EDOF (inscription, conditions, reste à charge).";
        break;
      case "kit_france_travail":
        detail = "Dossier France Travail (AIF/POEI : prescription, accord de financement).";
        break;
    }

    // Rendu des alertes DÉJÀ levées par l'évaluateur — aucune règle recalculée.
    const codesLies = ALERTES_PAR_PIECE[piece] ?? [];
    const alerteOuverte = codesLies.find((c) => codesOuverts.has(c));
    if (alerteOuverte !== undefined) {
      detail = `${detail} Alerte ouverte : ${alerteOuverte}.`;
    }

    items.push({ key: piece, libelle, etat: "a_faire", detail });
  }

  return items;
}
