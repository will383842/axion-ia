"use client";
// use-client: formulaire interactif avec état local (lignes dynamiques, selects, inputs numériques) + useTransition pour createDevisAction + router.push vers la page de détail.

/**
 * DevisForm — Création d&apos;un devis commercial formation.
 *
 * - Sélection du client (liste CRM).
 * - Lignes : designation / quantité / prixUnitaireHtCents / offre catalogue.
 * - Choisir une offre renseigne l'intitulé ET le PU HT depuis pricing.ts (SSOT),
 *   sauf quand aucun prix FERME n'est dérivable (offre « sur devis », fourchette,
 *   prix « à partir de », paliers d'effectif) : on ne pré-remplit RIEN, jamais 0.
 * - Financement suggéré + options OPCO si sélectionné.
 * - Mention TVA affichée en lecture seule, dérivée de `qualiopi.regime_tva`.
 * - Date de validité auto (+30 j) — affiché en informatif.
 * - Appelle `createDevisAction` puis redirige vers `/[basePath]/[id]`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDevisAction } from "@/server/actions/qualiopi/devis";
import { ACTIVITE_LABELS } from "@/server/qualiopi/financements/facture-libre-pur";
import type { ActiviteFacturation } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
}

export interface OffreOption {
  /** Vrai `tier_id` pricing.ts — `null` pour les offres du catalogue V2. */
  tierId: string | null;
  code: string;
  titreFr: string;
  prixLabelFr: string;
  /**
   * PU HT en centimes, pré-résolu par le serveur. `null` = aucun montant ferme :
   * on ne pré-remplit RIEN plutôt que d'écrire 0 — un 0 pré-rempli part en
   * signature sans que personne ne le voie.
   */
  prixHtCents: number | null;
  /** Rappel effectif + frais, dérivé de l'offre côté serveur — jamais en dur. */
  noteDevisFr: string;
}

