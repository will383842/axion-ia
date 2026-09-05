"use client";
// use-client: formulaire interactif (inputs/checkbox/textarea + useTransition) création/édition stagiaire.

/**
 * TraineeForm — création ou édition d'un stagiaire (R10).
 *
 * RGPD : le détail handicap est WRITE-ONLY (jamais pré-rempli ni affiché ;
 * il est chiffré côté serveur via encryptPii). Laisser vide = ne pas modifier.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraineeAction, updateTraineeAction } from "@/server/actions/qualiopi/trainees";
import {
  OPTION_ENTREPRISE_AUCUNE,
  OPTION_ENTREPRISE_LIBRE,
  entrepriseRetenue,
  optionInitialeEntreprise,
} from "@/components/admin/qualiopi/entreprise-client";

/** Un client du CRM, tel qu'il peut être désigné comme employeur du stagiaire. */
export interface ClientEntrepriseOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface TraineeFormProps {
  mode: "create" | "edit";
  baseHref: string;
  traineeId?: string;
  /**
   * 🔴 F1 — les clients existants, chargés côté serveur.
   *
   * Sans eux le champ « Entreprise » redevient une SECONDE saisie libre du même
   * fait, et deux saisies libres du même fait divergent toujours. La liste est
   * facultative pour ne pas casser un appelant qui ne la fournit pas — mais
   * l'écran dit alors explicitement pourquoi il n'en propose aucune.
   */
  clients?: ClientEntrepriseOption[];
  initial?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    entreprise: string | null;
    fonction: string | null;
    situationHandicap: boolean;
    consentementFormation: boolean;
    consentementEmail: boolean;
    /** Indique si un détail handicap chiffré est déjà présent (sans le révéler). */
    handicapDetailsPresent: boolean;
  };
}

