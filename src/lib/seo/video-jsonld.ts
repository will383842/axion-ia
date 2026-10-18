/**
 * JSON-LD d'une PAGE VIDÉO (lot W2, plan PLAN-W1-W4 §6.3) : `VideoObject` +
 * `Clip` + `SeekToAction` + `BreadcrumbList`, dans un seul `@graph`.
 *
 * Règles (verrouillées par `__tests__/video-jsonld.spec.ts`) :
 *  - `thumbnailUrl` est un TABLEAU de 3 (16:9, 4:3, 1:1), URL absolues `/medias/` ;
 *  - AUCUN `embedUrl` : il n'existe aucune page d'intégration, et un `embedUrl`
 *    YouTube ferait de YouTube l'adresse principale de la vidéo aux yeux de Google ;
 *  - `hasPart` (Clip) et `potentialAction` (SeekToAction) ABSENTS sous 30 s ou avec
 *    moins de 2 chapitres ; aucun couple de Clip au même `startOffset` ;
 *  - le `?t=` n'apparaît QUE dans `Clip.url` et `SeekToAction.target` (c'est leur
 *    définition) — jamais dans la canonique, `og:url`, le fil d'Ariane ni le plan du site ;
 *  - dates avec fuseau (Europe/Paris), jamais « Z » nu ; `creator` = l'organisation,
 *    sauf la Person de Williams quand il est à l'image (D7).
 */
import { SEUIL_CHAPITRES_SECONDES } from "@/server/videos/contrat";
import { mentionIa } from "@/server/videos/mention-ia";
import type { VideoPubliee } from "@/server/videos/lecture";

export function dureeIso8601(totalSecondes: number): string {
  const h = Math.floor(totalSecondes / 3600);
  const m = Math.floor((totalSecondes % 3600) / 60);
  const s = totalSecondes % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

/** `2026-11-02T10:00:00+01:00` — heure de Paris, avec son décalage. */
export function dateIsoParis(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const localCommeUTC = Date.UTC(
    +p.year!,
    +p.month! - 1,
    +p.day!,
    +p.hour!,
    +p.minute!,
    +p.second!,
  );
  const decalageMin = Math.round((localCommeUTC - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const signe = decalageMin >= 0 ? "+" : "-";
  const abs = Math.abs(decalageMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${signe}${hh}:${mm}`;
}

export interface OptionsJsonLdVideo {
  readonly siteUrl: string;
  /** Page de thème (≥ 3 vidéos) à intercaler dans le fil d'Ariane. */
  readonly theme?: { readonly libelle: string; readonly href: string } | null;
}

export function buildVideoPageJsonLd(v: VideoPubliee, { siteUrl, theme }: OptionsJsonLdVideo) {
  const site = siteUrl.replace(/\/+$/, "");
  const page = `${site}/fr/videos/${v.slug}`;
  const f = v.fichiers;
  const mention = mentionIa(v);
  const avecChapitres = v.dureeSecondes >= SEUIL_CHAPITRES_SECONDES && v.chapitres.length >= 2;

  const clips = avecChapitres
    ? v.chapitres.map((c, i) => ({
        "@type": "Clip",
        name: c.titre,
        startOffset: c.debutSecondes,
        endOffset: v.chapitres[i + 1]?.debutSecondes ?? v.dureeSecondes,
        url: `${page}?t=${c.debutSecondes}`,
      }))
    : null;

  const videoObject = {
    "@type": "VideoObject",
    "@id": `${page}#video`,
    name: v.titre,
    description: mention ? `${v.description} ${mention}` : v.description,
    inLanguage: "fr",
    thumbnailUrl: [f.affiche169, f.vignette43, f.vignette11].map((x) => `${site}${x.chemin}`),
    uploadDate: dateIsoParis(v.publieeLe),
    dateModified: dateIsoParis(v.modifieeLe),
    duration: dureeIso8601(v.dureeSecondes),
    contentUrl: `${site}${f.video.chemin}`,
    publisher: { "@id": `${site}/#organization` },
    creator: {
      "@id": v.williamsALImage ? `${site}/fr/equipe/williams#person` : `${site}/#organization`,
    },
    isFamilyFriendly: true,
    ...(v.transcription ? { transcript: v.transcription } : {}),
    ...(clips ? { hasPart: clips } : {}),
    ...(avecChapitres
      ? {
          potentialAction: {
            "@type": "SeekToAction",
            target: `${page}?t={seek_to_second_number}`,
            "startOffset-input": "required name=seek_to_second_number",
          },
        }
      : {}),
  };

  const fil = [
    { name: "Accueil", href: "/fr" },
    { name: "Vidéos", href: "/fr/videos" },
    ...(theme ? [{ name: theme.libelle, href: `/fr${theme.href}` }] : []),
    { name: v.titre, href: `/fr/videos/${v.slug}` },
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      videoObject,
      {
        "@type": "BreadcrumbList",
        "@id": `${page}#breadcrumb`,
        itemListElement: fil.map((x, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: x.name,
          item: `${site}${x.href}`,
        })),
      },
    ],
  } as const;
}
