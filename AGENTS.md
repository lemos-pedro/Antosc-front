# AGENTS.md

- TanStack Router ≥1.170: `errorComponent` deve ter props `ErrorComponentProps` (onde `error` é `unknown`) — tipar o componente com `import("@tanstack/react-router").ErrorComponentProps`; envolver em `lazy()` não resolve.
- A cena 3D (src/components/site3d) só pode ser avaliada no cliente: import dinâmico dentro de `useEffect` em `Site3DPanel` (rotas são SSR). `Site3DPanel` define `data-scene-ready` quando a cena monta, para o harness de verificação.
- Nunca preencher campos ausentes da API v0 com valores fabricados: deixar `undefined`/`N/A` (ver docstring de UiTower em src/lib/api-adapters.ts).
