"use client";
// use-client: useActionState bind upsertJobOfferAction + auto-slug + éditeur Tiptap.

import { useActionState, useState } from "react";
import { upsertJobOfferAction, type UpsertJobOfferState } from "@/features/admin-job-offers/actions";
import { TiptapEditor } from "@/components/admin/TiptapEditor";
import { slugify } from "@/lib/slug";
import { CAREER_CATEGORIES } from "@/content/careers/categories";

const init: UpsertJobOfferState = { ok: false, error: "" };

export interface JobOfferFormInitial {
  id: string;
  slug: string;
  status: string;
  category: string;
  titleFr: string;
  titleEn: string;
  summaryFr: string;
  summaryEn: string;
  bodyFrHtml: string;
  bodyEnHtml: string;
  employmentType: string;
  contractLabel: string;
  workMode: string;
  remoteDaysPerWeek: string;
  city: string;
  region: string;
  country: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: string;
  salaryCurrency: string;
  salaryVisible: boolean;
  isCommission: boolean;
  requiresDriverLicense: boolean;
  requiresVehicle: boolean;
  screeningQuestions: string;
  perks: string;
  startDate: string;
  applicationDeadline: string;
  validThrough: string;
  teamName: string;
  managerName: string;
  heroImagePath: string;
  ogImagePath: string;
  metaTitle: string;
  metaDescription: string;
  indexationTier: string;
  displayOrder: number;
}

interface Props {
  initial?: JobOfferFormInitial;
}

