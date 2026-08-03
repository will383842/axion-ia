// use-client: formulaire interactif avec state React (useState, sonner toast) — dispatch ad-hoc non rendable côté serveur.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { dispatchAdHocJob } from "@/server/actions/content-gen/adhoc";

// NB : `landing_ville` est VOLONTAIREMENT absent — généré par script CLI
// uniquement (hors REGISTRY content-gen, cf. generators/index.ts). Le proposer
// ici créait un job voué à échouer « No generator registered ».
const CONTENT_TYPES = [
  { value: "blog_article", label: "Article de blog" },
  { value: "blog_from_rss", label: "Article depuis un flux RSS" },
  { value: "blog_from_keywords", label: "Article depuis des mots-clés" },
  { value: "blog_from_title", label: "Article depuis un titre" },
  { value: "comparison", label: "Comparatif" },
  { value: "guide_pilier", label: "Guide pilier" },
  { value: "qa_derived", label: "Q/R dérivé" },
  { value: "faq_standalone", label: "FAQ autonome" },
] as const;

// B5 (CONTENT-GEN-UX 2026) — aligné sur l'enum DB `SearchIntent` (8 valeurs).
// Avant : `commercial` (inexistant en DB) → la Server Action `dispatchAdHocJob`
// rejetait la valeur en Zod. Désormais on propose les valeurs réelles.
const SEARCH_INTENTS = [
  { value: "informational", label: "Informationnel" },
  { value: "commercial_investigation", label: "Commercial / comparaison" },
  { value: "transactional", label: "Transactionnel" },
  { value: "navigational", label: "Navigationnel" },
  { value: "local", label: "Local" },
  { value: "voice_search", label: "Recherche vocale" },
  { value: "ai_overview", label: "Aperçu IA (AI Overview)" },
  { value: "featured_snippet", label: "Extrait optimisé (featured snippet)" },
] as const;

interface Props {
  adminPrefix: string;
}

export function AdHocDispatchV2({ adminPrefix }: Props) {
  const [contentType, setContentType] = useState<string>("blog_article");
  const [title, setTitle] = useState("");
  const [anchorVilleSlug, setAnchorVilleSlug] = useState("");
  const [searchIntent, setSearchIntent] = useState<string>("informational");
  const [campaignId, setCampaignId] = useState("");
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await dispatchAdHocJob({
        contentType: contentType as Parameters<typeof dispatchAdHocJob>[0]["contentType"],
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
        searchIntent: searchIntent as Parameters<typeof dispatchAdHocJob>[0]["searchIntent"],
        ...(campaignId ? { campaignId } : {}),
      });
      setLastJobId(result.jobId);
      toast.success("Génération lancée. Suivez-la depuis la carte ci-dessous.");
    } catch (err) {
      // Détail technique en console — le toast porte un message métier fixe.
      console.error("[adhoc-dispatch] dispatch du job en échec :", err);
      toast.error("Le lancement a échoué. Vérifiez les champs et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // 🔴 Seule page du module sans AUCUNE primitive admin : des `div` et un
    // `h1` nus, et des jetons absents de la charte admin (`bg-primary`,
    // `text-muted-foreground`, `bg-muted/40`). Elle ne ressemblait à aucun
    // autre écran de la console.
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Générer une page à la demande"
        description="Lance une génération immédiate, sans attendre le cycle automatique."
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="adhocdispatchv2-type-de-contenu" className="admin-label">
            Type de contenu
          </label>
          <select
            id="adhocdispatchv2-type-de-contenu"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="admin-input"
            required
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="adhocdispatchv2-titre-mot-cle-impose-optionnel" className="admin-label">
            Titre ou mot-clé imposé (facultatif)
          </label>
          <input
            id="adhocdispatchv2-titre-mot-cle-impose-optionnel"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Automatiser sa facturation avec l'IA en cabinet comptable"
            className="admin-input"
            maxLength={140}
          />
          <p className="admin-meta-small">
            Si renseigné, ce titre est imposé tel quel comme sujet. Laissé vide, un mot-clé est
            choisi automatiquement dans la réserve.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="adhocdispatchv2-ville-slug-optionnel" className="admin-label">
            Ville (facultatif)
          </label>
          <input
            id="adhocdispatchv2-ville-slug-optionnel"
            type="text"
            value={anchorVilleSlug}
            onChange={(e) => setAnchorVilleSlug(e.target.value)}
            placeholder="ex: paris, lyon-3e"
            className="admin-input"
            maxLength={100}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="adhocdispatchv2-intention-de-recherche" className="admin-label">
            Intention de recherche
          </label>
          <select
            id="adhocdispatchv2-intention-de-recherche"
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            className="admin-input"
          >
            {SEARCH_INTENTS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="adhocdispatchv2-id-de-campagne-optionnel" className="admin-label">
            Rattacher à une campagne (facultatif)
          </label>
          <input
            id="adhocdispatchv2-id-de-campagne-optionnel"
            type="text"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="Identifiant de la campagne"
            className="admin-input"
            maxLength={30}
          />
        </div>

        <button type="submit" disabled={loading} className="admin-button">
          {loading ? "Lancement…" : "Lancer la génération"}
        </button>
      </form>

      {lastJobId && (
        <AdminCard className="mt-[var(--space-admin-5)]">
          {/* 🔴 L'identifiant brut était TOUT ce que la page rendait après un
              lancement : ni lien, ni état, rien à en faire. */}
          <span className="font-medium">Dernière génération lancée :</span>{" "}
          <a href={`/fr/${adminPrefix}/content-gen/jobs/${lastJobId}`} className="admin-link">
            Suivre cette génération
          </a>
        </AdminCard>
      )}
    </AdminPageShell>
  );
}
