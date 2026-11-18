import { mkdir, cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const name of ["store.js", "store.css"]) {
  await cp(`public/${name}`, `dist/${name}`);
}
await cp("manus-routes.json", "dist/manus-routes.json");
console.log("Assets públicos preparados. As páginas e APIs são servidas pelo container da aplicação.");
