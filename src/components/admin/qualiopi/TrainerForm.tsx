"use client";
// use-client: formulaire interactif (inputs/select + useTransition) pour créer/éditer un formateur.

/**
 * TrainerForm — création ou édition d'un formateur (R9).
 * mode="create" → createTrainerAction puis redirection vers la fiche.
 * mode="edit"   → updateTrainerAction puis router.refresh().
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrainerAction, updateTrainerAction } from "@/server/actions/qualiopi/trainers";
import { REGIONS } from "@/content/regions";

type Statut = "salarie" | "sous_traitant" | "dirigeant";

export interface TrainerFormProps {
  mode: "create" | "edit";
  /** Base href admin (pour la redirection après création). */
  baseHref: string;
  trainerId?: string;
  initial?: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
    statut: Statut;
    region: string | null;
    regionsIntervention?: string[];
    interventionFranceEntiere?: boolean;
    adresseProfessionnelle?: string | null;
    tarifJourneeHtCents: number | null;
    sousTraitantNda: string | null;
  };
}

export function TrainerForm({
  mode,
  baseHref,
  trainerId,
  initial,
}: TrainerFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [prenom, setPrenom] = useState(initial?.prenom ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [statut, setStatut] = useState<Statut>(initial?.statut ?? "salarie");
  const [region, setRegion] = useState(initial?.region ?? "");
  // Multi-régions + « France entière ». `region` (mono) reste envoyée par
  // l'action, alimentée par la première du tableau : le calendrier la lit.
  const [regions, setRegions] = useState<string[]>(
    initial?.regionsIntervention ?? (initial?.region ? [initial.region] : []),
  );
  const [franceEntiere, setFranceEntiere] = useState(initial?.interventionFranceEntiere ?? false);
  const [adressePro, setAdressePro] = useState(initial?.adresseProfessionnelle ?? "");
  const [tarifEuros, setTarifEuros] = useState(
    initial?.tarifJourneeHtCents != null ? String(initial.tarifJourneeHtCents / 100) : "",
  );
  const [nda, setNda] = useState(initial?.sousTraitantNda ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const tarifCents = tarifEuros.trim() !== "" ? Math.round(Number(tarifEuros) * 100) : undefined;

    startTransition(async () => {
      if (mode === "create") {
        const result = await createTrainerAction({
          nom,
          prenom,
          email,
          statut,
          region,
          regionsIntervention: franceEntiere ? [] : regions,
          interventionFranceEntiere: franceEntiere,
          ...(adressePro ? { adresseProfessionnelle: adressePro } : {}),
          ...(telephone ? { telephone } : {}),
          ...(tarifCents !== undefined && !Number.isNaN(tarifCents)
            ? { tarifJourneeHtCents: tarifCents }
            : {}),
          ...(statut === "sous_traitant" && nda ? { sousTraitantNda: nda } : {}),
        });
        if ("error" in result) {
          setError(result.error);
        } else {
          router.push(`${baseHref}/${result.data.id}`);
        }
      } else {
        const result = await updateTrainerAction({
          id: trainerId as string,
          nom,
          prenom,
          email,
          // `statut` VOLONTAIREMENT absent : il n'est plus éditable ici (cf. le
          // commentaire du champ). L'envoyer réverterait la valeur choisie dans
          // TrainerManageForm, dont ce composant ignore la mise à jour.
          region,
          regionsIntervention: franceEntiere ? [] : regions,
          interventionFranceEntiere: franceEntiere,
          adresseProfessionnelle: adressePro,
          ...(telephone ? { telephone } : {}),
          ...(tarifCents !== undefined && !Number.isNaN(tarifCents)
            ? { tarifJourneeHtCents: tarifCents }
            : {}),
          ...(statut === "sous_traitant" && nda ? { sousTraitantNda: nda } : {}),
        });
        if ("error" in result) {
          setError(result.error);
        } else {
          setSuccessMsg("Formateur enregistré.");
          router.refresh();
        }
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]"
    >
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-prenom">
            Prénom
          </label>
          <input
            id="t-prenom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-nom">
            Nom
          </label>
          <input
            id="t-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isPending}
            required
            maxLength={200}
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-email">
            Email
          </label>
          <input
            id="t-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-tel">
            Téléphone
          </label>
          <input
            id="t-tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            disabled={isPending}
            maxLength={40}
            className={inputCls}
          />
        </div>
        {/* Statut : réglable À LA CRÉATION uniquement. Après création, il se
            modifie depuis la section « Statut » de TrainerManageForm, qui
            explique l'effet du choix sur les pièces exigées.
            ⚠️ NE PAS le réintroduire ici : ce composant fige son état au montage
            (`useState`), donc deux sélecteurs sur la même page se désynchronisent
            après un `router.refresh()` et l'enregistrement de l'identité
            REVERTAIT silencieusement le statut choisi ailleurs. */}
        {mode === "create" && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="t-statut">
              Statut
            </label>
            <select
              id="t-statut"
              value={statut}
              onChange={(e) => setStatut(e.target.value as Statut)}
              disabled={isPending}
              className={inputCls}
            >
              <option value="salarie">Salarié</option>
              <option value="sous_traitant">Sous-traitant</option>
              <option value="dirigeant">Dirigeant-formateur</option>
            </select>
          </div>
        )}
        {/*
          Régions d'intervention MULTIPLES (2026-08-02). Le champ était un
          sélecteur mono-valeur : un formateur qui se déplace dans trois régions
          ne pouvait en déclarer qu'une, et la donnée devenait fausse au moment
          précis où elle servait. « France entière » évite d'énumérer treize
          cases pour dire une chose simple — et le dit explicitement sur les
          pièces, au lieu d'une liste qu'un lecteur devrait recompter.

          `region` (mono) reste envoyée par l'action, alimentée par la première
          région retenue : le calendrier et les filtres existants la lisent.
        */}
        <div className={`${fieldCls} sm:col-span-2`}>
          <span className={labelCls}>Régions d&apos;intervention</span>
          <label className="mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <input
              type="checkbox"
              checked={franceEntiere}
              onChange={(e) => {
                setFranceEntiere(e.target.checked);
                if (e.target.checked) {
                  setRegions([]);
                  setRegion("");
                }
              }}
              disabled={isPending}
            />
            <span>France entière</span>
          </label>
          {!franceEntiere && (
            <div className="grid grid-cols-1 gap-[var(--space-admin-1)] sm:grid-cols-3">
              {REGIONS.map((r) => (
                <label
                  key={r.slug}
                  className="flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
                >
                  <input
                    type="checkbox"
                    checked={regions.includes(r.slug)}
                    onChange={(e) => {
                      const suivantes = e.target.checked
                        ? [...regions, r.slug]
                        : regions.filter((s) => s !== r.slug);
                      setRegions(suivantes);
                      setRegion(suivantes[0] ?? "");
                    }}
                    disabled={isPending}
                  />
                  <span>{r.nameFr}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {/*
          Adresse PROFESSIONNELLE — le champ n'existait pas en base, si bien que
          la lettre de mission, qui doit identifier les deux parties, imprimait
          un tiret figé. Jamais le domicile personnel (minimisation RGPD) :
          c'est l'adresse d'exercice qui identifie une partie au contrat.
        */}
        <div className={`${fieldCls} sm:col-span-2`}>
          <label className={labelCls} htmlFor="t-adresse-pro">
            Adresse professionnelle
          </label>
          <input
            id="t-adresse-pro"
            type="text"
            value={adressePro}
            onChange={(e) => setAdressePro(e.target.value)}
            disabled={isPending}
            placeholder="Adresse d'exercice — jamais le domicile personnel"
            className={inputCls}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="t-tarif">
            Tarif journée HT (€)
          </label>
          <input
            id="t-tarif"
            type="number"
            min={0}
            step="0.01"
            value={tarifEuros}
            onChange={(e) => setTarifEuros(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        {statut === "sous_traitant" && (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="t-nda">
              N° NDA sous-traitant
            </label>
            <input
              id="t-nda"
              value={nda}
              onChange={(e) => setNda(e.target.value)}
              disabled={isPending}
              maxLength={20}
              placeholder="Ex. 84691234569"
              className={inputCls}
            />
          </div>
        )}
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
          {isPending ? "Enregistrement…" : mode === "create" ? "Créer le formateur" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
