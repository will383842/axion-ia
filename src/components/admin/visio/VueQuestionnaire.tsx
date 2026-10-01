// « Questionnaire de cadrage » d'un projet (chantier visio, PR 7 ; décision B8 :
// questionnaire « à copier » en V1) — vue de la page du projet
// (`…/projets/<id>?vue=questionnaire`), pas une page de plus (cliquet des pages
// de la console : voir `VueCompteRendu.tsx`).
//
// Ce que Will fait ici :
//   1. « Préparer un questionnaire » : le worker le rédige depuis ce qui MANQUE
//      au dossier (jamais ce qu'un collègue a déjà dit) ;
//   2. le texte à copier dans son e-mail, les cases « posée de vive voix » ;
//   3. coller la réponse du client SOUS chaque question ;
//   4. valider ou écarter les réponses rangées en faits.
//
// Questionnaire EN LIGNE (2026-10-01) : Will peut aussi « Écrire mes
// questions » (une par ligne, sans IA), puis demander le « Lien du
// questionnaire en ligne » — une adresse secrète à mettre sous un bouton de
// son e-mail. Le client répond sur une page publique ; ses réponses arrivent
// ici, sous chaque question, avec « Reçu en ligne le … · par … ».
//
// Composant SERVEUR, rendu en texte brut, formulaires sans JavaScript (l'action
// unique `gesteSuiviAction`). La page appelle la garde A2 AVANT de lire.

import { gesteSuiviAction } from "@/features/dossier-client/suivi-actions";
import type { QuestionnaireDuProjet } from "@/features/dossier-client/queries";
import { peutPreparerQuestionnaire } from "@/features/dossier-client/questionnaire-etat";
import { texteACopier } from "@/server/visio/passes/p6-questionnaire";
import { formatDateFrShort, formatTimeFr } from "@/lib/format-date-fr";
import { BoutonGeste } from "./BoutonGeste";
import { CopierLienQuestionnaire } from "./CopierLienQuestionnaire";

const carte =
  "mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titre = "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold";
const discret = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";
const bouton =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]";
const champ =
  "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";

const LIBELLE_STATUT: Readonly<Record<QuestionnaireDuProjet["statut"], string>> = {
  brouillon: "prêt à copier",
  copie: "envoyé au client, en attente de réponse",
  reponse_recue: "réponses reçues",
  clos: "clos",
};

interface Props {
  readonly clientId: string;
  readonly projetId: string;
  readonly retour: string;
  readonly questionnaire: QuestionnaireDuProjet | null;
  readonly message: string | undefined;
  readonly erreur: string | undefined;
}

