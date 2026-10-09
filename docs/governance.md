# Gobernanza del repositorio

`main` se protege con un ruleset. El archivo que lo describe es [`scripts/github/main-ruleset.json`](../scripts/github/main-ruleset.json).

## Qué exige el ruleset

- Los cambios a `main` entran por pull request. No hay push directo.
- No se puede borrar `main` ni hacer force push.
- El check `ci` tiene que estar verde y al día con la rama base. Ese job lo define el workflow de integración cuando exista.

La cantidad de aprobaciones queda en cero: el ruleset obliga a usar un PR y a pasar el CI, y no bloquea a un único maintainer que no puede aprobar su propio PR. La revisión de código sigue marcada en [`.github/CODEOWNERS`](../.github/CODEOWNERS).

## Cómo aplicarlo

Hace falta un token con permiso de administración del repositorio.

```bash
gh auth status
scripts/github/apply-repo-settings.sh
```

El script también crea los labels de [`.github/labels.json`](../.github/labels.json) e intenta habilitar el escaneo de secretos nativo de GitHub y la push protection.

Si la API responde 403 o 401, ese paso queda pendiente, el script sigue con el siguiente y no reintenta. En ese caso el ruleset queda declarado en el JSON y se aplica a mano cuando haya permiso.

## Escaneo de secretos

Hay dos capas:

- El workflow [`.github/workflows/secret-scanning.yml`](../.github/workflows/secret-scanning.yml) corre gitleaks en cada PR y en cada push a `main`.
- El escaneo nativo de GitHub, si el script pudo habilitarlo.

Ninguno de los dos reemplaza la regla de no commitear valores de secretos.
