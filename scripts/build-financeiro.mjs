// Lê Contratos, Parcelas e Metas no Notion, calcula os totais do mês e grava
// financeiro/data.enc.json criptografado (AES-256-GCM). A chave fica só no link
// do embed (#k=...), então o arquivo público no GitHub é ilegível sem ela.
import { writeFile } from "node:fs/promises";
import { createCipheriv, randomBytes } from "node:crypto";

const token = process.env.NOTION_TOKEN;
const keyB64 = process.env.FIN_KEY;
if (!token || !keyB64) {
  console.log("NOTION_TOKEN ou FIN_KEY ausente: financeiro não atualizado.");
  process.exit(0);
}
const key = Buffer.from(keyB64, "base64url");
if (key.length !== 32) throw new Error("FIN_KEY precisa ter 32 bytes em base64url.");

const DB = {
  contratos: "41b958e93a1e81f99c19c202b869e8d4",
  lancamentos: "41b958e93a1e818298fbf5fe8c2b2cd5",
  metas: "41b958e93a1e8192a3bac7e0519d083b",
};

async function queryAll(id) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${id}/query`, {
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
  return rows.map((r) => r.properties);
}

const num = (p) => p?.number ?? 0;
const date = (p) => p?.date?.start ?? null;
const name = (p) => p?.status?.name ?? p?.select?.name ?? null;
const monthOf = (d) => (d ? d.slice(0, 7) : null);

// Mês e dia de hoje no fuso de Brasília
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const thisMonth = today.slice(0, 7);
const lastMonths = (n) => {
  const [y, m] = thisMonth.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
};

const [contratos, lancamentos, metas] = await Promise.all([
  queryAll(DB.contratos), queryAll(DB.lancamentos), queryAll(DB.metas),
]);

const fechadoPorMes = {};
for (const c of contratos) {
  const sit = name(c["Situação"]);
  if (sit === "Cancelado" || sit === "Proposta enviada") continue;
  const m = monthOf(date(c["Aceite"]));
  if (m) fechadoPorMes[m] = (fechadoPorMes[m] || 0) + num(c["Valor fechado"]);
}
const metaPorMes = {};
for (const m of metas) {
  const mo = monthOf(date(m["Início do mês"]));
  if (mo) metaPorMes[mo] = num(m["Meta"]);
}

const t = { recebido: 0, despesas: 0, aReceberMes: 0, atraso: 0, aReceberTotal: 0, parcelas: 0 };
for (const l of lancamentos) {
  const status = name(l["Status"]);
  const saida = name(l["Tipo"]) === "Saída";
  const valor = num(l["Valor"]);
  const venc = date(l["Vencimento"]);
  const pago = status === "Pago";
  const aberto = !pago && status !== "Cancelado";
  if (pago && monthOf(date(l["Pago em"])) === thisMonth) {
    if (saida) t.despesas += valor; else t.recebido += valor;
  }
  if (saida) continue;
  if (status !== "Cancelado") t.parcelas += valor;
  if (aberto) {
    t.aReceberTotal += valor;
    if (monthOf(venc) === thisMonth) t.aReceberMes += valor;
    if (venc && venc < today) t.atraso += valor;
  }
}

const data = {
  updatedAt: new Date().toISOString(),
  month: thisMonth,
  fechado: fechadoPorMes[thisMonth] || 0,
  meta: metaPorMes[thisMonth] || 0,
  ...t,
  resultado: t.recebido - t.despesas,
  historico: lastMonths(6).map((m) => ({ month: m, fechado: fechadoPorMes[m] || 0, meta: metaPorMes[m] || 0 })),
};

const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final(), cipher.getAuthTag()]);
await writeFile(
  new URL("../financeiro/data.enc.json", import.meta.url),
  JSON.stringify({ v: 1, iv: iv.toString("base64"), ct: ct.toString("base64") }) + "\n",
);
console.log("Financeiro atualizado (criptografado).");
