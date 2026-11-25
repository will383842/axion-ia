// Demande d’apport d’affaires — les 7 écrans du wizard (une question, un écran).
//
// Chaque écran est un composant contrôlé : il reçoit les réponses, les
// erreurs de SON écran et un patcheur. Aucune logique de navigation ici —
// elle vit dans le wizard. Pas de "use client" : importés par le wizard.
//
// Emojis : UNIQUEMENT dans les titres d’étape prévus par le brief (🤖 📍 ✨),
// jamais dans les labels de champs.

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  B2B_ANNEES_OPTIONS,
  CARNET_DIRIGEANTS_OPTIONS,
  IA_OUTILS_OPTIONS,
  INFORMATIQUE_USAGES_OPTIONS,
  SOURCE_OPTIONS,
  STATUT_OPTIONS,
} from "@/lib/commercial-application/model";
import {
  Chip,
  ChipGroup,
  RequiredMark,
  StepHeading,
  TextField,
  FIELD_CLASS,
  LABEL_CLASS,
} from "./ui";
import type { FieldErrors, WizardAnswers } from "./wizard-state";

export interface StepProps {
  a: WizardAnswers;
  set: (patch: Partial<WizardAnswers>) => void;
  errors: FieldErrors;
}

// ── Étape 1 — Qui êtes-vous ─────────────────────────────────────────────────────

