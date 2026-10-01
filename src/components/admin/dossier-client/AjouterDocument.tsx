/**
 * Formulaire « + Ajouter un document » de la rubrique Documents d'un projet
 * (ADR 0063 ; libellés exacts de 2-ux.md §3).
 *
 * Composant SERVEUR : un formulaire HTML relié à une action serveur, qui
 * marche sans JavaScript (le lien et le fichier restent visibles ; la règle
 * « l'un ou l'autre » est vérifiée au serveur). Seuls le champ fichier et les
 * boutons sont des îlots clients (`DocumentsInteractifs.tsx`), pour peser le
 * moins possible dans la console.
 */

import {
  BoutonsAjoutDocument,
  ChampFichierDocument,
} from "@/components/admin/dossier-client/DocumentsInteractifs";
import { ajouterDocumentFormAction } from "@/features/dossier-client/documents/actions";
import {
  ACCEPT_FICHIERS,
  TAILLE_MAX_FICHIER_OCTETS,
} from "@/features/dossier-client/documents/formats";

const champCls =
  "min-h-[44px] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]";
const libelleCls =
  "mb-[var(--space-admin-1)] block text-[length:var(--text-admin-sm)] font-semibold";
const aideCls =
  "mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const choixCls =
  "flex min-h-[44px] cursor-pointer items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] has-[:checked]:border-[color:var(--color-admin-accent)]";

export function AjouterDocument({
  clientId,
  projetId,
  ouvert,
  aujourdhui,
  erreurId,
}: {
  clientId: string;
  projetId: string;
  /** Ouvert d'office : carte vide, ou retour en erreur. */
  ouvert: boolean;
  /** `AAAA-MM-JJ`, heure de Paris. */
  aujourdhui: string;
  /** Identifiant du message d'erreur, relié aux champs. */
  erreurId?: string;
}): React.ReactElement {
  const decrit = (aide: string) => [aide, erreurId].filter(Boolean).join(" ");

  return (
    <details open={ouvert} className="mb-[var(--space-admin-4)]">
      <summary className="admin-button inline-flex min-h-[44px] cursor-pointer list-none">
        + Ajouter un document
      </summary>
      <form
        action={ajouterDocumentFormAction}
        className="mt-[var(--space-admin-3)] grid gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] md:grid-cols-2"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="projetId" value={projetId} />

        <fieldset className="md:col-span-2">
          <legend className={libelleCls}>Ce document a été…</legend>
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            <label className={choixCls}>
              <input type="radio" name="cote" value="envoye_au_client" defaultChecked />
              {"Envoyé au client"}
            </label>
            <label className={choixCls}>
              <input type="radio" name="cote" value="interne" />
              {"Gardé en interne"}
            </label>
          </div>
        </fieldset>

        <div className="md:col-span-2">
          <label className={libelleCls} htmlFor="document-lien">
            Coller un lien
          </label>
          <input
            id="document-lien"
            name="lien"
            type="url"
            inputMode="url"
            placeholder="https://"
            maxLength={2000}
            className={champCls}
            aria-describedby={decrit("document-lien-aide")}
          />
          <p id="document-lien-aide" className={aideCls}>
            Une adresse qui commence par https://
          </p>
        </div>

        <div className="md:col-span-2">
          <span className={libelleCls}>ou choisir un fichier</span>
          <ChampFichierDocument
            accept={ACCEPT_FICHIERS}
            decritPar={decrit("document-fichier-aide")}
            tailleMax={TAILLE_MAX_FICHIER_OCTETS}
          />
          <p id="document-fichier-aide" className={aideCls}>
            PDF, Word, Excel, PowerPoint, image, e-mail (.eml), page web, texte · 15 Mo au plus
          </p>
        </div>

        <div>
          <label className={libelleCls} htmlFor="document-titre">
            Titre
          </label>
          <input
            id="document-titre"
            name="titre"
            type="text"
            maxLength={200}
            className={champCls}
            aria-describedby="document-titre-aide"
          />
          <p id="document-titre-aide" className={aideCls}>
            Laissez vide pour reprendre le nom du fichier ou du site
          </p>
        </div>

        <div>
          <label className={libelleCls} htmlFor="document-nature">
            Nature
          </label>
          <select id="document-nature" name="nature" defaultValue="deviner" className={champCls}>
            <option value="deviner">Je laisse deviner</option>
            <option value="email">E-mail</option>
            <option value="pdf">PDF</option>
            <option value="page_en_ligne">Page en ligne</option>
            <option value="compte_rendu">Compte rendu</option>
            <option value="devis">Devis</option>
            <option value="note">Note</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        <div>
          <label className={libelleCls} htmlFor="document-date">
            Date d&apos;envoi au client
          </label>
          <input
            id="document-date"
            name="envoyeLe"
            type="date"
            defaultValue={aujourdhui}
            className={champCls}
            aria-describedby="document-date-aide"
          />
          <p id="document-date-aide" className={aideCls}>
            Seulement pour un document envoyé. Aujourd&apos;hui par défaut.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)] md:col-span-2">
          <BoutonsAjoutDocument />
        </div>
      </form>
    </details>
  );
}
