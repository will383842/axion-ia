// Bloc « Rapport d'analyse » de la fiche client, onglet Questionnaire (2026-11-02).
//
// Composant SERVEUR. Le seul JavaScript envoyé au navigateur : le bouton « Lancer l'analyse
// complète » (`LancerAnalyseBouton`) et l'envoi des deux formulaires « Valider le PDF client » et
// « Compléter la fiche » (`FormulaireRapport`, qui écrit le résultat sous le bouton). Le contenu
// des formulaires (tableau, cases) est rendu ici, au serveur.
//
// ⛔ Rien n'est écrit sur la fiche sans clic explicite ; rien n'est jamais envoyé au client.
// Toutes les décisions sont dans `features/rapport-avant-audit/ecran/logique.ts` (pur, testé).

import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { confirmerSirenFormAction } from "@/features/dossier-client/actions";
import {
  completerFicheAction,
  validerPdfClientAction,
} from "@/features/rapport-avant-audit/ecran/actions";
import type { ResumeRapport } from "@/features/rapport-avant-audit/ecran/contrat";
import type { EcranRapport } from "@/features/rapport-avant-audit/ecran/lecture";
import {
  libelleJetons,
  libelleStatut,
  LIBELLES_CHAMPS,
  pourcentage,
  RESERVE_SUPER_ADMIN,
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
        {r.etape !== null ? ` · étape : ${r.etape}` : ""} ({r.etapesFaites}/{r.etapesTotal})
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
  clientId,
  ficheHref,
}: {
  r: ResumeRapport;
  clientId: string;
  ficheHref: string;
}): React.ReactElement {
  const lien = (f: string): string =>
    `${ficheHref}/rapport-analyse?r=${encodeURIComponent(r.id)}&f=${f}`;
  return (
    <div className="space-y-[var(--space-admin-2)]">
      <h3 className="font-medium">Télécharger</h3>
      <ul className="flex flex-wrap gap-x-[var(--space-admin-4)] gap-y-[var(--space-admin-1)]">
        <li>
          <a className="admin-link" href={lien("base-json")} download>
            Base d&apos;audit (.json)
          </a>
        </li>
        <li>
          <a className="admin-link" href={lien("base-md")} download>
            Base d&apos;audit (.md)
          </a>
        </li>
        <li>
          <a className="admin-link" href={lien("fiches-md")} download>
            Fiche de chaque personne (.md)
          </a>
        </li>
        {r.pdfValideLe !== null ? (
          <li>
            <a className="admin-link" href={lien("pdf-client")} download>
              PDF client
            </a>
          </li>
        ) : null}
      </ul>
      {r.pdfValideLe !== null ? (
        <p className={PETIT}>
          PDF client validé le {jourHeure(r.pdfValideLe)}. Il n&apos;est jamais envoyé
          automatiquement : c&apos;est vous qui le transmettez au client.
        </p>
      ) : (
        <FormulaireRapport
          action={validerPdfClientAction}
          libelle="Valider le PDF client"
          libelleEnCours="Validation…"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="rapportId" value={r.id} />
          <p className={PETIT}>
            Relisez la base d&apos;audit d&apos;abord. Une fois validé, le PDF devient
            téléchargeable ; rien n&apos;est envoyé au client.
          </p>
        </FormulaireRapport>
      )}
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
        <form
          key={`siren-${l.cle}`}
          action={confirmerSirenFormAction}
          className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]"
        >
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="siren" value={l.valeurAEcrire ?? ""} />
          <span>
            SIREN proposé par l&apos;analyse : <span className="font-mono">{l.valeurAEcrire}</span>{" "}
            ({l.source}). Vérifiez-le avant de le poser.
          </span>
          <AdminButton type="submit" variant="secondary">
            Poser ce SIREN
          </AdminButton>
        </form>
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
        besoins exprimés, fiche de chaque personne, pistes et questions à poser.
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
          {courant.statut === "incomplet" && courant.erreur !== null ? (
            <p className={PETIT}>Ce qui manque : {courant.erreur}</p>
          ) : null}
          {ecran.superAdmin ? (
            <>
              <Telechargements r={courant} clientId={clientId} ficheHref={ficheHref} />
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
                  <th scope="col">PDF client</th>
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
                    <td>
                      {r.pdfValideLe !== null
                        ? `Validé le ${jourHeure(r.pdfValideLe)}`
                        : "Non validé"}
                    </td>
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
