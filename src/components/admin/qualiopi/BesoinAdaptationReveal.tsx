"use client";

/**
 * Révélation à la demande du besoin d'adaptation déclaré par un bénéficiaire.
 *
 * ## Pourquoi un bouton et non un affichage
 *
 * C'est une donnée de SANTÉ (RGPD art. 9). L'afficher d'emblée l'exposerait à
 * quiconque passe devant l'écran et la ferait entrer dans le HTML de chaque
 * consultation de fiche. Ici il faut un geste délibéré — et ce geste est
 * journalisé côté serveur (`qualiopi.trainee.besoin_adaptation.lu`), ce qui
 * rend l'accès auditable. Une donnée de santé lue sans trace n'est pas
 * conforme.
 *
 * ## Ce que le composant NE fait pas
 *
 * Il ne reçoit jamais le besoin en props : le serveur ne l'envoie qu'en réponse
 * à l'action, après vérification du rôle. Rendre la valeur en props l'aurait
 * placée dans la charge utile de la page pour tout admin, ce qui aurait vidé
 * la restriction de son sens.
 */

import { useState, useTransition } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

type Resultat = { data: { besoin: string | null } } | { error: string };

export function BesoinAdaptationReveal({
  traineeId,
  lireAction,
}: {
  traineeId: string;
  lireAction: (input: { traineeId: string }) => Promise<Resultat>;
}): React.ReactElement {
  const [besoin, setBesoin] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [affiche, setAffiche] = useState(false);
  const [enCours, demarrer] = useTransition();

  function basculer() {
    if (affiche) {
      // On oublie la valeur en la masquant : la laisser en mémoire du
      // composant n'apporterait rien et prolongerait son exposition.
      setBesoin(null);
      setErreur(null);
      setAffiche(false);
      return;
    }
    demarrer(async () => {
      const r = await lireAction({ traineeId });
      if ("error" in r) {
        setErreur(r.error);
        setAffiche(true);
        return;
      }
      setBesoin(r.data.besoin);
      setErreur(null);
      setAffiche(true);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        className="inline-flex items-center gap-2 rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-3 py-2 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] disabled:opacity-60"
      >
        {enCours ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : affiche ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
        {affiche ? "Masquer le besoin" : "Afficher le besoin déclaré"}
      </button>

      {/*
        `aria-live` : le besoin apparaît après un aller-retour serveur. Sans
        région vivante, un lecteur d'écran ne signalerait rien — le bouton
        semblerait sans effet.
      */}
      <div aria-live="polite" className="mt-[var(--space-admin-2)]">
        {affiche && erreur ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
            {erreur}
          </p>
        ) : null}
        {affiche && !erreur ? (
          besoin ? (
            <>
              <p className="rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-surface-2)] p-3 text-[length:var(--text-admin-sm)] whitespace-pre-wrap text-[color:var(--color-admin-fg)]">
                {besoin}
              </p>
              <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Cette consultation a été enregistrée dans le journal d’activité.
              </p>
            </>
          ) : (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucun détail n’a été saisi — seule la situation a été signalée.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}
