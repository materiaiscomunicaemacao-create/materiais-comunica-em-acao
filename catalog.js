import { newProducts } from "./new-products.js";

export const topics = {
  todos: "Todos os assuntos",
  leitura: "Leitura e interpretação",
  gramatica: "Gramática",
  figuras: "Figuras de linguagem",
  preposicoes: "Preposições",
  tonicidade: "Sílaba tônica",
  adjetivos: "Adjetivos",
  abstratos: "Substantivos abstratos",
  avaliacao: "Avaliações e ENEM",
  redacao: "Redação",
  literatura: "Literatura"
};

export const stages = {
  todos: "Todas as etapas",
  fundamental: "Ensino Fundamental II",
  medio: "Ensino Médio"
};

export const years = {
  "6": "6º ano", "7": "7º ano", "8": "8º ano", "9": "9º ano",
  m1: "1º ano do Ensino Médio", m2: "2º ano do Ensino Médio", m3: "3º ano do Ensino Médio"
};

export const products = [
  {
    id: "CEA-001",
    title: "Hora de interpretar — Enola Holmes",
    topics: ["literatura", "leitura"],
    stage: "fundamental",
    years: ["8", "9"],
    level: "8º e 9º ano",
    image: "/manus-storage/mockup-CEA-001-paginas-sobrepostas_3e19a984.jpg",
    price: null,
    description: "Leitura crítica a partir de uma HQ, com questões de interpretação e reflexão sobre personagens, escolhas e protagonismo.",
    included: ["Atividade em PDF", "Questões de leitura e interpretação", "Análise da HQ", "Material autoral Comunic@ Em Ação"],
    pages: 6,
    format: "PDF digital"
  },
  {
    id: "CEA-002",
    title: "Mandala das figuras de linguagem",
    topics: ["gramatica", "figuras"],
    stage: "fundamental",
    years: ["8", "9"],
    level: "8º e 9º ano",
    image: "/manus-storage/mockup-CEA-002-mandala-figuras-de-linguagem_168dc1c5.jpg",
    price: null,
    description: "Uma revisão visual de figuras de linguagem com mandala, caça-palavras, análise de frases e missões de criação.",
    included: ["PDF com 7 páginas", "Atividades do estudante: mandala e 42 frases", "Caça-palavras, análise e criação de frases", "Gabarito e orientações exclusivos do professor"],
    format: "PDF digital",
    pages: 7,
    hasAnswerKey: true
  },
  ...newProducts
];

export function normalizeSearch(text) {
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function stageForYear(year) {
  if (!Object.hasOwn(years, year)) return "todos";
  return year.startsWith("m") ? "medio" : "fundamental";
}

export function getVisibleProducts({ stage = "todos", year = "todos", topic = "todos", query = "", sort = "recentes" } = {}) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const visible = products.filter((product) => {
    const searchText = normalizeSearch([
      product.title, product.description, product.id, product.level,
      stages[product.stage], ...product.topics.map((key) => topics[key]),
      ...product.years.map((key) => years[key]), ...product.included
    ].join(" "));
    return (stage === "todos" || product.stage === stage)
      && (year === "todos" || product.years.includes(year))
      && (topic === "todos" || product.topics.includes(topic))
      && words.every((word) => searchText.includes(word));
  });
  if (sort === "az") return visible.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (sort === "za") return visible.sort((a, b) => b.title.localeCompare(a.title, "pt-BR"));
  return visible.sort((a, b) => b.id.localeCompare(a.id));
}
