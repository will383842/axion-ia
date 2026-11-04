// Bloc « Rapport d'analyse » de la fiche client, onglet Questionnaire (2026-11-02).
//
// Composant SERVEUR. Le seul JavaScript envoyé au navigateur : le bouton « Lancer l'analyse
// complète » (`LancerAnalyseBouton`) et l'envoi du formulaire « Compléter la fiche »
// (`FormulaireRapport`, qui écrit le résultat sous le bouton). Le contenu des formulaires
// (tableau, cases) est rendu ici, au serveur.
//
// Les documents téléchargeables sont des HTML INTERNES : ils ne sont jamais transmis au client.
//
// ⛔ Rien n'est écrit sur la fiche sans clic explicite ; rien n'est jamais envoyé au client.
// Toutes les décisions sont dans `features/rapport-avant-audit/ecran/logique.ts` (pur, testé).

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import {
  completerFicheAction,
  poserSirenDepuisRapportAction,
} from "@/features/rapport-avant-audit/ecran/actions";
import type { ResumeRapport } from "@/features/rapport-avant-audit/ecran/contrat";
import type { EcranRapport } from "@/features/rapport-avant-audit/ecran/lecture";
import {
  libelleJetons,
  libelleStatut,
  LIBELLES_CHAMPS,
  pourcentage,
  RESERVE_SUPER_ADMIN,
  VERSION_2_REQUISE,
  type LigneProposition,
} from "@/features/rapport-avant-audit/ecran/logique";

import { FormulaireRapport } from "./FormulaireRapport";
import { LancerAnalyseBouton } from "./LancerAnalyseBouton";

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

const PETIT = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

function Progression({ r }: { r: ResumeRapport }): React.ReactElement {
  const pct = pourcentage(r);
  return (
    <div className="space-y-[var(--space-admin-1)]">
      <p>
        Version {r.version} — {libelleStatut(r)}
        {r.etape !== null ? ` · étape : ${r.etape}` : ""} ({pct} %)
      </p>
      <progress value={pct} max={100} aria-label={`Avancement de la version ${r.version}`}>
        {pct} %
      </progress>
      <p className={PETIT}>{libelleJetons(r)}</p>
    </div>
  );
}

function Telechargements({
  r,
  ficheHref,
}: {
  r: ResumeRapport;
  ficheHref: string;
}): React.ReactElement {
  const lien = (f: string): string =>
    `${ficheHref}/rapport-analyse?r=${encodeURIComponent(r.id)}&f=${f}`;
  const version2 = r.versionSchema === "base-audit/2";
  return (
    <div className="space-y-[var(--space-admin-2)]">
      <h3 className="font-medium">Télécharger</h3>
      <ul className="flex flex-wrap gap-[var(--space-admin-3)]">
        <li>
          <a className="admin-button-secondary" href={lien("synthese-html")} download>
            Synthèse (réponses, difficultés, logiciels)
          </a>
        </li>
        <li>
          {version2 ? (
            <a className="admin-button-secondary" href={lien("automatisations-html")} download>
              Fiche des automatisations
            </a>
          ) : (
            <button
              type="button"
              className="admin-button-secondary"
              disabled
              aria-describedby="doc-v2"
            >
              Fiche des automatisations
            </button>
          )}
        </li>
        <li>
          {version2 ? (
            <a className="admin-button-secondary" href={lien("schema-html")} download>
              Schéma des dépendances
            </a>
          ) : (
            <button
              type="button"
              className="admin-button-secondary"
              disabled
              aria-describedby="doc-v2"
            >
              Schéma des dépendances
            </button>
          )}
        </li>
      </ul>
      {version2 ? null : (
        <p id="doc-v2" className={PETIT}>
          {VERSION_2_REQUISE}.
        </p>
      )}
      <p className={PETIT}>
        Documents internes : jamais transmis au client. Pour les machines seulement :{" "}
        <a className="admin-link" href={lien("base-json")} download>
          base d&apos;audit au format .json
        </a>
        .
      </p>
    </div>
  );
}

