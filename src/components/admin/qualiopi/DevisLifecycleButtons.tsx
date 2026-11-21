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
import { prolongerValiditeDevisAction } from "@/server/actions/qualiopi/devis-prolonger-validite";
import { formatDateParis } from "@/components/admin/qualiopi/devis-validite";

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
  /** Un e-mail d'envoi de ce devis attend validation (ou part) : aucun lien n'existe encore. */
  emailEnAttente?: boolean;
  /** Page des e-mails à valider de la console (le préfixe d'administration vient du serveur). */
  emailsHref?: string;
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
  /**
   * Devis remis en main propre : aucun e-mail n'est parti et aucun lien n'existe. Le renvoi par
   * e-mail et son avertissement sont masqués (le serveur le refuse aussi).
   */
  remisEnMainPropre?: boolean;
  /** L'utilisateur peut conclure un devis (`conclure_devis`) : sans cela, ni « Marquer accepté » ni « Transformer ». */
  peutConclure?: boolean;
  /** L'utilisateur peut écrire dans la console : sans cela, aucun bouton d'écriture n'est rendu. */
  peutEcrire?: boolean;
  /** Date de validité actuelle (ISO). Absente : « Prolonger la validité… » n'est pas proposé. */
  dateValiditeIso?: string;
  /** Une version plus récente de ce devis a été émise : elle seule se prolonge. */
  successeurEmis?: boolean;
  /** Ancien classique avec estimation d'un tiers liée à sa date : la date ne se change pas ici. */
  estimationTiersFigee?: boolean;
}

const JOUR_MS = 86_400_000;

/** Jour civil de Paris décalé de `jours`, au format `AAAA-MM-JJ` (valeur d'un champ date). */
function jourParisIso(jours: number): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, mo, d] = p.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, d) + jours * JOUR_MS).toISOString().slice(0, 10);
}

/**
 * Plus petite date proposée : le plus tard entre demain et le lendemain de la validité actuelle
 * (le serveur refuse une date non postérieure à l'actuelle). Les dates `AAAA-MM-JJ` se comparent
 * comme des chaînes.
 */
