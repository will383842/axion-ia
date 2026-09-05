"use client";
// use-client: éditeur de lignes (ajout/retrait/saisie) + Server Action.
/**
 * SessionJoursEditor — Saisie des journées RÉELLEMENT animées d'une session (D14).
 *
 * Sans cet écran, `session_jours` reste vide et la génération des créneaux
 * continue de supposer que les journées se suivent. Elles ne se suivent pas
 * toujours : un parcours de 4 journées réparties sur 3 mois produit alors 66
 * jours ouvrés au lieu de 4, un dénominateur multiplié par 16, un taux de
 * présence à ≈ 3 % et une attestation refusée à un stagiaire assidu.
 *
 * Accessibilité : `<input type="date">` et `<input type="time">` natifs — clavier
 * et lecteur d'écran fonctionnent sans une ligne de JS de notre part. Chaque
 * champ porte un label lié ; le bouton de retrait nomme la journée qu'il retire,
 * sinon un lecteur d'écran annonce cinq fois « Retirer ».
 */

import { useState, useTransition, useId } from "react";
import { useRouter } from "next/navigation";

export interface JourSaisi {
  date: string;
  heureDebut: string;
  heureFin: string;
}

export interface JourInitial extends JourSaisi {
  /** Faux tant que ce sont les horaires PROPOSÉS à la création de la session. */
  horairesConfirmes: boolean;
}

export interface SessionJoursEditorProps {
  sessionId: string;
  joursInitiaux: JourInitial[];
  /** Vrai si des créneaux ont déjà été générés — change ce qu'il faut avertir. */
  hasCreneaux: boolean;
  saveAction: (input: {
    sessionId: string;
    jours: JourSaisi[];
  }) => Promise<{ data: { nbJours: number } } | { error: string }>;
}

/** Empreinte stable d'une liste de journées, insensible à l'ordre de saisie. */
function clefComparaison(jours: JourSaisi[]): string {
  return JSON.stringify(
    [...jours]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((j) => [j.date, j.heureDebut, j.heureFin]),
  );
}

/** Horaires proposés à l'ajout d'une ligne. Modifiables — ce sont des valeurs de départ, pas une vérité. */
const HEURE_DEBUT_DEFAUT = "09:00";
const HEURE_FIN_DEFAUT = "17:00";

/**
 * Le bouton d'enregistrement est-il actif ?
 *
 * Extrait du composant pour être testable sans monter React — la règle a déjà
 * bloqué le parcours une fois, elle mérite mieux qu'une relecture à l'œil.
 *
 * Deux motifs INDÉPENDANTS d'enregistrer :
 * - `modifie` : l'admin a changé quelque chose ;
 * - `aConfirmer` : les journées sont encore des PROPOSITIONS, et les valider
 *   telles quelles est un geste à part entière — c'est lui qui fait passer
 *   `horairesConfirmes` à vrai. Sans ce second motif, une proposition juste
 *   était inconfirmable, et `emettreLiensSessionAction` refusait ensuite
 *   d'émettre le moindre lien (`horaires_non_confirmes`) : plus aucune
 *   signature possible sur la session.
 */
/**
 * 🔴 F8 — ce que « Confirmer ces journées » fait, et ce qu'il NE FAIT PAS.
 *
 * Constaté le 2026-09-04 : le suivi de dossier n'a qu'une étape, « Journées de
 * présence confirmées ». L'écran, lui, en a DEUX, séparées par un bloc entier :
 * « Confirmer ces journées » (→ « 1 journée enregistrée ») puis, plus bas,
 * « Générer les créneaux » (→ « 2 créneau(x) créés »). Le message de succès du
 * premier bouton s'arrêtait à son propre geste et laissait croire le travail
 * fini — alors que sans créneaux, les liens de signature partent et le
 * stagiaire arrive sur « Aucune demi-journée à signer ».
 *
 * On ne CHAÎNE pas les deux gestes : l'écran affirme explicitement, quelques
 * lignes plus bas, que modifier les journées ne recalcule PAS les créneaux
 * existants — « un créneau peut porter une signature, et rien ne distingue en
 * base une absence émargée d'un créneau vierge ». Générer d'office trahirait
 * cette décision. Le bouton dit donc ce qu'il a fait, et ce qu'il reste à
 * faire.
 *
 * Extrait du composant pour être testable sans monter React : c'est une phrase
 * qui décide si quelqu'un ira au bout de la chaîne probante.
 */