export function VueQuestionnaire({
  clientId,
  projetId,
  retour,
  questionnaire: q,
  message,
  erreur,
}: Props): React.ReactElement {
  const cache = (geste: string) => (
    <>
      <input type="hidden" name="geste" value={geste} />
      <input type="hidden" name="retour" value={retour} />
    </>
  );
  const pret = q !== null && !q.enPreparation && q.questions.length > 0;
  // Tant que rien n'est reçu, « Écrire mes questions » REMPLACE la version courante.
  // Même règle que le geste (`versionRemplacable`, lue par la requête) : seul un
  // brouillon écrit par Will se remplace ; sinon, une nouvelle version.
  const remplace = q !== null && q.remplacable;
  const ancienLienSeFerme =
    q !== null && !q.remplacable && q.mode === "en_ligne" && q.statut === "copie";
  const enLigneOuvert = pret && q !== null && q.mode === "en_ligne" && q.statut === "copie";
  const peutOuvrirLien =
    pret && q !== null && (q.statut === "brouillon" || q.statut === "copie") && !enLigneOuvert;
  return (
    <section className={carte} aria-labelledby="questionnaire-titre">
      <h2 id="questionnaire-titre" className={titre}>
        Questionnaire de cadrage
      </h2>
      {message ? <p className="mb-[var(--space-admin-3)]">{message}</p> : null}
      {erreur ? (
        <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">{erreur}</p>
      ) : null}
      <p className={`mb-[var(--space-admin-3)] ${discret}`}>
        Les questions portent sur ce qui manque au dossier de ce projet : rien de ce que le client
        ou un collègue a déjà dit n&apos;est redemandé, et aucune question ne parle de prix. Vous
        relisez le texte avant de le copier dans votre e-mail.
      </p>

      {q !== null && q.preparationEchouee ? (
        <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-error)]">
          La préparation du questionnaire n&apos;a pas abouti : le dossier ne laisse peut-être
          aucune question utile à poser, ou la préparation par l&apos;IA n&apos;est pas encore
          ouverte. Vous pouvez relancer, ou écrire vos questions vous-même dans votre e-mail.
        </p>
      ) : null}

      {peutPreparerQuestionnaire(q) ? (
        <form action={gesteSuiviAction} className="mb-[var(--space-admin-4)]">
          {cache("questionnaire_demander")}
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="projetId" value={projetId} />
          <button type="submit" className={bouton}>
            {q === null
              ? "Préparer un questionnaire"
              : q.preparationEchouee
                ? "Relancer la préparation"
                : "Préparer un nouveau questionnaire"}
          </button>
        </form>
      ) : null}

      <details className="mb-[var(--space-admin-4)]" open={q === null}>
        <summary className="cursor-pointer font-medium">
          Écrire mes questions{remplace ? " (remplace les questions actuelles)" : ""}
        </summary>
        <form action={gesteSuiviAction} className="mt-[var(--space-admin-2)]">
          {cache("questionnaire_ecrire")}
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="projetId" value={projetId} />
          <label className={discret} htmlFor="questionnaire-ecrire">
            Une question par ligne, sans IA : le client verra vos questions, dans cet ordre (votre
            texte n&apos;est pas relu par les gardes du questionnaire préparé : ni lien ni prix
            n&apos;y sont retirés). Après le « ? », une courte aide pour le client ; une liste entre
            parenthèses, ou après « : », séparée par des virgules, devient des choix à toucher.{" "}
            {remplace
              ? "Ces questions remplacent celles de ce brouillon."
              : ancienLienSeFerme
                ? "Elles forment une nouvelle version : l'ancien lien, envoyé sans réponse, ne fonctionnera plus."
                : "Elles forment un nouveau questionnaire pour ce projet."}
          </label>
          <textarea
            id="questionnaire-ecrire"
            name="questions"
            rows={8}
            className={`${champ} mb-[var(--space-admin-2)]`}
            defaultValue={remplace && q !== null ? q.questions.map((x) => x.texte).join("\n") : ""}
          />
          <BoutonGeste className={bouton}>Enregistrer mes questions</BoutonGeste>
        </form>
      </details>

      {q !== null ? (
        <p className={`mb-[var(--space-admin-3)] ${discret}`}>
          Version {q.version} —{" "}
          {q.preparationEchouee
            ? "préparation échouée"
            : q.enPreparation
              ? "en préparation (quelques minutes)"
              : q.mode === "en_ligne" && q.statut === "copie"
                ? "lien en ligne envoyé au client, en attente de réponse"
                : LIBELLE_STATUT[q.statut]}
        </p>
      ) : null}

      {peutOuvrirLien && q !== null ? (
        <form action={gesteSuiviAction} className="mb-[var(--space-admin-4)]">
          {cache("questionnaire_lien")}
          <input type="hidden" name="questionnaireId" value={q.id} />
          <BoutonGeste className={bouton}>Lien du questionnaire en ligne</BoutonGeste>
        </form>
      ) : null}

      {enLigneOuvert && q !== null ? (
        <div className="mb-[var(--space-admin-4)]">
          <label className={discret} htmlFor="questionnaire-lien">
            Lien du questionnaire en ligne — à mettre sous un bouton de votre e-mail. Un lien par
            projet : le client n&apos;y voit que ces questions.
          </label>
          {q.lienEnLigne !== null ? (
            <CopierLienQuestionnaire
              url={q.lienEnLigne}
              classeChamp={champ}
              classeBouton={bouton}
            />
          ) : (
            <p className="text-[color:var(--color-admin-error)]">
              Le lien ne peut pas être fabriqué : le secret du serveur (AUTH_SECRET) manque.
            </p>
          )}
        </div>
      ) : null}

      {q !== null && q.mode === "en_ligne" && q.reponseRecueLe !== null ? (
        <p className="mb-[var(--space-admin-3)] font-medium">
          Reçu en ligne le {formatDateFrShort(q.reponseRecueLe)} à {formatTimeFr(q.reponseRecueLe)}
          {q.repondant ? ` · par ${q.repondant}` : ""}
        </p>
      ) : null}

      {pret && q !== null ? (
        <>
          <label className={discret} htmlFor="questionnaire-texte">
            Texte à copier dans votre e-mail (sélectionnez tout, puis copiez)
          </label>
          <textarea
            id="questionnaire-texte"
            readOnly
            rows={Math.min(24, q.questions.length * 2 + 8)}
            className={`${champ} mb-[var(--space-admin-3)] font-mono`}
            defaultValue={texteACopier(q.questions)}
          />
          {q.statut === "brouillon" ? (
            <form action={gesteSuiviAction} className="mb-[var(--space-admin-4)]">
              {cache("questionnaire_copie")}
              <input type="hidden" name="questionnaireId" value={q.id} />
              <button type="submit" className={bouton}>
                J&apos;ai copié le questionnaire dans mon e-mail
              </button>
            </form>
          ) : null}

          <form action={gesteSuiviAction}>
            {cache("questionnaire_reponses")}
            <input type="hidden" name="questionnaireId" value={q.id} />
            <ol className="space-y-[var(--space-admin-4)]">
              {q.questions.map((question) => (
                <li key={question.id}>
                  <p className="font-medium">
                    {question.ordre}. {question.texte}
                  </p>
                  {question.poseeDeViveVoix ? (
                    <p className={discret}>Posée de vive voix (hors du texte à copier).</p>
                  ) : null}
                  <label className={discret} htmlFor={`reponse_${question.id}`}>
                    Réponse du client, collée telle quelle
                  </label>
                  <textarea
                    id={`reponse_${question.id}`}
                    name={`reponse_${question.id}`}
                    rows={3}
                    className={champ}
                    defaultValue={question.reponse ?? ""}
                  />
                  {question.faits.map((f) => (
                    <div key={f.id} className="mt-[var(--space-admin-2)]">
                      <p>
                        {f.enonce}{" "}
                        <span className={discret}>
                          ({f.statut === "valide" ? "validé" : "à valider"})
                        </span>
                      </p>
                      {f.citation ? <p className={`${discret} italic`}>« {f.citation} »</p> : null}
                    </div>
                  ))}
                </li>
              ))}
            </ol>
            <button type="submit" className={`${bouton} mt-[var(--space-admin-4)]`}>
              Enregistrer les réponses et les ranger dans le dossier
            </button>
          </form>

          {/* Les gestes par question ou par fait : formulaires distincts (pas d'imbrication). */}
          <div className="mt-[var(--space-admin-4)] space-y-[var(--space-admin-2)]">
            {q.questions.map((question) => (
              <div key={question.id} className="flex flex-wrap gap-[var(--space-admin-2)]">
                <form action={gesteSuiviAction}>
                  {cache("questionnaire_vive_voix")}
                  <input type="hidden" name="questionId" value={question.id} />
                  <input
                    type="hidden"
                    name="valeur"
                    value={question.poseeDeViveVoix ? "non" : "oui"}
                  />
                  <button type="submit" className={bouton}>
                    Q{question.ordre} :{" "}
                    {question.poseeDeViveVoix ? "remettre dans le texte" : "posée de vive voix"}
                  </button>
                </form>
                {question.faits
                  .filter((f) => f.statut !== "valide")
                  .map((f) => (
                    <span key={f.id} className="flex gap-[var(--space-admin-2)]">
                      <form action={gesteSuiviAction}>
                        {cache("reponse_valider")}
                        <input type="hidden" name="faitId" value={f.id} />
                        <button type="submit" className={bouton}>
                          Q{question.ordre} : valider la réponse
                        </button>
                      </form>
                      <form action={gesteSuiviAction}>
                        {cache("reponse_rejeter")}
                        <input type="hidden" name="faitId" value={f.id} />
                        <button type="submit" className={bouton}>
                          Q{question.ordre} : écarter
                        </button>
                      </form>
                    </span>
                  ))}
              </div>
            ))}
          </div>

          {q.statut !== "clos" ? (
            <form action={gesteSuiviAction} className="mt-[var(--space-admin-4)]">
              {cache("questionnaire_clore")}
              <input type="hidden" name="questionnaireId" value={q.id} />
              <button type="submit" className={bouton}>
                Clore ce questionnaire
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
