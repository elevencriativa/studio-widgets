# Studio · widgets

Widgets incorporados no painel **Studio · Projetos** do Notion.

- `clock/` · relógio (Brasília). Parâmetros: `?tema=escuro`, `?fuso=America/Manaus`.
- `metricas/` · métricas de entrega (aprovação x reprovação). Parâmetro: `?tema=escuro`.

`metricas/data.json` é gerado a cada hora pela rotina `.github/workflows/metricas.yml`,
que lê o banco "📊 Apresentações e aprovações" com o segredo `NOTION_TOKEN`.
O arquivo guarda só totais, sem nomes de clientes ou projetos.

Para atualizar na hora: aba **Actions** → "Atualizar métricas" → **Run workflow**.
