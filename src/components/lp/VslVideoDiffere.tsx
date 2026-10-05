"use client";
// use-client: charge le lecteur vidéo à la demande (import dynamique, navigateur seulement).

// Le lecteur de `VslVideo` ne doit PAS peser sur le chunk de la page : il vit dans
// un chunk à part, chargé après l'hydratation, et seulement si le film existe.
// Le cadre garde le ratio du film pendant le chargement (CLS = 0).

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type { VslVideo as VslVideoType } from "./VslVideo";

type Props = ComponentProps<typeof VslVideoType>;

const Lecteur = dynamic(() => import("./VslVideo").then((m) => m.VslVideo), {
  ssr: false,
  loading: () => <div className="bg-ink aspect-[4/5] w-full rounded-2xl md:aspect-video" />,
});

export function VslVideoDiffere(props: Props) {
  return <Lecteur {...props} className={cn(props.className)} />;
}
