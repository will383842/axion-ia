"use client";
// use-client: formulaire de saisie à état local (aperçu et pastille d'indexation en direct, recherche de lieu, appels aux actions serveur).

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { NOTE_PREUVE_MIN as NOTE_REFUS_MIN } from "@/lib/equipe/console/schemas";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { TEAM_CATEGORIES, evaluerIndexabilite } from "@/lib/equipe/donnees";
import {
  creerCollaborateur,
  depublierCollaborateur,
  effacerCollaborateurDefinitivement,
  modifierCollaborateur,
  proposerSlugCollaborateur,
  publierCollaborateur,
  rechercherLieux,
  retirerConsentementCollaborateur,
  type LieuTrouve,
} from "@/server/actions/equipe/collaborateurs";
import { deposerPhotoAction, retirerPhotoAction } from "@/server/actions/equipe/photo";
import {
  enregistrerEnBrouillon,
  refuserFiche,
  validerEtPublier,
} from "@/server/actions/equipe/a-valider";

export interface FicheInitiale {
  id?: string;
  /** `updatedAt` de la fiche chargée (ISO) : refus serveur si elle a changé entre-temps. */
  version?: string;
  status: string;
  publishedAt: boolean;
  category: string;
  firstName: string;
  organizationName: string;
  jobTitle: string;
  headline: string;
  bioMd: string;
  skills: string;
  languages: string;
  websiteUrl: string;
  linkedinUrl: string;
  citySlug: string;
  departmentCode: string;
  locationLabel: string;
  showOnMap: boolean;
  slug: string;
  sortOrder: number;
  consentPublication: boolean;
  consentLinkedin: boolean;
  consentNote: string;
  /** Données de la fiche enregistrée, utiles à la pastille d'indexabilité. */
  photoKind: string;
  photoConsent: boolean;
  photoUrl256: string | null;
  questionnaireVersion: string | null;
  categoryAnswers: unknown;
}

