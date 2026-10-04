/**
 * Qualiopi — Dossier prêt à déposer chez l'OPCO (chantier OPCO A6), module PUR.
 *
 * C'est l'ENTREPRISE qui dépose sa demande de prise en charge sur son espace
 * OPCO (Atlas : « obligatoirement par l'entreprise depuis son compte
 * myAtlas »). L'organisme lui remet donc un dossier COMPLET, et le kit dit
 * ce qui y est vraiment : une pièce n'est cochée que si elle existe au
 * registre des documents, en vigueur (non annulée) — et, pour la convention,
 * signée AVEC son exemplaire signé archivé (`exemplaireSigneKey`) : c'est cet
 * exemplaire, jamais le PDF vierge, que le dossier remet. Les pièces absentes sont NOMMÉES : un kit qui coche tout ce qu'il
 * liste se lit comme complet alors qu'il ne l'est pas.
 *
 * Aucun import Prisma : la lecture vit dans `dossier-pret-a-deposer-lecture.ts`.
 */

import type { DocumentType } from "../../../../prisma/generated/client";
import { OPCO_FICHES, dateLimiteDepotPourSession, isOpcoId, opcoLabel } from "./opco-referentiel";
import type { RegimePaiement } from "./regime-paiement-opco";

/** Une pièce du registre, telle que lue pour la session. */
export interface DocumentLu {
  id: string;
  type: DocumentType;
  numero: string;
  createdAt: Date;
  annuleeAt: Date | null;
  statutSignature: string;
  /** Clé de stockage de l'exemplaire SIGNÉ (`…-signe.pdf`), null s'il n'a pas été archivé. */
  exemplaireSigneKey: string | null;
}

export type ClePiece = "convention" | "programme" | "devis" | "calendrier";

interface DefinitionPiece {
  cle: ClePiece;
  libelle: string;
  /** Types acceptés, par ordre de préférence. */
  types: readonly DocumentType[];
  /** La pièce ne vaut que signée (convention). */
  exigeSignature: boolean;
}

/** Les pièces que l'entreprise joint à sa demande. Ordre d'impression. */
export const PIECES_DEMANDE_OPCO: readonly DefinitionPiece[] = [
  {
    cle: "convention",
    libelle: "Convention de formation signée",
    types: ["convention_tripartite", "convention"],
    exigeSignature: true,
  },
  {
    cle: "programme",
    libelle: "Programme de la formation",
    types: ["programme"],
    exigeSignature: false,
  },
  { cle: "devis", libelle: "Devis", types: ["devis"], exigeSignature: false },
  {
    cle: "calendrier",
    libelle: "Calendrier et organisation de l'action",
    types: ["organisation_action"],
    exigeSignature: false,
  },
];

export interface EtatPiece {
  cle: ClePiece;
  libelle: string;
  presente: boolean;
  /** Précision lisible : numéro de la pièce, ou pourquoi elle manque. */
  detail: string;
  /**
   * La pièce ne vaut que signée : le dossier joint alors l'exemplaire SIGNÉ
   * (`document.exemplaireSigneKey`), jamais le PDF vierge.
   */
  exigeSignature: boolean;
  /** La pièce à joindre au dossier, si présente. */
  document: Pick<DocumentLu, "id" | "type" | "numero" | "createdAt" | "exemplaireSigneKey"> | null;
}

export const EXEMPLAIRE_SIGNE_INTROUVABLE = "exemplaire signé introuvable";

/**
 * Pièces EN VIGUEUR des types admis, de la plus récente à la plus ancienne ;
 * à date égale, l'ordre de préférence des types départage (tripartite d'abord).
 * Tous types confondus : une tripartite non signée ne doit pas masquer une
 * bipartite signée.
 */
function vivantes(docs: readonly DocumentLu[], types: readonly DocumentType[]): DocumentLu[] {
  const rang = (t: DocumentType) => types.indexOf(t);
  return docs
    .filter((d) => types.includes(d.type) && d.annuleeAt === null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || rang(a.type) - rang(b.type));
}

function manquante(def: DefinitionPiece, detail: string): EtatPiece {
  return {
    cle: def.cle,
    libelle: def.libelle,
    presente: false,
    exigeSignature: def.exigeSignature,
    detail,
    document: null,
  };
}

/**
 * État réel des pièces de la demande. `documents` : pièces de la session ET le
 * devis rattaché (un devis est émis au client, pas à la session).
 */
