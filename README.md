# Enrailar

Enrailar es una propuesta de trenes argentinos con foco en Tandil. Es una iniciativa de Sinequix.

## Estado

Etapa inicial: convocatoria a ingenieros. Todavía no hay plan, socios ni presupuesto.

## Gestión del proyecto

La gestión del proyecto está en ClickUp, en el espacio Enrailar (privado).

## Cómo participar

Completá el formulario en [https://pox.me](https://pox.me).

## Desarrollo

El monorepo usa pnpm y Turborepo. Los contratos compartidos están en `packages/shared`. Lint y tests corren con Deno. La decisión de runtime está en [docs/adr/0001-runtime.md](docs/adr/0001-runtime.md).

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## Repositorio

El código es Apache-2.0. Para proponer cambios, leé [CONTRIBUTING.md](CONTRIBUTING.md). Las vulnerabilidades van por [SECURITY.md](SECURITY.md). La protección de `main` está descripta en [docs/governance.md](docs/governance.md).
