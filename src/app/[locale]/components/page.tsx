import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Price } from "@/components/marketing/Price";
import { Stat } from "@/components/marketing/Stat";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { CaseStudyCard } from "@/components/marketing/CaseStudyCard";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";

// Dev-only component gallery. Reach it at /fr/components or /en/components.
// Sprint 4 will add composite sections; Sprint 5 builds product pages on top.
export default function ComponentsPage() {
  return (
    <>
      <Section
        eyebrow="Component library"
        title="Axion-IA · atomic & composite UI"
        description="Atoms shadcn-style + Editorial v3.1 tokens + Axion-IA marketing primitives."
      />

      <Section eyebrow="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="xl">Extra large</Button>
          <Button loading>Loading…</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section eyebrow="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>NEUTRAL</Badge>
          <Badge variant="accent">ACCENT</Badge>
          <Badge variant="success">SUCCESS</Badge>
          <Badge variant="warning">WARNING</Badge>
          <Badge variant="danger">DANGER</Badge>
        </div>
      </Section>

      <Section eyebrow="Alerts">
        <div className="space-y-4">
          <Alert variant="info">
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>Standard info banner.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Operation completed.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>Heads up.</AlertDescription>
          </Alert>
          <Alert variant="danger">
            <AlertTitle>Danger</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section eyebrow="Cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>One-line summary that supports the title.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-fg-soft text-sm">
                Body content uses base Tailwind text classes. Hover the card to see the 5-layer
                shadow signature.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost">Read more →</Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section eyebrow="Form atoms">
        <Container className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="demo-input">Email</Label>
            <Input id="demo-input" type="email" placeholder="vous@entreprise.fr" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="demo-textarea">Décrivez votre besoin</Label>
            <Textarea id="demo-textarea" placeholder="Quelques lignes…" />
          </div>
        </Container>
      </Section>

      <Separator />

      <Section eyebrow="Marketing · Price">
        <div className="flex flex-wrap items-end gap-8">
          <Price amount={490} suffix="HT" size="xl" />
          <Price amount={1290} suffix="HT" size="lg" />
          <Price amount={290} suffix="HT" size="md" />
        </div>
      </Section>

      <Section eyebrow="Marketing · Stats">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat number="+38" suffix="%" label="ROI moyen post-implémentation" variant="primary" />
          <Stat
            number="2.4"
            suffix="h/jour"
            label="Temps gagné par collaborateur"
            variant="green"
          />
          <Stat number="11" suffix="cas" label="Études concrètes publiées" variant="purple" />
          <Stat number="48" suffix="h" label="Délai de réponse audit" variant="orange" />
        </div>
      </Section>

      <Section eyebrow="Marketing · Testimonials & cards">
        <div className="grid gap-4 lg:grid-cols-3">
          <TestimonialCard
            quote="Une intervention dense, des résultats opérationnels dès le lendemain."
            author="C. Lambert"
            role="DAF"
            company="PME industrielle"
          />
          <CaseStudyCard
            href="/cas-concrets/exemple"
            title="Industrie · -32% temps administratif"
            excerpt="Implémentation IA sur les flux comptables et fournisseurs en 6 semaines."
            industry="Industrie"
            metric="-32%"
          />
          <ArticleCard
            href="/blog/exemple"
            title="Pourquoi auditer avant d'implémenter"
            excerpt="L'audit identifie où l'IA crée de la valeur sans casser vos workflows existants."
            publishedAt="2026-04-12"
            readingTime="6 min"
          />
        </div>
      </Section>

      <Section eyebrow="Marketing · FAQ accordion (auto JSON-LD)">
        <FaqAccordion
          items={[
            {
              id: "duration",
              question: "Combien de temps dure une formation collective ?",
              answer: "Une journée complète sur site, avec livraison d'un plan d'action concret.",
            },
            {
              id: "outcome",
              question: "Que reste-t-il après l'intervention ?",
              answer: "Un plan d'implémentation chiffré + 30 jours de support pour itérer.",
            },
          ]}
        />
      </Section>

      <Section eyebrow="Skeleton (loading)">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Section>
    </>
  );
}
