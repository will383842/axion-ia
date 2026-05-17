import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  /** Optional photo URL. If absent, a neutral placeholder fills the avatar. */
  photoUrl?: string;
}

interface TeamGridProps {
  members: ReadonlyArray<TeamMember>;
  className?: string;
}

// Editorial v3 — sober card minus border, serif name, sand avatar fallback.
export function TeamGrid({ members, className }: TeamGridProps) {
  return (
    <ul className={cn("grid gap-10 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {members.map((member) => (
        <li key={member.id} className="border-border-strong flex flex-col gap-5 border-t pt-6">
          {/* aspect-square + dimensions explicites = anti-CLS (Lighthouse audit 2026-05-17). */}
          <div className="bg-sand text-fg-muted border-border relative flex aspect-square h-20 w-20 items-center justify-center overflow-hidden rounded-full border">
            {member.photoUrl ? (
              <Image
                src={member.photoUrl}
                alt={member.name}
                width={80}
                height={80}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-medium" style={{ fontFamily: "var(--font-serif)" }}>
                {member.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h3
              className="text-fg text-2xl leading-tight font-medium"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {member.name}
            </h3>
            <p className="text-terracotta text-sm italic">{member.role}</p>
          </div>
          {member.bio ? (
            <p className="text-fg-soft text-base leading-relaxed">{member.bio}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
