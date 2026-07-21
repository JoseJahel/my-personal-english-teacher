# My Personal English Teacher

Proyecto universitario del curso **Señales y Sistemas**. Una PWA (Progressive Web App) offline para práctica conversacional de inglés, donde toda la inteligencia artificial se ejecuta del lado del cliente, directamente en el navegador.

## Descripción

La aplicación permite practicar conversación en inglés sin depender de servidores externos: reconocimiento de voz, corrección gramatical, síntesis de voz y retroalimentación de pronunciación corren localmente usando modelos de Hugging Face ejecutados con `transformers.js` sobre ONNX Runtime.

El componente de Procesamiento Digital de Señales (DSP) es central al proyecto: se extraen features acústicas (pitch, energía, formantes, MFCC) en tiempo real con la Web Audio API, se generan visualizaciones (waveform, espectrograma, pitch tracking) y se compara la pronunciación del usuario contra una referencia mediante análisis de esas señales.

## Características principales

- Reconocimiento de voz (ASR) client-side con Whisper.
- Síntesis de voz (TTS) client-side con SpeechT5.
- Corrección gramatical con un modelo T5 cuantizado.
- Extracción de features acústicas: pitch, energía, formantes, MFCC.
- Visualizaciones en tiempo real: waveform, espectrograma, pitch tracking.
- Corrección de pronunciación por comparación de señales contra una referencia.
- Funcionamiento 100% offline una vez cargados los modelos (PWA).

## Stack tecnológico

- **IA en navegador:** transformers.js + ONNX Runtime Web.
- **Modelos:** Whisper (ASR), SpeechT5 (TTS), T5 cuantizado (gramática).
- **DSP / Audio:** Web Audio API.
- **Tipo de aplicación:** PWA (Progressive Web App), offline-first.

## Estructura actual del repositorio

```
/
├── Documentacion general/   # Documentación del curso
├── README.md
└── .gitignore
```

Próximamente el código de la aplicación se ubicará en una carpeta `app/`.

## Calendario de entregas

| Entrega | Semana | Contenido |
|---|---|---|
| Avance 1 | Semana 4 | Arquitectura del sistema + prototipo de ASR y corrección gramatical |
| Avance 2 | Semana 7 | Conversación integrada + módulo de pronunciación con señales (DSP) |
| Entrega Final | Semana 10 | Aplicación completa, con pruebas y demo |

## Estado

Fase inicial: **planificación**. Aún no hay código de la aplicación; el repositorio contiene únicamente la documentación del curso y este archivo de inicialización.