export function etatPiecesDemande(documents: readonly DocumentLu[]): EtatPiece[] {
  return PIECES_DEMANDE_OPCO.map((def) => {
    const candidats = vivantes(documents, def.types);
    const retenu = def.exigeSignature
      ? (candidats.find((d) => d.statutSignature === "signee") ?? null)
      : (candidats[0] ?? null);
    if (!retenu) {
      return manquante(
        def,
        def.exigeSignature && candidats.length > 0
          ? `émise (${candidats[0]?.numero ?? ""}), signature non recueillie`
          : "non émise",
      );
    }
    // Signée au registre mais exemplaire jamais archivé : joindre la vierge en
    // l'annonçant signée serait faux. Manquante, et le motif le dit.
    if (def.exigeSignature && retenu.exemplaireSigneKey === null) {
      return manquante(def, `signée (${retenu.numero}), ${EXEMPLAIRE_SIGNE_INTROUVABLE}`);
    }
    return {
      cle: def.cle,
      libelle: def.libelle,
      presente: true,
      exigeSignature: def.exigeSignature,
      detail: retenu.numero,
      document: {
        id: retenu.id,
        type: retenu.type,
        numero: retenu.numero,
        createdAt: retenu.createdAt,
        exemplaireSigneKey: retenu.exemplaireSigneKey,
      },
    };
  });
}

/**
 * Confirme au STOCKAGE l'exemplaire signé de chaque pièce qui l'exige. Une clé
 * en base ne prouve pas l'objet : absent, ou vérification impossible → la pièce
 * passe manquante. Le kit et le ZIP disent ainsi la même chose. Les pièces sans
 * signature ne sont pas sondées.
 */
export async function confirmerExemplairesSignes(
  pieces: readonly EtatPiece[],
  existe: (cle: string) => Promise<boolean>,
): Promise<EtatPiece[]> {
  return Promise.all(
    pieces.map(async (p) => {
      const cle = p.exigeSignature && p.presente ? p.document?.exemplaireSigneKey : null;
      if (!cle) return p;
      const ok = await existe(cle).catch(() => false);
      if (ok) return p;
      return {
        ...p,
        presente: false,
        detail: `signée (${p.document?.numero ?? ""}), ${EXEMPLAIRE_SIGNE_INTROUVABLE}`,
        document: null,
      };
    }),
  );
}

// ── Encart « Comment déposer chez <OPCO> » ──────────────────────────────────

export const NON_RENSEIGNE = "non renseigné";

/** Libellés SOBRES : l'accord du financeur décide, jamais l'organisme. */
export const LIBELLES_REGIME: Record<RegimePaiement, string> = {
  subrogation_possible: "paiement direct possible selon l'accord",
  remboursement_entreprise: "l'entreprise règle puis se fait rembourser",
  inconnu: "à confirmer sur l'accord",
};

export interface EncartDepot {
  titre: string;
  qui: string;
  portail: string;
  delai: string;
  dateLimite: string;
  regime: string;
  /** Texte du bandeau d'état des fonds, s'il y en a un. */
  etatFonds: string | null;
}

function jourFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/** Encart de dépôt, lu UNIQUEMENT dans `OPCO_FICHES` : rien d'inventé. */
export function encartDepot(input: {
  opco: string | null;
  dateDebut: Date;
  regime: RegimePaiement;
  etatFonds: string | null;
}): EncartDepot {
  const regime = LIBELLES_REGIME[input.regime];
  if (!isOpcoId(input.opco)) {
    return {
      titre: "Comment déposer la demande de prise en charge",
      qui: "Dépôt par l'entreprise, auprès de son OPCO (OPCO non renseigné)",
      portail: NON_RENSEIGNE,
      delai: NON_RENSEIGNE,
      dateLimite: NON_RENSEIGNE,
      regime,
      etatFonds: input.etatFonds,
    };
  }
  const fiche = OPCO_FICHES[input.opco];
  const delai = fiche.delaiDepotJours.valeur;
  const limite = dateLimiteDepotPourSession(input.opco, input.dateDebut);
  const limiteAnnuelle = fiche.dateLimiteDepot2026.valeur;
  return {
    titre: `Comment déposer chez ${opcoLabel(input.opco)}`,
    qui:
      fiche.modeDeDepotConstate.valeur === "compte_adherent"
        ? "Dépôt par l'entreprise, depuis son espace sur le portail de l'OPCO"
        : "Dépôt par l'entreprise, auprès de son OPCO",
    portail: fiche.portailEntrepriseUrl.valeur ?? NON_RENSEIGNE,
    delai:
      delai === null
        ? NON_RENSEIGNE
        : delai === 0
          ? "au plus tard le premier jour de la formation"
          : `au moins ${delai} jour${delai > 1 ? "s" : ""} avant le début de la formation`,
    dateLimite: [
      limite === null ? NON_RENSEIGNE : jourFr(limite),
      limiteAnnuelle === null
        ? null
        : `au plus tard le ${limiteAnnuelle.split("-").reverse().join("/")} pour l'exercice 2026`,
    ]
      .filter((p): p is string => p !== null)
      .join(" ; "),
    regime,
    etatFonds: input.etatFonds,
  };
}