const liste = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function CollaborateurForm({
  initial,
  modeValidation = false,
}: {
  initial: FicheInitiale;
  /** Écran « À valider » : les trois décisions remplacent « Publier » (pas de consentement saisi ici). */
  modeValidation?: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [lieux, setLieux] = useState<LieuTrouve[]>([]);
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<string | null>(null);
  const [noteRefus, setNoteRefus] = useState("");
  const [confirmationEffacement, setConfirmationEffacement] = useState("");
  const [demandeLe, setDemandeLe] = useState("");
  const [enCours, demarrer] = useTransition();
  const maj = <K extends keyof FicheInitiale>(cle: K, valeur: FicheInitiale[K]) =>
    setF((p) => ({ ...p, [cle]: valeur }));

  const indexabilite = evaluerIndexabilite({
    category: f.category,
    questionnaireVersion: f.questionnaireVersion,
    photoKind: f.photoKind,
    photoConsentAt: f.photoConsent ? new Date(0) : null,
    photoUrl256: f.photoUrl256,
    bioMd: f.bioMd,
    skills: liste(f.skills),
    languages: liste(f.languages),
    categoryAnswers: f.categoryAnswers,
    linkedinUrl: f.linkedinUrl || null,
    linkedinConsentAt: f.consentLinkedin ? new Date(0) : null,
    websiteUrl: f.websiteUrl || null,
  });

  const payload = () => ({
    category: f.category,
    firstName: f.firstName,
    organizationName: f.organizationName,
    jobTitle: f.jobTitle,
    headline: f.headline,
    bioMd: f.bioMd,
    skills: liste(f.skills),
    languages: liste(f.languages),
    websiteUrl: f.websiteUrl,
    linkedinUrl: f.linkedinUrl,
    citySlug: f.citySlug,
    departmentCode: f.departmentCode,
    showOnMap: f.showOnMap,
    slug: f.slug || undefined,
    sortOrder: f.sortOrder,
    consentPublication: f.consentPublication,
    consentLinkedin: f.consentLinkedin,
    consentNote: f.consentNote,
  });

  const executer = (
    travail: () => Promise<{ ok: boolean; erreur?: string; champs?: Record<string, string> }>,
    message: string,
  ) =>
    demarrer(async () => {
      setErreur(null);
      setInfo(null);
      setChamps({});
      const r = await travail();
      if (!r.ok) {
        setErreur(r.erreur ?? "Échec.");
        setChamps(r.champs ?? {});
        // Une décision peut avoir enregistré les modifications avant de refuser : version à jour.
        if (modeValidation) router.refresh();
        return;
      }
      setInfo(message);
      router.refresh();
    });

  const enregistrer = () =>
    demarrer(async () => {
      setErreur(null);
      setInfo(null);
      setChamps({});
      const r = f.id
        ? await modifierCollaborateur(f.id, payload(), f.version)
        : await creerCollaborateur(payload());
      if (!r.ok) {
        setErreur(r.erreur);
        setChamps(r.champs ?? {});
        return;
      }
      if (!f.id && "id" in r) {
        router.push(`./${r.id}`);
        return;
      }
      setInfo("Fiche enregistrée.");
      router.refresh();
    });

  const chercher = (q: string) => {
    setRecherche(q);
    if (q.trim().length < 2) return setLieux([]);
    void rechercherLieux(q).then((r) => setLieux(r.ok ? r.lieux : []));
  };

  const proposer = () =>
    demarrer(async () => {
      const r = await proposerSlugCollaborateur({
        firstName: f.firstName,
        category: f.category,
        citySlug: f.citySlug,
        departmentCode: f.departmentCode,
        ...(f.id ? { excluId: f.id } : {}),
      });
      if (r.ok) maj("slug", r.slug);
      else setErreur(r.erreur);
    });

  const fichierPhoto = useRef<HTMLInputElement>(null);
  const [altPhoto, setAltPhoto] = useState("");
  const [notePhoto, setNotePhoto] = useState("");
  const aPhoto = f.photoKind === "reelle" && f.photoUrl256 !== null;

  const deposerPhoto = () => {
    const fichier = fichierPhoto.current?.files?.[0];
    if (!f.id) return;
    if (!fichier) {
      setErreur("Choisissez une photo.");
      return;
    }
    const donnees = new FormData();
    donnees.set("photo", fichier);
    donnees.set("alt", altPhoto);
    donnees.set("note", notePhoto);
    executer(() => deposerPhotoAction(f.id, donnees), "Photo enregistrée.");
  };

  const slugFige = f.publishedAt;
  const peutPublier = f.id !== undefined && f.status !== "publie" && f.consentPublication;
  const err = (c: string) =>
    champs[c] ? (
      <small role="alert" className="text-[color:var(--color-admin-destructive)]">
        {champs[c]}
      </small>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        {erreur ? (
          <p role="alert" className="text-[color:var(--color-admin-destructive)]">
            {erreur}
          </p>
        ) : null}
        {info ? <p role="status">{info}</p> : null}

        <label className="flex flex-col gap-1">
          Catégorie
          <select value={f.category} onChange={(e) => maj("category", e.target.value)}>
            {TEAM_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.singulier}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Prénom (seul affiché, jamais de nom de famille)
          <input
            value={f.firstName}
            maxLength={80}
            required
            onChange={(e) => maj("firstName", e.target.value)}
          />
          {err("firstName")}
        </label>
        {f.category === "partenaire" ? (
          <label className="flex flex-col gap-1">
            Nom de la structure (avec accord)
            <input
              value={f.organizationName}
              maxLength={160}
              onChange={(e) => maj("organizationName", e.target.value)}
            />
            {err("organizationName")}
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          Intitulé du rôle
          <input
            value={f.jobTitle}
            maxLength={120}
            required
            onChange={(e) => maj("jobTitle", e.target.value)}
          />
          {err("jobTitle")}
        </label>
        <label className="flex flex-col gap-1">
          Accroche
          <input
            value={f.headline}
            maxLength={200}
            onChange={(e) => maj("headline", e.target.value)}
          />
          {err("headline")}
        </label>
        <label className="flex flex-col gap-1">
          Présentation ({f.bioMd.trim().length} caractères ; 300 au moins pour compter dans
          l&apos;indexation)
          <textarea
            rows={8}
            value={f.bioMd}
            maxLength={2000}
            onChange={(e) => maj("bioMd", e.target.value)}
          />
          {err("bioMd")}
        </label>
        <label className="flex flex-col gap-1">
          Compétences (séparées par des virgules)
          <input value={f.skills} onChange={(e) => maj("skills", e.target.value)} />
          {err("skills")}
        </label>
        <label className="flex flex-col gap-1">
          Langues parlées (séparées par des virgules)
          <input value={f.languages} onChange={(e) => maj("languages", e.target.value)} />
          {err("languages")}
        </label>
        <label className="flex flex-col gap-1">
          Site personnel (https)
          <input
            type="url"
            value={f.websiteUrl}
            onChange={(e) => maj("websiteUrl", e.target.value)}
          />
          {err("websiteUrl")}
        </label>
        <label className="flex flex-col gap-1">
          Profil LinkedIn (affiché seulement avec l&apos;accord)
          <input
            type="url"
            value={f.linkedinUrl}
            onChange={(e) => maj("linkedinUrl", e.target.value)}
          />
          {err("linkedinUrl")}
        </label>

        <fieldset className="space-y-2">
          <legend>Lieu (ville ou département, jamais d&apos;adresse)</legend>
          <p>
            Lieu actuel : <strong>{f.locationLabel || "aucun"}</strong>
            {f.locationLabel ? (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() =>
                  setF((p) => ({
                    ...p,
                    citySlug: "",
                    departmentCode: "",
                    locationLabel: "",
                    showOnMap: false,
                  }))
                }
              >
                Retirer
              </button>
            ) : null}
          </p>
          <input
            type="search"
            aria-label="Rechercher une ville ou un département"
            placeholder="Rechercher une ville ou un département"
            value={recherche}
            onChange={(e) => chercher(e.target.value)}
          />
          {lieux.length > 0 ? (
            <ul className="space-y-1">
              {lieux.map((l) => (
                <li key={`${l.type}-${l.valeur}`}>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setF((p) => ({
                        ...p,
                        citySlug: l.type === "ville" ? l.valeur : "",
                        departmentCode: l.type === "departement" ? l.valeur : "",
                        locationLabel: l.libelle,
                      }));
                      setLieux([]);
                      setRecherche("");
                    }}
                  >
                    {l.libelle}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {err("citySlug")}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.showOnMap}
              disabled={f.locationLabel === ""}
              onChange={(e) => maj("showOnMap", e.target.checked)}
            />
            Afficher un point sur la carte
          </label>
        </fieldset>

        <label className="flex flex-col gap-1">
          Slug de la page {slugFige ? "(figé après la première publication)" : ""}
          <span className="flex gap-2">
            <input
              className="flex-1"
              value={f.slug}
              disabled={slugFige}
              placeholder="proposé automatiquement"
              onChange={(e) => maj("slug", e.target.value)}
            />
            {!slugFige ? (
              <AdminButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={proposer}
                disabled={f.firstName.trim() === ""}
              >
                Proposer
              </AdminButton>
            ) : null}
          </span>
          {err("slug")}
        </label>
        <label className="flex flex-col gap-1">
          Ordre d&apos;affichage (plus petit = plus haut)
          <input
            type="number"
            min={0}
            max={10000}
            value={f.sortOrder}
            onChange={(e) => maj("sortOrder", Number(e.target.value))}
          />
        </label>

        <fieldset className="space-y-2">
          <legend>Accords de la personne</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.consentPublication}
              disabled={modeValidation}
              onChange={(e) => maj("consentPublication", e.target.checked)}
            />
            Accord de publication de la page
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={f.consentLinkedin}
              disabled={modeValidation}
              onChange={(e) => maj("consentLinkedin", e.target.checked)}
            />
            Accord d&apos;affichage du lien LinkedIn
          </label>
          <label className="flex flex-col gap-1">
            Note de preuve (obligatoire pour un accord saisi ici : quand, comment, par quel message)
            <textarea
              rows={3}
              value={f.consentNote}
              maxLength={2000}
              onChange={(e) => maj("consentNote", e.target.value)}
            />
            {err("consentNote")}
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <AdminButton type="submit" loading={enCours}>
            Enregistrer
          </AdminButton>
          {modeValidation && f.id ? (
            <>
              <AdminButton
                type="button"
                variant="secondary"
                disabled={enCours}
                onClick={() =>
                  executer(
                    () => enregistrerEnBrouillon(f.id, payload(), f.version),
                    "Fiche enregistrée en brouillon.",
                  )
                }
              >
                Enregistrer en brouillon
              </AdminButton>
              <AdminButton
                type="button"
                disabled={!peutPublier || enCours}
                onClick={() =>
                  executer(
                    () => validerEtPublier(f.id, payload(), f.version),
                    "Fiche validée et publiée.",
                  )
                }
              >
                Valider et publier
              </AdminButton>
            </>
          ) : null}
          {!modeValidation && f.id && f.status !== "publie" ? (
            <AdminButton
              type="button"
              variant="secondary"
              disabled={!peutPublier || enCours}
              onClick={() => executer(() => publierCollaborateur(f.id), "Fiche publiée.")}
            >
              Publier
            </AdminButton>
          ) : null}
          {f.id && f.status === "publie" ? (
            <AdminButton
              type="button"
              variant="danger"
              disabled={enCours}
              onClick={() => executer(() => depublierCollaborateur(f.id), "Fiche dépubliée.")}
            >
              Dépublier maintenant
            </AdminButton>
          ) : null}
        </div>
        {modeValidation && f.id ? (
          <section aria-label="Refus" className="border-terracotta space-y-2 rounded border p-4">
            <h2 className="text-lg font-semibold">Refuser cette fiche</h2>
            <label className="flex flex-col gap-1">
              Note de refus (obligatoire, {NOTE_REFUS_MIN} caractères au moins). La fiche repart en
              brouillon, rien n&apos;est publié.
              <textarea
                rows={3}
                value={noteRefus}
                maxLength={2000}
                onChange={(e) => setNoteRefus(e.target.value)}
              />
            </label>
            <AdminButton
              type="button"
              variant="danger"
              disabled={enCours || noteRefus.trim().length < NOTE_REFUS_MIN}
              onClick={() =>
                executer(() => refuserFiche(f.id, noteRefus, f.version), "Fiche refusée.")
              }
            >
              Refuser
            </AdminButton>
          </section>
        ) : null}
        {f.id && !modeValidation ? (
          <section aria-label="Retrait et effacement" className="space-y-3 rounded border p-4">
            <h2 className="text-lg font-semibold">Retrait et effacement</h2>
            <div className="flex flex-wrap gap-2">
              {f.photoConsent ? (
                <AdminButton
                  type="button"
                  variant="secondary"
                  disabled={enCours}
                  onClick={() =>
                    executer(
                      () => retirerConsentementCollaborateur(f.id, "photo"),
                      "Photo retirée (avatar).",
                    )
                  }
                >
                  Retirer la photo
                </AdminButton>
              ) : null}
              {f.consentLinkedin ? (
                <AdminButton
                  type="button"
                  variant="secondary"
                  disabled={enCours}
                  onClick={() =>
                    executer(
                      () => retirerConsentementCollaborateur(f.id, "linkedin"),
                      "Lien LinkedIn retiré.",
                    )
                  }
                >
                  Retirer LinkedIn
                </AdminButton>
              ) : null}
            </div>
            <div className="border-terracotta space-y-2 rounded border p-3">
              <p>
                <strong>Effacer définitivement</strong> : supprime la fiche, ses réponses, ses
                photos et ses invitations. Irréversible. Seule une trace sans donnée personnelle
                (date de la demande, date du traitement) est conservée.
              </p>
              <label className="flex flex-col gap-1">
                Date de réception de la demande (facultatif)
                <input
                  type="date"
                  value={demandeLe}
                  onChange={(e) => setDemandeLe(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                Tapez EFFACER pour confirmer
                <input
                  type="text"
                  value={confirmationEffacement}
                  autoComplete="off"
                  onChange={(e) => setConfirmationEffacement(e.target.value)}
                />
              </label>
              <AdminButton
                type="button"
                variant="danger"
                disabled={enCours || confirmationEffacement !== "EFFACER"}
                onClick={() =>
                  demarrer(async () => {
                    setErreur(null);
                    const r = await effacerCollaborateurDefinitivement(
                      f.id,
                      confirmationEffacement,
                      demandeLe,
                    );
                    if (!r.ok) {
                      setErreur(r.erreur);
                      return;
                    }
                    router.push("./");
                  })
                }
              >
                Effacer définitivement
              </AdminButton>
            </div>
          </section>
        ) : null}
        {f.id && !f.consentPublication && f.status !== "publie" ? (
          <p>
            « Publier » reste grisé tant que l&apos;accord de publication n&apos;est pas enregistré.
          </p>
        ) : null}
        {f.id ? (
          <p>
            Modifiez d&apos;abord, enregistrez, puis publiez : la publication utilise la fiche
            enregistrée.
          </p>
        ) : null}
      </form>

      <aside className="space-y-4">
        <section aria-label="Aperçu" className="rounded border p-4">
          <h2 className="text-lg font-semibold">Aperçu</h2>
          <p className="text-xl">{f.firstName || "Prénom"}</p>
          <p>{f.jobTitle || "Intitulé du rôle"}</p>
          {f.headline ? <p className="italic">{f.headline}</p> : null}
          {f.locationLabel ? <p>{f.locationLabel}</p> : null}
          <p className="mt-2 whitespace-pre-line">{f.bioMd}</p>
          {liste(f.skills).length > 0 ? (
            <p className="mt-2">{liste(f.skills).join(" · ")}</p>
          ) : null}
        </section>
        <section aria-label="Indexation" className="rounded border p-4">
          <h2 className="text-lg font-semibold">Indexation</h2>
          <AdminBadge tone={indexabilite.indexable ? "success" : "warning"}>
            {indexabilite.indexable ? "Indexable" : "noindex"}
          </AdminBadge>
          <p className="mt-2">Éléments propres à la personne : {indexabilite.elementsPropres}</p>
          {indexabilite.manque.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {indexabilite.manque.map((m) => (
                <li key={m}>Il manque : {m}</li>
              ))}
            </ul>
          ) : null}
          {!f.photoConsent || !aPhoto ? (
            <p className="mt-2 text-sm">
              Sans photo réelle avec l&apos;accord de la personne, la fiche reste en noindex.
            </p>
          ) : null}
        </section>
        {f.id ? (
          <section aria-label="Photo" className="space-y-2 rounded border p-4">
            <h2 className="text-lg font-semibold">Photo</h2>
            <p>
              {aPhoto
                ? "Photo réelle enregistrée. Le public ne la voit que si la fiche est publiée avec l'accord photo ; sinon, c'est l'avatar à initiales."
                : "Aucune photo : le public voit l'avatar à initiales."}
            </p>
            <label className="flex flex-col gap-1">
              {aPhoto ? "Remplacer la photo" : "Déposer une photo"} (JPEG, PNG ou WebP, 8 Mo au
              plus, 400 px au moins de côté)
              <input ref={fichierPhoto} type="file" accept="image/jpeg,image/png,image/webp" />
            </label>
            <label className="flex flex-col gap-1">
              Texte alternatif (par défaut : « Photo de {f.firstName || "…"} »)
              <input
                value={altPhoto}
                maxLength={200}
                onChange={(e) => setAltPhoto(e.target.value)}
              />
            </label>
            {!f.photoConsent ? (
              <label className="flex flex-col gap-1">
                Accord photo non enregistré. Note de preuve (quand, comment, par quel message) :
                <textarea
                  rows={3}
                  value={notePhoto}
                  maxLength={2000}
                  onChange={(e) => setNotePhoto(e.target.value)}
                />
              </label>
            ) : null}
            <p className="text-sm">
              L&apos;image est ré-encodée et ses données cachées (lieu, appareil) sont supprimées.
            </p>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                type="button"
                variant="secondary"
                disabled={enCours}
                onClick={deposerPhoto}
              >
                {aPhoto ? "Remplacer" : "Déposer"}
              </AdminButton>
              {aPhoto || f.photoConsent ? (
                <AdminButton
                  type="button"
                  variant="danger"
                  disabled={enCours}
                  onClick={() => {
                    if (window.confirm("Retirer la photo et l'accord photo ? Retour à l'avatar.")) {
                      executer(
                        () => retirerPhotoAction(f.id),
                        "Photo retirée : avatar à initiales.",
                      );
                    }
                  }}
                >
                  Retirer la photo
                </AdminButton>
              ) : null}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