function minNouvelleDate(dateValiditeIso: string | undefined): string {
  const demain = jourParisIso(1);
  if (!dateValiditeIso) return demain;
  const actuelle = new Date(dateValiditeIso);
  if (Number.isNaN(actuelle.getTime())) return demain;
  const [y, mo, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(actuelle)
    .split("-")
    .map(Number) as [number, number, number];
  const lendemain = new Date(Date.UTC(y, mo - 1, d) + JOUR_MS).toISOString().slice(0, 10);
  return lendemain > demain ? lendemain : demain;
}

/** `AAAA-MM-JJ` → `JJ/MM/AAAA`. */
function jourLisible(iso: string): string {
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
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
  emailEnAttente = false,
  emailsHref = "../../emails",
  signeParClient = false,
  signeDesDeuxParties = false,
  repriseParRelance = false,
  remisEnMainPropre = false,
  peutConclure = true,
  peutEcrire = true,
  dateValiditeIso,
  successeurEmis = false,
  estimationTiersFigee = false,
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

  const [prolongerOuvert, setProlongerOuvert] = useState(false);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const peutProlonger =
    peutEcrire &&
    peutConclure &&
    statut === "envoye" &&
    dateValiditeIso !== undefined &&
    !clientASigne &&
    !signeParClient &&
    !signeDesDeuxParties &&
    !repriseParRelance &&
    !successeurEmis &&
    !estimationTiersFigee;

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
                "L'e-mail attend votre validation dans Emails, À valider. Le devis reste en brouillon et aucun lien de signature n'existe tant que l'e-mail n'est pas parti.",
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

  function handleProlonger() {
    if (!dateValiditeIso || nouvelleDate === "") return;
    const nouvelle = jourLisible(nouvelleDate);
    const ancienne = formatDateParis(new Date(dateValiditeIso));
    const expire = statut === "expire";
    demander(
      {
        titre: `Prolonger la validité du devis${numero ? ` ${numero}` : ""} ?`,
        description: `La validité passe du ${ancienne} au ${nouvelle}. Le PDF n'est pas modifié. Le lien de signature déjà reçu par le client garde son ancienne échéance : renvoyez ensuite le devis par e-mail pour lui donner un lien valable.${expire ? " Le devis redevient « envoyé »." : ""}`,
        libelleConfirmer: "Prolonger",
      },
      () => {
        resetMessages();
        startTransition(async () => {
          const result = await prolongerValiditeDevisAction({ devisId, nouvelleDate });
          if ("error" in result) {
            setError(result.error);
            return;
          }
          const lisible = result.data.nouvelleDateLisible;
          setSuccessMsg(
            remisEnMainPropre
              ? `Validité prolongée jusqu'au ${lisible}. Ce devis a été remis en main propre : prévenez le client de la nouvelle date.`
              : `Validité prolongée jusqu'au ${lisible}. Le client n'est pas prévenu : cliquez sur « Renvoyer par email » pour lui envoyer un nouveau lien (selon vos réglages, l'e-mail attendra votre validation dans Emails → À valider).`,
          );
          setProlongerOuvert(false);
          setNouvelleDate("");
          router.refresh();
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
    demander(
      {
        titre: `Marquer le devis${numero ? ` ${numero}` : ""} accepté ?`,
        description:
          "À faire seulement si le client a signé le devis papier ou donné son accord écrit. La fiche passe client et la suite est lancée.",
        libelleConfirmer: "Marquer accepté",
      },
      () => {
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
      },
    );
  }

  function handleDecline() {
    demander(
      {
        titre: `Marquer le devis${numero ? ` ${numero}` : ""} refusé ?`,
        description: "Le lien de signature envoyé au client est désactivé immédiatement.",
        libelleConfirmer: "Marquer refusé",
        destructif: true,
      },
      () => {
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
      },
    );
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
        {peutEcrire &&
          statut === "brouillon" &&
          !(estClassique && !destinataire) &&
          !emailEnAttente && (
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
        {statut === "brouillon" && emailEnAttente && (
          <p
            data-testid="email-en-attente"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            E-mail en attente de validation : aucun lien de signature n&apos;existe encore.{" "}
            <a href={emailsHref} className="admin-link">
              Ouvrir les e-mails à valider
            </a>
          </p>
        )}
        {statut === "brouillon" && estClassique && !destinataire && (
          <p
            data-testid="note-sans-adresse"
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Ce client n&apos;a pas d&apos;adresse e-mail.
          </p>
        )}

        {peutEcrire && statut === "brouillon" && estClassique && (
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

        {peutEcrire && statut === "envoye" && estClassique && !clientASigne && (
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
        {peutConclure && statut === "envoye" && signeDesDeuxParties && (
          <p
            data-testid="note-signe-des-deux-parties"
            className="basis-full text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Ce devis est signé des deux parties, mais son acceptation n&apos;a pas été enregistrée.
            Cliquez sur « Marquer accepté » pour la finir.
          </p>
        )}
        {peutEcrire && statut === "envoye" && !signeParClient && !repriseParRelance && (
          <>
            {peutConclure && (
              <button
                type="button"
                onClick={handleAccept}
                disabled={isPending}
                className="admin-button"
                aria-label="Marquer le devis comme accepté"
              >
                {isPending ? "…" : "Marquer accepté"}
              </button>
            )}
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

        {peutProlonger && !prolongerOuvert && (
          <button
            type="button"
            onClick={() => setProlongerOuvert(true)}
            disabled={isPending}
            className="admin-button-secondary"
            aria-label="Prolonger la validité du devis"
          >
            Prolonger la validité…
          </button>
        )}
        {peutProlonger && prolongerOuvert && (
          <div
            data-testid="zone-prolonger"
            className="flex basis-full flex-wrap items-end gap-[var(--space-admin-3)]"
          >
            <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
              <span>Nouvelle date de validité</span>
              <input
                type="date"
                name="nouvelleDate"
                value={nouvelleDate}
                min={minNouvelleDate(dateValiditeIso)}
                max={jourParisIso(90)}
                onChange={(e) => setNouvelleDate(e.target.value)}
                disabled={isPending}
                className="admin-input"
              />
            </label>
            <button
              type="button"
              onClick={handleProlonger}
              disabled={isPending || nouvelleDate === ""}
              className="admin-button"
            >
              {isPending ? "…" : "Prolonger"}
            </button>
            <p className="basis-full text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Le PDF déjà envoyé n&apos;est pas modifié : il garde sa date d&apos;origine.
            </p>
          </div>
        )}
        {peutEcrire &&
          statut === "envoye" &&
          !signeParClient &&
          !signeDesDeuxParties &&
          !repriseParRelance &&
          !remisEnMainPropre && (
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
        {peutEcrire &&
          statut === "envoye" &&
          !signeParClient &&
          !signeDesDeuxParties &&
          !repriseParRelance &&
          !remisEnMainPropre && (
            <p
              data-testid="avertissement-renvoi-lien"
              className="basis-full text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            >
              Renvoyer par email désactive dès maintenant l&apos;ancien lien de signature, avant
              l&apos;approbation de l&apos;e-mail en corbeille : s&apos;il est refusé ou supprimé,
              le client n&apos;a plus de lien valable.
            </p>
          )}

        {peutEcrire && peutConclure && statut === "accepte" && (
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
