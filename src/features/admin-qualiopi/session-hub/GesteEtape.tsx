"use client";
// use-client: compose les boutons de relance et de génération d'accès, eux-mêmes clients (état d'envoi + Server Action).

/**
 * Le geste DIRECT d'une étape de « Où en est ce dossier » — posé sans quitter
 * la checklist.
 *
 * ## Ce qu'il fait, et ce qu'il ne fera jamais
 *
 * Trois gestes simples, non habilités, déjà offerts ailleurs dans la console :
 *
 * - relancer un questionnaire resté sans réponse (`relancerQuestionnaireAction`) ;
 * - relancer par e-mail la partie qui doit encore signer une pièce
 *   (`envoyerLienSignatureParEmailAction`, le bouton de « À traiter ») ;
 * - générer un accès à l'espace stagiaire (`genererPortailAccesAction`).
 *
 * Les TROIS actions sont classées OUVERTE au registre du verrou (ADR 0060) : ce
 * sont les gestes qui restent dus sur un dossier clos. Leurs gardes serveur
 * restent seules juges — ce composant ne décide rien.
 *
 * ⛔ Jamais un acte habilité. Contresigner, évaluer, attester ENGAGENT
 * l'organisme : la checklist mène à leur panneau, elle ne les déclenche pas.
 * Le type `GesteDirect` n'a d'ailleurs aucune variante pour eux (garde :
 * `fil-conducteur.spec.ts`).
 *
 * Les boutons sont RÉUTILISÉS tels quels : deux boutons de relance
 * divergeraient sur ce qu'ils disent avoir envoyé.
 */

import type { GesteDirect } from "@/server/qualiopi/parcours/session-parcours";
import { RelancerQuestionnaireButton } from "@/components/admin/qualiopi/RelancerQuestionnaireButton";
import { RelancerSignatureButton } from "@/components/admin/qualiopi/RelancerSignatureButton";
import { GenererPortailAccesButton } from "@/components/admin/qualiopi/GenererPortailAccesButton";
import { genererPortailAccesAction } from "@/server/actions/qualiopi/portail";

const ligne =
  "mt-[var(--space-admin-1)] flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

export function GesteEtape({ geste }: { readonly geste: GesteDirect }) {
  switch (geste.type) {
    case "relancer_questionnaire":
      return (
        <span className="block">
          {geste.cibles.map((c) => (
            <span key={c.questionnaireId} className={ligne}>
              {c.destinataire} :
              <RelancerQuestionnaireButton
                questionnaireId={c.questionnaireId}
                destinataire={c.destinataire}
              />
            </span>
          ))}
        </span>
      );
    case "relancer_signature":
      return (
        <span className={ligne}>
          Pièce {geste.numero} :
          <RelancerSignatureButton
            documentGenereId={geste.documentGenereId}
            partie={geste.partie}
          />
        </span>
      );
    case "generer_acces_portail":
      return (
        <span className="block">
          {geste.cibles.map((c) => (
            <span key={c.traineeId} className={ligne}>
              {c.destinataire} :
              <GenererPortailAccesButton
                traineeId={c.traineeId}
                genererAction={genererPortailAccesAction}
              />
            </span>
          ))}
        </span>
      );
  }
}
