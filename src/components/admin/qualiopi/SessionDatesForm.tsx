"use client";
// use-client: état local des deux champs + useTransition pour setSessionDatesAction. router.refresh() après succès.

/**
 * SessionDatesForm — Correction des dates de déroulement depuis la fiche session.
 *
 * Raison d&apos;être : jusqu&apos;ici, `dateDebut` et `dateFin` n&apos;étaient
 * écrites qu&apos;à la CRÉATION. Une coquille — un « 09 » pour un « 10 » — ne se
 * corrigeait que par « Reporter », qui crée une seconde session et laisse la
 * première au registre en statut « Reportée ». Pour une faute de frappe, cela
 * verse au registre légal la trace d&apos;un report qui n&apos;a jamais eu lieu.
 *
 * ⚠️ Vocabulaire : cet écran dit « Modifier les dates », JAMAIS « Reporter ».
 * Les dates sont un ATTRIBUT de la session ; le report est un ÉVÉNEMENT de son
 * cycle de vie, avec ses propres conséquences (migration des inscriptions,
 * nouvelle session). Confondre les deux mots ferait choisir le mauvais geste.
 *
 * 🔴 La garde serveur n&apos;interdit pas : quand des pièces s&apos;appuient déjà
 * sur ces dates, elle EXIGE un motif écrit. Ce composant révèle alors le champ
 * de motif, avec le texte exact de ce qui est en jeu.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setSessionDatesAction } from "@/server/actions/qualiopi/sessions";

export interface SessionDatesFormProps {
  sessionId: string;
  /**
   * Valeurs actuelles au format `<input type="datetime-local">`
   * (`AAAA-MM-JJTHH:MM`), calculées côté serveur en heure de PARIS.
   *
   * ⚠️ Volontairement des chaînes, pas des `Date` : formater côté client
   * exposerait au fuseau du navigateur et ferait diverger le rendu serveur du
   * rendu client (erreur d&apos;hydratation) sur un poste hors Europe/Paris.
   */
  initialDateDebut: string;
  initialDateFin: string;
  /**
   * 🔴 Journées déclarées qui tombent HORS de la plage actuelle, comptées côté
   * serveur au rendu.
   *
   * Corriger les dates ne décale PAS les `SessionJour` — décision documentée
   * dans `sessions/requalification-dates.ts`. Le prix de cette décision est une
   * divergence, et une divergence qui ne se voit pas est un piège : cet
   * avertissement reste affiché tant qu'elle dure, pas seulement à
   * l'enregistrement.
   */
  joursHorsPlage: number;
  /** Total des journées déclarées, pour situer le chiffre ci-dessus. */
  nbJoursDeclares: number;
  /** Lien vers la sous-page Émargement, où les journées se corrigent. */
  hrefJournees: string;
}

