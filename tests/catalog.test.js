import { test } from "node:test";
import assert from "node:assert/strict";
import { products, topics, years, getVisibleProducts, normalizeSearch, stageForYear } from "../catalog.js";

const ids = (options) => getVisibleProducts(options).map((product) => product.id);
const product = (id) => products.find((item) => item.id === id);

test("catálogo mantém nove produtos únicos", () => {
  assert.equal(products.length, 9);
  for (const id of ["CEA-001", "CEA-002", "CEA-003", "CEA-004", "CEA-005", "CEA-006", "CEA-007", "CEA-008", "CEA-009"]) assert.ok(product(id));
  assert.equal(new Set(products.map((p) => p.id)).size, products.length);
  assert.equal(products.filter((p) => p.title === "Mergulho na sílaba tônica").length, 1);
});
test("classificação de Enola e Mandala é preservada", () => {
  assert.ok(ids({ topic: "literatura" }).includes("CEA-001"));
  assert.ok(ids({ topic: "leitura" }).includes("CEA-001"));
  assert.ok(ids({ topic: "gramatica" }).includes("CEA-002"));
  assert.ok(ids({ topic: "figuras" }).includes("CEA-002"));
});
test("novos recortes de Gramática funcionam", () => {
  assert.deepEqual(ids({ topic: "preposicoes" }), ["CEA-005", "CEA-004"]);
  assert.deepEqual(ids({ topic: "tonicidade" }), ["CEA-003"]);
  assert.ok(ids({ year: "8", topic: "preposicoes" }).includes("CEA-004"));
  assert.ok(!ids({ year: "8", topic: "preposicoes" }).includes("CEA-005"));
  assert.deepEqual(ids({ year: "9", topic: "preposicoes" }), ["CEA-005", "CEA-004"]);
});
test("adjetivos e substantivos abstratos são para o 6º ano conforme a autora", () => {
  assert.deepEqual(ids({ topic: "adjetivos" }), ["CEA-009"]);
  assert.deepEqual(ids({ topic: "abstratos" }), ["CEA-009"]);
  assert.equal(product("CEA-009").pages, 7);
  assert.equal(product("CEA-009").hasAnswerKey, true);
  assert.deepEqual(product("CEA-009").years, ["6"]);
  assert.equal(product("CEA-009").level, "6º ano");
  assert.ok(ids({ stage: "fundamental", year: "6", topic: "adjetivos" }).includes("CEA-009"));
  assert.ok(ids({ query: "adjetivos abstratos" }).includes("CEA-009"));
});
test("Mergulho tem ano a confirmar em vez de série inventada", () => {
  assert.equal(product("CEA-003").stage, "todos");
  assert.deepEqual(product("CEA-003").years, []);
  assert.equal(product("CEA-003").level, "Ano a confirmar");
  assert.ok(!ids({ year: "8" }).includes("CEA-003"));
});
test("Eduardo e Mônica tem ano a confirmar e não anuncia gabarito", () => {
  assert.equal(product("CEA-008").stage, "todos");
  assert.deepEqual(product("CEA-008").years, []);
  assert.equal(product("CEA-008").hasAnswerKey, false);
  assert.ok(ids({ query: "eduardo monica" }).includes("CEA-008"));
});
test("infográfico literário corresponde aos três anos do Ensino Médio", () => {
  assert.deepEqual(product("CEA-006").years, ["m1", "m2", "m3"]);
  for (const year of ["m1", "m2", "m3"]) assert.ok(ids({ year, topic: "literatura" }).includes("CEA-006"));
});
test("Simulado é a versão do aluno sem gabarito e sem série inventada", () => {
  assert.equal(product("CEA-007").hasAnswerKey, false);
  assert.equal(product("CEA-007").edition, "Versão do aluno");
  assert.equal(product("CEA-007").pages, 10);
  assert.deepEqual(product("CEA-007").years, []);
  assert.ok(ids({ stage: "medio", topic: "avaliacao" }).includes("CEA-007"));
});
test("busca ignora acentos, caixa e combina vários termos", () => {
  assert.equal(normalizeSearch("  GRAMÁTICA  "), "gramatica");
  assert.ok(ids({ query: "preposicao criptograma" }).includes("CEA-004"));
  assert.ok(ids({ query: "SILABA TONICA" }).includes("CEA-003"));
  assert.ok(ids({ query: "FIGURAS linguagem" }).includes("CEA-002"));
  assert.deepEqual(ids({ query: "<script>" }), []);
});
test("todos os filtros combinados respeitam etapa, ano, assunto e busca", () => {
  assert.deepEqual(ids({ stage: "fundamental", year: "8", topic: "figuras", query: "mandala" }), ["CEA-002"]);
  for (const topic of Object.keys(topics)) {
    for (const year of Object.keys(years)) {
      for (const p of getVisibleProducts({ topic, year })) {
        assert.ok(p.years.includes(year));
        assert.ok(topic === "todos" || p.topics.includes(topic));
      }
    }
  }
});
test("ordenação é consistente e não altera o cadastro", () => {
  const original = products.map((p) => p.id);
  const az = getVisibleProducts({ sort: "az" });
  const za = getVisibleProducts({ sort: "za" });
  assert.deepEqual(az.map((p) => p.id), [...za].reverse().map((p) => p.id));
  assert.deepEqual(ids({}), [...original].sort((a, b) => b.localeCompare(a)));
  assert.deepEqual(products.map((p) => p.id), original);
});
test("ano identifica a etapa correta", () => {
  assert.equal(stageForYear("8"), "fundamental");
  assert.equal(stageForYear("m2"), "medio");
  assert.equal(stageForYear("todos"), "todos");
});
test("todos os temas são válidos e os preços não foram inventados", () => {
  for (const p of products) {
    for (const topic of p.topics) assert.ok(topics[topic]);
    for (const year of p.years) assert.ok(years[year]);
    assert.equal(p.price, null);
    assert.ok(p.image.endsWith(".jpg"));
    assert.equal(JSON.stringify(p).includes(".pdf"), false);
    assert.equal(JSON.stringify(p).includes("/home/ubuntu"), false);
    assert.equal("private_pdf_path" in p, false);
  }
});
