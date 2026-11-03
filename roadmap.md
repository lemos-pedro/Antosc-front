# Roadmap — ANTOSC / TOWERCORE

## Pendente
- [ ] Visão Global: mapa de Angola ao centro + painel de energia/disponibilidade com selector Semana/Mês/Trimestre/Ano (plano aprovado em .lovable/plan/)
- [ ] Sites: árvore de sites pesquisável agrupada por região à esquerda do detalhe
- [ ] Backend towercore offline (túnel ngrok expirado): confirmar endpoints de criação quando voltar — POST /api/v1/users, POST /api/v1/towers, POST /api/v1/towers/{id}/energy/generator (payloads marcados com TODO em src/lib/api.ts)
- [ ] Câmeras: ligar feed real quando o towercore fornecer stream (hoje: imagens de demonstração marcadas "SEM FEED · DEMO")

## Concluído (2026-10-30)
- [x] Criar site (página Sites), criar utilizador (Equipas → Utilizadores), registar gerador (Equipamentos)
- [x] Vista 3D do site (React Three Fiber) em /torres/$torreId#view3d
- [x] Abas Câmeras e Histórico (7/30/90 dias, métricas + eventos reais) no detalhe do site
- [x] Erros TS de campos renomeados corrigidos; atualização de segurança dos pacotes TanStack

## Concluído (2026-11-03)
- [x] Histórico por métrica no detalhe do site: selector de série (chaves reais do payload), estatísticas último/mín/máx/média, gráfico por período 7/30/90 dias
- [x] Exportações CSV: métricas e eventos no detalhe do site; centro de exportações em Configurações (inventário de sites, tickets, histórico por site, auditoria via endpoint do towercore)
- [x] Página Configurações completa (Geral, Monitorização, Integrações, Dados & Exportações, Auditoria com tabela de registos)
