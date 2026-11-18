/**
 * Fiche admin d'un devis à formules : ce que le client a CHOISI en signant. Pur, lecture seule.
 *
 * Le choix vient du `choixOffre` SCELLÉ de la ligne de signature, déjà contrôlé par
 * `choixImprimable` (intégrité, sceau V4) — jamais de `devis.choixRetenu`, rempli seulement à
 * l'acceptation, donc APRÈS la contresignature que l'administrateur s'apprête à apposer.
 * Un choix qui ne passe pas les contrôles n'est pas affiché : on le dit, on ne devine pas.
 */
import type { ResultatChoixImprimable } from "@/server/qualiopi/devis/choix-exemplaire";

export function ChoixClientSigne({
  resultat,
  maintenanceFacultativeProposee,
}: {
  resultat: ResultatChoixImprimable;
  /** Formule A avec maintenance facultative dans l'offre : « non retenue » est alors une info. */
  maintenanceFacultativeProposee: boolean;
}) {
  if (!resultat.ok) {
    return (
      <p
        data-testid="choix-client-illisible"
        className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]"
      >
        Choix du client non affichable : le choix scellé à la signature n&apos;a pas passé les
        contrôles d&apos;intégrité ({resultat.motif}). Ne pas contresigner avant vérification.
      </p>
    );
  }
  const { choix } = resultat;
  const maintenanceRetenue = choix.recurrent.some((l) => l.startsWith("Maintenance"));
  const estAchat = choix.formuleLibelle.startsWith("Formule A");
  return (
    <div data-testid="choix-client-signe" className="mt-[var(--space-admin-2)]">
      <p className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]">
        Formule choisie par le client : {choix.formuleLibelle}
      </p>
      {choix.automatisations.length > 0 ? (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Automatisations retenues : {choix.automatisations.join(", ")}
        </p>
      ) : null}
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Total ponctuel : {choix.totalPonctuelHtLisible} HT ({choix.totalPonctuelTtcLisible} TTC)
      </p>
      {choix.recurrent.map((l) => (
        <p
          key={l}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          {l}
        </p>
      ))}
      {estAchat && !maintenanceRetenue && maintenanceFacultativeProposee ? (
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Maintenance facultative : non retenue par le client.
        </p>
      ) : null}
    </div>
  );
}
