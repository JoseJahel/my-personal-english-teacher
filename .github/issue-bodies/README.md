# Cuerpos de issues (plantillas del equipo)

Textos listos para pegar o actualizar issues de GitHub del proyecto
**My Personal English Teacher**. Complementan:

- [`Documentacion general/GUIA-CREACION-ISSUES.md`](../../Documentacion%20general/GUIA-CREACION-ISSUES.md) — cómo escribir tickets
- [`Documentacion general/BACKLOG-RUBRICA-ESTRICTA.md`](../../Documentacion%20general/BACKLOG-RUBRICA-ESTRICTA.md) — orden del backlog / rúbrica
- Issue meta en GitHub: [#80](https://github.com/JoseJahel/my-personal-english-teacher/issues/80)

## Cómo usarlos

1. Abre o crea el issue en GitHub (número alineado con el nombre del archivo cuando exista).
2. Copia el markdown del archivo correspondiente al cuerpo del issue.
3. Ajusta assignee, labels (`person:…`, hito, capa) y rama personal según `CONTRIBUTING.md`.
4. Si el código o la matriz cambian, actualiza **tanto** el issue en GitHub **como** este archivo en un PR.

## Índice

| Archivo | Tema (resumen) |
|---------|----------------|
| `01-sync-docs.md` | Sincronizar matriz / reporte / README con `main` |
| `02-score-energy-formants.md` | Energía y formantes en el score |
| `03-live-spectrogram-pitch.md` | Espectrograma y pitch en vivo |
| `04-communication-suggestions.md` | Panel de sugerencias de comunicación |
| `05-latency-profile.md` | Perfil de latencia ASR |
| `06-pdf-export.md` | PDF del documento técnico |
| `07-adaptive-noise.md` | Filtrado adaptativo de ruido |
| `08-a2-presentation.md` | Presentación Avance 2 |
| `lote-excelencia/09-fir-antialias.md` … `18-vad-metrics.md` | Lote de excelencia / señales y producto |
| `lote-excelencia/19-resample-multirate-fir.md` | #92 remuestreo FIR 44.1/48 (Jahel) |
| `lote-excelencia/20-live-pcm-stft-yin.md` | #93 STFT/YIN live sobre PCM (Jahel) |
| `lote-excelencia/21-mfcc-chain-audit.md` | #94 auditoría encadenado MFCC (Jahel) |
| `lote-excelencia/22-speaker-bias-score.md` | #95 sesgo de locutor en score (Jahel) |
| `lote-excelencia/23-progressive-feedback.md` | #96 chat ASR+T5 sin esperar tutor (Jahel) |
| `lote-excelencia/24-defense-kit-local.md` | #97 kit defensa local (Jahel) |
| `lote-excelencia/25-layer-contracts-mocks.md` | #98 contratos + mocks (Jahel) |

Los números de archivo son el orden de redacción del lote; los números de issue en GitHub pueden diferir — cruza siempre con #80 y el backlog versionado.
