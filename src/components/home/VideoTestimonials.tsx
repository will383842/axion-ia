import Image from "next/image";
import { Play } from "lucide-react";
import type { VideoTestimonial } from "@/content/home-data";

export type { VideoTestimonial };

interface VideoTestimonialsProps {
  videos: VideoTestimonial[];
}

// SSR pur. Pas de lecture inline : on link vers YouTube (nocookie) en target
// blank avec `rel="noopener noreferrer"` — économise ~600 KB de bundle iframe
// + tracking par défaut. Thumbnail = fallback YouTube i.ytimg.com (jpg) si pas
// de thumbnail custom fournie.
//
// Conditional rendering : si videos.length === 0, on retourne null → la section
// entière n'apparaît pas (cf. blueprint §10 → "S'il n'y a pas de vidéo ça ne
// doit pas apparaître").
export function VideoTestimonials({ videos }: VideoTestimonialsProps) {
  if (videos.length === 0) return null;

  return (
    <ul className="grid gap-8 lg:grid-cols-3">
      {videos.map((video) => {
        const thumbUrl =
          video.thumbnail ?? `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`;
        const watchUrl = `https://www.youtube-nocookie.com/watch?v=${video.youtubeId}`;
        return (
          <li key={video.slug}>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-paper border-border focus-visible:ring-primary hover:shadow-elevated block overflow-hidden rounded-2xl border transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label={`Voir la vidéo : ${video.title}`}
              data-video={video.slug}
            >
              <div className="bg-mocha-rich relative aspect-video w-full overflow-hidden">
                <Image
                  src={thumbUrl}
                  alt=""
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover opacity-90 transition group-hover:scale-105 group-hover:opacity-100"
                  unoptimized={thumbUrl.startsWith("https://i.ytimg.com/")}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="bg-terracotta text-paper inline-flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition group-hover:scale-110">
                    <Play className="ml-1 h-7 w-7" fill="currentColor" />
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-4 p-6">
                <blockquote
                  className="text-fg text-lg leading-snug font-medium italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  « {video.quote} »
                </blockquote>
                <footer className="text-fg-soft text-sm">
                  <span className="text-fg font-semibold">{video.author}</span>
                  <span className="mx-2">·</span>
                  <span>{video.role}</span>
                  <span className="mx-2">·</span>
                  <span>{video.company}</span>
                </footer>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