export function messageJoursEnregistrees(etat: { nbJours: number; hasCreneaux: boolean }): string {
  if (etat.nbJours === 0) {
    return "Aucune journée déclarée : la session retombe sur sa plage de dates.";
  }
  const pluriel = etat.nbJours > 1 ? "s" : "";
  const base = `${etat.nbJours} journée${pluriel} enregistrée${pluriel}.`;
  if (etat.hasCreneaux) {
    return `${base} Les créneaux de présence existent déjà et ne sont PAS recalculés : vérifiez plus bas, dans « Créneaux de présence », qu'ils correspondent à ces journées.`;
  }
  return `${base} Aucun créneau de présence n'existe encore — cet enregistrement n'en crée aucun. Tant qu'ils manquent, un lien de signature envoyé mène à « Aucune demi-journée à signer ». Prochain geste : « Générer les créneaux », dans la section « Créneaux de présence » ci-dessous.`;
}

export function peutEnregistrerJours(etat: {
  isPending: boolean;
  modifie: boolean;
  aDesHorairesNonConfirmes: boolean;
  nbJours: number;
}): boolean {
  if (etat.isPending) return false;
  if (etat.modifie) return true;
  return etat.aDesHorairesNonConfirmes && etat.nbJours > 0;
}

export function SessionJoursEditor({
  sessionId,
  joursInitiaux,
  hasCreneaux,
  saveAction,
}: SessionJoursEditorProps): React.ReactElement {
  const router = useRouter();
  const [jours, setJours] = useState<JourSaisi[]>(() =>
    joursInitiaux.map((j) => ({ date: j.date, heureDebut: j.heureDebut, heureFin: j.heureFin })),
  );
  // Des horaires seulement PROPOSÉS ne doivent jamais être présentés comme
  // constatés : c'est ce qui sépare cette génération automatique du
  // « 09h00–17h00 » codé en dur que ce chantier supprime.
  const aDesHorairesNonConfirmes = joursInitiaux.some((j) => !j.horairesConfirmes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const idBase = useId();

  // Comparaison sur une copie TRIÉE : la relecture serveur revient ordonnée par
  // date. Comparer l'ordre de saisie laisserait `modifie` à `true` pour toujours
  // dès que l'admin saisit ses journées dans le désordre — bouton « Enregistrer »
  // actif à vide, et avertissement orange affiché en même temps que le succès.
  const modifie = clefComparaison(jours) !== clefComparaison(joursInitiaux);

  // 🔴 Constat du parcours à blanc 2026-07-27 — impasse de confirmation.
  //
  // Les journées PROPOSÉES arrivent déjà dans `joursInitiaux`, donc `modifie`
  // est faux dès l'ouverture. Le bouton restait désactivé alors que l'écran
  // demande, en orange, de « vérifier les horaires réels, puis enregistrer ».
  // Autrement dit : quand la proposition automatique tombait JUSTE — le cas
  // nominal — il était impossible de la confirmer. Il fallait fausser un
  // horaire pour débloquer le bouton, puis le remettre. Rien ne partait en
  // base : ni feuille d'émargement, ni liens de signature.
  //
  // Confirmer un contenu inchangé est ici une ACTION à part entière, pas un
  // enregistrement à vide : c'est ce qui fait passer `horairesConfirmes` de
  // faux à vrai, et donc des horaires supposés à des horaires constatés.
  const aConfirmer = aDesHorairesNonConfirmes && jours.length > 0;

  function majJour(index: number, champ: keyof JourSaisi, valeur: string) {
    setSucces(null);
    setJours((prec) => prec.map((j, i) => (i === index ? { ...j, [champ]: valeur } : j)));
  }

  function ajouter() {
    setSucces(null);
    setJours((prec) => [
      ...prec,
      { date: "", heureDebut: HEURE_DEBUT_DEFAUT, heureFin: HEURE_FIN_DEFAUT },
    ]);
  }

  function retirer(index: number) {
    setSucces(null);
    setJours((prec) => prec.filter((_, i) => i !== index));
  }

  function enregistrer() {
    setError(null);
    setSucces(null);
    startTransition(async () => {
      const r = await saveAction({ sessionId, jours });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      // F8 — le message ne s'arrête plus au geste accompli : il dit aussi ce
      // qu'il RESTE à faire, sans quoi on croit la chaîne probante bouclée.
      setSucces(messageJoursEnregistrees({ nbJours: r.data.nbJours, hasCreneaux }));
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  // `.admin-input` est la classe maison (`admin.css`) — la recomposer à la main
  // ferait diverger ces champs du reste de la console au premier ajustement.
  const inputCls = "admin-input";

  return (
    <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Journées réellement animées
      </h2>
      <p className="mt-[var(--space-admin-1)] mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Déclarez ici chaque journée animée, avec ses horaires réels. Sans cette saisie, les créneaux
        sont déduits de la plage de dates de la session — ce qui est faux dès que les journées ne se
        suivent pas, et fausse alors le taux de présence. Les horaires figureront sur la feuille
        d&apos;émargement.
      </p>

      {/* 🔴 F8 — dire les DEUX gestes AVANT le clic, pas seulement après.
          Ce bouton enregistre des journées ; il ne crée aucun créneau. La
          deuxième moitié du travail vit sous un autre bloc, et le suivi de
          dossier n'a qu'UNE étape (« Journées de présence confirmées ») : il
          affichait donc « Fait » avec zéro créneau. */}
      {!hasCreneaux && (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          <strong>Deux gestes, pas un.</strong> Enregistrer les journées ne crée aucun créneau de
          présence : il faut ensuite « Générer les créneaux », plus bas. Sans créneaux, un lien de
          signature envoyé mène le stagiaire à « Aucune demi-journée à signer ».
        </p>
      )}

      {aDesHorairesNonConfirmes && (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          Ces journées ont été <strong>proposées automatiquement</strong> à partir de la durée de la
          formation. Vérifiez les dates et les horaires réels, puis enregistrez : ils figureront
          tels quels sur la feuille d&apos;émargement, qui est une pièce à valeur probante.
        </p>
      )}

      {jours.length === 0 ? (
        // ⚠️ Ce message disait « la session utilise sa plage de dates », ce qui
        // n'est plus vrai depuis que la feuille d'émargement et les liens de
        // signature exigent des horaires réels. Une session créée avant cette
        // évolution n'a aucune journée : il faut le dire, et dire quoi faire.
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
          <strong>Aucune journée déclarée.</strong> Les créneaux de présence retombent sur la plage
          de dates de la session, mais ni les liens de signature ni la feuille d&apos;émargement ne
          peuvent être produits : tous deux exigent des horaires réels. Ajoutez ci-dessous les
          journées effectivement animées.
        </p>
      ) : (
        <ul className="mb-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
          {jours.map((jour, index) => (
            // Index en clé : les lignes n'ont pas d'identité stable tant qu'elles
            // ne sont pas enregistrées, et une date vide ne peut pas servir de clé.
            <li
              key={`${idBase}-${index}`}
              className="grid grid-cols-1 items-end gap-[var(--space-admin-3)] sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <div>
                <label className={labelCls} htmlFor={`${idBase}-date-${index}`}>
                  Date
                </label>
                <input
                  id={`${idBase}-date-${index}`}
                  type="date"
                  required
                  className={inputCls}
                  value={jour.date}
                  onChange={(e) => majJour(index, "date", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${idBase}-debut-${index}`}>
                  Début
                </label>
                <input
                  id={`${idBase}-debut-${index}`}
                  type="time"
                  required
                  className={inputCls}
                  value={jour.heureDebut}
                  onChange={(e) => majJour(index, "heureDebut", e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor={`${idBase}-fin-${index}`}>
                  Fin
                </label>
                <input
                  id={`${idBase}-fin-${index}`}
                  type="time"
                  required
                  className={inputCls}
                  value={jour.heureFin}
                  onChange={(e) => majJour(index, "heureFin", e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => retirer(index)}
                className="admin-button-ghost text-[length:var(--text-admin-sm)]"
              >
                Retirer<span className="sr-only"> la journée {jour.date || `n° ${index + 1}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="button" onClick={ajouter} className="admin-button-ghost">
          Ajouter une journée
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={
            !peutEnregistrerJours({
              isPending,
              modifie,
              aDesHorairesNonConfirmes,
              nbJours: jours.length,
            })
          }
          className="admin-button"
        >
          {isPending
            ? "Enregistrement…"
            : !modifie && aConfirmer
              ? "Confirmer ces journées"
              : "Enregistrer les journées"}
        </button>
      </div>

      {hasCreneaux && modifie && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          Des créneaux ont déjà été générés pour cette session. Modifier les journées ne les
          recalcule pas et n&apos;en supprime aucun — c&apos;est volontaire : un créneau peut porter
          une signature, et rien ne distingue en base une absence émargée d&apos;un créneau vierge.
          Aucun écran ne permet aujourd&apos;hui de supprimer un créneau : le taux de présence
          restera calculé sur les créneaux existants. Prévenez la technique avant de vous fier au
          taux de cette session.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {succes && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {succes}
        </p>
      )}
    </section>
  );
}
