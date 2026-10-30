/**
 * Emplacement du lot B8 : seul ce lot modifie ce fichier.
 * Prestations dans l'onglet Résumé : carte compacte, une ligne par prestation en cours. Rien n'est
 * lu hors `ctx.voitEchanges` ; une lecture en panne s'écrit « Lecture impossible », jamais « rien ».
 */

import { CartePrestationsResume } from "./CartePrestationsResume";
import type { ContexteFiche } from "./contexte";
import { lireProjetsDuClient } from "@/features/dossier-client/queries";
import {
  assemblerPrestations,
  lireSuivisDesProjets,
} from "@/features/dossier-client/suivi-prestations";

export async function resumePrestations(ctx: ContexteFiche): Promise<React.ReactElement | null> {
  if (!ctx.voitEchanges) return null;
  try {
    const projets = await lireProjetsDuClient(ctx.clientId);
    const suivis = await lireSuivisDesProjets(projets.map((p) => p.id));
    if (suivis === null) return lectureImpossible();
    return (
      <CartePrestationsResume
        prestations={assemblerPrestations(projets, suivis)}
        ficheHref={ctx.ficheHref}
      />
    );
  } catch {
    return lectureImpossible();
  }
}

function lectureImpossible(): React.ReactElement {
  return (
    <section
      aria-labelledby="resume-prestations"
      data-bloc="resume-prestations"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="resume-prestations"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Prestations
      </h2>
      <p
        role="alert"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
      >
        Lecture impossible
      </p>
    </section>
  );
}
