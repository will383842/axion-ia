// Annuaire équipe — qui reçoit les notifications de documents (formateurs +
// commerciaux). Les formateurs s'importent en un clic depuis les fiches
// Qualiopi (source riche) ; les commerciaux s'ajoutent à la main. Aucun compte.
// À chaque publication d'une nouvelle version, les personnes concernées (par
// rôle + périmètre) reçoivent un e-mail avec lien de téléchargement.

import { getRecipients } from "@/server/intervention-documents/queries";
import { RecipientManager } from "@/components/admin/documents-interventions/RecipientManager";
import { ImportTrainersButton } from "@/components/admin/documents-interventions/ImportTrainersButton";

export default async function AnnuaireEquipePage(): Promise<React.ReactElement> {
  const recipients = await getRecipients();
  return (
    <div>
      <h1 className="text-mocha mb-1 text-xl font-semibold">Annuaire équipe</h1>
      <p className="text-fg-muted mb-4 text-sm">
        Les personnes notifiées à chaque nouvelle version publiée. Importe tes{" "}
        <strong>formateurs</strong> depuis leurs fiches Qualiopi en un clic ; ajoute tes{" "}
        <strong>commerciaux</strong> à la main. Le <strong>périmètre</strong> limite les
        notifications à une famille / prestation (vide = tout). Aucun compte requis.
      </p>
      <div className="mb-6">
        <ImportTrainersButton />
      </div>
      <RecipientManager recipients={recipients} />
    </div>
  );
}
