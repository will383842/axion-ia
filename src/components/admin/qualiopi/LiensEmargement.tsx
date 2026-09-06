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
 * ⚠️ Les liens ne sont PAS persistés en clair EN BASE : elle n'en garde que le
 * SHA-256. En réémettre révoque les précédents — deux liens vivants rendraient
 * la révocation illusoire.
 *
 * 🔴 F9 (2026-09-05) — ils vivaient dans un `useState`, donc dans la mémoire
 * d'un composant démonté à la PREMIÈRE navigation. Le chemin naturel — émettre,
 * aller chercher l'adresse d'un stagiaire, revenir — les détruisait, et il
 * fallait réémettre, ce qui invalide ceux déjà distribués. Ils sont désormais
 * conservés dans le `sessionStorage` de l'ONGLET (`liens-emargement-memoire.ts`),
 * jamais envoyés nulle part : le serveur ne stocke toujours que l'empreinte, et
 * fermer l'onglet les perd toujours. C'est la navigation interne qui cesse de
 * détruire.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clefMemoireLiens,
  lireLiensMemorises,
  serialiserLiens,
  type LienMemorise,
} from "@/components/admin/qualiopi/liens-emargement-memoire";

export interface LienAffiche {
  enrollmentId: string;
  stagiaireNom: string;
  url: string;
  qr: string;
  expiresAt: string;
}

export interface LiensEmargementProps {
  sessionId: string;
  /**
   * Des créneaux existent-ils ? Sans eux, les liens partent quand même — mais
   * le stagiaire arrive sur « Aucune demi-journée à signer ». On prévient
   * l'admin AVANT l'envoi plutôt que de le laisser diffuser des liens vides.
   */
  hasCreneaux?: boolean;
  emettreAction: (input: { sessionId: string }) => Promise<
    | {
        data: {
          liens: Array<Omit<LienAffiche, "expiresAt"> & { expiresAt: Date }>;
          erreurPartielle: string | null;
        };
      }
    | { error: string }
  >;
  revoquerAction: (input: {
    sessionId: string;
    motif: string;
  }) => Promise<{ data: { revoques: number } } | { error: string }>;
  /**
   * 🔴 L'ENVOI — il n'existait pas. `emettreAction` fabriquait le lien et
   * l'affichait ; rien ne partait jamais. Constaté sur AXI-SESS-2026-005 : la
   * stagiaire n'a jamais pu émarger, et le seul écran qui aurait pu le dire
   * affichait un lien parfaitement valide.
   *
   * Geste SÉPARÉ de l'émission : réémettre révoque les jetons précédents, donc
   * un envoi implicite à chaque affichage de l'écran enverrait des salves dont
   * chacune annulerait la précédente.
   */
  envoyerAction: (input: {
    sessionId: string;
    enrollmentId?: string;
  }) => Promise<
    | { data: { envoyes: number; echecs: Array<{ stagiaireNom: string; motif: string }> } }
    | { error: string }
  >;
}

