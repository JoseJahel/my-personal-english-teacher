# Identidad visual — Atelier

**Producto:** My Personal English Teacher  
**Issue:** [#81](https://github.com/JoseJahel/my-personal-english-teacher/issues/81)  
**Fuente de verdad en código:** `app/src/index.css` (`@theme`) + freeze-guard `app/src/theme-tokens.test.ts`

## Voz de marca

- **Nombre corto (rail):** **Teacher**  
- **Marca en rail:** monograma **T** en círculo oscuro + wordmark serif itálica  
- **Línea de producto:** inglés personal  
- **Tono:** instituto de práctica oral serio, no “startup juguete”  
- **UI en español** · práctica oral en **inglés**  
- El nombre legal del producto sigue siendo *My Personal English Teacher* (título, PWA). No usar MPET ni Atelier como marca visible.

## Tipografía

| Rol | Familia | Uso |
|-----|---------|-----|
| UI | **DM Sans** (`--font-sans`) | Cuerpo, botones, rail, chat |
| Marca / score | **Instrument Serif** (`--font-serif`) | Marca M, puntuación grande, pista del rail |
| Código / métricas | **IBM Plex Mono** (`--font-mono`) | Transcripciones, formantes, tech |

Fallback de sistema si las webfonts no cargan (offline parcial).

## Color (Atelier)

| Token | Hex | Rol |
|-------|-----|-----|
| `--color-sage-50` / ivory | `#f4f2ec` | Fondo papel cálido |
| `--color-atelier-elev` | `#fbfaf7` | Superficies elevadas (rail, panel, burbujas) |
| `--color-sage-200` | `#e2dfd6` | Bordes / líneas |
| `--color-sage-600` | `#4a6b50` | Acento bosque (CTA Hablar, score) |
| `--color-ink-900` | `#2c322c` | Texto principal / burbuja usuario |
| `--color-ink-600` | `#6a7068` | Texto secundario |
| `--color-blush-600` | `#b04f3c` | Escucha / detener (coral) |
| `--color-atelier-ok` | `#3d7a4a` | Indicador offline listo |

Los tokens `sage-*` se reutilizan en clases Tailwind existentes; los valores hex son Atelier (no el verde “genérico” anterior).

## Logo / monograma

- Letra **T** (Teacher) en círculo `ink-900` con texto `sage-50`, serif itálica  
- Wordmark **Teacher** en Instrument Serif itálica; no MPET ni Atelier  
- No copiar marcas ni iconografía de productos de chat comerciales de terceros

## Anti-patrones

- No reintroducir un stack vertical de “dashboard” con métricas sueltas sobre el chat  
- No cambiar la paleta sin actualizar este doc **y** `theme-tokens.test.ts`  
- No hardcodear hex en JSX; usar clases de tokens  

## Evolución

Cualquier cambio material de color o tipo es un PR de diseño que actualiza:  
`index.css` → `theme-tokens.test.ts` → este documento → capturas Playwright si el shell se ve distinto.
