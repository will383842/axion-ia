// Server Component — graphique de hero PAR INTENTION (pages-intention détail).
//
// Un schéma inline-SVG DISTINCT par intention (chatbot = flux de conversation,
// agents = étapes chaînées, crm-erp = enrichissement, documents = parse→JSON,
// etc.), volontairement différent des orbitales home/audit (ImplementationHero
// Schema / HeroOrbital). Cohérence assurée par l'accent terracotta + le même
// langage de formes (cartes paper, connecteurs fins fléchés, libellés courts).
//
// Doctrine `.hero-schema` (576×576 lg, overflow:visible) + viewBox 560×560.
// Zéro JS, zéro animation, SSR-friendly, tokens uniquement (pas de hex).
// aria-label porté par le wrapper (le SVG est décoratif).

import type { ReactNode } from "react";

export type IntentionVariant =
  | "chatbot"
  | "agents"
  | "crm-erp"
  | "documents"
  | "processus"
  | "structuration"
  | "integrations"
  | "ia-custom"
  | "no-code";

export interface IntentionHeroSchemaProps {
  variant: IntentionVariant;
  /** Texte alternatif (le SVG est décoratif). */
  ariaLabel: string;
  className?: string;
}

const W = 560;
const H = 560;

// ─── Primitives réutilisables ───────────────────────────────────────────────

function Card({
  x,
  y,
  w,
  h,
  accent = false,
  r = 16,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  accent?: boolean;
  r?: number;
}): ReactNode {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill="var(--color-paper)"
      stroke={accent ? "var(--color-terracotta)" : "var(--color-border)"}
      strokeWidth={accent ? 2.5 : 1.5}
      filter="url(#ihs-shadow)"
    />
  );
}

function Title({
  x,
  y,
  children,
  anchor = "start",
  size = 19,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
}): ReactNode {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill="var(--color-fg)"
      fontSize={size}
      fontWeight={600}
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {children}
    </text>
  );
}

function Sub({
  x,
  y,
  children,
  anchor = "start",
  size = 14,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
}): ReactNode {
  return (
    <text x={x} y={y} textAnchor={anchor} fill="var(--color-fg-soft)" fontSize={size}>
      {children}
    </text>
  );
}

/** Connecteur fléché entre deux points. */
function Flow({ d }: { d: string }): ReactNode {
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-terracotta)"
      strokeWidth={2.5}
      strokeOpacity={0.55}
      markerEnd="url(#ihs-arrow)"
    />
  );
}

// ─── Diagrammes par intention ───────────────────────────────────────────────

function ChatbotFlow(): ReactNode {
  return (
    <g>
      {/* bulle user (gauche) */}
      <Card x={56} y={120} w={250} h={86} />
      <circle cx={92} cy={163} r={16} fill="var(--color-primary)" fillOpacity={0.16} />
      <Title x={120} y={158}>
        Question client
      </Title>
      <Sub x={120} y={182}>
        sur votre site, Slack, Teams…
      </Sub>
      <Flow d="M 200 206 C 240 250 280 250 300 286" />
      {/* moteur RAG (centre) */}
      <Card x={186} y={236} w={188} h={88} accent r={44} />
      <Title x={280} y={278} anchor="middle">
        L’assistant
      </Title>
      <Sub x={280} y={302} anchor="middle">
        cherche la bonne réponse
      </Sub>
      {/* doc source */}
      <rect
        x={406}
        y={250}
        width={62}
        height={60}
        rx={8}
        fill="var(--color-sand)"
        stroke="var(--color-border)"
        strokeWidth={1.5}
      />
      <line x1={418} y1={268} x2={456} y2={268} stroke="var(--color-fg-soft)" strokeWidth={2} />
      <line x1={418} y1={282} x2={456} y2={282} stroke="var(--color-fg-soft)" strokeWidth={2} />
      <line x1={418} y1={296} x2={444} y2={296} stroke="var(--color-fg-soft)" strokeWidth={2} />
      <line
        x1={392}
        y1={280}
        x2={406}
        y2={280}
        stroke="var(--color-terracotta)"
        strokeWidth={2.5}
        strokeOpacity={0.55}
      />
      <Flow d="M 280 324 C 260 372 300 372 260 408" />
      {/* réponse (droite) */}
      <Card x={250} y={408} w={254} h={86} accent />
      <Title x={282} y={446}>
        Réponse fiable
      </Title>
      <Sub x={282} y={470}>
        ou relais humain si hors-sujet
      </Sub>
    </g>
  );
}