export function LiensEmargement({
  sessionId,
  hasCreneaux,
  emettreAction,
  revoquerAction,
  envoyerAction,
}: LiensEmargementProps): React.ReactElement {
  const router = useRouter();
  // 🔴 F9 — les liens survivent à une navigation DANS la console.
  //
  // Ils restent hors de la base (le serveur n'a que le SHA-256) et hors de tout
  // envoi : `sessionStorage` est propre à l'onglet et meurt avec lui. Le
  // premier rendu part vide et la relecture se fait dans un `useEffect` :
  // toucher `sessionStorage` pendant le rendu ferait diverger le HTML du
  // serveur de celui du client, et React 19 ne recolle pas une divergence
  // (« This won't be patched up »).
  const [liens, setLiens] = useState<LienAffiche[] | null>(null);
  const clef = clefMemoireLiens(sessionId);

  function memoriser(valeur: readonly LienMemorise[] | null) {
    // Un `sessionStorage` peut LEVER, pas seulement rendre null (navigation
    // privée, stockage désactivé, quota). Perdre la mémoire du lien est
    // acceptable ; faire tomber l'écran d'émargement le jour de la session ne
    // l'est pas.
    try {
      if (valeur === null) window.sessionStorage.removeItem(clef);
      else window.sessionStorage.setItem(clef, serialiserLiens(valeur));
    } catch {
      /* mémoire indisponible : l'écran reste utilisable, sans persistance. */
    }
  }

  // Restauration depuis `sessionStorage` — microtask defer pour
  // `react-hooks/set-state-in-effect`.
  //
  // 🔴 Cette relecture DOIT rester dans un effet, et pas dans un initialiseur
  // paresseux de `useState` : ce composant est rendu côté SERVEUR au premier
  // passage, où `sessionStorage` n'existe pas. Un initialiseur rendrait donc du
  // vide au serveur et les liens au client — une divergence d'hydratation sur
  // le contenu même de l'écran.
  //
  // Le `queueMicrotask` est le patron déjà employé dans ce dépôt pour exactement
  // ce cas (`AdminSidebarNav`, restauration depuis `localStorage`) : il évite le
  // rendu en cascade que la règle vise, sans supprimer la règle. Le drapeau
  // `cancelled` évite d'écrire sur un composant démonté entre-temps.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let brut: string | null = null;
      try {
        brut = window.sessionStorage.getItem(clef);
      } catch {
        brut = null;
      }
      const repris = lireLiensMemorises(brut, new Date());
      if (repris === null) {
        // Purge une entrée entièrement expirée : garder un QR mort est pire
        // qu'un écran vide — on le projette en salle et personne ne peut signer.
        if (brut !== null) memoriser(null);
        return;
      }
      setLiens(
        repris.map((l) => ({
          enrollmentId: l.enrollmentId,
          stagiaireNom: l.stagiaireNom,
          url: l.url,
          qr: l.qr,
          expiresAt: new Date(l.expiresAtIso).toLocaleString("fr-FR"),
        })),
      );
    });
    return () => {
      cancelled = true;
    };
    // `clef` dérive de `sessionId` : la relecture doit rejouer si l'écran passe
    // d'une session à une autre sans démontage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef]);
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
      memoriser(
        r.data.liens.map((l) => ({
          enrollmentId: l.enrollmentId,
          stagiaireNom: l.stagiaireNom,
          url: l.url,
          qr: l.qr,
          expiresAtIso: new Date(l.expiresAt).toISOString(),
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
      // Un lien révoqué ne signe plus : le garder en mémoire ferait rouvrir
      // l'écran sur des QR morts, exactement ce que la révocation veut éviter.
      memoriser(null);
      setMessage(
        `${r.data.revoques} lien${r.data.revoques > 1 ? "s" : ""} révoqué${r.data.revoques > 1 ? "s" : ""}. Les anciens liens ne signent plus.`,
      );
      router.refresh();
    });
  }

  /**
   * Envoie le lien par e-mail — à tous, ou à une seule personne.
   *
   * ⚠️ Chaque envoi émet un jeton NEUF et révoque le précédent du même
   * stagiaire. Le texte de l'écran le dit : sans cela, un admin qui renvoie à
   * un retardataire croirait laisser les autres liens intacts.
   */
  function envoyer(enrollmentId?: string) {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const r = await envoyerAction(
        enrollmentId === undefined ? { sessionId } : { sessionId, enrollmentId },
      );
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      // 🔴 Les échecs sont NOMMÉS. « 3 envoyés » sur 4 stagiaires laisserait
      // chercher lequel manque — sur une pièce probante, c'est inacceptable.
      const echecs = r.data.echecs;
      setMessage(
        `${r.data.envoyes} lien${r.data.envoyes > 1 ? "s" : ""} envoyé${r.data.envoyes > 1 ? "s" : ""}.` +
          (echecs.length > 0
            ? ` Non envoyé à : ${echecs.map((e) => `${e.stagiaireNom} (${e.motif})`).join(" · ")}`
            : ""),
      );
      // L'envoi a émis de nouveaux jetons : les liens affichés sont périmés.
      setLiens(null);
      memoriser(null);
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
      {/* UI 2026-07-27 — l'émission ne vérifie NI les journées NI les
          créneaux : les liens partaient, et le stagiaire tombait sur « Aucune
          demi-journée à signer ». Un lien envoyé ne se reprend pas ; on avertit
          donc avant, sans bloquer — envoyer les liens en avance reste un usage
          légitime tant qu'on sait ce qu'on fait. */}
      {hasCreneaux === false && (
        <p
          role="status"
          className="mt-[var(--space-admin-2)] rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-warning-soft)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          <strong>Aucun créneau n&apos;existe encore.</strong> Les liens partiront, mais le
          stagiaire verra « Aucune demi-journée à signer ». Déclarez les journées puis générez les
          créneaux avant d&apos;envoyer.
        </p>
      )}
      <p className="mt-[var(--space-admin-1)] mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Un lien personnel par stagiaire, valable jusqu&apos;à 48 h après la fin de session.
        Envoyez-les <strong>avant</strong> la session : chacun arrive avec son lien et signe sur son
        propre téléphone, tous en même temps. Le QR sert de rattrapage pour qui a perdu le sien — il
        est personnel, il ne se projette pas pour toute la salle. En distanciel, copiez le lien dans
        le chat de la visio.
      </p>
      {/*
        🔴 2026-09-06 — dire ce que « Émettre » ne fait PAS, et ce qu'il coûte.
        « Émettre » fabrique et affiche ; il n'envoie rien. Un admin qui s'arrête
        là croit ses stagiaires servis : c'est ce qui est arrivé sur
        AXI-SESS-2026-001, où personne n'a pu émarger. Depuis, le cron horaire
        rattrape ce cas — mais en réémettant, donc en tuant le QR déjà imprimé.
        Ce résidu ne se corrige pas en code : il se DIT, ici, avant le clic.
      */}
      <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        <strong>« Émettre » n&apos;envoie rien</strong> : le bouton fabrique les liens et affiche
        les QR, c&apos;est tout. Pour que les stagiaires les reçoivent, cliquez «&nbsp;Envoyer les
        liens par e-mail&nbsp;». Si vous imprimez un QR sans envoyer, le rattrapage automatique du
        jour J enverra les liens — et <strong>le QR imprimé cessera alors de fonctionner</strong>,
        chaque envoi révoquant le lien précédent.
      </p>

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <button type="button" onClick={emettre} disabled={isPending} className="admin-button">
          {isPending ? "Émission…" : liens === null ? "Émettre les liens" : "Réémettre"}
        </button>
        <button
          type="button"
          onClick={() => envoyer()}
          disabled={isPending}
          className="admin-button"
        >
          {isPending ? "Envoi…" : "Envoyer les liens par e-mail"}
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
      <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Envoyer produit un lien neuf pour chaque destinataire et{" "}
        <strong>invalide le lien précédent</strong> de cette personne. Un stagiaire qui avait déjà
        reçu le sien devra utiliser le nouveau.
      </p>

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
            Ces liens ne sont pas conservés en clair côté serveur : la base n&apos;en garde que
            l&apos;empreinte. Ils restent affichés ici tant que <strong>cet onglet</strong> est
            ouvert — vous pouvez donc aller consulter une fiche et revenir sans les perdre. Fermer
            l&apos;onglet les perd définitivement, et il faut alors en réémettre — ce qui invalide
            ceux déjà distribués.
          </p>

          <ul className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-3)]">
            {liens.map((l) => (
              <li
                key={l.enrollmentId}
                className="flex flex-wrap items-center gap-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-3)]"
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
                    data-clarity-mask="true"
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
                  {/* ⚠️ `data-clarity-mask` : la console admin hérite elle aussi
                      des scripts du layout racine, et Clarity enregistre le DOM.
                      Sans ce masque, un admin ayant accepté les cookies fait
                      archiver N liens de signature rejouables chez Microsoft,
                      hors UE. Le QR ci-dessus porte la même valeur, d'où le
                      masque sur le conteneur entier. */}
                  <p
                    data-clarity-mask="true"
                    title={l.url}
                    className="mt-1 truncate text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]"
                  >
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