function CompleterLaFiche({
  lignes,
  clientId,
  rapportId,
}: {
  lignes: ReadonlyArray<LigneProposition>;
  clientId: string;
  rapportId: string;
}): React.ReactElement {
  const sirens = lignes.filter((l) => l.etat === "siren" && l.valeurAEcrire !== null);
  const aCocher = lignes.some((l) => l.etat === "a_cocher");
  const tableau = (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Retenir</th>
            <th scope="col">Champ</th>
            <th scope="col">Valeur proposée</th>
            <th scope="col">Source</th>
            <th scope="col">Confiance</th>
            <th scope="col">Remarque</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle}>
              <td>
                {l.etat === "a_cocher" ? (
                  <input
                    type="checkbox"
                    name="cle"
                    value={l.cle}
                    aria-label={`Retenir : ${l.champ}`}
                  />
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </td>
              <td>{l.champFiche !== null ? LIBELLES_CHAMPS[l.champFiche] : l.champ}</td>
              <td>{l.valeur}</td>
              <td>{l.source}</td>
              <td>{l.confiance}</td>
              <td>
                {l.explication}
                {l.valeurActuelle !== null ? ` (sur la fiche : « ${l.valeurActuelle} »)` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-[var(--space-admin-2)]">
      <h3 className="font-medium">Compléter la fiche</h3>
      <p className={PETIT}>
        Ce que l&apos;analyse a trouvé pour la fiche. Seuls les champs encore VIDES peuvent être
        remplis ; une valeur déjà saisie n&apos;est jamais remplacée. Rien n&apos;est écrit sans
        votre clic.
      </p>
      {aCocher ? (
        <FormulaireRapport
          action={completerFicheAction}
          libelle="Compléter la fiche avec les lignes cochées"
          libelleEnCours="Écriture…"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="rapportId" value={rapportId} />
          {tableau}
        </FormulaireRapport>
      ) : (
        <>
          {tableau}
          <p className={PETIT}>Aucune ligne ne peut remplir un champ vide de la fiche.</p>
        </>
      )}
      {sirens.map((l) => (
        // La VALEUR n'est pas dans le formulaire : l'action la relit dans le rapport, par sa clé.
        <FormulaireRapport
          key={`siren-${l.cle}`}
          action={poserSirenDepuisRapportAction.bind(null, clientId, rapportId, l.cle)}
          libelle="Poser ce SIREN"
          libelleEnCours="Écriture…"
        >
          <p className="text-[length:var(--text-admin-xs)]">
            SIREN proposé par l&apos;analyse : <span className="font-mono">{l.valeurAEcrire}</span>{" "}
            ({l.source}). Vérifiez-le avant de le poser.
          </p>
        </FormulaireRapport>
      ))}
    </div>
  );
}

export function BlocRapportAnalyse({
  ecran,
  clientId,
  ficheHref,
}: {
  ecran: EcranRapport;
  clientId: string;
  ficheHref: string;
}): React.ReactElement {
  const enCours = ecran.rapports.filter(
    (r) => r.statut === "en_attente" || r.statut === "en_cours",
  );
  const courant = ecran.courant;
  return (
    <section
      id="rapport-analyse"
      aria-labelledby="rapport-analyse-titre"
      className="admin-carte mt-[var(--space-admin-6)] space-y-[var(--space-admin-4)] text-[length:var(--text-admin-sm)]"
    >
      <h2 id="rapport-analyse-titre" className="admin-carte-titre">
        Rapport d&apos;analyse
      </h2>
      <p className={PETIT}>
        Une analyse complète des réponses au questionnaire, pour préparer l&apos;audit sur place :
        besoins exprimés, difficultés de chaque personne, automatisations et questions à poser.
      </p>

      {ecran.rappel.ton === "attention" ? (
        <AdminBloc teinte="ambre" niveau={3} titre="À faire">
          <p role="status">{ecran.rappel.texte}</p>
        </AdminBloc>
      ) : (
        <p role="status">{ecran.rappel.texte}</p>
      )}

      {ecran.superAdmin ? (
        <LancerAnalyseBouton
          clientId={clientId}
          actif={ecran.bouton.actif}
          libelle={ecran.bouton.libelle}
          raison={ecran.bouton.raison}
        />
      ) : (
        <p className={PETIT}>Lancer l&apos;analyse : {RESERVE_SUPER_ADMIN.toLowerCase()}</p>
      )}

      {enCours.map((r) => (
        <Progression key={r.id} r={r} />
      ))}

      {courant !== null ? (
        <div className="space-y-[var(--space-admin-3)]">
          <p>
            Dernier rapport utilisable : version {courant.version}, lancée le{" "}
            {jourHeure(courant.lanceLe)}
            {courant.termineLe !== null
              ? `, terminée le ${jourHeure(courant.termineLe)}`
              : ""}. {libelleStatut(courant)}.{" "}
            <span className={PETIT}>{libelleJetons(courant)}.</span>
          </p>
          {ecran.superAdmin ? (
            <>
              <Telechargements r={courant} ficheHref={ficheHref} />
              {ecran.propositions.length > 0 ? (
                <CompleterLaFiche
                  lignes={ecran.propositions}
                  clientId={clientId}
                  rapportId={courant.id}
                />
              ) : null}
            </>
          ) : (
            <p className={PETIT}>Téléchargements : {RESERVE_SUPER_ADMIN.toLowerCase()}</p>
          )}
        </div>
      ) : null}

      {ecran.rapports.length > 0 ? (
        <div className="space-y-[var(--space-admin-2)]">
          <h3 className="font-medium">Historique des versions</h3>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Lancée le</th>
                  <th scope="col">État</th>
                  <th scope="col">Jetons</th>
                </tr>
              </thead>
              <tbody>
                {ecran.rapports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.version}</td>
                    <td>{jourHeure(r.lanceLe)}</td>
                    <td>
                      {libelleStatut(r)}
                      {r.statut === "echoue" && r.erreur !== null ? ` — ${r.erreur}` : ""}
                    </td>
                    <td>{libelleJetons(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
