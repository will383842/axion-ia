/**
 * Détails d'un devis pour la corbeille « E-mails à valider » — lecture seule.
 *
 * Une seule requête groupée pour tous les e-mails d'envoi de devis en attente
 * (jamais une requête par e-mail). Le montant TTC est celui de la PHOTO de la pièce
 * envoyée (même chemin que la page de signature) ; sans photo lisible, aucun montant
 * n'est annoncé plutôt qu'un montant faux. Un devis à formules n'annonce AUCUN montant
 * (son total vaut 0 ou n'est que partiel, comme dans l'e-mail client), et un total nul
 * ou négatif n'est jamais affiché.
 */
import { formatEurosFromCents } from "@/server/qualiopi/documents/base-layout";
import { formulesDepuisMetadata } from "@/server/qualiopi/devis/email-devis-envoi";
import {
  lirePhotoDevis,
  totauxDepuisPhoto,
} from "@/server/qualiopi/documents/signature/photo-devis";

export const GABARIT_DEVIS = "devis-envoi";

export interface DetailsDevis {
  numero: string;
  montantTtcCents: number | null;
  documentId: string | null;
}

interface LigneDevis {
  id: string;
  numero: string;
  documentGenereId: string | null;
  offre?: unknown;
  documentGenere: { metadata: unknown } | null;
}

export interface LecteurDevis {
  devis: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: {
        id: true;
        numero: true;
        documentGenereId: true;
        offre: true;
        documentGenere: { select: { metadata: true } };
      };
    }) => Promise<LigneDevis[]>;
  };
}

export function estEnvoiDevis(e: {
  template: string;
  entityType: string | null;
  entityId: string | null;
}): boolean {
  return e.template === GABARIT_DEVIS && e.entityType === "Devis" && e.entityId !== null;
}

export async function lireDetailsDevis(
  db: LecteurDevis,
  emails: ReadonlyArray<{ template: string; entityType: string | null; entityId: string | null }>,
): Promise<Map<string, DetailsDevis>> {
  const ids = [...new Set(emails.filter(estEnvoiDevis).map((e) => e.entityId as string))];
  const out = new Map<string, DetailsDevis>();
  if (ids.length === 0) return out;
  const lignes = await db.devis.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      numero: true,
      documentGenereId: true,
      offre: true,
      documentGenere: { select: { metadata: true } },
    },
  });
  for (const l of lignes) {
    let ttc: number | null = null;
    const aFormules =
      (l.offre !== null && l.offre !== undefined) ||
      (formulesDepuisMetadata(l.documentGenere?.metadata)?.formules.length ?? 0) > 0;
    if (!aFormules) {
      try {
        const photo = l.documentGenere ? lirePhotoDevis(l.documentGenere.metadata) : null;
        const total = photo ? totauxDepuisPhoto(photo).totalTtcCents : null;
        ttc = total !== null && total > 0 ? total : null;
      } catch {
        ttc = null;
      }
    }
    out.set(l.id, { numero: l.numero, montantTtcCents: ttc, documentId: l.documentGenereId });
  }
  return out;
}

/** Message personnalisé déjà saisi dans la charge de l'e-mail, ou chaîne vide. */
export function messageDejaSaisi(payload: unknown): string {
  if (payload === null || typeof payload !== "object") return "";
  const m = (payload as Record<string, unknown>)["messagePersonnalise"];
  return typeof m === "string" ? m : "";
}

/** Montant, liens console et PDF d'un devis, prêts à afficher. */
export function presenterDevis(
  d: DetailsDevis,
  devisId: string,
  adminPrefix: string,
): { montantTtc: string | null; lienDevis: string; lienPdf: string | null } {
  return {
    montantTtc: d.montantTtcCents !== null ? formatEurosFromCents(d.montantTtcCents) : null,
    lienDevis: `/fr/${adminPrefix}/qualiopi/devis/${devisId}`,
    lienPdf: d.documentId ? `/api/qualiopi/documents/${d.documentId}` : null,
  };
}

/**
 * Résumé lisible de la charge utile, pour que l'admin voie ce qui part sans
 * avoir à rendre le HTML complet.
 *
 * On liste des couples label/valeur plutôt que le JSON brut : un admin ne doit
 * pas avoir à décoder une structure technique pour décider d'un envoi.
 */
export function construireApercu(
  payload: unknown,
  template: string,
): Array<{ label: string; valeur: string }> {
  if (payload === null || typeof payload !== "object") return [];
  const LIBELLES: Record<string, string> = {
    destinataireNom: "Destinataire",
    numeroFacture: "Facture",
    montantDu: "Montant dû",
    dateEcheance: "Échéance",
    joursRetard: "Jours de retard",
    soldePartiel: "Solde après versement partiel",
    titreFormation: "Formation",
    numeroSession: "Session",
  };
  const libelleDuNumero = template === GABARIT_DEVIS ? "Devis n°" : null;
  if (libelleDuNumero !== null) LIBELLES["numero"] = libelleDuNumero;
  const out: Array<{ label: string; valeur: string }> = [];
  for (const [cle, libelle] of Object.entries(LIBELLES)) {
    const v = (payload as Record<string, unknown>)[cle];
    if (v === undefined || v === null || v === "") continue;
    out.push({ label: libelle, valeur: typeof v === "boolean" ? (v ? "oui" : "non") : String(v) });
  }
  return out;
}
