"use client";
// use-client: sélection de fichier, envoi par morceaux avec progression, relecture de l'état.

// DÉPOSER SES MEILLEURS MONTAGES — page « Tes tarifs » (Will, 2026-09-28).
//
// Mobile d'abord : un seul bouton, une barre de progression par vidéo, l'état
// dit en mots (« analyse antivirus… », « reçue »). L'envoi se fait par morceaux
// de 4 Mo (Cloudflare refuse un corps de plus de 100 Mo, et un morceau perdu sur
// une connexion mobile se renvoie seul, jusqu'à trois fois).
// Le jeton voyage dans l'en-tête `x-jeton`, jamais dans l'URL.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  extensionAutorisee,
  nombreDeMorceaux,
  tailleLisible,
  VIDEO_ACCEPT,
  VIDEO_OCTETS_MAX,
  VIDEOS_MAX,
  type StatutVideo,
} from "@/lib/careers/videos";

interface VideoListee {
  id: string;
  nomOriginal: string;
  taille: number;
  octetsRecus: number;
  statut: StatutVideo;
  motifRejet: string | null;
}

const LIBELLE: Record<StatutVideo, string> = {
  envoi: "Envoi…",
  analyse: "Analyse antivirus…",
  disponible: "Reçue ✅",
  rejetee: "Refusée",
};

export function DeposerVideos({ jeton }: { jeton: string }) {
  const [videos, setVideos] = useState<VideoListee[]>([]);
  const [progres, setProgres] = useState<{ nom: string; pct: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const entete = { "x-jeton": jeton };

  const relire = useCallback(async () => {
    const r = await fetch("/api/candidature/video", { headers: { "x-jeton": jeton } }).catch(
      () => null,
    );
    const j = (await r?.json().catch(() => null)) as { ok: boolean; videos?: VideoListee[] } | null;
    if (j?.ok && j.videos) setVideos(j.videos);
  }, [jeton]);

  // Chargement initial : l'état n'est posé que dans le callback de la requête
  // (règle react-hooks/set-state-in-effect), et jamais après démontage.
  useEffect(() => {
    let actif = true;
    fetch("/api/candidature/video", { headers: { "x-jeton": jeton } })
      .then((r) => r.json() as Promise<{ ok: boolean; videos?: VideoListee[] }>)
      .then((j) => {
        if (actif && j.ok && j.videos) setVideos(j.videos);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [jeton]);

  // Tant qu'une vidéo est en analyse, on relit toutes les 5 s.
  const enAnalyse = videos.some((v) => v.statut === "analyse");
  useEffect(() => {
    if (!enAnalyse) return;
    const t = setInterval(() => void relire(), 5000);
    return () => clearInterval(t);
  }, [enAnalyse, relire]);

  const visibles = videos.filter((v) => v.statut !== "envoi" || progres);
  const places =
    VIDEOS_MAX - videos.filter((v) => v.statut === "analyse" || v.statut === "disponible").length;

  async function envoyer(fichier: File) {
    setErreur(null);
    if (!extensionAutorisee(fichier.name)) return setErreur("Formats acceptés : MP4, MOV ou WebM.");
    if (fichier.size > VIDEO_OCTETS_MAX) return setErreur("200 Mo au maximum par vidéo.");

    const init = await fetch("/api/candidature/video", {
      method: "POST",
      headers: { ...entete, "Content-Type": "application/json" },
      body: JSON.stringify({ nom: fichier.name, taille: fichier.size }),
    }).catch(() => null);
    const ij = (await init?.json().catch(() => null)) as
      { ok: true; id: string; tailleMorceau: number } | { ok: false; error: string } | null;
    if (!ij || !ij.ok) return setErreur(ij && !ij.ok ? ij.error : "Envoi impossible, réessaie.");

    const n = nombreDeMorceaux(fichier.size);
    setProgres({ nom: fichier.name, pct: 0 });
    for (let i = 0; i < n; i++) {
      const morceau = fichier.slice(i * ij.tailleMorceau, (i + 1) * ij.tailleMorceau);
      let reussi = false;
      for (let essai = 0; essai < 3 && !reussi; essai++) {
        const r = await fetch(`/api/candidature/video/${ij.id}?i=${i}`, {
          method: "PUT",
          headers: { ...entete, "Content-Type": "application/octet-stream" },
          body: morceau,
        }).catch(() => null);
        reussi = !!r?.ok;
      }
      if (!reussi) {
        setProgres(null);
        return setErreur("La connexion a coupé pendant l'envoi. Réessaie.");
      }
      setProgres({ nom: fichier.name, pct: Math.round(((i + 1) / n) * 100) });
    }
    const fin = await fetch(`/api/candidature/video/${ij.id}/fin`, {
      method: "POST",
      headers: entete,
    }).catch(() => null);
    const fj = (await fin?.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    setProgres(null);
    if (!fj?.ok) setErreur(fj?.error ?? "L'envoi n'a pas abouti, réessaie.");
    await relire();
  }

  async function retirer(id: string) {
    await fetch(`/api/candidature/video/${id}`, { method: "DELETE", headers: entete }).catch(
      () => null,
    );
    await relire();
  }

  return (
    <section className="mt-10 space-y-3" aria-labelledby="titre-videos">
      <h2 id="titre-videos" className="text-fg text-base font-semibold">
        Tes meilleurs montages <span className="text-fg-soft font-normal">(facultatif)</span>
      </h2>
      <p className="text-fg-soft text-sm">
        Jusqu’à {VIDEOS_MAX} vidéos (MP4, MOV ou WebM, 200 Mo max chacune). Elles servent uniquement
        à évaluer ta candidature, sont vérifiées par un antivirus et supprimées avec elle.
      </p>

      {visibles.length > 0 ? (
        <ul className="space-y-2">
          {visibles.map((v) => (
            <li
              key={v.id}
              className="border-border flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{v.nomOriginal}</span>
              <span className="text-fg-soft shrink-0">{tailleLisible(v.taille)}</span>
              <span
                className={
                  v.statut === "rejetee"
                    ? "text-accent-red shrink-0 font-medium"
                    : "shrink-0 font-medium"
                }
                title={v.motifRejet ?? undefined}
              >
                {LIBELLE[v.statut]}
              </span>
              {v.statut !== "envoi" ? (
                <button
                  type="button"
                  onClick={() => void retirer(v.id)}
                  className="text-fg-soft shrink-0 underline"
                  aria-label={`Retirer ${v.nomOriginal}`}
                >
                  Retirer
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {progres ? (
        <div role="status" aria-live="polite" className="space-y-1">
          <p className="text-fg-soft truncate text-sm">
            Envoi de {progres.nom} — {progres.pct} %
          </p>
          <div className="bg-border h-2 w-full overflow-hidden rounded-full">
            <div className="bg-terracotta h-2" style={{ width: `${progres.pct}%` }} />
          </div>
        </div>
      ) : null}

      {erreur ? (
        <p role="alert" className="text-accent-red text-sm font-medium">
          {erreur}
        </p>
      ) : null}

      {places > 0 && !progres ? (
        <>
          <input
            ref={input}
            type="file"
            accept={VIDEO_ACCEPT}
            className="sr-only"
            id="deposer-video"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void envoyer(f);
            }}
          />
          <label
            htmlFor="deposer-video"
            className="border-terracotta text-terracotta block w-full cursor-pointer rounded-full border-2 px-6 py-3.5 text-center text-base font-semibold"
          >
            + Ajouter une vidéo
          </label>
        </>
      ) : null}
    </section>
  );
}
