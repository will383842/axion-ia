/**
 * Entrée de l'écran « devis signé sur papier puis scanné » : décide si le bloc s'affiche et
 * lequel. Rendu pur, sans état : la partie interactive est `DevisVersementScanPapier`.
 */

import { peutSignerPourOrganisme } from "@/server/qualiopi/documents/signature/garde-engagement";
import type { ResultatVersementScan } from "@/server/actions/qualiopi/devis-scan-papier";
import { DevisVersementScanPapier } from "./DevisVersementScanPapier";

export interface EtatDevisPourScan {
  statut: string;
  offre: unknown;
  offreSha256: string | null;
  documentGenereId: string | null;
  /** Type de la pièce en vigueur (le serveur exige « devis »). */
  pieceType: string | null;
  pieceAnnulee: boolean;
  clientASigne: boolean;
}

/** Mêmes conditions que l'action serveur : devis envoyé, classique, pièce en vigueur, non signé. */
export function peutVerserScanPapier(e: EtatDevisPourScan, role: string | null): boolean {
  return (
    peutSignerPourOrganisme(role) &&
    e.statut === "envoye" &&
    e.offre === null &&
    e.offreSha256 === null &&
    e.documentGenereId !== null &&
    e.pieceType === "devis" &&
    !e.pieceAnnulee &&
    !e.clientASigne
  );
}

export function libelleSignaturePapier(signeAt: Date, organismeNom: string): string {
  return `Copie numérisée versée le ${signeAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} — signature manuscrite sur papier ; l'original est conservé par ${organismeNom}.`;
}

export function DevisScanPapierEntree(props: {
  etat: EtatDevisPourScan;
  role: string | null;
  devisId: string;
  signataireNom: string;
  organismeNom: string;
  validiteDepassee: string | null;
  verserAction: (formData: FormData) => Promise<ResultatVersementScan>;
}): React.ReactElement | null {
  if (!peutVerserScanPapier(props.etat, props.role)) return null;
  if (props.signataireNom.trim() === "") {
    return (
      <p
        data-testid="scan-papier-fiche-sans-nom"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
      >
        La fiche client ne porte pas de nom de signataire : renseignez-la d&apos;abord pour pouvoir
        verser un devis signé sur papier.
      </p>
    );
  }
  return (
    <DevisVersementScanPapier
      devisId={props.devisId}
      signataireNom={props.signataireNom}
      organismeNom={props.organismeNom}
      validiteDepassee={props.validiteDepassee}
      verserAction={props.verserAction}
    />
  );
}
