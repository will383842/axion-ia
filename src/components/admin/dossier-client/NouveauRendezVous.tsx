/**
 * « Nouveau rendez-vous » — sur l'onglet Échanges de la fiche client et sur la
 * page d'un projet (chantier visio, PR 4 ; décision B9 : 2 clics depuis le
 * projet).
 *
 * Composant SERVEUR, sans JavaScript : un `<details>` s'ouvre au premier clic
 * (le formulaire est pré-rempli : visio, 45 minutes, le projet), le second
 * clic crée le rendez-vous. L'action vérifie elle-même le rôle.
 *
 * La case « test interne » n'est RENDUE que sur la fiche du client fictif, en
 * mode pilote (`caseTestInterneVisible`) — et l'action la refuse ailleurs.
 */

import { creerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import { DUREES_RENDEZ_VOUS } from "@/features/dossier-client/creer-rencontre";

const champCls =
  "mt-[var(--space-admin-1)] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-2)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]";
const libelleCls = "block text-[length:var(--text-admin-sm)] font-medium";

export function NouveauRendezVous({
  clientId,
  projetId,
  personnes,
  caseTestVisible,
  debutParDefaut,
}: {
  clientId: string;
  projetId: string | null;
  personnes: ReadonlyArray<{ id: string; nom: string }>;
  caseTestVisible: boolean;
  /** Valeur « AAAA-MM-JJTHH:MM » (heure de Paris) proposée. */
  debutParDefaut: string;
}): React.ReactElement {
  return (
    <details className="mb-[var(--space-admin-5)]">
      <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)]">
        + Nouveau rendez-vous
      </summary>
      <form
        action={creerRencontreAction}
        className="mt-[var(--space-admin-3)] grid gap-[var(--space-admin-3)] sm:grid-cols-2"
      >
        <input type="hidden" name="clientId" value={clientId} />
        {projetId !== null ? <input type="hidden" name="projetId" value={projetId} /> : null}
        <label className={libelleCls}>
          Date et heure (heure de Paris)
          <input
            type="datetime-local"
            name="debut"
            required
            defaultValue={debutParDefaut}
            className={champCls}
          />
        </label>
        <label className={libelleCls}>
          Durée
          <select name="duree" defaultValue="45" className={champCls}>
            {DUREES_RENDEZ_VOUS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </label>
        <label className={libelleCls}>
          Format
          <select name="type" defaultValue="visio" className={champCls}>
            <option value="visio">Visio (Google Meet)</option>
            <option value="telephone">Téléphone</option>
            <option value="presentiel">En personne</option>
          </select>
        </label>
        <label className={libelleCls}>
          Lien de la visio (facultatif)
          <input
            type="url"
            name="lien"
            placeholder="https://meet.google.com/…"
            className={champCls}
          />
        </label>
        <label className={`${libelleCls} sm:col-span-2`}>
          Titre (facultatif)
          <input
            type="text"
            name="titre"
            maxLength={255}
            placeholder="Rendez-vous du …"
            className={champCls}
          />
        </label>
        {personnes.length > 0 ? (
          <fieldset className="sm:col-span-2">
            <legend className={libelleCls}>Personnes invitées</legend>
            {personnes.map((p, i) => (
              <label
                key={p.id}
                className="mr-[var(--space-admin-4)] inline-flex items-center gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]"
              >
                <input type="checkbox" name="contact" value={p.id} defaultChecked={i === 0} />
                {p.nom}
              </label>
            ))}
          </fieldset>
        ) : null}
        {caseTestVisible ? (
          <label className="inline-flex items-center gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] sm:col-span-2">
            <input type="checkbox" name="testInterne" />
            Rendez-vous de test (pilote, client fictif)
          </label>
        ) : null}
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] sm:col-span-2">
          Pour une visio, un e-mail d&apos;invitation est préparé et attend votre validation dans «
          E-mails à valider » : rien ne part sans vous.
        </p>
        <div className="sm:col-span-2">
          <button type="submit" className="admin-button">
            Créer le rendez-vous
          </button>
        </div>
      </form>
    </details>
  );
}
