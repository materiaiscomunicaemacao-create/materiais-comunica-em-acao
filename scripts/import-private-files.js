import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "../server/db.js";
import { storeProtectedPdf, readProtectedPdf } from "../server/storage.js";

const manifestPath = process.argv[2];
if (!manifestPath) throw new Error("Informe o manifesto privado fora da pasta pública.");
const entries = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(entries)) throw new Error("Manifesto inválido.");
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

try {
  for (const entry of entries) {
    if (!/^CEA-\d{3}$/.test(entry.id) || typeof entry.path !== "string") throw new Error("Entrada inválida.");
    const [rows] = await pool.execute("SELECT id, storage_key FROM products WHERE id = ?", [entry.id]);
    if (!rows.length) throw new Error(`Produto não cadastrado: ${entry.id}`);
    if (rows[0].storage_key) {
      console.log(`${entry.id}: arquivo já configurado, preservado.`);
      continue;
    }
    const original = await readFile(entry.path);
    if (original.length > 16 * 1024 * 1024 || original.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error(`Arquivo inválido ou muito grande: ${entry.id}`);
    }
    const storageKey = await storeProtectedPdf(original);
    const restored = await readProtectedPdf(storageKey);
    if (hash(original) !== hash(restored)) throw new Error(`Falha de integridade: ${entry.id}`);
    await pool.execute("UPDATE products SET storage_key = ? WHERE id = ? AND storage_key IS NULL", [storageKey, entry.id]);
    console.log(`${entry.id}: arquivo cifrado, transferido e integridade conferida.`);
  }
} finally {
  await pool.end();
}
