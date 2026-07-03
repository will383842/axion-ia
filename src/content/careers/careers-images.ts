// Images Unsplash par offre (généré). url=urls.regular (hotlink), crédit photographe (CGU).
export interface CareerImage {
  url: string;
  alt: string;
  byName: string;
  byUrl: string;
}

export const CAREERS_HERO: CareerImage = {
  url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwbW9kZXJuJTIwdGVjaCUyMHRlYW0lMjBvZmZpY2UlMjBjb2xsYWJvcmF0aW9ufGVufDF8MHx8fDE3ODEwMDgzMDd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  alt: "group of people using laptop computer",
  byName: "Annie Spratt",
  byUrl: "https://unsplash.com/@anniespratt",
};

export const CAREERS_IMAGES: Record<string, CareerImage> = {
  // Postes tech/IA Grenoble (2026-07) — images Unsplash par métier (crédit photographe, CGU).
  "ingenieur-machine-learning": {
    url: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxtYWNoaW5lJTIwbGVhcm5pbmclMjBlbmdpbmVlciUyMGNvbXB1dGVyJTIwc2NyZWVufGVufDF8MHx8fDE3ODMwOTY3NTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "laptop screen displaying colorful code",
    byName: "Mohammad Rahmani",
    byUrl: "https://unsplash.com/@afgprogrammer",
  },
  "data-engineer": {
    url: "https://images.unsplash.com/photo-1695668548342-c0c1ad479aee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxkYXRhJTIwZW5naW5lZXIlMjBzZXJ2ZXIlMjBwaXBlbGluZXxlbnwxfDB8fHwxNzgzMDk2NzUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a rack of servers in a server room",
    byName: "Kevin Ache",
    byUrl: "https://unsplash.com/@kevinache",
  },
  "data-scientist": {
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxkYXRhJTIwc2NpZW5jZSUyMGFuYWx5dGljcyUyMGNoYXJ0cyUyMGxhcHRvcHxlbnwxfDB8fHwxNzgzMDk2NzUyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "graphs of performance analytics on a laptop screen",
    byName: "Luke Chesser",
    byUrl: "https://unsplash.com/@lukechesser",
  },
  "consultant-ia-generative": {
    url: "https://images.unsplash.com/photo-1690378820474-b468b8ee64d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxhaSUyMGNvbnN1bHRhbnQlMjBtZWV0aW5nJTIwbGFwdG9wJTIwb2ZmaWNlfGVufDF8MHx8fDE3ODMwOTY3NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a group of people sitting around a table with laptops",
    byName: "Lyubomyr Reverchuk",
    byUrl: "https://unsplash.com/@lreverchuk",
  },
  "ingenieur-mlops": {
    url: "https://images.unsplash.com/photo-1667372335936-3dc4ff716017?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxkZXZvcHMlMjBhdXRvbWF0aW9uJTIwbW9uaXRvcmluZyUyMHNlcnZlcnxlbnwxfDB8fHwxNzgzMDk2NzUzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "serveurs et automatisation en salle machine",
    byName: "Growtika",
    byUrl: "https://unsplash.com/@growtika",
  },
  "ingenieur-rag-llm": {
    url: "https://images.unsplash.com/photo-1674027444485-cec3da58eef4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwbmV1cmFsJTIwbmV0d29yayUyMGNvZGV8ZW58MXwwfHx8MTc4MzA5Njc1NHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "réseau de neurones abstrait, sphère de points connectés",
    byName: "Growtika",
    byUrl: "https://unsplash.com/@growtika",
  },
  "product-manager-ia": {
    url: "https://images.unsplash.com/photo-1542626991-cbc4e32524cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxwcm9kdWN0JTIwbWFuYWdlciUyMHRlYW0lMjByb2FkbWFwJTIwcGxhbm5pbmd8ZW58MXwwfHx8MTc4MzA5Njc1NHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "notes autocollantes sur un tableau de planification",
    byName: "Jo Szczepanska",
    byUrl: "https://unsplash.com/@joszczepanska",
  },
  "architecte-cloud-ia": {
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjbG91ZCUyMGRhdGElMjBjZW50ZXIlMjBhcmNoaXRlY3R1cmUlMjBzZXJ2ZXJzfGVufDF8MHx8fDE3ODMwOTY3NTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "câblage réseau d'un centre de données",
    byName: "Taylor Vick",
    byUrl: "https://unsplash.com/@tvick",
  },
  "consultant-data-strategie": {
    url: "https://images.unsplash.com/photo-1529119368496-2dfda6ec2804?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHN0cmF0ZWd5JTIwZGF0YSUyMG1lZXRpbmclMjB3aGl0ZWJvYXJkfGVufDF8MHx8fDE3ODMwOTY3NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "atelier de stratégie devant un tableau blanc",
    byName: "Startaê Team",
    byUrl: "https://unsplash.com/@startaeteam",
  },
  "prompt-engineer": {
    url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBjb2RpbmclMjBhaSUyMGNoYXQlMjBsYXB0b3B8ZW58MXwwfHx8MTc4MzA5Njc1N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "MacBook Pro affichant du code de programmation",
    byName: "Arnold Francisca",
    byUrl: "https://unsplash.com/@clark_fransa",
  },
  "business-developer-ia": {
    url: "https://images.unsplash.com/photo-1549923746-c502d488b3ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjBoYW5kc2hha2UlMjBvZmZpY2V8ZW58MXwwfHx8MTc4MTAwODMwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "two men facing each other while shake hands and smiling",
    byName: "Sebastian Herrmann",
    byUrl: "https://unsplash.com/@officestock",
  },
  "formateur-ia-itinerant": {
    url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcCUyMHRyYWluaW5nJTIwcHJlc2VudGF0aW9uJTIwYXVkaWVuY2V8ZW58MXwwfHx8MTc4MTAwODMwOHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man standing in front of people sitting beside table with laptop computers",
    byName: "Campaign Creators",
    byUrl: "https://unsplash.com/@campaign_creators",
  },
  "redacteur-web-ia": {
    url: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx3cml0aW5nJTIwbGFwdG9wJTIwbm90ZWJvb2slMjBkZXNrfGVufDF8MHx8fDE3ODEwMDgzMDl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "MacBook Pro near white open book",
    byName: "Nick Morrison",
    byUrl: "https://unsplash.com/@nickmorrison",
  },
  "charge-rd-ia": {
    url: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxhcnRpZmljaWFsJTIwaW50ZWxsaWdlbmNlJTIwcmVzZWFyY2glMjBsYWJ8ZW58MXwwfHx8MTc4MTAwODMwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a computer circuit board with a brain on it",
    byName: "Steve A Johnson",
    byUrl: "https://unsplash.com/@steve_j",
  },
  "ingenieur-ia-implementation": {
    url: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzb2Z0d2FyZSUyMGVuZ2luZWVyJTIwY29kaW5nJTIwc2NyZWVufGVufDF8MHx8fDE3ODEwMDgzMTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "monitor showing Java programming",
    byName: "Ilya Pavlov",
    byUrl: "https://unsplash.com/@ilyapavlov",
  },
  "customer-success-ia": {
    url: "https://images.unsplash.com/photo-1626863905121-3b0c0ed7b94c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjdXN0b21lciUyMHN1cHBvcnQlMjBzbWlsaW5nJTIwaGVhZHNldHxlbnwxfDB8fHwxNzgxMDA4MzExfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "woman in black headphones holding black and silver headphones",
    byName: "Charanjeet Dhiman",
    byUrl: "https://unsplash.com/@charanjeet_dhiman",
  },
  "developpeur-web": {
    url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx3ZWIlMjBkZXZlbG9wZXIlMjBjb2RlJTIwbGFwdG9wfGVufDF8MHx8fDE3ODEwMDgzMTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "A MacBook with lines of code on its screen on a busy desk",
    byName: "Christopher Gower",
    byUrl: "https://unsplash.com/@cgower",
  },
  "devops-infra": {
    url: "https://images.unsplash.com/photo-1744868562210-fffb7fa882d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzZXJ2ZXIlMjByb29tJTIwZGF0YSUyMGNlbnRlcnxlbnwxfDB8fHwxNzgxMDA4MzEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "Yellow and green cables are neatly connected.",
    byName: "Albert Stoynov",
    byUrl: "https://unsplash.com/@albertstoynov",
  },
  "designer-ux-ui": {
    url: "https://images.unsplash.com/photo-1553877522-43269d4ea984?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx1eCUyMGRlc2lnbmVyJTIwd29ya3NwYWNlJTIwZmlnbWF8ZW58MXwwfHx8MTc4MTAwODMxM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man using MacBook",
    byName: "charlesdeluvio",
    byUrl: "https://unsplash.com/@charlesdeluvio",
  },
  "formateur-ia-sedentaire": {
    url: "https://images.unsplash.com/photo-1617755870291-1f0de453ad30?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx0ZWFjaGVyJTIwY2xhc3Nyb29tJTIwbGFwdG9wJTIwdHJhaW5pbmd8ZW58MXwwfHx8MTc4MTAwODMxNHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "macbook pro on brown wooden table",
    byName: "Thomas Park",
    byUrl: "https://unsplash.com/@thomascpark",
  },
  "stagiaire-formation-ia": {
    url: "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwaW50ZXJuc2hpcCUyMGxlYXJuaW5nJTIwbGFwdG9wfGVufDF8MHx8fDE3ODEwMDgzMTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person sitting front of laptop",
    byName: "Christin Hume",
    byUrl: "https://unsplash.com/@christinhumephoto",
  },
  "referent-pedagogique-ia": {
    url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxlZHVjYXRpb24lMjBkZXNpZ24lMjBsZWFybmluZyUyMG1hdGVyaWFsfGVufDF8MHx8fDE3ODEwMDgzMTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "red apple fruit on four pyle books",
    byName: "Element5 Digital",
    byUrl: "https://unsplash.com/@element5digital",
  },
  "assistant-financements-qualiopi": {
    url: "https://images.unsplash.com/photo-1764025851210-9ad5ed83e01f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBwYXBlcndvcmslMjBhZG1pbmlzdHJhdGlvbiUyMGRlc2t8ZW58MXwwfHx8MTc4MTAwODMxNnww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "A black stapler rests on a desk with papers.",
    byName: "Duskfall Crew",
    byUrl: "https://unsplash.com/@duskfallcrew",
  },
  "charge-subventions": {
    url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwZG9jdW1lbnRzJTIwZGVzayUyMGNhbGN1bGF0b3J8ZW58MXwwfHx8MTc4MTAwODMxN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person holding paper near pen and calculator",
    byName: "Kelly Sikkema",
    byUrl: "https://unsplash.com/@kellysikkema",
  },
  "secretaire-direction": {
    url: "https://images.unsplash.com/photo-1595846723416-99a641e1231a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBhc3Npc3RhbnQlMjBtb2Rlcm4lMjBvZmZpY2V8ZW58MXwwfHx8MTc4MTAwODMxOHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "black and brown wooden table near blue padded chair",
    byName: "Gian Paolo Aliatis",
    byUrl: "https://unsplash.com/@gianpaoloaliatis",
  },
  "office-manager": {
    url: "https://images.unsplash.com/photo-1497215842964-222b430dc094?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBicmlnaHQlMjBvZmZpY2UlMjB3b3Jrc3BhY2V8ZW58MXwwfHx8MTc4MTAwODMxOHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "closeup photo of silver iMac",
    byName: "Alesia Kazantceva",
    byUrl: "https://unsplash.com/@alesiaskaz",
  },
  "charge-recrutement-sourcing": {
    url: "https://images.unsplash.com/photo-1698047682091-782b1e5c6536?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxqb2IlMjBpbnRlcnZpZXclMjByZWNydWl0bWVudCUyMG9mZmljZXxlbnwxfDB8fHwxNzgxMDA4MzE5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a woman shaking hands with another woman sitting at a table",
    byName: "Resume Genius",
    byUrl: "https://unsplash.com/@resumegenius",
  },
  "charge-communication": {
    url: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjb21tdW5pY2F0aW9uJTIwc29jaWFsJTIwbWVkaWElMjBsYXB0b3B8ZW58MXwwfHx8MTc4MTAwODMyMHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person using both laptop and smartphone",
    byName: "Austin Distel",
    byUrl: "https://unsplash.com/@austindistel",
  },
  "responsable-rh": {
    url: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxodW1hbiUyMHJlc291cmNlcyUyMHRlYW0lMjBtZWV0aW5nfGVufDF8MHx8fDE3ODEwMDgzMjF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "people sitting on chair in front of table while holding pens during daytime",
    byName: "Dylan Gillis",
    byUrl: "https://unsplash.com/@mainermedia",
  },
  "responsable-reseau-commercial": {
    url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzYWxlcyUyMHRlYW0lMjBtZWV0aW5nJTIwd2hpdGVib2FyZHxlbnwxfDB8fHwxNzgxMDA4MzIyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "three men sitting while using laptops and watching man beside whiteboard",
    byName: "Austin Distel",
    byUrl: "https://unsplash.com/@austindistel",
  },
  "chef-projet-ia": {
    url: "https://images.unsplash.com/photo-1542626991-cbc4e32524cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxwcm9qZWN0JTIwbWFuYWdlbWVudCUyMHRlYW0lMjBwbGFubmluZ3xlbnwxfDB8fHwxNzgxMDA4MzIzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "sticky notes on corkboard",
    byName: "Jo Szczepanska",
    byUrl: "https://unsplash.com/@joszczepanska",
  },
  "referent-handicap": {
    url: "https://images.unsplash.com/photo-1573497701240-345a300b8d36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxpbmNsdXNpdmUlMjBkaXZlcnNlJTIwd29ya3BsYWNlJTIwdGVhbXxlbnwxfDB8fHwxNzgxMDA4MzI0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "five people sitting at table and talking",
    byName: "Christina @ wocintechchat.com M",
    byUrl: "https://unsplash.com/@wocintechchat",
  },
  "responsable-qualite-qualiopi": {
    url: "https://images.unsplash.com/photo-1754039985008-a15410211b67?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxxdWFsaXR5JTIwY2hlY2tsaXN0JTIwY2xpcGJvYXJkJTIwb2ZmaWNlfGVufDF8MHx8fDE3ODEwMDgzMjR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "Someone is checking items off a checklist.",
    byName: "Jakub Żerdzicki",
    byUrl: "https://unsplash.com/@jakubzerdzicki",
  },
  "comptable-raf": {
    url: "https://images.unsplash.com/photo-1707157284454-553ef0a4ed0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxhY2NvdW50aW5nJTIwZmluYW5jZSUyMGRlc2slMjBjYWxjdWxhdG9yfGVufDF8MHx8fDE3ODEwMDgzMjV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "office desk with smartphone and financial charts",
    byName: "Jakub Żerdzicki",
    byUrl: "https://unsplash.com/@jakubzerdzicki",
  },
  "juriste-dpo": {
    url: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxsZWdhbCUyMGxhdyUyMGRvY3VtZW50cyUyMG9mZmljZXxlbnwxfDB8fHwxNzgxMDEwMDA1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "restaurant menus on clipboards close up",
    byName: "Arisa Chattasa",
    byUrl: "https://unsplash.com/@golfarisa",
  },
  "support-hotline-saas": {
    url: "https://images.unsplash.com/photo-1553775282-20af80779df7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx0ZWNoJTIwc3VwcG9ydCUyMGNhbGwlMjBjZW50ZXIlMjBoZWFkc2V0fGVufDF8MHx8fDE3ODEwMTAwMDZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "black and brown headset near laptop computer",
    byName: "Petr Macháček",
    byUrl: "https://unsplash.com/@machec",
  },
  "coordinateur-interventions": {
    url: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxsb2dpc3RpY3MlMjBwbGFubmluZyUyMHNjaGVkdWxlJTIwYm9hcmR8ZW58MXwwfHx8MTc4MTAxMDAwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person working on blue and white paper on board",
    byName: "Alvaro Reyes",
    byUrl: "https://unsplash.com/@alvarordesign",
  },
  "responsable-marketing-growth": {
    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBhbmFseXRpY3MlMjBkYXNoYm9hcmQlMjBsYXB0b3B8ZW58MXwwfHx8MTc4MTAxMDAwN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "laptop computer on glass-top table",
    byName: "Carlos Muza",
    byUrl: "https://unsplash.com/@kmuza",
  },
  "directeur-operations": {
    url: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGxlYWRlciUyMG1vZGVybiUyMG9mZmljZXxlbnwxfDB8fHwxNzgxMDEwMDA4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man standing beside another sitting man using computer",
    byName: "Proxyclick Visitor Management System",
    byUrl: "https://unsplash.com/@proxyclick",
  },
  "directeur-commercial": {
    url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzYWxlcyUyMGRpcmVjdG9yJTIwYnVzaW5lc3MlMjBtZWV0aW5nfGVufDF8MHx8fDE3ODEwMTAwMDl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man standing in front of people sitting beside table with laptop computers",
    byName: "Campaign Creators",
    byUrl: "https://unsplash.com/@campaign_creators",
  },
  "responsable-acquisition-growth": {
    url: "https://images.unsplash.com/photo-1666875753105-c63a6f3bdc86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwyfHxncm93dGglMjBtYXJrZXRpbmclMjBkYXRhJTIwYW5hbHl0aWNzfGVufDF8MHx8fDE3ODEwMTAwMTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "graphical user interface",
    byName: "Deng Xiang",
    byUrl: "https://unsplash.com/@dengxiangs",
  },
  "traffic-manager-media-buyer": {
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwyfHxkaWdpdGFsJTIwYWR2ZXJ0aXNpbmclMjBhbmFseXRpY3MlMjBzY3JlZW58ZW58MXwwfHx8MTc4MTAxMDAxMnww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "graphs of performance analytics on a laptop screen",
    byName: "Luke Chesser",
    byUrl: "https://unsplash.com/@lukechesser",
  },
  "social-media-manager": {
    url: "https://images.unsplash.com/photo-1579869847557-1f67382cc158?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzb2NpYWwlMjBtZWRpYSUyMGNvbnRlbnQlMjBjcmVhdGlvbiUyMHBob25lfGVufDF8MHx8fDE3ODEwMTAwMTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "black iphone 4 on brown wooden table",
    byName: "dole777",
    byUrl: "https://unsplash.com/@dole777",
  },
  "community-manager": {
    url: "https://images.unsplash.com/photo-1645848921952-7214192d3394?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjb21tdW5pdHklMjBlbmdhZ2VtZW50JTIwbGFwdG9wJTIwc29jaWFsfGVufDF8MHx8fDE3ODEwMTAwMTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a woman is holding a coffee cup and looking at her laptop",
    byName: "Collabstr",
    byUrl: "https://unsplash.com/@collabstr",
  },
  "videaste-content-creator": {
    url: "https://images.unsplash.com/photo-1497015289639-54688650d173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx2aWRlb2dyYXBoZXIlMjBmaWxtaW5nJTIwY2FtZXJhfGVufDF8MHx8fDE3ODEwMTAwMTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person sitting in front bookshelf",
    byName: "Sam McGhee",
    byUrl: "https://unsplash.com/@sammcghee",
  },
  "monteur-video-motion": {
    url: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGVkaXRpbmclMjBzdHVkaW8lMjB0aW1lbGluZXxlbnwxfDB8fHwxNzgxMDEwMDE2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "flat screen monitor",
    byName: "Peter Stumpf",
    byUrl: "https://unsplash.com/@peter_s",
  },
  "createur-ugc-reels": {
    url: "https://images.unsplash.com/photo-1630797160666-38e8c5ba44c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwY29udGVudCUyMGNyZWF0b3IlMjBmaWxtaW5nfGVufDF8MHx8fDE3ODEwMTAwMTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "man in black jacket holding camera during daytime",
    byName: "Andrés",
    byUrl: "https://unsplash.com/@andresssssssq",
  },
  "producteur-podcast": {
    url: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxwb2RjYXN0JTIwc3R1ZGlvJTIwbWljcm9waG9uZSUyMHJlY29yZGluZ3xlbnwxfDB8fHwxNzgxMDEwMDE3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "macro photography of silver and black studio microphone condenser",
    byName: "Jonathan Velasquez",
    byUrl: "https://unsplash.com/@jonathanvez",
  },
  "monteur-son-podcast": {
    url: "https://images.unsplash.com/photo-1618609377864-68609b857e90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxhdWRpbyUyMG1peGluZyUyMGNvbnNvbGUlMjBzdHVkaW98ZW58MXwwfHx8MTc4MTAxMDAxOHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "black and green audio mixer",
    byName: "James Kovin",
    byUrl: "https://unsplash.com/@james2k",
  },
  "charge-relations-presse": {
    url: "https://images.unsplash.com/photo-1635847870914-3d79036809b0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxwcmVzcyUyMGNvbmZlcmVuY2UlMjBtaWNyb3Bob25lcyUyMGpvdXJuYWxpc3RzfGVufDF8MHx8fDE3ODEwMTAwMTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a large group of people in a room with cameras",
    byName: "Fardad sepandar",
    byUrl: "https://unsplash.com/@fardad_sepandar",
  },
  "responsable-partenariats-evenements": {
    url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjb25mZXJlbmNlJTIwZXZlbnQlMjBuZXR3b3JraW5nJTIwYXVkaWVuY2V8ZW58MXwwfHx8MTc4MTAxMDAyMHww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "crowd of people sitting on chairs inside room",
    byName: "Headway",
    byUrl: "https://unsplash.com/@headwayio",
  },
  "brand-content-strategist": {
    url: "https://images.unsplash.com/photo-1529119368496-2dfda6ec2804?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHN0cmF0ZWd5JTIwd2hpdGVib2FyZCUyMGJyYWluc3Rvcm18ZW58MXwwfHx8MTc4MTAxMDAyMXww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "person pointing white paper on wall",
    byName: "Startaê Team",
    byUrl: "https://unsplash.com/@startaeteam",
  },
  "photographe-crea": {
    url: "https://images.unsplash.com/photo-1672619868507-28132de2e258?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoZXIlMjBjYW1lcmElMjBzdHVkaW8lMjBzaG9vdHxlbnwxfDB8fHwxNzgxMDEwMDIxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "a man taking a picture with a camera",
    byName: "Ellis Lee",
    byUrl: "https://unsplash.com/@xllis_ly",
  },
  "assistant-dossiers-financement-clients": {
    url: "https://images.unsplash.com/photo-1764025851210-9ad5ed83e01f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5NTEzMjN8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBwYXBlcndvcmslMjBhZG1pbmlzdHJhdGlvbiUyMGRlc2t8ZW58MXwwfHx8MTc4MTAwODMxNnww&ixlib=rb-4.1.0&q=80&w=1080",
    alt: "A black stapler rests on a desk with papers.",
    byName: "Duskfall Crew",
    byUrl: "https://unsplash.com/@duskfallcrew",
  },
};

export function careerImage(slug: string): CareerImage {
  return CAREERS_IMAGES[slug] ?? CAREERS_HERO;
}
