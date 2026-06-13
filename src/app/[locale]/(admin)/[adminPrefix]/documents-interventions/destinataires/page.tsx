// Listes de destinataires (notifications e-mail). À chaque publication d'une
// nouvelle version de document, les destinataires concernés (par rôle + scope)
// reçoivent un e-mail. Aucun compte requis.

import { getRecipients } from "@/server/intervention-documents/queries";
import { RecipientManager } from "@/components/admin/documents-interventions/RecipientManager";

export default async function DestinatairesPage(): Promise<React.ReactElement> {
  const recipients = await getRecipients();
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-[#2a2520]">Listes de destinataires</h1>
      <p className="mb-6 text-sm text-[#6b635b]">
        E-mails notifiés à chaque nouvelle version publiée. Le <strong>périmètre</strong> limite les
        notifications à une famille et/ou une prestation (vide = tout). Les commerciaux ne reçoivent
        que les documents à visibilité « commercial » (ex. programme).
      </p>
      <RecipientManager recipients={recipients} />
    </div>
  );
}