export function JobOfferForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(upsertJobOfferAction, init);
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));

  function maybeAutoSlug(title: string) {
    if (!slugTouched && title) setSlug(slugify(title).slice(0, 180));
  }

  return (
    <form action={formAction} className="admin-form">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <h3 className="admin-section-title">Identité</h3>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="titleFr" className="admin-label">
            Titre (FR)
          </label>
          <input
            id="titleFr"
            name="titleFr"
            type="text"
            required
            minLength={3}
            maxLength={160}
            defaultValue={initial?.titleFr ?? ""}
            className="admin-input"
            disabled={pending}
            onBlur={(e) => maybeAutoSlug(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="titleEn" className="admin-label">
            Titre (EN)
          </label>
          <input
            id="titleEn"
            name="titleEn"
            type="text"
            required
            minLength={3}
            maxLength={160}
            defaultValue={initial?.titleEn ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="slug" className="admin-label">
            Slug (URL) — auto depuis le titre, modifiable
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="admin-input"
            disabled={pending}
            placeholder="ex: developpeur-fullstack-lyon"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="category" className="admin-label">
            Catégorie
          </label>
          <select
            id="category"
            name="category"
            defaultValue={initial?.category ?? "autre"}
            className="admin-input"
            disabled={pending}
          >
            {CAREER_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.fr}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="status" className="admin-label">
            Statut
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "draft"}
            className="admin-input"
            disabled={pending}
          >
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="displayOrder" className="admin-label">
            Ordre
          </label>
          <input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            defaultValue={initial?.displayOrder ?? 0}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="summaryFr" className="admin-label">
            Résumé (FR) — carte + meta (max 320)
          </label>
          <textarea
            id="summaryFr"
            name="summaryFr"
            required
            rows={2}
            minLength={10}
            maxLength={320}
            defaultValue={initial?.summaryFr ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="summaryEn" className="admin-label">
            Résumé (EN) — max 320
          </label>
          <textarea
            id="summaryEn"
            name="summaryEn"
            required
            rows={2}
            minLength={10}
            maxLength={320}
            defaultValue={initial?.summaryEn ?? ""}
            className="admin-input admin-textarea"
            disabled={pending}
          />
        </div>
      </div>

      <h3 className="admin-section-title">Descriptif</h3>
      <div className="admin-field">
        <label className="admin-label">Corps de l&apos;offre (FR)</label>
        <TiptapEditor name="bodyFr" initialHtml={initial?.bodyFrHtml ?? ""} />
      </div>
      <div className="admin-field">
        <label className="admin-label">Corps de l&apos;offre (EN)</label>
        <TiptapEditor name="bodyEn" initialHtml={initial?.bodyEnHtml ?? ""} />
      </div>

      <h3 className="admin-section-title">Contrat &amp; lieu</h3>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="contractLabel" className="admin-label">
            Type affiché (ex. CDI, Stage 6 mois)
          </label>
          <input
            id="contractLabel"
            name="contractLabel"
            type="text"
            maxLength={60}
            defaultValue={initial?.contractLabel ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="employmentType" className="admin-label">
            employmentType (Google)
          </label>
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={initial?.employmentType ?? "FULL_TIME"}
            className="admin-input"
            disabled={pending}
          >
            <option value="FULL_TIME">FULL_TIME</option>
            <option value="PART_TIME">PART_TIME</option>
            <option value="CONTRACTOR">CONTRACTOR</option>
            <option value="INTERN">INTERN</option>
            <option value="TEMPORARY">TEMPORARY</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="workMode" className="admin-label">
            Mode de travail
          </label>
          <select
            id="workMode"
            name="workMode"
            defaultValue={initial?.workMode ?? "on_site"}
            className="admin-input"
            disabled={pending}
          >
            <option value="on_site">Sur site</option>
            <option value="hybrid">Hybride</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="remoteDaysPerWeek" className="admin-label">
            Jours remote / sem (hybride)
          </label>
          <input
            id="remoteDaysPerWeek"
            name="remoteDaysPerWeek"
            type="number"
            min={0}
            max={5}
            defaultValue={initial?.remoteDaysPerWeek ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="city" className="admin-label">
            Ville
          </label>
          <input
            id="city"
            name="city"
            type="text"
            maxLength={120}
            defaultValue={initial?.city ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="region" className="admin-label">
            Région
          </label>
          <input
            id="region"
            name="region"
            type="text"
            maxLength={120}
            defaultValue={initial?.region ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="country" className="admin-label">
            Pays (ISO2)
          </label>
          <input
            id="country"
            name="country"
            type="text"
            maxLength={2}
            defaultValue={initial?.country ?? "FR"}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <div className="admin-form-row">
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="requiresDriverLicense"
            value="true"
            defaultChecked={initial?.requiresDriverLicense ?? false}
            disabled={pending}
          />
          Permis requis (affiche le champ au candidat)
        </label>
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="requiresVehicle"
            value="true"
            defaultChecked={initial?.requiresVehicle ?? false}
            disabled={pending}
          />
          Véhicule requis
        </label>
      </div>

      <h3 className="admin-section-title">Rémunération</h3>
      <div className="admin-form-row">
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="isCommission"
            value="true"
            defaultChecked={initial?.isCommission ?? false}
            disabled={pending}
          />
          100 % commission (omet baseSalary, JobPosting incentiveCompensation)
        </label>
        <input type="hidden" name="salaryVisible" value="false" />
        <label className="admin-checkbox">
          <input
            type="checkbox"
            name="salaryVisible"
            value="true"
            defaultChecked={initial?.salaryVisible ?? false}
            disabled={pending}
          />
          Afficher la fourchette publiquement
        </label>
      </div>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="salaryMin" className="admin-label">
            Salaire min
          </label>
          <input
            id="salaryMin"
            name="salaryMin"
            type="number"
            min={0}
            defaultValue={initial?.salaryMin ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="salaryMax" className="admin-label">
            Salaire max
          </label>
          <input
            id="salaryMax"
            name="salaryMax"
            type="number"
            min={0}
            defaultValue={initial?.salaryMax ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="salaryPeriod" className="admin-label">
            Période
          </label>
          <select
            id="salaryPeriod"
            name="salaryPeriod"
            defaultValue={initial?.salaryPeriod ?? "YEAR"}
            className="admin-input"
            disabled={pending}
          >
            <option value="YEAR">/ an</option>
            <option value="MONTH">/ mois</option>
            <option value="HOUR">/ heure</option>
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="salaryCurrency" className="admin-label">
            Devise
          </label>
          <input
            id="salaryCurrency"
            name="salaryCurrency"
            type="text"
            maxLength={3}
            defaultValue={initial?.salaryCurrency ?? "EUR"}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <h3 className="admin-section-title">Équipe &amp; dates</h3>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="teamName" className="admin-label">
            Équipe
          </label>
          <input
            id="teamName"
            name="teamName"
            type="text"
            maxLength={120}
            defaultValue={initial?.teamName ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="managerName" className="admin-label">
            Manager
          </label>
          <input
            id="managerName"
            name="managerName"
            type="text"
            maxLength={120}
            defaultValue={initial?.managerName ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="startDate" className="admin-label">
            Prise de poste
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={initial?.startDate ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="applicationDeadline" className="admin-label">
            Date limite candidature
          </label>
          <input
            id="applicationDeadline"
            name="applicationDeadline"
            type="date"
            defaultValue={initial?.applicationDeadline ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      <h3 className="admin-section-title">Questions &amp; avantages (JSON)</h3>
      <div className="admin-field">
        <label htmlFor="screeningQuestions" className="admin-label">
          Questions de l&apos;offre — JSON : [{`{ "id":"q1","labelFr":"…","labelEn":"…","required":true }`}]
        </label>
        <textarea
          id="screeningQuestions"
          name="screeningQuestions"
          rows={3}
          defaultValue={initial?.screeningQuestions ?? ""}
          className="admin-input admin-textarea"
          disabled={pending}
          placeholder='[{"id":"q1","labelFr":"Pourquoi nous ?","labelEn":"Why us?","required":true}]'
        />
      </div>
      <div className="admin-field">
        <label htmlFor="perks" className="admin-label">
          Avantages — JSON : [{`{ "labelFr":"Télétravail","labelEn":"Remote","icon":"🏡" }`}]
        </label>
        <textarea
          id="perks"
          name="perks"
          rows={2}
          defaultValue={initial?.perks ?? ""}
          className="admin-input admin-textarea"
          disabled={pending}
        />
      </div>

      <h3 className="admin-section-title">SEO &amp; images</h3>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="metaTitle" className="admin-label">
            Meta title (max 70)
          </label>
          <input
            id="metaTitle"
            name="metaTitle"
            type="text"
            maxLength={70}
            defaultValue={initial?.metaTitle ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="metaDescription" className="admin-label">
            Meta description (max 160)
          </label>
          <input
            id="metaDescription"
            name="metaDescription"
            type="text"
            maxLength={160}
            defaultValue={initial?.metaDescription ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="indexationTier" className="admin-label">
            Indexation
          </label>
          <select
            id="indexationTier"
            name="indexationTier"
            defaultValue={initial?.indexationTier ?? "tier_1_indexable"}
            className="admin-input"
            disabled={pending}
          >
            <option value="tier_1_indexable">Indexable</option>
            <option value="tier_2_noindex_follow">noindex, follow</option>
            <option value="tier_3_noindex_nofollow">noindex, nofollow</option>
          </select>
        </div>
      </div>
      <div className="admin-form-row">
        <div className="admin-field">
          <label htmlFor="heroImagePath" className="admin-label">
            Image éditoriale (chemin/URL) — optionnel
          </label>
          <input
            id="heroImagePath"
            name="heroImagePath"
            type="text"
            maxLength={255}
            defaultValue={initial?.heroImagePath ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="ogImagePath" className="admin-label">
            OG image (chemin/URL) — optionnel
          </label>
          <input
            id="ogImagePath"
            name="ogImagePath"
            type="text"
            maxLength={255}
            defaultValue={initial?.ogImagePath ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="validThrough" className="admin-label">
            Expiration (Google) — auto +1 an si vide
          </label>
          <input
            id="validThrough"
            name="validThrough"
            type="date"
            defaultValue={initial?.validThrough ?? ""}
            className="admin-input"
            disabled={pending}
          />
        </div>
      </div>

      {state.ok ? (
        <p role="status" className="admin-alert admin-alert-success">
          ✓ {state.created ? "Offre créée" : "Offre mise à jour"}.
        </p>
      ) : state.error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="admin-button">
        {pending ? "Enregistrement…" : initial?.id ? "Mettre à jour" : "Créer l'offre"}
      </button>
    </form>
  );
}
