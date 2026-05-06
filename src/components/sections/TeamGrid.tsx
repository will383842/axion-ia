import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
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

export function TeamGrid({ members, className }: TeamGridProps) {
  return (
    <ul className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {members.map((member) => (
        <li key={member.id}>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="bg-border/60 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
                {member.photoUrl ? (
                  // Plain <img> — Sprint 5 swaps to next/image once we have
                  // real photos and a CDN policy in place.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-gray-600">
                    {member.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-fg text-base leading-tight font-semibold tracking-tight">
                  {member.name}
                </h3>
                <p className="text-sm text-gray-600">{member.role}</p>
              </div>
              {member.bio ? (
                <p className="text-sm leading-relaxed text-gray-700">{member.bio}</p>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
