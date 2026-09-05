"use client";
// use-client: useActionState + useState — le compte rendu d'un envoi groupé doit
// s'afficher sans recharger, et choisir un modèle doit remplir les deux champs.
//
// 🔴 POURQUOI CE BLOC EST REPLIÉ PAR DÉFAUT.
//
// C'est le seul geste de la console qui écrive à cinquante personnes d'un clic,
// et il ne se rattrape pas. Un `<details>` fermé demande une intention
// supplémentaire — l'ouvrir — là où un formulaire déjà déplié invite à
// remplir. Ce n'est pas de l'ornement : le bouton « Appliquer à la sélection »,
// juste au-dessus, change un statut, ce qui se corrige.
//
// 🔑 IL VIT DANS LE MÊME `<form>` QUE LA TABLE, et c'est pour cela qu'il voit
// les cases cochées. Le bouton porte `formAction` : un formulaire n'a qu'une
// action, un bouton peut en imposer une autre. Les deux gestes partagent donc
// la sélection sans que la table soit rendue deux fois.
//
// ✅ VÉRIFIÉ PAR L'INTERFACE, et pas seulement lu dans la documentation : voir
// `tests/e2e/flows/reponse-en-masse.spec.ts`. Le témoin qui tranche est un
// dossier ÉCARTÉ dont le statut n'est pas `new` — s'il bascule, c'est que le
// geste de statut a tourné en plus. Il ne bascule pas.

import { useActionState, useState } from "react";

import { repondreEnMasseAction } from "@/features/admin-job-applications/actions-reponse-en-masse";
import type {
  EtatReponseEnMasse,
  MotifEcart,
} from "@/features/admin-job-applications/reponse-en-masse";

/**
 * Un modèle, réduit à ce que l'écran en a besoin.
 *
 * 🔴 LE VOCABULAIRE NE TRAVERSE PAS LA FRONTIÈRE. Importer
 * `@/content/recrutement/modeles-reponse` depuis un composant client tirerait
 * le module ENTIER dans le paquet du navigateur — ses cinq modèles, leurs corps
 * complets et `remplirModele`, dont rien n'est utilisé ici. Le parent est un
 * composant serveur : il réduit et passe en props. Même raison que
 * `OptionDeMenu` dans `FormulaireEnMasse`, et le cliquet `bundle:check` a déjà
 * attrapé ce dépôt à 0,35 Ko près.
 */
export interface ModeleProposable {
  readonly value: string;
  readonly label: string;
  /** Ce que ce modèle sert à dire — affiché sous le choix, pour éviter l'erreur. */
  readonly quand: string;
  readonly objet: string;
  readonly corps: string;
}

const INITIAL: EtatReponseEnMasse = {
  ok: true,
  envoyees: 0,
  ecartees: 0,
  echouees: 0,
  details: [],
};

/**
 * Ce que chaque motif d'écart veut dire pour le recruteur, et ce qu'il doit
 * faire ensuite.
 *
 * 🔑 La traduction vit ICI, pas dans le domaine. Le domaine rend une VALEUR
 * (`variable_non_resolue`) : les tests l'assertionnent sans figer une phrase
 * française, et l'écran reste libre de la reformuler.
 */
const PHRASE_MOTIF: Record<MotifEcart, string> = {
  variable_non_resolue: "dossier incomplet — à écrire à la main",
  destinataire_injoignable: "adresse absente ou illisible",
  ecriture_impossible: "échec technique — rien n'a été écrit",
  dossier_introuvable: "dossier disparu depuis la sélection",
};

interface Props {
  readonly modeles: readonly ModeleProposable[];
  readonly plafond: number;
}

