/**
 * Bloc « Fichiers envoyés » de la fiche candidat (Candidatures unifiées L5, maquette).
 *
 * Composant SERVEUR : la lecture vient de `lireFichiersEnvoyes` (journal des
 * accès, sans donnée personnelle). Les mots sont « ouvert le… » et
 * « téléchargé le… », jamais « lu ». Un accès qui ne vient que d'un robot de
 * messagerie (aperçu automatique) est dit comme tel. Chaque tableau défile
 * dans son propre conteneur : lisible à 390 px.
 */

import { AdminBadge } from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { DUREE_LIEN_JOURS, DUREE_LIEN_RUSHS_JOURS, porteDesRushs } from "@/server/partages/liens";
import { LIBELLE_CATEGORIE, tailleLisible, type CategorieFichier } from "@/server/partages/regles";
import type { FichierRecu, LienEnvoye } from "@/server/partages/suivi";

import { GestesLien } from "./GestesLien";

const LIBELLE_ETAT = { actif: "actif", expire: "expiré", retire: "retiré" } as const;
const TON_ETAT = { actif: "success", expire: "neutral", retire: "neutral" } as const;

function quand(d: Date | null, apercu: boolean): string {
  if (d) return formatDateFrShort(d);
  return apercu ? "aperçu automatique seulement" : "pas encore";
}

/**
 * L5b — « Fichier reçu » : ce que le candidat a renvoyé par son lien. HTML
 * SERVEUR seulement (aucun composant client) : un `<video>` natif sur une
 * adresse signée courte, chargé au clic (`preload="none"`). Avant le verdict de
 * l'antivirus, rien du fichier n'est montré — ni nom, ni lecteur.
 */
function FichiersRecus({ recus }: { recus: ReadonlyArray<FichierRecu> }) {
  return (
    <div className="mt-[var(--space-admin-3)] grid gap-[var(--space-admin-3)]">
      {recus.map((f) => {
        if (f.etat === "en_analyse") {
          return (
            <p key={f.id} className="admin-meta-small">
              Fichier reçu : analyse antivirus en cours. Il apparaîtra ici une fois vérifié.
            </p>
          );
        }
        if (f.etat === "bloque") {
          return (
            <p key={f.id} className="admin-meta-small">
              Fichier reçu bloqué par l&apos;antivirus : il n&apos;est pas affiché.
            </p>
          );
        }
        return (
          <div key={f.id} className="grid gap-[var(--space-admin-2)]">
            <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
              <AdminBadge tone="success">Fichier reçu</AdminBadge>
              <span className="admin-meta-small">
                le {formatDateFrShort(f.recuLe)} · {f.nomFichier} · {tailleLisible(f.tailleOctets)}
              </span>
            </div>
            {f.url === null ? (
              <p className="admin-meta-small">
                Le stockage ne répond pas pour le moment : rechargez la page dans quelques minutes.
              </p>
            ) : f.video ? (
              <video
                src={f.url}
                controls
                playsInline
                preload="none"
                className="w-full max-w-[640px] rounded-lg bg-black"
              >
                <a href={f.url}>Ouvrir la vidéo</a>
              </video>
            ) : (
              <a
                href={f.url}
                className="admin-button-secondary admin-button-tactile w-fit"
                rel="noreferrer"
              >
                Télécharger l&apos;archive
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FichiersEnvoyes({ liens }: { liens: ReadonlyArray<LienEnvoye> }) {
  if (liens.length === 0) {
    return (
      <p className="admin-meta-small">
        Aucun fichier envoyé. « Joindre des fichiers » dans la réponse les envoie par un lien
        personnel.
      </p>
    );
  }
  return (
    <div className="grid gap-[var(--space-admin-4)]">
      {liens.map((l) => {
        const categories = l.fichiers.map((f) => f.categorie);
        const duree = `${porteDesRushs(categories) ? DUREE_LIEN_RUSHS_JOURS : DUREE_LIEN_JOURS} jours`;
        return (
          <section key={l.id} aria-label={`Envoi du ${formatDateFrShort(l.creeLe)}`}>
            <div className="mb-[var(--space-admin-2)] flex flex-wrap items-center gap-[var(--space-admin-2)]">
              <AdminBadge tone={TON_ETAT[l.etat]}>{LIBELLE_ETAT[l.etat]}</AdminBadge>
              <span className="admin-meta-small">
                Envoyé le {formatDateFrShort(l.creeLe)} par {l.creeParNom}
                {l.etat === "retire" && l.revoqueLe
                  ? ` · retiré le ${formatDateFrShort(l.revoqueLe)}`
                  : ` · jusqu'au ${formatDateFrShort(l.expireLe)}`}
                {" · page ouverte : "}
                {quand(l.ouvertLe, l.apercuSeulement)}
                {l.depotAutorise ? " · dépôt de sa version autorisé" : ""}
              </span>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Fichier</th>
                    <th scope="col">Taille</th>
                    <th scope="col">Téléchargé</th>
                  </tr>
                </thead>
                <tbody>
                  {l.fichiers.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.titre}
                        <span className="admin-meta-small">
                          {" "}
                          · {LIBELLE_CATEGORIE[f.categorie as CategorieFichier] ?? f.categorie}
                        </span>
                      </td>
                      <td>{f.tailleOctets === null ? "lien" : tailleLisible(f.tailleOctets)}</td>
                      <td>
                        {quand(f.telechargeLe, f.apercuSeulement)}
                        {f.plafondAtteint ? (
                          <span className="admin-meta-small">
                            {" "}
                            · limite de 20 atteinte (prolonger la rouvre)
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {l.recus.length > 0 ? <FichiersRecus recus={l.recus} /> : null}
            <div className="mt-[var(--space-admin-2)]">
              <GestesLien
                lienId={l.id}
                retirable={l.etat !== "retire"}
                duree={duree}
                avecLienExterne={l.fichiers.some((f) => f.nature === "lien_externe")}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
