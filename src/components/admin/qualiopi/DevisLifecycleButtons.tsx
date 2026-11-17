"use client";
// use-client: boutons conditionnels de cycle de vie d'un devis (sendDevisAction / acceptDevisAction / declineDevisAction) selon le statut courant. useTransition + router.refresh().

/**
 * DevisLifecycleButtons — Boutons du cycle de vie d&apos;un devis commercial.
 *
 * Affichage conditionnel selon le statut :
 *   - brouillon : « Envoyer au client » → sendDevisAction, APRÈS confirmation (destinataire,
 *                 montant). Devis classique sans e-mail de contact : une note remplace le bouton ;
 *                 « Remis en main propre… » (devis classique seulement) →
 *                 marquerRemisEnMainPropreAction, après confirmation (dialogue `useConfirmation`, pas de boîte native).
 *   - envoye    : (client signé, organisme pas encore : une note renvoie à la contresignature ;
 *                 signé des deux parties : seul « Marquer accepté » reste, pour finir l'acceptation)
 *                 « Marquer accepté » → acceptDevisAction
 *                 « Marquer refusé »  → declineDevisAction
 *                 « Corriger et renvoyer » (classique, non signé par le client) →
 *                 reviseDevisAction après confirmation, puis écran /corriger.
 *   - autres    : aucun bouton (terminal).
 *
 * router.refresh() après chaque succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { messageEnvoi, type TonMessage } from "@/server/qualiopi/financements/message-envoi";
import {
  sendDevisAction,
  reviseDevisAction,
  acceptDevisAction,
  declineDevisAction,
  transformDevisToConventionAction,
} from "@/server/actions/qualiopi/devis";
import { marquerRemisEnMainPropreAction } from "@/server/actions/qualiopi/devis-remis-main-propre";
import { useConfirmation } from "@/components/admin/ui/useConfirmation";
import { envoyerDevisEmailAction } from "@/server/actions/qualiopi/facturation-emails";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DevisStatut =
  "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";

export interface DevisLifecycleButtonsProps {
  devisId: string;
  statut: DevisStatut;
  /** Devis classique (ni offre ni empreinte) : seul à pouvoir être remis en main propre. */
  estClassique?: boolean;
  /** Numéro du devis, affiché dans la confirmation. */
  numero?: string;
  /** Montant HT déjà formaté côté serveur, affiché dans la confirmation d'envoi. */
  montantHtLabel?: string;
  /** Adresse e-mail du contact du client, ou `null` s'il n'en a pas. */
  destinataire?: string | null;
  /** Le client a déjà signé : « Corriger et renvoyer » n'est plus proposé. */
  clientASigne?: boolean;
  /** Le client a signé (non révoquée, pièce non annulée) et l'organisme pas encore : il ne reste qu'à contresigner. */
  signeParClient?: boolean;
  /** Les deux parties ont signé mais le statut est encore « envoyé » : l'acceptation est à finir. */
  signeDesDeuxParties?: boolean;
  /**
   * Devis À FORMULES signé des deux parties, resté « envoyé » : la reprise se fait par le bloc
   * « relancer l'acceptation » de la fiche. Aucune action de cycle de vie n'est proposée ici
   * (`acceptDevisAction` refuserait de toute façon).
   */
  repriseParRelance?: boolean;
}

type MotifRemise = "sans_email" | "adresse_bloquee" | "remis_en_rendez_vous";