export function ComposeurEnMasse({ modeles, plafond }: Props): React.ReactElement {
  const [etat, action, enCours] = useActionState(repondreEnMasseAction, INITIAL);
  const [objet, setObjet] = useState("");
  const [corps, setCorps] = useState("");
  /**
   * 🔴 LE SECOND CLIC EST LE VRAI DANGER DE CET ÉCRAN.
   *
   * `disabled={enCours}` protège pendant l'envoi. Il ne protège pas APRÈS :
   * l'écran retrouve son état normal, le texte est encore là, la sélection
   * aussi — et un clic de plus renvoie le même message aux mêmes cinquante
   * personnes. Le geste de statut voisin n'a pas ce défaut : le réappliquer ne
   * change rien, puisqu'il compte les dossiers « déjà dans cet état ».
   *
   * On ne pose pas de `confirm()` : une boîte modale se clique sans être lue,
   * et elle rendrait ce parcours intestable par l'interface. On EXIGE une
   * modification — changer un mot, reprendre un modèle — ce qui est exactement
   * le geste qu'on fait quand on veut vraiment renvoyer autre chose, et qu'on
   * ne fait jamais par inadvertance.
   */
  const [retouche, setRetouche] = useState(false);
  const [choisi, setChoisi] = useState("libre");

  function choisirModele(id: string): void {
    const m = modeles.find((x) => x.value === id);
    if (!m) return;
    setChoisi(id);
    // Le modèle « Message libre » porte deux chaînes vides : le choisir VIDE
    // les champs, ce qui est le geste attendu quand on veut repartir de zéro.
    setObjet(m.objet);
    setCorps(m.corps);
    setRetouche(true);
  }

  const total = etat.ok ? etat.envoyees + etat.ecartees + etat.echouees : 0;
  const dejaEnvoye = etat.ok && total > 0 && !retouche;

  return (
    <details className="mt-[var(--space-admin-4)]">
      <summary className="admin-label cursor-pointer">Écrire à la sélection</summary>

      <div className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-3)]">
        <p className="admin-meta-small">
          Un message <strong>par personne</strong>, jamais en copie : personne n’apprend qui d’autre
          a candidaté. Au plus {plafond} destinataires par envoi.{" "}
          {/* La personnalisation est le seul endroit où l'écran doit ENSEIGNER
              quelque chose : sans cette phrase, on écrit « Bonjour, » à tout le
              monde et on croit que c'est la seule forme possible. */}
          <code>{"{prenom}"}</code> et <code>{"{poste}"}</code> sont remplacés depuis chaque dossier
          ; un dossier qui n’en porte pas est <strong>écarté</strong> plutôt qu’envoyé avec un trou.
        </p>

        <div className="admin-field">
          <label htmlFor="masse-modele" className="admin-label">
            Modèle de départ
          </label>
          <select
            id="masse-modele"
            name="modele"
            className="admin-input"
            defaultValue="libre"
            onChange={(e) => choisirModele(e.target.value)}
          >
            {modeles.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {/* 🔑 CE QUE LE MODÈLE SERT À DIRE, sous le choix. Un menu de cinq
              libellés seuls fait choisir « Refus » pour une relance : les deux
              mots se ressemblent à la lecture rapide, et le geste est groupé. */}
          <p className="admin-meta-small">{modeles.find((m) => m.value === choisi)?.quand ?? ""}</p>
        </div>

        <div className="admin-field">
          <label htmlFor="masse-objet" className="admin-label">
            Objet
          </label>
          {/* ⚠️ ENTRÉE NE SOUMET PAS — ET VOICI CE QUI EST ÉTABLI, ET CE QUI
              NE L'EST PAS. Je préfère écrire les deux plutôt que de laisser un
              commentaire affirmer un défaut que je n'ai pas su reproduire.

              CE QUI EST VRAI, par lecture : ce champ est le premier champ texte
              d'une ligne de ce `<form>` — qui ne contenait jusque-là que des
              cases à cocher et deux `select`. Il réveille donc la SOUMISSION
              IMPLICITE de HTML, qui active le premier bouton `submit` du
              formulaire en ordre de document. Ce bouton n'est pas le nôtre :
              c'est « Appliquer à la sélection », rendu plus haut par
              `FormulaireEnMasse`.

              🔴 CE QUI N'EST PAS ÉTABLI : que l'effet NUISIBLE se produise. La
              recette `reponse-en-masse.spec.ts` a été rejouée en RETIRANT cette
              ligne, et son test « Entrée ne rebascule pas la sélection » est
              resté VERT : aucun dossier n'a changé de statut. Cette garde ne
              rougit donc pas — elle ne prouve rien.

              🔑 Pourquoi je la garde quand même. Elle coûte une ligne, elle
              n'enlève aucun geste utile — le corps du message est un
              `<textarea>` où Entrée reste un retour à la ligne, et les `select`
              du geste de statut gardent leur soumission au clavier — et elle
              ferme une mécanique HTML réelle dont je ne sais pas dire POURQUOI
              elle reste inoffensive ici. Ne pas savoir pourquoi quelque chose
              ne casse pas est une mauvaise raison de compter dessus.

              ⚠️ Ce que ce commentaire ne doit PAS devenir : « on a corrigé un
              défaut ». Non. On a fermé une porte dont on n'a pas prouvé qu'elle
              menait quelque part. */}
          <input
            id="masse-objet"
            name="subject"
            className="admin-input"
            value={objet}
            onChange={(e) => {
              setObjet(e.target.value);
              setRetouche(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            maxLength={120}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="masse-corps" className="admin-label">
            Message
          </label>
          <textarea
            id="masse-corps"
            name="bodyMarkdown"
            className="admin-input"
            rows={10}
            value={corps}
            onChange={(e) => {
              setCorps(e.target.value);
              setRetouche(true);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
          {/* 🔑 `formAction` — ET IL FONCTIONNE, VÉRIFIÉ PAR L'INTERFACE.

              Un formulaire n'a qu'une action ; un bouton peut en imposer une
              autre. C'est ce qui permet au composeur de partager la sélection
              cochée avec le geste de statut sans que la table soit rendue deux
              fois.

              ⚠️ NE PAS remplacer par `type="button"` + un appel manuel à
              l'action. Je l'ai fait, en croyant que `formAction` ne remplaçait
              pas l'action du formulaire mais s'y ajoutait — et la mesure a dit
              l'inverse : c'est la version manuelle qui déclenche LES DEUX. Le
              témoin qui tranche est un dossier ÉCARTÉ dont le statut n'est pas
              `new` : avec `formAction` il ne bouge pas ; avec l'appel manuel il
              bascule à `reviewing` sans qu'aucune réponse ne lui soit écrite.
              La recette `reponse-en-masse.spec.ts` garde ce témoin.

              🔴 `admin-button` — la classe PRIMAIRE du système, et pas
              `admin-button-primary` que j'avais écrite : elle n'existe pas. Le
              système nomme `.admin-button`, `-secondary`, `-ghost`, `-danger`,
              `-cta`. Une classe inconnue ne casse RIEN à l'exécution — elle ne
              style simplement rien, et le bouton le plus dangereux de l'écran
              serait parti sans habillage. C'est la garde `admin-design-tokens`
              qui l'a vue, et elle ne l'a vue qu'au deuxième run : le premier
              s'arrêtait sur Prettier, quinze étapes plus tôt. */}
          <button
            type="submit"
            formAction={action}
            className="admin-button"
            disabled={enCours || dejaEnvoye}
            onClick={() => setRetouche(false)}
          >
            {enCours ? "Envoi…" : "Envoyer à la sélection"}
          </button>
          {dejaEnvoye ? (
            <span className="admin-meta-small">
              Ce message est parti. Modifier l’objet ou le texte pour en envoyer un autre.
            </span>
          ) : null}
        </div>

        {/* `role="status"` et non `alert` : un compte rendu d'envoi réussi n'est
            pas une alerte, et un lecteur d'écran qui interrompt tout à chaque
            geste finit par être coupé. */}
        {!etat.ok ? (
          <p className="admin-alert admin-alert-error" role="alert">
            {etat.error}
          </p>
        ) : total > 0 ? (
          <div className="admin-alert admin-alert-success" role="status">
            <p>
              {etat.envoyees} message{etat.envoyees > 1 ? "s" : ""} envoyé
              {etat.envoyees > 1 ? "s" : ""}
              {/* 🔴 LES TROIS NOMBRES NE SE MÉLANGENT JAMAIS. Un total unique
                  « 50 traitées » ferait croire à des messages partis qui ne le
                  sont pas — et c'est exactement ce qu'on relit quand un candidat
                  dit « je n'ai rien reçu ». */}
              {etat.ecartees > 0 ? ` · ${etat.ecartees} écarté${etat.ecartees > 1 ? "s" : ""}` : ""}
              {etat.echouees > 0
                ? ` · ${etat.echouees} en échec d’envoi, rejouable${etat.echouees > 1 ? "s" : ""} depuis la fiche`
                : ""}
              .
            </p>

            {etat.details.length > 0 ? (
              <ul className="mt-[var(--space-admin-2)]">
                {etat.details.map((d) => (
                  <li key={d.id} className="admin-meta-small">
                    {/* L'identifiant PLUTÔT que le nom : le compte rendu ne doit
                        pas remettre à l'écran l'identité de gens à qui on n'a
                        justement rien envoyé. Il suffit à retrouver la fiche. */}
                    <code>{d.id.slice(0, 8)}</code> — {PHRASE_MOTIF[d.motif]}
                    {d.variables.length > 0 ? ` (${d.variables.join(", ")})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