function Steps({ items }: { items: ReadonlyArray<{ t: string; s: string }> }): ReactNode {
  // 4 étapes empilées en escalier, connectées.
  const rows = items.slice(0, 4);
  return (
    <g>
      {rows.map((it, i) => {
        const x = 70 + i * 34;
        const y = 110 + i * 86;
        const accent = i === rows.length - 1;
        return (
          <g key={i}>
            {i > 0 ? (
              <Flow
                d={`M ${x - 34 + 230} ${y - 86 + 64} C ${x + 40} ${y - 4} ${x - 6} ${y - 18} ${x + 16} ${y}`}
              />
            ) : null}
            <Card x={x} y={y} w={300} h={64} accent={accent} />
            <circle
              cx={x + 34}
              cy={y + 32}
              r={15}
              fill="var(--color-terracotta)"
              fillOpacity={accent ? 0.85 : 0.16}
            />
            <text
              x={x + 34}
              y={y + 37}
              textAnchor="middle"
              fontSize={14}
              fontWeight={700}
              fill={accent ? "var(--color-paper)" : "var(--color-terracotta)"}
            >
              {i + 1}
            </text>
            <Title x={x + 62} y={y + 28} size={16}>
              {it.t}
            </Title>
            <Sub x={x + 62} y={y + 49} size={13}>
              {it.s}
            </Sub>
          </g>
        );
      })}
    </g>
  );
}

function EnrichFlow(): ReactNode {
  return (
    <g>
      {/* fiche source */}
      <Card x={48} y={206} w={150} h={150} />
      <Title x={123} y={244} anchor="middle" size={16}>
        Fiche CRM
      </Title>
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1={72}
          y1={272 + i * 24}
          x2={174}
          y2={272 + i * 24}
          stroke="var(--color-fg-soft)"
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      ))}
      <Flow d="M 198 281 H 236" />
      {/* transformateur IA */}
      <circle
        cx={280}
        cy={281}
        r={46}
        fill="var(--color-paper)"
        stroke="var(--color-terracotta)"
        strokeWidth={2.5}
        filter="url(#ihs-shadow)"
      />
      <circle cx={280} cy={281} r={18} fill="var(--color-terracotta)" fillOpacity={0.85} />
      <Sub x={280} y={344} anchor="middle">
        L’IA complète & vérifie
      </Sub>
      <Flow d="M 324 281 H 362" />
      {/* fiche enrichie */}
      <Card x={362} y={186} w={150} h={190} accent />
      <Title x={437} y={222} anchor="middle" size={16}>
        Fiche à jour
      </Title>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={386}
          y1={248 + i * 26}
          x2={488}
          y2={248 + i * 26}
          stroke="var(--color-terracotta)"
          strokeWidth={2}
          strokeOpacity={0.45}
        />
      ))}
    </g>
  );
}

function ParsePipeline(): ReactNode {
  return (
    <g>
      {/* document entrant */}
      <Card x={56} y={196} w={132} h={168} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={78}
          y1={232 + i * 26}
          x2={166}
          y2={232 + i * 26}
          stroke="var(--color-fg-soft)"
          strokeWidth={2}
          strokeOpacity={0.5}
        />
      ))}
      <Sub x={122} y={386} anchor="middle">
        PDF, contrat, facture
      </Sub>
      <Flow d="M 188 280 H 224" />
      {/* extraction (champs surlignés) */}
      <Card x={224} y={210} w={112} h={140} accent />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={244}
          y={236 + i * 34}
          width={72}
          height={18}
          rx={5}
          fill="var(--color-terracotta)"
          fillOpacity={0.18}
        />
      ))}
      <Sub x={280} y={372} anchor="middle">
        L’IA lit & extrait
      </Sub>
      <Flow d="M 336 280 H 372" />
      {/* JSON */}
      <Card x={372} y={210} w={132} h={140} />
      <circle cx={438} cy={244} r={18} fill="var(--color-terracotta)" fillOpacity={0.16} />
      <path
        d="M 430 244 l 6 7 l 11 -13"
        fill="none"
        stroke="var(--color-terracotta)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Sub x={438} y={296} anchor="middle">
        Infos prêtes à l’emploi
      </Sub>
      <Sub x={438} y={318} anchor="middle">
        directement dans vos outils
      </Sub>
    </g>
  );
}

