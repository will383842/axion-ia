/**
 * Espace ressources — page principale (2026-06-13).
 * Documents accessibles à la personne connectée (commercial ou formateur),
 * filtrés par son périmètre, avec téléchargement à la demande.
 */

import { requireRecipient } from "@/server/ressources/guard";
import { listDocumentsForRecipientEmail } from "@/server/ressources/queries";
import { DocumentDownloadList } from "@/components/espace-ressources/DocumentDownloadList";

export default async function RessourcesPage(): Promise<React.ReactElement> {
  const session = await requireRecipient();
  const documents = await listDocumentsForRecipientEmail(session.email);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-mocha font-serif text-2xl font-semibold">Mes documents</h1>
        <p className="text-fg-muted text-sm">
          Supports, programmes et livrables des prestations de votre périmètre. Cliquez pour
          télécharger la dernière version.
        </p>
      </div>
      <DocumentDownloadList documents={documents} />
    </div>
  );
}