export function StepIdentite({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Qui êtes-vous ?"
        hint="Le minimum pour vous répondre — rien de plus. Les champs marqués * sont obligatoires."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom"
          fieldId="ca-prenom"
          requiredField
          value={a.prenom}
          onChange={(e) => set({ prenom: e.target.value })}
          autoComplete="given-name"
          maxLength={60}
          error={errors.prenom}
        />
        <TextField
          label="Nom"
          fieldId="ca-nom"
          requiredField
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
          requiredField
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
          requiredField
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
          requiredField
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
          requiredField
          value={a.codePostal}
          onChange={(e) => set({ codePostal: e.target.value })}
          autoComplete="postal-code"
          maxLength={10}
          error={errors.codePostal}
        />
      </div>

      {/* 🔴 2026-09-04 — LE CONSENTEMENT VIT ICI, plus au dernier écran.
          À partir de cette version, le dossier ENREGISTRE le contact dès la
          validation de cet écran : un abandon à l'écran 5 laisse une personne
          rappelable au lieu de rien. L'accord doit donc PRÉCÉDER l'écriture.
          C'est aussi plus honnête — on dit ce qu'on fait des réponses au moment
          où on les demande, pas après huit écrans de travail.
          🔑 29/09 : c'est désormais le SEUL endroit où l'accord est demandé (le
          dernier écran ne le répète plus) ; le wizard vérifie qu'il est coché
          avant l'envoi final. */}
      <div className="mt-7">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            checked={a.consent}
            onChange={(e) => set({ consent: e.target.checked })}
            className="accent-terracotta mt-0.5 h-5 w-5 shrink-0"
            aria-describedby={errors.consent ? "ca-consent-error" : undefined}
          />
          <span className="text-fg-soft text-sm leading-relaxed">
            J’accepte que mes informations soient utilisées pour l’étude de ma demande d’apport
            d’affaires.
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

// ── Étape 2 — L’expérience B2B ──────────────────────────────────────────────

export function StepB2b({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Votre expérience"
        hint="Aucune expérience de la vente n’est exigée. Vos réponses nous aident à préparer notre échange."
      />
      <ChipGroup legend="Avez-vous déjà vendu en B2B ?" requiredField error={errors.b2bDejaVendu}>
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
          <ChipGroup legend="Depuis combien d’années ?" requiredField error={errors.b2bAnnees}>
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

      {/* La question la plus prédictive du recrutement — et la seule qui mesure
          le STOCK plutôt que l'expérience. Posée « demain matin » et non
          « connais-tu des dirigeants » : la seconde invite à compter les
          rencontres de salon, la première force à penser à ceux qui
          décrocheraient vraiment.

          FACULTATIVE à dessein : la rendre bloquante ferait abandonner ceux qui
          hésitent sur le chiffre, alors qu'une demande sans carnet déclaré
          reste parfaitement exploitable — elle passe simplement par l'échange
          collectif au lieu d'un appel prioritaire. */}
      <div className="mt-6">
        <ChipGroup
          legend="Combien de dirigeants d’entreprise pourriez-vous appeler demain matin ?"
          optionalHint
          error={errors.carnetDirigeants}
        >
          {CARNET_DIRIGEANTS_OPTIONS.map((o) => (
            <Chip
              key={o.id}
              name="carnet-dirigeants"
              value={o.id}
              label={o.label}
              checked={a.carnetDirigeants === o.id}
              onToggle={(v) => set({ carnetDirigeants: a.carnetDirigeants === v ? "" : v })}
            />
          ))}
        </ChipGroup>
      </div>
    </div>
  );
}

// ── Étape 3 — L’IA au quotidien 🤖 ──────────────────────────────────────────

export function StepIa({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="L’IA au quotidien 🤖" />
      <ChipGroup
        legend="Utilisez-vous déjà l’IA au quotidien ?"
        requiredField
        error={errors.iaUtilise}
      >
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
            {/* OBLIGATOIRE quand la réponse IA est Oui (retour Will 2026-08-13). */}
            <label className={LABEL_CLASS} htmlFor="ca-ia-usage">
              Pourquoi, et pour quoi faire ?
              <RequiredMark />
            </label>
            <textarea
              id="ca-ia-usage"
              rows={3}
              maxLength={600}
              className={cn(FIELD_CLASS, errors.iaUsage && "border-terracotta-deep")}
              value={a.iaUsage}
              onChange={(e) => set({ iaUsage: e.target.value })}
              placeholder="2-3 lignes suffisent : préparer vos rendez-vous, rédiger vos e-mails, chercher des infos sur un prospect…"
              aria-required={true}
              aria-invalid={errors.iaUsage ? true : undefined}
              aria-describedby={errors.iaUsage ? "ca-ia-usage-error" : undefined}
            />
            {errors.iaUsage ? (
              <p
                id="ca-ia-usage-error"
                className="text-terracotta-deep mt-1.5 text-sm"
                role="alert"
              >
                {errors.iaUsage}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Étape 4 — L’informatique ────────────────────────────────────────────────

export function StepInformatique({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="L’informatique" />
      <ChipGroup
        legend="Utilisez-vous l’informatique dans votre travail ?"
        requiredField
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

// ── Étape 5 — Vous, en quelques lignes ✨ ────────────────────────────────────

export function StepPitch({ a, set, errors }: StepProps) {
  const len = a.pitch.trim().length;
  return (
    <div>
      <StepHeading
        title="Vous, en quelques lignes ✨"
        hint="Si vous deviez vous décrire, de façon à vraiment vous mettre en valeur ?"
      />
      <label className="sr-only" htmlFor="ca-pitch">
        Décrivez-vous en 150 à 800 caractères
      </label>
      <textarea
        id="ca-pitch"
        rows={7}
        maxLength={900}
        className={cn(FIELD_CLASS, errors.pitch && "border-terracotta-deep")}
        value={a.pitch}
        onChange={(e) => set({ pitch: e.target.value })}
        placeholder="Ce que vous savez faire mieux que les autres, ce dont vous êtes fier, la vente que vous racontez encore aujourd’hui…"
        aria-required={true}
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
            len >= 150 && len <= 800 ? "text-fg-soft" : "text-fg-muted",
          )}
        >
          {len} / 150-800
        </p>
      </div>
      {/* Anti-tassement (retour Will 2026-08-13) : annoncer le message libre
          qui vient juste après, pour que le candidat ne mette pas tout ici. */}
      <p className="text-fg-muted mt-3 text-sm">
        Étape suivante : votre message libre (facultatif) — gardez ce que vous voulez nous dire pour
        l’écran d’après.
      </p>
    </div>
  );
}

// ── Étape 6 — Votre message (facultatif) ──────────────────────────────────────

export function StepMessage({ a, set }: StepProps) {
  return (
    <div>
      <StepHeading
        title="Votre message"
        hint="Pas de lettre de motivation. Mais si vous avez quelque chose à nous dire, c’est ici."
      />
      <label className="sr-only" htmlFor="ca-message">
        Votre message (facultatif)
      </label>
      <textarea
        id="ca-message"
        rows={6}
        maxLength={2000}
        className={FIELD_CLASS}
        value={a.messageLibre}
        onChange={(e) => set({ messageLibre: e.target.value })}
        placeholder="Tout ce qui vous semble utile — ou rien du tout, c’est très bien aussi."
      />
    </div>
  );
}

// ── Étape 7 — Derniers détails ──────────────────────────────────────────────

export function StepDetails({ a, set, errors }: StepProps) {
  return (
    <div>
      <StepHeading title="Derniers détails" hint="Promis, c’est le dernier écran." />
      <div>
        <ChipGroup legend="Votre statut aujourd’hui" optionalHint>
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
          // Dernier champ texte du dernier écran : la touche d'action doit
          // dire « OK », pas « Suivant » — il n'y a plus de champ après.
          enterKeyHint="done"
          value={a.linkedin}
          onChange={(e) => set({ linkedin: e.target.value })}
          placeholder="linkedin.com/in/…"
          maxLength={255}
          optionalHint
          error={errors.linkedin}
        />
      </div>

      <div className="mt-6">
        <ChipGroup legend="Comment avez-vous connu cette offre ?" optionalHint>
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
      {/* Plus de case de consentement ici (29/09) : l'accord est demandé une
          seule fois, à l'écran 1, avant toute écriture. Le redemander au
          dernier écran faisait cocher deux fois la même chose. */}
    </div>
  );
}