function TriggerAction(): ReactNode {
  return (
    <g>
      {/* déclencheur */}
      <Card x={60} y={246} w={150} h={80} />
      <path d="M 104 268 l -10 22 h 12 l -8 22 22 -28 h -12 z" fill="var(--color-terracotta)" />
      <Title x={128} y={280} size={15}>
        Déclencheur
      </Title>
      <Sub x={128} y={302} size={12}>
        devis accepté…
      </Sub>
      <Flow d="M 210 286 H 250" />
      {/* décision (losange) */}
      <path
        d="M 318 226 L 388 286 L 318 346 L 248 286 Z"
        fill="var(--color-paper)"
        stroke="var(--color-terracotta)"
        strokeWidth={2.5}
        filter="url(#ihs-shadow)"
      />
      <Sub x={318} y={290} anchor="middle">
        Vos règles
      </Sub>
      {/* deux branches */}
      <Flow d="M 388 270 C 430 250 440 210 452 196" />
      <Flow d="M 388 302 C 430 322 440 362 452 376" />
      <Card x={420} y={150} w={120} h={56} accent />
      <Sub x={480} y={183} anchor="middle">
        Relance
      </Sub>
      <Card x={420} y={366} w={120} h={56} accent />
      <Sub x={480} y={399} anchor="middle">
        Facturation
      </Sub>
    </g>
  );
}

function ToStructured(): ReactNode {
  return (
    <g>
      {/* blob non structuré */}
      <Card x={52} y={200} w={170} h={160} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={74}
          y1={232 + i * 26}
          x2={i % 2 === 0 ? 204 : 176}
          y2={232 + i * 26}
          stroke="var(--color-fg-soft)"
          strokeWidth={3}
          strokeOpacity={0.45}
          strokeLinecap="round"
        />
      ))}
      <Sub x={137} y={382} anchor="middle">
        Emails, PDF, tableurs
      </Sub>
      <Flow d="M 222 280 H 286" />
      <text x={254} y={262} textAnchor="middle" fontSize={20} fill="var(--color-terracotta)">
        ✦
      </text>
      {/* arbre JSON propre */}
      <Card x={300} y={186} w={208} h={188} accent />
      {[
        { x: 326, y: 224, w: 150 },
        { x: 346, y: 256, w: 120 },
        { x: 346, y: 286, w: 120 },
        { x: 326, y: 318, w: 150 },
        { x: 346, y: 350, w: 100 },
      ].map((r, i) => (
        <rect
          key={i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={14}
          rx={4}
          fill="var(--color-terracotta)"
          fillOpacity={i === 1 || i === 2 || i === 4 ? 0.22 : 0.42}
        />
      ))}
      <line
        x1={334}
        y1={248}
        x2={334}
        y2={326}
        stroke="var(--color-terracotta)"
        strokeWidth={1.5}
        strokeOpacity={0.4}
      />
      <Sub x={404} y={400} anchor="middle">
        Données claires & exploitables
      </Sub>
    </g>
  );
}

function HubSpoke(): ReactNode {
  const apps = [
    { x: 110, y: 120 },
    { x: 450, y: 120 },
    { x: 70, y: 290 },
    { x: 490, y: 290 },
    { x: 150, y: 446 },
    { x: 410, y: 446 },
  ];
  return (
    <g>
      {apps.map((a, i) => (
        <Flow key={`f${i}`} d={`M ${a.x + 28} ${a.y + 28} L ${280} ${280}`} />
      ))}
      {apps.map((a, i) => (
        <g key={i}>
          <rect
            x={a.x}
            y={a.y}
            width={56}
            height={56}
            rx={14}
            fill="var(--color-paper)"
            stroke="var(--color-border)"
            strokeWidth={1.5}
            filter="url(#ihs-shadow)"
          />
          <rect
            x={a.x + 18}
            y={a.y + 18}
            width={20}
            height={20}
            rx={5}
            fill="var(--color-fg-soft)"
            fillOpacity={0.4}
          />
        </g>
      ))}
      {/* hub central */}
      <circle
        cx={280}
        cy={280}
        r={58}
        fill="var(--color-paper)"
        stroke="var(--color-terracotta)"
        strokeWidth={3}
        filter="url(#ihs-shadow)"
      />
      <circle cx={280} cy={280} r={24} fill="var(--color-terracotta)" fillOpacity={0.85} />
      <Sub x={280} y={356} anchor="middle">
        Tous vos outils reliés à l’IA
      </Sub>
    </g>
  );
}

