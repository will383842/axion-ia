/**
 * Détails d'un devis pour la corbeille « E-mails à valider » — lecture seule.
 *
 * Une seule requête groupée pour tous les e-mails d'envoi de devis en attente
 * (jamais une requête par e-mail). Le montant TTC est celui de la PHOTO de la pièce
 * envoyée (même chemin que la page de signature) ; sans photo lisible, aucun montant
 * n'est annoncé plutôt qu'un montant faux.
 */
import { formatEurosFromCents } from "@/server/qualiopi/documents/base-layout";
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
      documentGenere: { select: { metadata: true } },
    },
  });
  for (const l of lignes) {
    let ttc: number | null = null;
    try {
      const photo = l.documentGenere ? lirePhotoDevis(l.documentGenere.metadata) : null;
      ttc = photo ? totauxDepuisPhoto(photo).totalTtcCents : null;
    } catch {
      ttc = null;
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
