"use client";
// use-client: émission à la demande + copie presse-papier + Server Actions.
/**
 * LiensEmargement — émission et affichage des liens de signature (oubli O4).
 *
 * Le jeton existait et n'atteignait personne. Trois usages depuis cet écran :
 *
 *  · **Projeter un QR en salle** — chacun scanne et signe EN PARALLÈLE sur son
 *    propre téléphone. C'est le meilleur mode : douze signatures simultanées, et
 *    l'identification ne repose pas sur le formateur.
 *  · **Copier un lien** pour le coller dans le chat d'une visio (distanciel).
 *  · **Révoquer** tous les liens si la session est annulée ou reportée — sans
 *    quoi un stagiaire pourrait signer une session qui n'a pas eu lieu, et la
 *    signature serait cryptographiquement valide, ce qui est pire qu'inutile.
 *
 * ⚠️ Les liens ne sont PAS persistés en clair : la base n'en garde que le
 * SHA-256. Fermer cette page les perd définitivement. En réémettre révoque les
 * précédents — deux liens vivants rendraient la révocation illusoire.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface LienAffiche {
  enrollmentId: string;
  stagiaireNom: string;
  url: string;
  qr: string;
  expiresAt: string;
}

export interface LiensEmargementProps {
  sessionId: string;
  emettreAction: (input: {
    sessionId: string;
  }) => Promise<
    | { data: { liens: Array<Omit<LienAffiche, "expiresAt"> & { expiresAt: Date }> } }
    | { error: string }
  >;
  revoquerAction: (input: {
    sessionId: string;
    motif: string;
  }) => Promise<{ data: { revoques: number } } | { error: string }>;
}

export function LiensEmargement({
  sessionId,
  emettreAction,
  revoquerAction,
}: LiensEmargementProps): React.ReactElement {
  const router = useRouter();
  const [liens, setLiens] = useState<LienAffiche[] | null>(null);
  const [agrandi, setAgrandi] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function emettre() {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const r = await emettreAction({ sessionId });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setLiens(
        r.data.liens.map((l) => ({
          ...l,
          expiresAt: new Date(l.expiresAt).toLocaleString("fr-FR"),
        })),
      );
      router.refresh();
    });
  }

  function revoquer() {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const r = await revoquerAction({ sessionId, motif: "Révocation manuelle depuis la console" });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setLiens(null);
      setMessage(`${r.data.revoques} lien(s) révoqué(s). Les anciens liens ne signent plus.`);
      router.refresh();
    });
  }

  async function copier(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(id);
    } catch {
      // Le presse-papier peut être refusé (contexte non sécurisé, permission) :
      // on le dit plutôt que de laisser croire à une copie réussie.
      setErreur("Copie impossible. Sélectionnez le lien à la main.");
    }
  }

  return (
    <section className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        Liens de signature
      </h2>
      <p className="mt-[var(--space-admin-1)] mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Un lien personnel par stagiaire, valable jusqu&apos;à 48 h après la fin de session. Projetez
        le QR en salle : chacun scanne et signe sur son propre téléphone, en même temps. En
        distanciel, copiez le lien dans le chat de la visio.
      </p>

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <button type="button" onClick={emettre} disabled={isPending} className="admin-button">
          {isPending ? "Émission…" : liens === null ? "Émettre les liens" : "Réémettre"}
        </button>
        <button
          type="button"
          onClick={revoquer}
          disabled={isPending}
          className="admin-button-ghost"
        >
          Révoquer tous les liens
        </button>
      </div>

      {erreur !== null && (
        <p
          role="alert"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {erreur}
        </p>
      )}
      {message !== null && (
        <p
          role="status"
          className="mt-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {message}
        </p>
      )}

      {liens !== null && (
        <>
          <p
            role="status"
            className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
          >
            Ces liens ne sont affichés qu&apos;ici et ne sont pas conservés en clair. Si vous fermez
            cette page, il faudra en réémettre — ce qui invalidera ceux déjà distribués.
          </p>

          <ul className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
            {liens.map((l) => (
              <li
                key={l.enrollmentId}
                className="flex flex-wrap items-center gap-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
              >
                {/* Bouton et non `<img onClick>` : agrandir le QR pour le projeter
                    doit être atteignable au clavier. */}
                <button
                  type="button"
                  onClick={() => setAgrandi(agrandi === l.enrollmentId ? null : l.enrollmentId)}
                  aria-expanded={agrandi === l.enrollmentId}
                  className="rounded bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data-URL
                      générée à la volée, jamais servie par le pipeline d'images. */}
                  <img
                    src={l.qr}
                    alt={`QR code du lien de signature de ${l.stagiaireNom}`}
                    width={agrandi === l.enrollmentId ? 320 : 96}
                    height={agrandi === l.enrollmentId ? 320 : 96}
                  />
                  <span className="sr-only">
                    {agrandi === l.enrollmentId ? "Réduire" : "Agrandir pour projeter"}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[color:var(--color-admin-fg)]">{l.stagiaireNom}</p>
                  <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                    Valable jusqu&apos;au {l.expiresAt}
                  </p>
                  <p className="mt-1 truncate text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                    {l.url}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void copier(l.url, l.enrollmentId)}
                  className="admin-button-ghost text-[length:var(--text-admin-sm)]"
                >
                  {copie === l.enrollmentId ? "Copié" : "Copier le lien"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
