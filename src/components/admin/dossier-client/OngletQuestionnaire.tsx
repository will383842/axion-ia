// Onglet « Questionnaire » de la fiche client (25/10/2026) : les questionnaires avant audit de la
// fiche (avec ou sans rendez-vous) et le bouton pour en envoyer un. Lecture seule : l'envoi reste le
// clic de Will sur la page « Questionnaire », après l'aperçu exact de l'e-mail.

import { BlocQuestionnaireFiche } from "@/components/admin/dossier-client/BlocQuestionnaireFiche";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import type { QuestionnaireDeLaFiche } from "@/features/dossier-client/questionnaires-de-la-fiche";

export function OngletQuestionnaire({
  questionnaires,
  clientId,
  adminPrefix,
}: {
  questionnaires: ReadonlyArray<QuestionnaireDeLaFiche>;
  clientId: string;
  adminPrefix: string;
}): React.ReactElement {
  return (
    <>
      <BlocQuestionnaireFiche
        questionnaires={questionnaires}
        adminPrefix={adminPrefix}
        clientId={clientId}
      />
      {questionnaires.length === 0 ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun questionnaire avant audit pour cette fiche.
        </p>
      ) : null}
      <AdminButton href={`/fr/${adminPrefix}/qualiopi/clients/${clientId}/questionnaire`}>
        Envoyer un questionnaire
      </AdminButton>
    </>
  );
}