export function TraineeForm({
  mode,
  baseHref,
  traineeId,
  clients = [],
  initial,
}: TraineeFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  // 🔴 F1 — l'entreprise DÉRIVE d'un client, elle ne se retape pas.
  //
  // `optionEntreprise` porte soit la raison sociale d'un client (recopiée telle
  // qu'elle est en base), soit le marqueur « saisie libre », soit le vide. La
  // décision d'ouverture est dans `entreprise-client.ts` — module pur, testé —
  // parce qu'elle a trois cas et qu'une relecture à l'œil n'en garantit aucun.
  const raisonsSociales = clients.map((c) => c.raisonSociale);
  const [optionEntreprise, setOptionEntreprise] = useState(() =>
    optionInitialeEntreprise(initial?.entreprise, raisonsSociales),
  );
  // Pré-remplie de la valeur en base quand celle-ci ne désigne aucun client :
  // une entreprise hors registre est une information, la perdre à l'ouverture
  // de la fiche serait plus grave que l'écart qu'on corrige.
  const [entrepriseLibre, setEntrepriseLibre] = useState(() =>
    optionInitialeEntreprise(initial?.entreprise, raisonsSociales) === OPTION_ENTREPRISE_LIBRE
      ? (initial?.entreprise ?? "")
      : "",
  );
  const entreprise = entrepriseRetenue(optionEntreprise, entrepriseLibre);
  const [fonction, setFonction] = useState(initial?.fonction ?? "");
  const [situationHandicap, setSituationHandicap] = useState(initial?.situationHandicap ?? false);
  const [handicapDetails, setHandicapDetails] = useState("");
  const [consentementFormation, setConsentementFormation] = useState(
    initial?.consentementFormation ?? false,
  );
  const [consentementEmail, setConsentementEmail] = useState(initial?.consentementEmail ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const common = {
      nom,
      prenom,
      email,
      situationHandicap,
      consentementFormation,
      consentementEmail,
      ...(telephone ? { telephone } : {}),
      ...(entreprise ? { entreprise } : {}),
      ...(fonction ? { fonction } : {}),
      ...(handicapDetails.trim() ? { handicapDetails } : {}),
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createTraineeAction(common)
          : await updateTraineeAction({ id: traineeId as string, ...common });
      if ("error" in result) {
        setError(result.error);
      } else if (mode === "create") {
        router.push(`${baseHref}/${result.data.id}`);
      } else {
        setSuccessMsg("Stagiaire enregistré.");
        setHandicapDetails("");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";
  const checkCls =
    "flex cursor-pointer items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-prenom">
            Prénom
          </label>
          <input
            id="s-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-nom">
            Nom
          </label>
          <input
            id="s-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-email">
            Email
          </label>
          <input
            id="s-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-tel">
            Téléphone
          </label>
          <input
            id="s-tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            disabled={isPending}
            maxLength={40}
            className={inputCls}
          />
        </div>
        {/* 🔴 F1 — ce champ était un `<input>` LIBRE, c'est-à-dire une seconde
            saisie du fait déjà saisi sur la fiche client. Constaté le
            2026-09-04 : « SCI Invest Sun » côté client, retapé côté stagiaire,
            sans qu'aucun écran ne rapproche jamais les deux. La convention porte
            ensuite l'écart, sous les yeux de l'auditeur.
            Le sélecteur recopie la raison sociale TELLE QU'ELLE EST en base ; la
            saisie libre reste atteignable pour un employeur hors registre —
            l'interdire pousserait à créer un faux client pour contourner
            l'écran. */}
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-entreprise">
            Entreprise
          </label>
          <select
            id="s-entreprise"
            value={optionEntreprise}
            onChange={(e) => setOptionEntreprise(e.target.value)}
            disabled={isPending}
            className={inputCls}
          >
            <option value={OPTION_ENTREPRISE_AUCUNE}>— Aucune —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.raisonSociale}>
                {c.numero} — {c.raisonSociale}
              </option>
            ))}
            <option value={OPTION_ENTREPRISE_LIBRE}>
              Autre entreprise (hors clients enregistrés)…
            </option>
          </select>
          {optionEntreprise === OPTION_ENTREPRISE_LIBRE && (
            <input
              aria-label="Nom de l'entreprise hors clients enregistrés"
              value={entrepriseLibre}
              onChange={(e) => setEntrepriseLibre(e.target.value)}
              disabled={isPending}
              maxLength={250}
              placeholder="Raison sociale de l'employeur"
              className={inputCls}
            />
          )}
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {clients.length === 0
              ? "Aucun client enregistré : seule la saisie libre est possible. Créez d'abord le client, et l'entreprise du stagiaire s'y rattachera au lieu d'être retapée."
              : optionEntreprise === OPTION_ENTREPRISE_LIBRE
                ? "Hors clients enregistrés : cette valeur ne sera rapprochée d'aucune fiche client, et une variante d'orthographe créera un doublon invisible."
                : "Reprise du client enregistré, à l'identique. C'est ce qui évite que « SCI Invest Sun » et « SCI INVEST SUN » désignent deux entreprises aux yeux d'un auditeur."}
          </p>
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="s-fonction">
            Fonction
          </label>
          <input
            id="s-fonction"
            value={fonction}
            onChange={(e) => setFonction(e.target.value)}
            disabled={isPending}
            maxLength={200}
            className={inputCls}
          />
        </div>
      </div>

      {/* Handicap (PII chiffré) */}
      <div className="mt-[var(--space-admin-5)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
        <label className={checkCls}>
          <input
            type="checkbox"
            checked={situationHandicap}
            onChange={(e) => setSituationHandicap(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
          />
          Situation de handicap déclarée
        </label>
        <div className="mt-[var(--space-admin-3)]">
          <label className={labelCls} htmlFor="s-handicap">
            Détail / besoins d&apos;adaptation (chiffré — write-only)
          </label>
          <textarea
            id="s-handicap"
            value={handicapDetails}
            onChange={(e) => setHandicapDetails(e.target.value)}
            disabled={isPending}
            rows={3}
            maxLength={2000}
            placeholder={
              initial?.handicapDetailsPresent
                ? "Un détail chiffré existe déjà. Saisir ici pour le REMPLACER (laisser vide = inchangé)."
                : "Saisir le besoin d'adaptation. Stocké chiffré (AES-256-GCM), jamais en clair."
            }
            className={inputCls}
          />
          <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            RGPD : non affiché en clair (lecture réservée au référent handicap).
          </p>
        </div>
      </div>

      {/* 🔴 F2 — les deux cases ne disaient RIEN de ce qu'elles emportent.
          Constaté le 2026-09-04 : décochées par défaut, même typographie, l'une
          sous l'autre, aucune conséquence écrite. Il a fallu demander à Will
          quoi faire — sur une donnée qui engage juridiquement.

          Ce qui est écrit ci-dessous est ce que le CODE fait aujourd'hui,
          vérifié fichier par fichier, et non ce qu'on aimerait qu'il fasse :
          `consentementFormation` est lu par la colonne « Consentement » de la
          liste des stagiaires (`stagiaires/page.tsx`), par le compteur
          `countTrainees` et par l'export RGPD (`rgpd-service.ts`) ;
          `consentementEmail` n'est lu par AUCUN chemin d'envoi
          (`grep -rln consentementEmail src/server/` → actions, export RGPD et
          service de consentement, rien d'autre). Écrire « cocher autorise les
          envois » serait une promesse que le produit ne tient pas, et c'est
          exactement le genre de phrase qu'on oppose ensuite à une réclamation. */}
      <div className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-4)]">
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <label className={checkCls}>
            <input
              type="checkbox"
              checked={consentementFormation}
              onChange={(e) => setConsentementFormation(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
            />
            <span className="font-semibold">Consentement traitement des données (formation)</span>
          </label>
          <p className="pl-[calc(1rem+var(--space-admin-2))] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            <strong>Cochée</strong> : la fiche est marquée « Donné » dans la colonne Consentement du
            registre des stagiaires, elle entre dans le compteur du même écran, et la mention est
            reprise dans l&apos;export RGPD du stagiaire. <strong>Décochée</strong> : la fiche
            affiche « Non recueilli » —{" "}
            <strong>aucun envoi ni aucune pièce n&apos;est bloqué pour autant</strong> : la gestion
            de la formation (convocation, convention, attestation) repose sur le CONTRAT, pas sur
            cette case. Elle trace le recueil, elle ne le conditionne pas. C&apos;est elle que
            l&apos;auditeur regarde.
          </p>
        </div>
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          <label className={checkCls}>
            <input
              type="checkbox"
              checked={consentementEmail}
              onChange={(e) => setConsentementEmail(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 accent-[color:var(--color-admin-accent)]"
            />
            <span>
              Consentement communications email (suivi, non contractuel){" "}
              <span className="text-[color:var(--color-admin-fg-muted)]">— facultatif</span>
            </span>
          </label>
          <p className="pl-[calc(1rem+var(--space-admin-2))] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            <strong>Cochée</strong> : la trace du consentement aux envois NON contractuels (suivi à
            froid, informations) est enregistrée et reprise dans l&apos;export RGPD.{" "}
            <strong>Décochée</strong> : la trace dit « non recueilli ».{" "}
            <strong>
              Attention — aujourd&apos;hui aucun envoi ne consulte cette case avant de partir
            </strong>{" "}
            : elle enregistre une intention, elle ne filtre encore rien. Avant toute campagne, la
            liste des destinataires doit être établie sur ce champ à la main.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}

      <div className="mt-[var(--space-admin-5)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le stagiaire" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
