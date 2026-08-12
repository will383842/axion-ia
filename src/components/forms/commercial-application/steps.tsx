// Candidature commerciale — les 9 écrans du wizard (une question, un écran).
//
// Chaque écran est un composant contrôlé : il reçoit les réponses, les
// erreurs de SON écran et un patcheur. Aucune logique de navigation ici —
// elle vit dans le wizard. Pas de "use client" : importés par le wizard.
//
// Emojis : UNIQUEMENT dans les titres d’étape prévus par le brief (🤖 📍 ✨),
// jamais dans les labels de champs.

import * as React from "react";
import { Plus, Trash2, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  B2B_ANNEES_OPTIONS,
  DEPARTEMENTS,
  DEPLACEMENT_OPTIONS,
  IA_OUTILS_OPTIONS,
  INFORMATIQUE_USAGES_OPTIONS,
  MOIS_FR,
  REGIONS_ZONE,
  SOURCE_OPTIONS,
  STATUT_OPTIONS,
  TYPES_CLIENTS_OPTIONS,
} from "@/lib/commercial-application/model";
import {
  Chip,
  ChipGroup,
  GhostButton,
  MonthYearSelect,
  StepHeading,
  TextField,
  FIELD_CLASS,
  LABEL_CLASS,
} from "./ui";
import type { ExperienceDraft, FieldErrors, WizardAnswers } from "./wizard-state";

export interface StepProps {
  a: WizardAnswers;
  set: (patch: Partial<WizardAnswers>) => void;
  errors: FieldErrors;
}

const CURRENT_YEAR = new Date().getFullYear();

/** Années proposées pour les expériences (10 ans d’historique + marge). */
const EXP_YEARS: readonly string[] = Array.from({ length: 41 }, (_, i) => String(CURRENT_YEAR - i));

/** Années proposées pour la disponibilité. */
const DISPO_YEARS: readonly string[] = [
  String(CURRENT_YEAR),
  String(CURRENT_YEAR + 1),
  String(CURRENT_YEAR + 2),
];

// ── Étape 1 — Qui es-tu ─────────────────────────────────────────────────────