const MOTIFS_REMISE: ReadonlyArray<{ valeur: MotifRemise; libelle: string }> = [
  { valeur: "sans_email", libelle: "Le client n'a pas d'adresse e-mail" },
  { valeur: "adresse_bloquee", libelle: "L'adresse e-mail est bloquée" },
  { valeur: "remis_en_rendez_vous", libelle: "Remis lors d'un rendez-vous" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function DevisLifecycleButtons({
  devisId,
  statut,
  estClassique = false,
  numero,
  montantHtLabel,
  destinataire = null,
  clientASigne = false,
  signeParClient = false,
  signeDesDeuxParties = false,
  repriseParRelance = false,
}: DevisLifecycleButtonsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // 🔴 Lot 3quinquies §2 — le TON du dernier message. Un envoi GARÉ pour
  // validation n'est ni un succès ni une erreur : c'est un troisième cas,
  // qui appelle un geste humain. Le confondre avec un succès envoie l'admin
  // exactement là où il ne faut pas — il n'ira pas valider la corbeille.
  const [ton, setTon] = useState<TonMessage>("succes");
  // Avertissement : action réussie côté statut, mais l'email n'est PAS parti
  // (pas d'email de contact, PDF absent, file d'attente indisponible). À NE PAS
  // afficher en vert « succès » — sinon l'admin croit le devis reçu par le client.
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const { demander, dialogue } = useConfirmation();
  // `useConfirmation` ne propose pas de choix DANS le dialogue : le motif se choisit ici,
  // à côté du bouton, puis la confirmation est simple.
  const [motifRemise, setMotifRemise] = useState<MotifRemise>("sans_email");

  function resetMessages() {
    setError(null);
    setSuccessMsg(null);
    setTon("succes");
    setWarningMsg(null);
  }

  function handleSend() {
    const montant = montantHtLabel !== undefined ? ` (${montantHtLabel} HT)` : "";
    const vers = destinataire ? ` à ${destinataire}` : " au client";
    demander(
      {
        titre: `Envoyer le devis${numero ? ` ${numero}` : ""} ?`,
        description: `Envoyer le devis${numero ? ` ${numero}` : ""}${montant}${vers} ? Le PDF et le lien de signature partent au client, ou attendent votre validation dans Emails → À valider.`,
        libelleConfirmer: "Envoyer",
      },
      () => {
        resetMessages();
        startTransition(async () => {
          const result = await sendDevisAction(devisId);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          // Un envoi réussi part toujours avec PDF et lien (sinon l'action refuse). Seul cas
          // à part : le courriel est GARÉ, il n'est pas encore parti — ce n'est pas un succès.
          if (result.data.garePourValidation === true) {
            setWarningMsg(
              result.data.note ??
                "Devis marqué envoyé. L'e-mail attend votre validation dans Emails → À valider.",
            );
          } else {
            setSuccessMsg("Devis envoyé au client par email (PDF joint + lien de signature).");
          }
          router.refresh();
        });
      },
    );
  }

  function handleCorriger() {
    demander(
      {
        titre: `Corriger et renvoyer le devis${numero ? ` ${numero}` : ""} ?`,
        description:
          "Une nouvelle version en brouillon est créée. L'ancien lien de signature reste valable jusqu'à l'envoi de la nouvelle version, qui le désactivera.",
        libelleConfirmer: "Créer la nouvelle version",
      },
      () => {
        resetMessages();
        startTransition(async () => {
          const result = await reviseDevisAction(devisId);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          // Même préfixe que la fiche courante : on remplace le dernier segment (l'identifiant).
          const base = window.location.pathname.replace(/\/[^/]+\/?$/, "");
          router.push(`${base}/${result.data.id}/corriger`);
        });
      },
    );
  }

  function handleRemisMainPropre() {
    const motif = motifRemise;
    const libelle = MOTIFS_REMISE.find((m) => m.valeur === motif)?.libelle ?? "";
    demander(
      {
        titre: `Remettre le devis${numero ? ` ${numero}` : ""} en main propre ?`,
        description: `Motif : ${libelle}. Le PDF numéroté est créé et le devis passe « envoyé » sans aucun e-mail ni lien de signature. Faites signer le devis papier, puis « Marquer accepté ».`,
        libelleConfirmer: "Confirmer",
      },
      () => {
        resetMessages();
        startTransition(async () => {
          const result = await marquerRemisEnMainPropreAction({ id: devisId, motif });
          if ("error" in result) {
            setError(result.error);
          } else {
            setSuccessMsg(
              "Devis marqué remis en main propre. Faites-le signer sur papier, puis « Marquer accepté ».",
            );
            router.refresh();
          }
        });
      },
    );
  }

  function handleResend() {
    resetMessages();
    startTransition(async () => {
      const result = await envoyerDevisEmailAction({ devisId });
      if ("error" in result) {
        setError(result.error);
      } else {
        // L'action calcule DÉJÀ la phrase juste (`note`) — on la relaie au
        // lieu d'en inventer une autre : deux phrases pour le même fait
        // divergent, et c'est celle de l'écran, la moins informée, qui
        // gagnerait.
        const m = messageEnvoi("Devis", result.data);
        setTon(m.ton);
        setSuccessMsg(m.texte);
        router.refresh();
      }
    });
  }

  function handleAccept() {
    resetMessages();
    startTransition(async () => {
      const result = await acceptDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis accepté.");
        router.refresh();
      }
    });
  }

  function handleDecline() {
    resetMessages();
    startTransition(async () => {
      const result = await declineDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis refusé.");
        router.refresh();
      }
    });
  }

  function handleTransform() {
    resetMessages();
    startTransition(async () => {
      const result = await transformDevisToConventionAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis transformé en convention — créez la session liée.");
        router.refresh();
      }
    });
  }

  // Statuts terminaux : aucune action disponible (sauf accepté → transformer)
  if (statut !== "brouillon" && statut !== "envoye" && statut !== "accepte") {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Aucune action disponible pour ce statut.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {dialogue}
      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        {statut === "brouillon" && !(estClassique && !destinataire) && (
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="admin-button"
            aria-label="Marquer le devis comme envoyé au client"
          >
            {isPending ? "…" : "Envoyer au client"}
          </button>
        )}
        {statut === "brouillon" && estClassique && !destinataire && (
          <p
            data-testid="note-sans-adresse"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Ce client n&apos;a pas d&apos;adresse e-mail.
          </p>
        )}

        {statut === "brouillon" && estClassique && (
          <>
            <label className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
              <span>Motif</span>
              <select
                value={motifRemise}
                onChange={(e) => setMotifRemise(e.target.value as MotifRemise)}
                disabled={isPending}
                className="admin-input"
              >
                {MOTIFS_REMISE.map((m) => (
                  <option key={m.valeur} value={m.valeur}>
                    {m.libelle}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleRemisMainPropre}
              disabled={isPending}
              className="admin-button-secondary"
              aria-label="Remis en main propre : remettre le devis sans e-mail ni lien de signature"
            >
              {isPending ? "…" : "Remis en main propre…"}
            </button>
          </>
        )}

        {statut === "brouillon" && (
          <a
            href={`/api/qualiopi/devis/${devisId}/apercu`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-button"
            aria-label="Ouvrir l'aperçu PDF du brouillon (aucune pièce numérotée créée, rien n'est envoyé)"
          >
            Aperçu
          </a>
        )}

        {statut === "envoye" && estClassique && !clientASigne && (
          <button
            type="button"
            onClick={handleCorriger}
            disabled={isPending}
            className="admin-button-secondary"
            aria-label="Créer une nouvelle version en brouillon de ce devis pour la corriger et la renvoyer"
          >
            {isPending ? "…" : "Corriger et renvoyer"}
          </button>
        )}
        {statut === "envoye" && signeParClient && (
          <p
            data-testid="note-signe-par-client"
            className="basis-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Le client a signé ce devis. Contresignez-le dans le bloc « Signature électronique »
            ci-dessus pour le conclure.
          </p>
        )}
        {statut === "envoye" && signeDesDeuxParties && (
          <p
            data-testid="note-signe-des-deux-parties"
            className="basis-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Ce devis est signé des deux parties, mais son acceptation n&apos;a pas été enregistrée.
            Cliquez sur « Marquer accepté » pour la finir.
          </p>
        )}
        {statut === "envoye" && !signeParClient && !repriseParRelance && (
          <>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isPending}
              className="admin-button"
              aria-label="Marquer le devis comme accepté"
            >
              {isPending ? "…" : "Marquer accepté"}
            </button>
            {!signeDesDeuxParties && (
              <button
                type="button"
                onClick={handleDecline}
                disabled={isPending}
                className="admin-button-danger"
                aria-label="Marquer le devis comme refusé"
              >
                {isPending ? "…" : "Marquer refusé"}
              </button>
            )}
          </>
        )}

        {statut === "envoye" && !signeParClient && !signeDesDeuxParties && !repriseParRelance && (
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending}
            className="admin-button"
            aria-label="Renvoyer le devis au client par email (PDF joint)"
          >
            {isPending ? "…" : "Renvoyer par email"}
          </button>
        )}
        {statut === "envoye" && !signeParClient && !signeDesDeuxParties && !repriseParRelance && (
          <p
            data-testid="avertissement-renvoi-lien"
            className="basis-full text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
          >
            Renvoyer par email désactive dès maintenant l&apos;ancien lien de signature, avant
            l&apos;approbation de l&apos;e-mail en corbeille : s&apos;il est refusé ou supprimé, le
            client n&apos;a plus de lien valable.
          </p>
        )}

        {statut === "accepte" && (
          <button
            type="button"
            onClick={handleTransform}
            disabled={isPending}
            className="admin-button"
            aria-label="Transformer le devis accepté en convention"
          >
            {isPending ? "…" : "Transformer en convention"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          // 🔴 La couleur ne fait que DOUBLER le texte, qui dit déjà tout
          // (WCAG 1.4.1) : « il attend votre validation » se lit en noir et
          // blanc, et sur une page imprimée.
          className={
            ton === "attention"
              ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning-fg)]"
              : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          }
        >
          {successMsg}
        </p>
      )}
      {warningMsg && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {warningMsg}
        </p>
      )}
    </div>
  );
}