function LayeredStack(): ReactNode {
  const layers = [
    { t: "Sécurité & contrôle", accent: true },
    { t: "Adaptée à votre métier" },
    { t: "Branchée sur vos données" },
    { t: "Intelligence sur-mesure" },
  ];
  return (
    <g>
      {layers.map((l, i) => {
        const y = 150 + i * 76;
        return (
          <g key={i}>
            <Card x={120} y={y} w={320} h={60} accent={l.accent === true} />
            <circle
              cx={156}
              cy={y + 30}
              r={9}
              fill="var(--color-terracotta)"
              fillOpacity={l.accent ? 0.85 : 0.3}
            />
            <Title x={184} y={y + 36} size={16}>
              {l.t}
            </Title>
          </g>
        );
      })}
      <Sub x={280} y={486} anchor="middle">
        Une IA à vous, qui parle votre métier
      </Sub>
    </g>
  );
}

function NoCodeBlocks(): ReactNode {
  const blocks = [
    { t: "Déclencheur", y: 150 },
    { t: "Étape IA", y: 270, accent: true },
    { t: "Action", y: 390 },
  ];
  return (
    <g>
      {blocks.map((b, i) => (
        <g key={i}>
          {i > 0 ? <Flow d={`M 280 ${b.y - 120 + 64} V ${b.y}`} /> : null}
          <Card x={170} y={b.y} w={220} h={64} accent={b.accent === true} />
          <rect
            x={194}
            y={b.y + 20}
            width={24}
            height={24}
            rx={6}
            fill="var(--color-terracotta)"
            fillOpacity={b.accent ? 0.85 : 0.22}
          />
          <Title x={234} y={b.y + 40} size={17}>
            {b.t}
          </Title>
        </g>
      ))}
      <Sub x={280} y={486} anchor="middle">
        Sur vos outils no-code — sur demande
      </Sub>
    </g>
  );
}

const DIAGRAMS: Record<IntentionVariant, () => ReactNode> = {
  chatbot: ChatbotFlow,
  agents: () =>
    Steps({
      items: [
        { t: "Cherche", s: "l'information utile" },
        { t: "Analyse", s: "comprend la demande" },
        { t: "Agit", s: "fait le travail pour vous" },
        { t: "Vous validez", s: "vous gardez la main" },
      ],
    }),
  "crm-erp": EnrichFlow,
  documents: ParsePipeline,
  processus: TriggerAction,
  structuration: ToStructured,
  integrations: HubSpoke,
  "ia-custom": LayeredStack,
  "no-code": NoCodeBlocks,
};

export function IntentionHeroSchema({
  variant,
  ariaLabel,
  className,
}: IntentionHeroSchemaProps): ReactNode {
  const Diagram = DIAGRAMS[variant] ?? DIAGRAMS.chatbot;
  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ihs-halo" cx="50%" cy="46%" r="55%">
            <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity={0.16} />
            <stop offset="55%" stopColor="var(--color-terracotta)" stopOpacity={0.04} />
            <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity={0} />
          </radialGradient>
          <marker
            id="ihs-arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-terracotta)" fillOpacity={0.7} />
          </marker>
          <filter id="ihs-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx={0}
              dy={6}
              stdDeviation={10}
              floodColor="var(--color-mocha)"
              floodOpacity={0.1}
            />
          </filter>
        </defs>
        <circle cx={280} cy={258} r={330} fill="url(#ihs-halo)" />
        <Diagram />
      </svg>
    </div>
  );
}