export function SessionDatesForm({
  sessionId,
  initialDateDebut,
  initialDateFin,
  joursHorsPlage,
  nbJoursDeclares,
  hrefJournees,
}: SessionDatesFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateDebut, setDateDebut] = useState(initialDateDebut);
  const [dateFin, setDateFin] = useState(initialDateFin);
  const [motif, setMotif] = useState("");
  // Passe à `true` quand le serveur a refusé faute de motif. On ne l&apos;affiche
  // pas d&apos;emblée : sur une session vierge, réclamer un motif transformerait
  // une correction de coquille en cérémonie — exactement ce qu&apos;on évite.
  const [motifRequis, setMotifRequis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const modifie = dateDebut !== initialDateDebut || dateFin !== initialDateFin;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await setSessionDatesAction({
        id: sessionId,
        // Même conversion que `SessionForm` à la création : la chaîne
        // `datetime-local` est lue dans le fuseau du navigateur.
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        ...(motif.trim() !== "" ? { motifRequalification: motif.trim() } : {}),
      });
      if ("error" in result) {
        setError(result.error);
        // Le message de la garde NOMME les pièces en jeu. C&apos;est lui qui
        // justifie l&apos;apparition du champ de motif : sans cette phrase,
        // demander un motif ressemblerait à une formalité arbitraire.
        if (result.error.includes("motif de la correction")) setMotifRequis(true);
        return;
      }
      setMotif("");
      setMotifRequis(false);
      setSuccessMsg(
        "Dates enregistrées. Les documents déjà générés ne changent pas — réémettre la convention, la convocation ou la feuille d'émargement pour qu'ils le portent." +
          (result.data.joursHorsPlage > 0
            ? ` Attention : ${result.data.joursHorsPlage} journée${result.data.joursHorsPlage > 1 ? "s" : ""} déclarée${result.data.joursHorsPlage > 1 ? "s" : ""} sur ${result.data.nbJours} tombe${result.data.joursHorsPlage > 1 ? "nt" : ""} désormais HORS de cette plage : les journées ne sont pas décalées automatiquement. Corrigez-les dans « Journées réellement animées », sous-page Émargement.`
            : ""),
      );
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Corrigez ici une plage saisie de travers. Ce n&apos;est PAS un report :{" "}
        <strong>rien n&apos;est créé, rien n&apos;est migré</strong>, la session reste la même au
        registre. Pour décaler réellement une session et prévenir les inscrits, utilisez « Reporter
        » dans <em>Cycle de vie</em>.
      </p>

      <div className="mb-[var(--space-admin-4)] grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="session-dates-debut">
            Date et heure de début
          </label>
          <input
            id="session-dates-debut"
            type="datetime-local"
            required
            disabled={isPending}
            className="admin-input"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="session-dates-fin">
            Date et heure de fin
          </label>
          <input
            id="session-dates-fin"
            type="datetime-local"
            required
            disabled={isPending}
            className="admin-input"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>

      {motifRequis && (
        <div className="mb-[var(--space-admin-4)]">
          <label className={labelCls} htmlFor="session-dates-motif">
            Motif de la correction (versé au journal)
          </label>
          <textarea
            id="session-dates-motif"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            disabled={isPending}
            className="admin-input"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : erreur de saisie à la création, la session s'est tenue les 10 et 11 septembre."
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            C&apos;est cette phrase que l&apos;auditeur lira pour comprendre pourquoi la pièce déjà
            émise et le dossier ne disent plus la même chose. Écrivez-la pour lui.
          </p>
        </div>
      )}

      {/* 🔴 Ce qui NE SUIT PAS la correction. Dit AVANT d'enregistrer, pas
          après : c'est ce qui permet de choisir entre corriger et reporter. */}
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Les documents déjà générés ne changent pas — réémettre la convention, la convocation ou la
        feuille d&apos;émargement pour qu&apos;ils le portent. Les{" "}
        <strong>journées réellement animées</strong> et les créneaux de présence ne sont pas décalés
        non plus : une session de quatre journées étalées sur trois mois n&apos;a aucun décalage
        commun avec sa plage, et un créneau peut déjà porter une signature. Vérifiez-les dans{" "}
        <a
          href={hrefJournees}
          className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          Journées réellement animées
        </a>{" "}
        après cette correction.
      </p>

      {/* 🔴 La divergence, rendue VISIBLE et PERMANENTE. Elle survit au
          rechargement : un avertissement qui ne s'affiche qu'une fois, juste
          après l'enregistrement, n'est vu que par celui qui a cliqué. */}
      {joursHorsPlage > 0 && (
        <p
          role="status"
          className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          <strong>
            {joursHorsPlage} journée{joursHorsPlage > 1 ? "s" : ""} déclarée
            {joursHorsPlage > 1 ? "s" : ""} sur {nbJoursDeclares} tombe
            {joursHorsPlage > 1 ? "nt" : ""} hors de cette plage.
          </strong>{" "}
          La session et ses journées ne disent plus la même chose. La feuille d&apos;émargement
          imprime les JOURNÉES, pas la plage : corrigez-les dans{" "}
          <a
            href={hrefJournees}
            className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
          >
            Journées réellement animées
          </a>
          , ou corrigez la plage ci-dessus si c&apos;est elle qui est fausse.
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg !== null && (
        <p
          role="status"
          className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
        >
          {successMsg}
        </p>
      )}

      <button type="submit" disabled={isPending || !modifie} className="admin-button">
        {isPending ? "Enregistrement…" : "Modifier les dates"}
      </button>
    </form>
  );
}
