# UI/UX — Shell de práctica (Estándar chat IA)

**Layout canónico:** *Estándar chat IA* (issue #81)  
**Referencia de producto (principios):** rail + chat centrado + panel de artefacto (ChatGPT/Claude), sidebar limpia (Linear/Notion).  
**Implementación:** `app/src/ui/HomeScreen.tsx` + `PracticeRail` + `PracticeComposer` + `FeedbackPanel`

## Arquitectura de layout

```
┌──────────┬────────────────────────────┬──────────────┐
│  Rail    │  Center (chat max ~44rem)  │ Feedback     │
│ ~240px   │  header + thread +         │ panel 22rem  │
│          │  composer fijo             │ (cerrado por │
│          │                            │  defecto)    │
└──────────┴────────────────────────────┴──────────────┘
```

### Rail izquierdo

- Marca **Teacher** (serif itálica) + monograma T · línea “inglés personal”  
- Nav: **Práctica** · **Historial** · **Señales**  
- Escenarios (restaurante / aeropuerto / entrevista)  
- Modo: Conversar (activo) · Repetir (UI presente, deshabilitado hasta #68)  
- Offline compacto + pista EN del escenario  

### Centro

- Barra con título del escenario + botón **Feedback**  
- Hilo de chat (ancho máximo de lectura)  
- Composer fijo: onda, nivel, Detener + Hablar, estado de pipeline  

### Panel derecho (artefacto)

- **Cerrado por defecto**  
- Se abre al pulsar Hablar (pestaña Señales, STFT/YIN en vivo) o tras un turno  
- Pestañas: **Turno** · **Sugerencias** · **Señales** · **Técnico**  
- Empty state de Turno hasta el primer resultado  
- Canvas de espectrograma/pitch **siempre montados** (aunque el panel esté `hidden`) para no romper refs de sesión  

### Historial

- Vista overlay desde el rail (no pantalla huérfana)  
- Stats + tendencia + lista IndexedDB  

### Señales (rail)

- Abre el panel en pestaña Señales (misma pareja de canvas)  

## Breakpoints

- **Desktop target de demo:** ≥ 1280×800 (Playwright baselines: 1280×800 y 1440×900)  
- Rail fijo; en viewports estrechos el shell sigue en fila (demo del curso es desktop Chromium)  

## Estados de micrófono

| `data-state` en `#mic-button` / `data-testid=mic-button` | Significado |
|----------------------------------------------------------|-------------|
| `idle` | Listo para hablar |
| `listening` | Capturando (estilo coral) |
| `processing` | Arranque o modelos en calentamiento |

## Contrato `data-testid` (shell crítica)

| testid | Elemento |
|--------|----------|
| `practice-shell` | Root del shell |
| `practice-rail` | Rail izquierdo |
| `practice-center` | Columna central |
| `feedback-panel` | Panel artefacto (`data-open=true\|false`) |
| `feedback-panel-toggle` | Botón Feedback |
| `feedback-panel-close` | Cerrar panel |
| `mic-button` | Hablar |
| `stop-button` | Detener |
| `practice-composer` | Composer |
| `chat-thread` | Hilo de chat |
| `history-overlay` | Overlay historial |
| `rail-nav-practice` / `history` / `signals` | Nav del rail |
| `panel-tab-turn` / `suggest` / `signals` / `tech` | Pestañas |
| `panel-empty-state` / `panel-filled-state` | Turno vacío vs con datos |

Fuente de constantes: `app/src/ui/practice-shell-types.ts` → `PRACTICE_SHELL_TEST_IDS`.

## Preview DEV (sin modelos)

| Hash | Estado |
|------|--------|
| `#shell-preview` | Idle, panel vacío |
| `#shell-preview-filled` | Turno completo (panel con datos) |
| `#shell-preview-listening` | Mic en escucha |
| `#shell-preview-composing` | Usuario + corrección en chat, tutor “Escribiendo…”, Hablar habilitado (#96) |

Solo con `import.meta.env.DEV`.

## Playwright

- Config: `app/playwright.config.ts`  
- Specs: `app/e2e/shell-visual.spec.ts`  
- Scripts: `pnpm test:e2e` (necesita Chromium de Playwright)  
- Baselines: `app/e2e/shell-visual.spec.ts-snapshots/`  

## Anti-patrones

- Meter lógica DSP/IA en componentes de presentación  
- Duplicar canvas de señales en overlay y panel (rompe refs)  
- Textos de producto hardcodeados fuera de `interface-texts.ts`  
- Inventar un layout distinto al estándar chat IA sin actualizar este doc e issue #81  

## Checklist demo (3 min)

1. Escenario en rail → intro del tutor en el chat  
2. Hablar → panel Señales se abre; onda + espectro + pitch se mueven  
3. Detener → utterance completa en los mismos canvas; pestaña Turno con ASR  
4. Historial en rail → turnos IndexedDB  
5. Cerrar panel con ✕ o Feedback  