export interface DevisFormProps {
  clients: ClientOption[];
  offres: OffreOption[];
  /** Chemin base admin pour la redirection : /fr/admin-xxx/qualiopi/devis */
  basePath: string;
  /** Client pré-sélectionné (searchParam `clientId` — lien depuis /qualiopi/entrees). */
  defaultClientId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types internes
// ─────────────────────────────────────────────────────────────────────────────

interface Ligne {
  designation: string;
  quantite: string;
  prixUnitaireHtCents: string;
  /**
   * Vrai `tier_id` pricing.ts, "" sinon.
   *
   * Avant ce correctif le <select> émettait `o.tierId ?? o.code` : les offres du
   * catalogue V2 (tier_id NULL, 21 des 26 offres actives) rangeaient donc un
   * CODE dans un champ nommé tierId, et la référence n'était jointe à rien. Les
   * devis déjà émis gardent cette forme — on ne réécrit pas une pièce émise.
   */
  offreTierId: string;
  /** Code AXI-OFF-NNN de l'offre catalogue, "" si aucune. */
  offreCode: string;
  /**
   * Vrai tant que la désignation affichée vient de l'offre, pas de l'admin.
   *
   * Sans ce drapeau les deux comportements possibles sont également faux :
   * écraser toujours efface une désignation tapée à la main ; n'écraser jamais
   * fige le titre de la PREMIÈRE offre choisie, et la pièce part au client avec
   * un libellé qui ne correspond plus à la référence portée sur la même ligne.
   */
  designationDepuisOffre: boolean;
}

type FinancementSuggere = "direct" | "opco" | "cpf" | "france_travail" | "";
type ModaliteOpco = "intra" | "inter_presentiel" | "inter_distanciel" | "";

const FINANCEMENT_OPTIONS: Array<{ value: FinancementSuggere; label: string }> = [
  { value: "", label: "— Aucun —" },
  { value: "direct", label: "Direct (entreprise)" },
  { value: "opco", label: "OPCO" },
  // CPF retiré (2026-07-04) — Axion-IA non habilité CPF (sélection interdite).
  // Enum + labels BPF conservés ailleurs pour l'intégrité des données existantes.
  { value: "france_travail", label: "France Travail" },
];

const MODALITE_OPCO_OPTIONS: Array<{ value: ModaliteOpco; label: string }> = [
  { value: "", label: "— Choisir —" },
  { value: "intra", label: "Intra" },
  { value: "inter_presentiel", label: "Inter présentiel" },
  { value: "inter_distanciel", label: "Inter distanciel" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function emptyLigne(): Ligne {
  return {
    designation: "",
    quantite: "1",
    prixUnitaireHtCents: "0",
    offreTierId: "",
    offreCode: "",
    designationDepuisOffre: false,
  };
}

/**
 * Rappel dérivé de l'offre sélectionnée — le texte vient du serveur.
 *
 * Aucune logique ici, volontairement : ce qu'il faut dire dépend de l'effectif
 * couvert (prix par groupe vs journée 1-to-1) et du régime de frais, deux
 * choses qui ne se lisent que dans pricing.ts.
 */
function NoteOffre({ offre }: { offre: OffreOption | undefined }): React.ReactElement | null {
  if (offre === undefined) return null;
  return (
    <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
      {offre.noteDevisFr}
    </p>
  );
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function totalHtCents(lignes: Ligne[]): number {
  return lignes.reduce((acc, l) => {
    const q = parseFloat(l.quantite) || 0;
    const p = parseInt(l.prixUnitaireHtCents, 10) || 0;
    return acc + Math.round(q * p);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function DevisForm({
  clients,
  offres,
  basePath,
  defaultClientId,
}: DevisFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [lignes, setLignes] = useState<Ligne[]>([emptyLigne()]);
  const [financementSuggere, setFinancementSuggere] = useState<FinancementSuggere>("");
  // 🔴 L'ACTIVITÉ n'était pas demandée, et son absence cassait TROIS choses :
  //   · `genererFactureDepuisDevisAction` REFUSE un devis sans activité — la
  //     chaîne devis → facture était rompue à son maillon central ;
  //   · `normaliserLignesPourActivite` ne s'appliquait pas, donc la règle
  //     d'exonération 261-4-4° (réservée à formation et 1-to-1) n'était pas
  //     opposée aux lignes d'un audit ou d'un site web ;
  //   · le PDF n'affichait pas `activiteLabel`.
  // L'action l'acceptait depuis toujours ; seul le formulaire ne la posait pas.
  const [activite, setActivite] = useState<ActiviteFacturation | "">("");
  const [nbParticipants, setNbParticipants] = useState<string>("");
  const [dureeHeures, setDureeHeures] = useState<string>("");
  const [modaliteOpco, setModaliteOpco] = useState<ModaliteOpco>("");
  const [enveloppeRestante, setEnveloppeRestante] = useState<string>("");

  const showOpco = financementSuggere === "opco";
  const total = totalHtCents(lignes);

  // ── Lignes helpers ──

  function updateLigne<K extends keyof Ligne>(idx: number, key: K, value: Ligne[K]) {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
  }

  /**
   * Saisie manuelle de la désignation : elle prend la main sur l'offre.
   *
   * `updateLigne` ne peut pas servir ici — il est MONO-CHAMP par construction,
   * et c'est exactement ce qui empêchait le <select> d'écrire autre chose que
   * l'identifiant de l'offre.
   */
  function setDesignation(idx: number, value: string) {
    setLignes((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, designation: value, designationDepuisOffre: false } : l,
      ),
    );
  }

  /**
   * Sélection d'une offre : écrit la référence, l'intitulé ET le prix d'un coup.
   *
   * Les deux gardes ci-dessous ne sont pas cosmétiques, ne pas les simplifier :
   *  - on ne recolle JAMAIS 0 par-dessus un chiffrage existant quand l'offre n'a
   *    pas de prix ferme (`prixHtCents === null`) ;
   *  - on ne remplace la désignation que si elle est vide OU si elle vient
   *    elle-même d'une offre (cf. `designationDepuisOffre`), sinon un admin qui
   *    choisit l'offre après avoir rédigé voit son travail effacé sans un mot.
   */
  function selectOffre(idx: number, code: string) {
    const offre = offres.find((o) => o.code === code);
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        if (offre === undefined) {
          // « — Aucune — » : on relâche la référence, jamais les montants déjà
          // affichés (l'admin peut vouloir garder un chiffrage hors catalogue).
          return { ...l, offreCode: "", offreTierId: "", designationDepuisOffre: false };
        }
        const reprendreLeTitre = l.designation.trim() === "" || l.designationDepuisOffre;
        return {
          ...l,
          offreCode: offre.code,
          offreTierId: offre.tierId ?? "",
          designation: reprendreLeTitre ? offre.titreFr : l.designation,
          designationDepuisOffre: reprendreLeTitre,
          prixUnitaireHtCents:
            offre.prixHtCents !== null ? String(offre.prixHtCents) : l.prixUnitaireHtCents,
        };
      }),
    );
  }

  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function removeLigne(idx: number) {
    setLignes((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Soumission ──

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Veuillez sélectionner un client.");
      return;
    }

    const parsedLignes = lignes.map((l) => ({
      designation: l.designation.trim(),
      quantite: parseFloat(l.quantite) || 0,
      prixUnitaireHtCents: parseInt(l.prixUnitaireHtCents, 10) || 0,
      // Deux références distinctes, volontairement : `offreCode` identifie
      // TOUTES les offres, `offreTierId` n'est renseigné que pour les quelques
      // offres legacy qui ont un vrai tier pricing.ts. Aucun taux de TVA n'est
      // transmis ici — il se dérive du régime configuré, en aval.
      ...(l.offreTierId !== "" ? { offreTierId: l.offreTierId } : {}),
      ...(l.offreCode !== "" ? { offreCode: l.offreCode } : {}),
    }));

    if (parsedLignes.some((l) => !l.designation || l.quantite <= 0)) {
      setError("Chaque ligne doit avoir une désignation et une quantité positive.");
      return;
    }

    // Une ligne offerte à 0 € reste légitime ; un devis dont le TOTAL est nul,
    // non. Le cas arrive sans faute de frappe : les offres sans prix ferme
    // (« Sur demande », « Séminaire IA », toutes deux actives) ne pré-remplissent
    // aucun prix, et rien en aval ne s'en apercevait — le PDF partait, DocuSeal
    // ouvrait une signature, et le client recevait une offre ferme à zéro euro.
    if (total <= 0) {
      setError(
        // Le total calculé du devis en cours de saisie, pas un tarif.
        "Devis à 0,00 € HT : chiffrez au moins une ligne (une offre sans prix ferme ne pré-remplit aucun montant).", // price-exempt
      );
      return;
    }

    startTransition(async () => {
      const result = await createDevisAction({
        clientId,
        lignes: parsedLignes,
        ...(activite !== "" ? { activite } : {}),
        ...(financementSuggere !== "" ? { financementSuggere } : {}),
        ...(showOpco && nbParticipants !== ""
          ? { nbParticipants: parseInt(nbParticipants, 10) }
          : {}),
        ...(showOpco && dureeHeures !== "" ? { dureeHeures: parseFloat(dureeHeures) } : {}),
        ...(showOpco && modaliteOpco !== "" ? { modaliteOpco } : {}),
        ...(showOpco && enveloppeRestante !== ""
          ? { opcoEnveloppeRestanteCents: Math.round(parseFloat(enveloppeRestante) * 100) }
          : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`${basePath}/${result.data.id}`);
      }
    });
  }

  // ── CSS helpers ──

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const selectCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-admin-6)]">
      {/* ── Client ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Client
        </h2>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="devis-client">
            Client <span className="text-[color:var(--color-admin-error)]">*</span>
          </label>
          {clients.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
              Aucun client dans le CRM. Créez un client avant de créer un devis.
            </p>
          ) : (
            <select
              id="devis-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isPending}
              required
              className={selectCls}
            >
              <option value="">— Sélectionner un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.raisonSociale}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* ── Lignes ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Lignes du devis
        </h2>

        <div className="flex flex-col gap-[var(--space-admin-4)]">
          {lignes.map((ligne, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-[var(--space-admin-3)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] sm:grid-cols-12"
            >
              {/* Désignation */}
              <div className="sm:col-span-5">
                <label className={labelCls} htmlFor={`ligne-${idx}-designation`}>
                  Désignation <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-designation`}
                  type="text"
                  value={ligne.designation}
                  onChange={(e) => setDesignation(idx, e.target.value)}
                  disabled={isPending}
                  required
                  maxLength={500}
                  placeholder="Ex. Formation IA appliquée"
                  className={inputCls}
                />
              </div>

              {/* Offre catalogue (optionnel) */}
              <div className="sm:col-span-3">
                <label className={labelCls} htmlFor={`ligne-${idx}-offre`}>
                  Offre catalogue
                </label>
                <select
                  id={`ligne-${idx}-offre`}
                  value={ligne.offreCode}
                  onChange={(e) => selectOffre(idx, e.target.value)}
                  disabled={isPending}
                  className={selectCls}
                >
                  <option value="">— Aucune —</option>
                  {offres.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.code} — {o.titreFr} · {o.prixLabelFr}
                    </option>
                  ))}
                </select>
                <NoteOffre offre={offres.find((o) => o.code === ligne.offreCode)} />
              </div>

              {/* Quantité */}
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`ligne-${idx}-quantite`}>
                  Qté <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-quantite`}
                  type="number"
                  value={ligne.quantite}
                  onChange={(e) => updateLigne(idx, "quantite", e.target.value)}
                  disabled={isPending}
                  min="0.01"
                  step="0.01"
                  required
                  className={inputCls}
                />
              </div>

              {/* Prix unitaire HT en centimes */}
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor={`ligne-${idx}-prix`}>
                  PU HT (€) <span className="text-[color:var(--color-admin-error)]">*</span>
                </label>
                <input
                  id={`ligne-${idx}-prix`}
                  type="number"
                  value={
                    ligne.prixUnitaireHtCents !== ""
                      ? (parseInt(ligne.prixUnitaireHtCents, 10) / 100).toString()
                      : ""
                  }
                  onChange={(e) => {
                    const eurVal = parseFloat(e.target.value);
                    updateLigne(
                      idx,
                      "prixUnitaireHtCents",
                      isNaN(eurVal) ? "0" : Math.round(eurVal * 100).toString(),
                    );
                  }}
                  disabled={isPending}
                  min="0"
                  step="0.01"
                  required
                  className={inputCls}
                />
              </div>

              {/* Supprimer ligne */}
              {lignes.length > 1 && (
                <div className="flex items-end sm:col-span-12">
                  <button
                    type="button"
                    onClick={() => removeLigne(idx)}
                    disabled={isPending}
                    className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:underline"
                  >
                    Supprimer cette ligne
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-[var(--space-admin-4)] flex items-center justify-between">
          <button
            type="button"
            onClick={addLigne}
            disabled={isPending}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] hover:underline"
          >
            + Ajouter une ligne
          </button>
          <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
            Total HT : <span className="tabular-nums">{formatEur(total)}</span>
          </p>
        </div>
      </section>

      {/* ── Financement ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Financement
        </h2>

        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="devis-activite">
              Activité *
            </label>
            <select
              id="devis-activite"
              value={activite}
              onChange={(e) => setActivite(e.target.value as ActiviteFacturation | "")}
              disabled={isPending}
              className={selectCls}
            >
              <option value="">— Sélectionner une activité —</option>
              {(Object.keys(ACTIVITE_LABELS) as ActiviteFacturation[]).map((cle) => (
                <option key={cle} value={cle}>
                  {ACTIVITE_LABELS[cle]}
                </option>
              ))}
            </select>
            <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Détermine le régime de TVA applicable et conditionne le passage en facture. Sans elle,
              le devis ne pourra pas être facturé.
            </p>
          </div>

          <div className={fieldCls}>
            <label className={labelCls} htmlFor="devis-financement">
              Financement suggéré
            </label>
            <select
              id="devis-financement"
              value={financementSuggere}
              onChange={(e) => setFinancementSuggere(e.target.value as FinancementSuggere)}
              disabled={isPending}
              className={selectCls}
            >
              {FINANCEMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* OPCO — champs complémentaires */}
          {showOpco && (
            <>
              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-modalite">
                  Modalité OPCO
                </label>
                <select
                  id="devis-opco-modalite"
                  value={modaliteOpco}
                  onChange={(e) => setModaliteOpco(e.target.value as ModaliteOpco)}
                  disabled={isPending}
                  className={selectCls}
                >
                  {MODALITE_OPCO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-participants">
                  Nb. participants
                </label>
                <input
                  id="devis-opco-participants"
                  type="number"
                  value={nbParticipants}
                  onChange={(e) => setNbParticipants(e.target.value)}
                  disabled={isPending}
                  min="1"
                  step="1"
                  placeholder="Ex. 8"
                  className={inputCls}
                />
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-duree">
                  Durée (heures)
                </label>
                <input
                  id="devis-opco-duree"
                  type="number"
                  value={dureeHeures}
                  onChange={(e) => setDureeHeures(e.target.value)}
                  disabled={isPending}
                  min="0.5"
                  step="0.5"
                  placeholder="Ex. 14"
                  className={inputCls}
                />
              </div>

              <div className={fieldCls}>
                <label className={labelCls} htmlFor="devis-opco-enveloppe">
                  Enveloppe OPCO restante (€, optionnel)
                </label>
                <input
                  id="devis-opco-enveloppe"
                  type="number"
                  value={enveloppeRestante}
                  onChange={(e) => setEnveloppeRestante(e.target.value)}
                  disabled={isPending}
                  min="0"
                  step="0.01"
                  placeholder="Défaut : plafond annuel Atlas"
                  className={inputCls}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Mention TVA ── */}
      <section className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]">
        <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          <span className="font-semibold tracking-wide uppercase">Mention TVA</span> — appliquée
          selon le régime configuré (Qualiopi → Configuration → Régime de TVA) ; le devis porte la
          mention correspondante. La date de validité sera fixée automatiquement à 30 jours à
          compter de la création du devis.
        </p>
      </section>

      {/* ── Erreur + Soumettre ── */}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending || clients.length === 0} className="admin-button">
          {isPending ? "Création…" : "Créer le devis"}
        </button>
      </div>
    </form>
  );
}
