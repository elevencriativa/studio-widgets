// Lê o banco "📊 Apresentações e aprovações" no Notion e grava metricas/data.json
// só com totais (nenhum nome de cliente ou projeto sai daqui).
import { writeFile } from "node:fs/promises";

const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID || "41b958e93a1e810fb1abfdf5cb62c828";
if (!token) {
  console.error("Falta o segredo NOTION_TOKEN.");
  process.exit(1);
}

const RESULT_KEYS = {
  "✅ Aprovado": "aprovado",
  "🟡 Aprovado com ajustes": "ajustes",
  "❌ Reprovado": "reprovado",
  "⏳ Aguardando retorno": "aguardando",
};
const empty = () => ({ aprovado: 0, ajustes: 0, reprovado: 0, aguardando: 0 });

async function queryAll() {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!res.ok) throw new Error(`Notion respondeu ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page.results);
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return rows;
}

const totals = empty();
const months = new Map();

for (const row of await queryAll()) {
  const key = RESULT_KEYS[row.properties["Resultado"]?.select?.name];
  if (!key) continue;
  totals[key]++;
  const date = row.properties["Data"]?.date?.start;
  if (date) {
    const month = date.slice(0, 7);
    if (!months.has(month)) months.set(month, empty());
    months.get(month)[key]++;
  }
}

const byMonth = [...months.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, counts]) => ({ month, ...counts }));

await writeFile(
  new URL("../metricas/data.json", import.meta.url),
  JSON.stringify({ updatedAt: new Date().toISOString(), totals, byMonth }, null, 2) + "\n",
);
console.log("Métricas atualizadas:", totals);