export function StepIdentite({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="Qui es-tu ?" hint="Le minimum pour te répondre — rien de plus." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          fieldId="ca-prenom"
          value={a.prenom}
          onChange={(e) => set({ prenom: e.target.value })}
          autoComplete="given-name"
          maxLength={60}
          error={errors.prenom}
        />
        <TextField
          label="Nom"
          fieldId="ca-nom"
          value={a.nom}
          onChange={(e) => set({ nom: e.target.value })}
          autoComplete="family-name"
          maxLength={60}
          error={errors.nom}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          fieldId="ca-email"
          type="email"
          inputMode="email"
          value={a.email}
          onChange={(e) => set({ email: e.target.value })}
          autoComplete="email"
          maxLength={180}
          error={errors.email}
        />
        <TextField
          label="Téléphone"
          fieldId="ca-telephone"
          type="tel"
          inputMode="tel"
          value={a.telephone}
          onChange={(e) => set({ telephone: e.target.value })}
          autoComplete="tel"
          maxLength={40}
          error={errors.telephone}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Ville"
          fieldId="ca-ville"
          value={a.ville}
          onChange={(e) => set({ ville: e.target.value })}
          autoComplete="address-level2"
          maxLength={120}
          error={errors.ville}
        />
        <TextField
          label="Code postal"
          fieldId="ca-cp"
          inputMode="numeric"
          value={a.codePostal}
          onChange={(e) => set({ codePostal: e.target.value })}
          autoComplete="postal-code"
          maxLength={10}
          error={errors.codePostal}
        />
      </div>

      <div className="mt-4">
        <span className={LABEL_CLASS}>
          Date de naissance
          <span className="text-fg-muted ml-1.5 font-normal">(facultatif)</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          <input
            aria-label="Jour de naissance"
            className={cn(FIELD_CLASS, errors.naissance && "border-terracotta-deep")}
            inputMode="numeric"
            placeholder="Jour"
            maxLength={2}
            value={a.naissanceJour}
            onChange={(e) => set({ naissanceJour: e.target.value.replace(/\D/g, "") })}
            autoComplete="bday-day"
          />
          <input
            aria-label="Mois de naissance"
            className={cn(FIELD_CLASS, errors.naissance && "border-terracotta-deep")}
            inputMode="numeric"
            placeholder="Mois"
            maxLength={2}
            value={a.naissanceMois}
            onChange={(e) => set({ naissanceMois: e.target.value.replace(/\D/g, "") })}
            autoComplete="bday-month"
          />
          <input
            aria-label="Année de naissance"
            className={cn(FIELD_CLASS, errors.naissance && "border-terracotta-deep")}
            inputMode="numeric"
            placeholder="Année"
            maxLength={4}
            value={a.naissanceAnnee}
            onChange={(e) => set({ naissanceAnnee: e.target.value.replace(/\D/g, "") })}
            autoComplete="bday-year"
          />
        </div>
        {errors.naissance ? (
          <p className="text-terracotta-deep mt-1.5 text-sm" role="alert">
            {errors.naissance}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <TextField
          label="Nationalité"
          fieldId="ca-nationalite"
          value={a.nationalite}
          onChange={(e) => set({ nationalite: e.target.value })}
          maxLength={80}
          optionalHint
          error={errors.nationalite}
        />
      </div>
    </div>
  );
}

// ── Étape 2 — Le prérequis B2B ──────────────────────────────────────────────

export function StepB2b({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Le prérequis"
        hint="Ce poste demande une vraie expérience de la vente B2B. C’est le seul prérequis, mais il est indispensable."
      />
      <ChipGroup legend="As-tu déjà vendu en B2B ?" error={errors.b2bDejaVendu}>
        <Chip
          name="b2b"
          value="oui"
          label="Oui"
          checked={a.b2bDejaVendu === true}
          onToggle={() => set({ b2bDejaVendu: true })}
        />
        <Chip
          name="b2b"
          value="non"
          label="Non"
          checked={a.b2bDejaVendu === false}
          onToggle={() => set({ b2bDejaVendu: false, b2bAnnees: "" })}
        />
      </ChipGroup>

      {a.b2bDejaVendu === true ? (
        <div className="mt-6">
          <ChipGroup legend="Depuis combien d’années ?" error={errors.b2bAnnees}>
            {B2B_ANNEES_OPTIONS.map((o) => (
              <Chip
                key={o.id}
                name="b2b-annees"
                value={o.id}
                label={o.label}
                checked={a.b2bAnnees === o.id}
                onToggle={(v) => set({ b2bAnnees: v })}
              />
            ))}
          </ChipGroup>
        </div>
      ) : null}

      {a.b2bDejaVendu === false ? (
        <p className="bg-paper border-border text-fg-soft mt-6 rounded-2xl border px-4 py-3.5 text-[15px] leading-relaxed">
          Le profil recherché est vraiment orienté vente B2B. Tu peux quand même envoyer ta
          candidature, on la lira.
        </p>
      ) : null}
    </div>
  );
}

// ── Étape 3 — Parcours des 10 dernières années ──────────────────────────────

interface ExperienceStepProps extends StepProps {
  onPatchExperience: (id: string, patch: Partial<ExperienceDraft>) => void;
  onAddExperience: () => void;
  onRemoveExperience: (id: string) => void;
}

function experienceSummary(exp: ExperienceDraft): string {
  const periode =
    exp.debutMois && exp.debutAnnee
      ? `${exp.debutMois}/${exp.debutAnnee} → ${exp.posteActuel ? "auj." : exp.finMois && exp.finAnnee ? `${exp.finMois}/${exp.finAnnee}` : "?"}`
      : "";
  return [exp.poste || "Poste ?", exp.entreprise || "Entreprise ?", periode]
    .filter(Boolean)
    .join(" — ");
}

export function StepParcours({
  a,
  errors,
  onPatchExperience,
  onAddExperience,
  onRemoveExperience,
}: ExperienceStepProps) {
  return (
    <div>
      <StepHeading
        title="Ton parcours des 10 dernières années"
        hint="Pas besoin de tout ton parcours de vie — seulement les 10 dernières années. Une seule entreprise sur la période ? C’est très bien aussi : un seul bloc suffit."
      />
      {errors.experiences ? (
        <p className="text-terracotta-deep mb-3 text-sm" role="alert">
          {errors.experiences}
        </p>
      ) : null}
      <div className="space-y-3">
        {a.experiences.map((exp, index) => {
          const pre = `exp-${exp.id}`;
          const hasError = Object.keys(errors).some((k) => k.startsWith(pre));
          return (
            <div
              key={exp.id}
              className={cn(
                "rounded-2xl border-2",
                hasError ? "border-terracotta-deep" : "border-border",
                "bg-bg",
              )}
            >
              <div className="flex items-center gap-1 pr-2">
                <button
                  type="button"
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-4 text-left"
                  aria-expanded={exp.open}
                  onClick={() => onPatchExperience(exp.id, { open: !exp.open })}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "text-fg-muted h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none",
                      exp.open && "rotate-180",
                    )}
                  />
                  <span className="text-fg min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {experienceSummary(exp)}
                  </span>
                </button>
                {a.experiences.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemoveExperience(exp.id)}
                    className="text-fg-muted hover:text-terracotta-deep flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors"
                    aria-label={`Supprimer l’expérience ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {exp.open ? (
                <div className="border-border space-y-4 border-t px-4 py-4">
                  <TextField
                    label="Entreprise"
                    fieldId={`${pre}-entreprise`}
                    value={exp.entreprise}
                    onChange={(e) => onPatchExperience(exp.id, { entreprise: e.target.value })}
                    maxLength={120}
                    autoComplete="organization"
                    error={errors[`${pre}-entreprise`]}
                  />
                  <TextField
                    label="Ville ou département de l’entreprise"
                    fieldId={`${pre}-ville`}
                    value={exp.ville}
                    onChange={(e) => onPatchExperience(exp.id, { ville: e.target.value })}
                    maxLength={120}
                    error={errors[`${pre}-ville`]}
                  />
                  <TextField
                    label="Poste occupé"
                    fieldId={`${pre}-poste`}
                    value={exp.poste}
                    onChange={(e) => onPatchExperience(exp.id, { poste: e.target.value })}
                    maxLength={120}
                    autoComplete="organization-title"
                    error={errors[`${pre}-poste`]}
                  />
                  <MonthYearSelect
                    idPrefix={`${pre}-debut`}
                    label="De"
                    monthValue={exp.debutMois}
                    yearValue={exp.debutAnnee}
                    months={MOIS_FR}
                    years={EXP_YEARS}
                    onMonthChange={(v) => onPatchExperience(exp.id, { debutMois: v })}
                    onYearChange={(v) => onPatchExperience(exp.id, { debutAnnee: v })}
                    error={errors[`${pre}-debut`]}
                  />
                  <div>
                    <MonthYearSelect
                      idPrefix={`${pre}-fin`}
                      label="À"
                      monthValue={exp.finMois}
                      yearValue={exp.finAnnee}
                      months={MOIS_FR}
                      years={EXP_YEARS}
                      onMonthChange={(v) => onPatchExperience(exp.id, { finMois: v })}
                      onYearChange={(v) => onPatchExperience(exp.id, { finAnnee: v })}
                      error={errors[`${pre}-fin`]}
                      disabled={exp.posteActuel}
                    />
                    <label className="mt-2.5 flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[15px]">
                      <input
                        type="checkbox"
                        checked={exp.posteActuel}
                        onChange={(e) =>
                          onPatchExperience(exp.id, {
                            posteActuel: e.target.checked,
                            ...(e.target.checked ? { finMois: "", finAnnee: "" } : {}),
                          })
                        }
                        className="accent-terracotta h-5 w-5 shrink-0"
                      />
                      <span className="text-fg font-medium">C’est mon poste actuel</span>
                    </label>
                  </div>
                  <ChipGroup legend="Type de clients" optionalHint>
                    {TYPES_CLIENTS_OPTIONS.map((o) => (
                      <Chip
                        key={o.id}
                        name={`${pre}-clients`}
                        value={o.id}
                        label={o.label}
                        multi
                        checked={exp.typesClients.includes(o.id)}
                        onToggle={(v) =>
                          onPatchExperience(exp.id, {
                            typesClients: exp.typesClients.includes(v)
                              ? exp.typesClients.filter((t) => t !== v)
                              : [...exp.typesClients, v],
                          })
                        }
                      />
                    ))}
                  </ChipGroup>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {a.experiences.length < 8 ? (
        <GhostButton type="button" onClick={onAddExperience} className="mt-3">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Ajouter une expérience
        </GhostButton>
      ) : (
        <p className="text-fg-muted mt-3 text-sm">8 expériences maximum — c’est déjà très bien.</p>
      )}
    </div>
  );
}

// ── Étape 4 — L’IA au quotidien 🤖 ──────────────────────────────────────────

export function StepIa({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="L’IA au quotidien 🤖" />
      <ChipGroup legend="Utilises-tu déjà l’IA au quotidien ?" error={errors.iaUtilise}>
        <Chip
          name="ia"
          value="oui"
          label="Oui"
          checked={a.iaUtilise === true}
          onToggle={() => set({ iaUtilise: true })}
        />
        <Chip
          name="ia"
          value="non"
          label="Non"
          checked={a.iaUtilise === false}
          onToggle={() => set({ iaUtilise: false, iaOutils: [], iaOutilAutre: "", iaUsage: "" })}
        />
      </ChipGroup>

      {a.iaUtilise === true ? (
        <>
          <div className="mt-6">
            <ChipGroup legend="Lesquelles ?" optionalHint>
              {IA_OUTILS_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  name="ia-outils"
                  value={o.id}
                  label={o.label}
                  multi
                  checked={a.iaOutils.includes(o.id)}
                  onToggle={(v) =>
                    set({
                      iaOutils: a.iaOutils.includes(v)
                        ? a.iaOutils.filter((t) => t !== v)
                        : [...a.iaOutils, v],
                    })
                  }
                />
              ))}
            </ChipGroup>
          </div>
          {a.iaOutils.includes("autre") ? (
            <div className="mt-4">
              <TextField
                label="Quel autre outil ?"
                fieldId="ca-ia-autre"
                value={a.iaOutilAutre}
                onChange={(e) => set({ iaOutilAutre: e.target.value })}
                maxLength={120}
              />
            </div>
          ) : null}
          <div className="mt-4">
            <label className={LABEL_CLASS} htmlFor="ca-ia-usage">
              Pourquoi, et pour quoi faire ?
              <span className="text-fg-muted ml-1.5 font-normal">(facultatif)</span>
            </label>
            <textarea
              id="ca-ia-usage"
              rows={3}
              maxLength={600}
              className={FIELD_CLASS}
              value={a.iaUsage}
              onChange={(e) => set({ iaUsage: e.target.value })}
              placeholder="2-3 lignes suffisent : préparer tes rendez-vous, rédiger tes emails, chercher des infos sur un prospect…"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Étape 5 — L’informatique ────────────────────────────────────────────────

export function StepInformatique({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="L’informatique" />
      <ChipGroup
        legend="Utilises-tu l’informatique dans ton travail ?"
        error={errors.informatiqueUtilise}
      >
        <Chip
          name="informatique"
          value="oui"
          label="Oui"
          checked={a.informatiqueUtilise === true}
          onToggle={() => set({ informatiqueUtilise: true })}
        />
        <Chip
          name="informatique"
          value="non"
          label="Non"
          checked={a.informatiqueUtilise === false}
          onToggle={() =>
            set({ informatiqueUtilise: false, informatiqueUsages: [], informatiqueAutre: "" })
          }
        />
      </ChipGroup>

      {a.informatiqueUtilise === true ? (
        <>
          <div className="mt-6">
            <ChipGroup legend="Pour quoi faire ?" optionalHint>
              {INFORMATIQUE_USAGES_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  name="informatique-usages"
                  value={o.id}
                  label={o.label}
                  multi
                  checked={a.informatiqueUsages.includes(o.id)}
                  onToggle={(v) =>
                    set({
                      informatiqueUsages: a.informatiqueUsages.includes(v)
                        ? a.informatiqueUsages.filter((t) => t !== v)
                        : [...a.informatiqueUsages, v],
                    })
                  }
                />
              ))}
            </ChipGroup>
          </div>
          {a.informatiqueUsages.includes("autre") ? (
            <div className="mt-4">
              <TextField
                label="Quel autre usage ?"
                fieldId="ca-informatique-autre"
                value={a.informatiqueAutre}
                onChange={(e) => set({ informatiqueAutre: e.target.value })}
                maxLength={120}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ── Étape 6 — Ta zone 📍 ────────────────────────────────────────────────────

export function StepZone({ a, set, errors }: StepProps) {
  const [search, setSearch] = React.useState("");
  const query = search.trim().toLowerCase();
  const matchingDepartements = query
    ? DEPARTEMENTS.filter(
        (d) => d.nom.toLowerCase().includes(query) || d.code.startsWith(search.trim()),
      ).slice(0, 12)
    : [];

  const toggleZone = (label: string) =>
    set({
      zoneMobile: false,
      zones: a.zones.includes(label) ? a.zones.filter((z) => z !== label) : [...a.zones, label],
    });

  return (
    <div>
      <StepHeading
        title="Ta zone 📍"
        hint="Sur quelle zone souhaites-tu travailler ? Régions, départements — ou partout."
      />
      <Chip
        name="zone-mobile"
        value="mobile"
        label="Peu importe, je suis mobile"
        checked={a.zoneMobile}
        onToggle={() => set({ zoneMobile: !a.zoneMobile, zones: [] })}
        prominent
      />

      <div className="mt-5">
        <ChipGroup legend="Ou choisis une ou plusieurs régions" error={errors.zones}>
          {REGIONS_ZONE.map((r) => (
            <Chip
              key={r}
              name="zone-region"
              value={r}
              label={r}
              multi
              checked={a.zones.includes(r)}
              onToggle={() => toggleZone(r)}
            />
          ))}
        </ChipGroup>
      </div>

      <div className="mt-5">
        <label className={LABEL_CLASS} htmlFor="ca-zone-recherche">
          Ou cherche un département
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2"
          />
          <input
            id="ca-zone-recherche"
            className={cn(FIELD_CLASS, "pl-11")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Isère, 38, Drôme…"
            autoComplete="off"
          />
        </div>
        {matchingDepartements.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {matchingDepartements.map((d) => {
              const label = `${d.nom} (${d.code})`;
              return (
                <Chip
                  key={d.code}
                  name="zone-departement"
                  value={label}
                  label={label}
                  multi
                  checked={a.zones.includes(label)}
                  onToggle={() => toggleZone(label)}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {a.zones.length > 0 ? (
        <p className="text-fg-soft mt-4 text-sm" aria-live="polite">
          Zone choisie : {a.zones.join(", ")}
        </p>
      ) : null}

      <div className="mt-7">
        <ChipGroup legend="Es-tu prêt à te déplacer chez les clients ?" optionalHint columns={1}>
          {DEPLACEMENT_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              name="deplacement"
              value={o.id}
              label={o.label}
              checked={a.deplacement === o.id}
              onToggle={(v) => set({ deplacement: a.deplacement === v ? "" : v })}
            />
          ))}
        </ChipGroup>
      </div>
    </div>
  );
}

// ── Étape 7 — Toi, en quelques lignes ✨ ────────────────────────────────────

export function StepPitch({ a, set, errors }: StepProps) {
  const len = a.pitch.trim().length;
  return (
    <div>
      <StepHeading
        title="Toi, en quelques lignes ✨"
        hint="Si tu devais te décrire, de façon qui te mette vraiment en valeur ?"
      />
      <label className="sr-only" htmlFor="ca-pitch">
        Décris-toi en 300 à 800 caractères
      </label>
      <textarea
        id="ca-pitch"
        rows={7}
        maxLength={900}
        className={cn(FIELD_CLASS, errors.pitch && "border-terracotta-deep")}
        value={a.pitch}
        onChange={(e) => set({ pitch: e.target.value })}
        placeholder="Ce que tu sais faire mieux que les autres, ce dont tu es fier, la vente que tu racontes encore aujourd’hui…"
        aria-describedby="ca-pitch-compteur"
        aria-invalid={errors.pitch ? true : undefined}
      />
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        {errors.pitch ? (
          <p className="text-terracotta-deep text-sm" role="alert">
            {errors.pitch}
          </p>
        ) : (
          <span />
        )}
        <p
          id="ca-pitch-compteur"
          className={cn(
            "shrink-0 text-sm tabular-nums",
            len >= 300 && len <= 800 ? "text-fg-soft" : "text-fg-muted",
          )}
        >
          {len} / 300-800
        </p>
      </div>
    </div>
  );
}

// ── Étape 8 — Ton message (facultatif) ──────────────────────────────────────

export function StepMessage({ a, set }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Ton message"
        hint="On ne veut pas de lettre de motivation. Mais si tu as quelque chose à nous dire, c’est ici."
      />
      <label className="sr-only" htmlFor="ca-message">
        Ton message (facultatif)
      </label>
      <textarea
        id="ca-message"
        rows={6}
        maxLength={2000}
        className={FIELD_CLASS}
        value={a.messageLibre}
        onChange={(e) => set({ messageLibre: e.target.value })}
        placeholder="Tout ce qui te semble utile — ou rien du tout, c’est très bien aussi."
      />
    </div>
  );
}

// ── Étape 9 — Derniers détails ──────────────────────────────────────────────

export function StepDetails({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="Derniers détails" hint="Promis, c’est le dernier écran." />
      <MonthYearSelect
        idPrefix="ca-dispo"
        label="À partir de quand es-tu disponible ?"
        monthValue={a.dispoMois}
        yearValue={a.dispoAnnee}
        months={MOIS_FR}
        years={DISPO_YEARS}
        onMonthChange={(v) => set({ dispoMois: v })}
        onYearChange={(v) => set({ dispoAnnee: v })}
        error={errors.dispo}
      />

      <div className="mt-6">
        <ChipGroup legend="As-tu le permis et un véhicule ?" error={errors.permisVehicule}>
          <Chip
            name="permis"
            value="oui"
            label="Oui"
            checked={a.permisVehicule === true}
            onToggle={() => set({ permisVehicule: true })}
          />
          <Chip
            name="permis"
            value="non"
            label="Non"
            checked={a.permisVehicule === false}
            onToggle={() => set({ permisVehicule: false })}
          />
        </ChipGroup>
      </div>

      <div className="mt-6">
        <ChipGroup legend="Ton statut aujourd’hui" optionalHint>
          {STATUT_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              name="statut"
              value={o.id}
              label={o.label}
              checked={a.statut === o.id}
              onToggle={(v) => set({ statut: a.statut === v ? "" : v })}
            />
          ))}
        </ChipGroup>
      </div>

      <div className="mt-6">
        <TextField
          label="Profil LinkedIn"
          fieldId="ca-linkedin"
          type="url"
          inputMode="url"
          value={a.linkedin}
          onChange={(e) => set({ linkedin: e.target.value })}
          placeholder="linkedin.com/in/…"
          maxLength={255}
          optionalHint
          error={errors.linkedin}
        />
      </div>

      <div className="mt-6">
        <ChipGroup legend="Comment as-tu connu cette offre ?" optionalHint>
          {SOURCE_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              name="source"
              value={o.id}
              label={o.label}
              checked={a.sourceConnaissance === o.id}
              onToggle={(v) => set({ sourceConnaissance: a.sourceConnaissance === v ? "" : v })}
            />
          ))}
        </ChipGroup>
      </div>

      <div className="mt-7">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={a.consent}
            onChange={(e) => set({ consent: e.target.checked })}
            className="accent-terracotta mt-0.5 h-5 w-5 shrink-0"
            aria-describedby={errors.consent ? "ca-consent-error" : undefined}
          />
          <span className="text-fg-soft text-sm leading-relaxed">
            J’accepte que mes données soient traitées par Axion-IA pour l’étude de ma candidature.
            Elles sont conservées 2 ans au maximum, puis supprimées.{" "}
            <a
              href="/fr/politique-confidentialite"
              className="text-terracotta-deep underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Politique de confidentialité
            </a>
          </span>
        </label>
        {errors.consent ? (
          <p id="ca-consent-error" className="text-terracotta-deep mt-1.5 text-sm" role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>
    </div>
  );
}
