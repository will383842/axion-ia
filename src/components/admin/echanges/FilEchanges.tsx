/**
 * LE FIL « ÉCHANGES » — composant SERVEUR (Candidatures unifiées L7).
 *
 * Rend une liste de faits déjà ordonnés (`features/echanges/fil.ts`) :
 * « Reçu » à gauche, « Envoyé » à droite, notes au centre, comme la maquette
 * validée. Aucun état, aucun geste : rien de ce fil ne part dans le JavaScript
 * du navigateur (le corps des messages porte le nom de la personne).
 *
 * `pied` : une ligne ajoutée en DERNIER (le premier fait du dossier), par
 * exemple l'accusé de réception automatique côté emploi.
 */

import { AdminBadge } from "@/components/admin/ui";
import type { FaitFil } from "@/features/echanges/fil";

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  dateStyle: "short",
  timeStyle: "short",
});

function Bulle({ f }: { f: FaitFil }): React.ReactElement {
  return (
    <li
      className={
        f.sens === "recu"
          ? "admin-fil-bulle admin-fil-bulle-recu"
          : "admin-fil-bulle admin-fil-bulle-envoye"
      }
    >
      <div className="admin-fil-tete">
        <span className="admin-fil-titre">{f.titre}</span>
        <span className="admin-meta-small">
          {[DATE_FR.format(f.quand), ...f.precisions].join(" · ")}
        </span>
        {f.badge ? <AdminBadge tone={f.badge.ton}>{f.badge.libelle}</AdminBadge> : null}
      </div>
      {f.texte ? <p className="admin-fil-texte">{f.texte}</p> : null}
      {/* L'erreur d'envoi EN ENTIER : elle distingue « clé absente » de
          « boîte pleine », deux pannes qui n'appellent pas le même geste. */}
      {f.erreur ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {f.erreur}
        </p>
      ) : null}
      {f.fichiers && f.fichiers.length > 0 ? (
        <ul className="admin-fil-fichiers">
          {f.fichiers.map((x, i) => (
            <li key={`${x.nom}-${i}`}>
              <span className="admin-fil-fichier-nom">{x.nom}</span>
              {x.taille ? <span className="admin-meta-small">{x.taille}</span> : null}
              <AdminBadge tone={x.ton}>{x.etat}</AdminBadge>
            </li>
          ))}
        </ul>
      ) : null}
      {f.detail ? (
        <details>
          <summary className="admin-meta-small">Voir le détail</summary>
          <p className="admin-fil-texte">{f.detail}</p>
        </details>
      ) : null}
      {f.lien ? (
        <a
          href={f.lien.href}
          target="_blank"
          rel="noopener noreferrer"
          className="admin-link admin-fil-lien"
        >
          {f.lien.libelle}
        </a>
      ) : null}
    </li>
  );
}

export function FilEchanges({
  faits,
  pied = null,
  vide = "Aucun échange pour l'instant.",
}: {
  faits: ReadonlyArray<FaitFil>;
  pied?: React.ReactNode;
  vide?: string;
}): React.ReactElement {
  if (faits.length === 0 && !pied) return <p className="admin-meta-small">{vide}</p>;
  return (
    <>
      {faits.length === 0 ? <p className="admin-meta-small">{vide}</p> : null}
      <ol className="admin-fil">
        {faits.map((f) =>
          f.sens === "note" ? (
            <li key={f.id} className="admin-fil-note">
              <span className="admin-fil-titre">{f.titre}</span>
              {" · "}
              {[DATE_FR.format(f.quand), ...f.precisions].join(" · ")}
              {f.texte ? <span className="admin-fil-texte">{` — ${f.texte}`}</span> : null}
            </li>
          ) : (
            <Bulle key={f.id} f={f} />
          ),
        )}
        {pied}
      </ol>
    </>
  );
}
