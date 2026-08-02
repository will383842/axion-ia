// use-client: formulaire interactif avec state React (useState, sonner toast) — dispatch ad-hoc non rendable côté serveur.
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { dispatchAdHocJob } from "@/server/actions/content-gen/adhoc";

// NB : `landing_ville` est VOLONTAIREMENT absent — généré par script CLI
// uniquement (hors REGISTRY content-gen, cf. generators/index.ts). Le proposer
// ici créait un job voué à échouer « No generator registered ».
const CONTENT_TYPES = [
  { value: "blog_article", label: "Blog article" },
  { value: "blog_from_rss", label: "Blog depuis RSS" },
  { value: "blog_from_keywords", label: "Blog depuis mots-clés" },
  { value: "blog_from_title", label: "Blog depuis titre" },
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

export function AdHocDispatchV2({ adminPrefix: _adminPrefix }: Props) {
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
      toast.success(`Job dispatché — ID : ${result.jobId}`);
    } catch (err) {
      // Détail technique en console — le toast porte un message métier fixe.
      console.error("[adhoc-dispatch] dispatch du job en échec :", err);
      toast.error(
        "Échec du lancement du job. Vérifiez les champs et réessayez — détail en console.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Lancement ad-hoc</h1>
        <p className="text-muted-foreground text-sm">
          Dispatch un job de génération immédiat, hors cycle orchestrateur.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Type de contenu</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
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
          <label className="text-sm font-medium">Titre / mot-clé imposé (optionnel)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Automatiser sa facturation avec l'IA en cabinet comptable"
            className="w-full rounded border px-3 py-2 text-sm"
            maxLength={140}
          />
          <p className="text-muted-foreground text-xs">
            Si renseigné, ce titre est imposé au générateur (sujet exact). Laissé vide, le worker
            pioche automatiquement un mot-clé dans le pool de seeds.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Ville (slug, optionnel)</label>
          <input
            type="text"
            value={anchorVilleSlug}
            onChange={(e) => setAnchorVilleSlug(e.target.value)}
            placeholder="ex: paris, lyon-3e"
            className="w-full rounded border px-3 py-2 text-sm"
            maxLength={100}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Intention de recherche</label>
          <select
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {SEARCH_INTENTS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">ID de campagne (optionnel)</label>
          <input
            type="text"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="cuid de la campagne à rattacher"
            className="w-full rounded border px-3 py-2 font-mono text-sm"
            maxLength={30}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-primary-fg hover:bg-primary-hover rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Envoi…" : "Dispatcher le job"}
        </button>
      </form>

      {lastJobId && (
        <div className="bg-muted/40 rounded border p-3 text-sm">
          <span className="font-medium">Dernier job dispatché :</span>{" "}
          <code className="font-mono text-xs">{lastJobId}</code>
        </div>
      )}
    </div>
  );
}
