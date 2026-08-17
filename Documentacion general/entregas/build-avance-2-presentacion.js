/**
 * Avance 2 — My Personal English Teacher
 * Course deck (10–15 min) + speaker notes + localhost demo script.
 * Run from this folder: node build-avance-2-presentacion.js
 */

const path = require("path");
const pptxgen = require("pptxgenjs");

const COLOR = {
  darkBg: "2C322C",
  cream: "F4F2EC",
  paper: "FBFAF7",
  ink: "2C322C",
  body: "6A7068",
  muted: "6A7068",
  mutedLight: "C8C4B8",
  forest: "4A6B50",
  forestDeep: "3D7A4A",
  blush: "B04F3C",
  hairline: "E2DFD6",
  titleOnDark: "F4F2EC",
  subtitleOnDark: "C8C4B8",
};

const FONT = {
  head: "Georgia",
  body: "Calibri",
  mono: "Consolas",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "My Personal English Teacher — Avance 2";
pres.author = "Equipo Señales y Sistemas";
pres.subject = "Presentación 10-15 min + guion de demo localhost";

const W = 13.333;
const H = 7.5;
const MX = 0.75;

const CAP = path.join(__dirname, "capturas");
const IMG = {
  idle: path.join(CAP, "shell-idle.png"),
  signals: path.join(CAP, "senales-en-vivo.png"),
  turn: path.join(CAP, "turno-chat.png"),
};

function shadow() {
  return { type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.08 };
}

function addEyebrow(slide, label, pageStr, onDark) {
  const c = onDark ? COLOR.mutedLight : COLOR.muted;
  slide.addText(label, {
    x: MX, y: 0.32, w: 8.5, h: 0.28,
    fontFace: FONT.body, fontSize: 11, color: c, charSpacing: 2.2, margin: 0,
  });
  slide.addText(pageStr, {
    x: W - MX - 1.6, y: 0.32, w: 1.6, h: 0.28,
    fontFace: FONT.body, fontSize: 11, color: c, align: "right", margin: 0,
  });
}

function addFooter(slide, onDark) {
  const c = onDark ? COLOR.mutedLight : COLOR.muted;
  slide.addText("My Personal English Teacher  ·  Avance 2  ·  localhost", {
    x: MX, y: H - 0.38, w: W - 2 * MX, h: 0.22,
    fontFace: FONT.body, fontSize: 10, color: c, margin: 0,
  });
}

function card(slide, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: COLOR.paper },
    line: { color: COLOR.hairline, width: 1 },
    shadow: shadow(),
  });
}

// ----------------------------------------------------------------------
function slideCover() {
  const s = pres.addSlide();
  s.background = { color: COLOR.darkBg };
  addEyebrow(s, "SEÑALES Y SISTEMAS  ·  SEMANA 7", "01 / 12", true);

  s.addShape(pres.shapes.RECTANGLE, {
    x: MX, y: 1.35, w: 2.55, h: 0.38,
    fill: { color: COLOR.darkBg },
    line: { color: COLOR.mutedLight, width: 0.75 },
  });
  s.addText("AVANCE 2", {
    x: MX, y: 1.35, w: 2.55, h: 0.38,
    fontFace: FONT.body, fontSize: 12, color: COLOR.titleOnDark,
    align: "center", valign: "middle", margin: 0, charSpacing: 2,
  });

  s.addText("My Personal English Teacher", {
    x: MX, y: 2.0, w: 11.5, h: 1.15,
    fontFace: FONT.head, fontSize: 40, color: COLOR.titleOnDark, margin: 0,
  });
  s.addText("Práctica oral de inglés en el navegador, con señales de voz e IA local.", {
    x: MX, y: 3.25, w: 10.2, h: 0.7,
    fontFace: FONT.body, fontSize: 18, color: COLOR.subtitleOnDark, margin: 0,
  });

  s.addText([
    { text: "Jahel  ·  Rebeca  ·  Luna  ·  Saúl  ·  César", options: { breakLine: true } },
    { text: "Demo: localhost  ·  sin nube  ·  10–15 minutos" },
  ], {
    x: MX, y: 5.55, w: 10, h: 0.7,
    fontFace: FONT.body, fontSize: 14, color: COLOR.subtitleOnDark, margin: 0,
  });
  addFooter(s, true);
  s.addNotes(
    "0:30. Presentar al equipo y el producto. Decir en la primera frase: toda la IA corre en el navegador, la demo es localhost, no hay Vercel. No usar Atelier ni MPET como marca. Pasar a la agenda.",
  );
}

function slideAgenda() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "HOJA DE RUTA", "02 / 12");
  s.addText("Doce minutos, luego la demo.", {
    x: MX, y: 0.7, w: 11, h: 0.55,
    fontFace: FONT.head, fontSize: 28, color: COLOR.ink, margin: 0,
  });

  const rows = [
    ["01", "1 min", "Problema y por qué es local"],
    ["02", "2 min", "Arquitectura de capas"],
    ["03", "5 min", "Pipeline y demo en vivo"],
    ["04", "3 min", "DSP: YIN, MFCC, DTW, score"],
    ["05", "2 min", "Límites honestos y Entrega Final"],
  ];
  rows.forEach((row, i) => {
    const y = 1.5 + i * 0.95;
    card(s, MX, y, 11.8, 0.85);
    s.addText(row[0], {
      x: MX + 0.25, y, w: 0.8, h: 0.85,
      fontFace: FONT.head, fontSize: 20, color: COLOR.forest, valign: "middle", margin: 0,
    });
    s.addText(row[1], {
      x: MX + 1.15, y, w: 1.3, h: 0.85,
      fontFace: FONT.mono, fontSize: 14, color: COLOR.body, valign: "middle", margin: 0,
    });
    s.addText(row[2], {
      x: MX + 2.6, y, w: 8.8, h: 0.85,
      fontFace: FONT.body, fontSize: 18, color: COLOR.ink, valign: "middle", margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "0:30. Leer la hoja de ruta. Avisar que la demo es el bloque largo y que si el mic o los modelos fallan hay plan B local, no un host en la nube.",
  );
}

function slideProblem() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "PROBLEMA", "03 / 12");
  s.addText("Practicar hablar inglés pide un interlocutor. La nube no encaja en el aula.", {
    x: MX, y: 0.7, w: 12, h: 1.0,
    fontFace: FONT.head, fontSize: 26, color: COLOR.ink, margin: 0,
  });

  const blocks = [
    ["Producción, no vocabulario", "Pronunciación, gramática en tiempo real y fluidez. El estudiante hispanohablante necesita feedback en español."],
    ["La voz es biométrica", "Enviar audio a un servidor suma latencia, costo y exposición. El enunciado pide edge AI."],
    ["Señales y Sistemas", "La voz es una señal. Medir pronunciación es muestreo, espectro, MFCC, pitch y alineación temporal."],
  ];
  blocks.forEach((b, i) => {
    const x = MX + i * 4.0;
    card(s, x, 2.0, 3.8, 3.6);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 2.0, w: 0.12, h: 3.6, fill: { color: COLOR.forest },
    });
    s.addText(b[0], {
      x: x + 0.35, y: 2.2, w: 3.25, h: 1.1,
      fontFace: FONT.head, fontSize: 18, color: COLOR.ink, margin: 0,
    });
    s.addText(b[1], {
      x: x + 0.35, y: 3.4, w: 3.25, h: 1.9,
      fontFace: FONT.body, fontSize: 15, color: COLOR.body, margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "1:30. Tres ideas: el cuello de botella es hablar; no mandamos voz a la nube; el corazón del curso es DSP, no un chatbot. Cerrar con: la interfaz está en español y la práctica en inglés.",
  );
}

function slideArchitecture() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "ARQUITECTURA", "04 / 12");
  s.addText("Cinco capas. La dependencia solo apunta hacia adentro.", {
    x: MX, y: 0.7, w: 12, h: 0.55,
    fontFace: FONT.head, fontSize: 26, color: COLOR.ink, margin: 0,
  });

  const layers = [
    ["ui/", "React + TypeScript", "Shell Teacher, chat, canvas, textos en español"],
    ["ia/", "Web Worker", "Whisper, T5, SpeechT5, SmolLM2"],
    ["dsp/", "Dominio puro", "YIN, STFT, MFCC, formantes, DTW, VAD"],
    ["audio/", "Web Audio", "Mic real, MediaRecorder, FIR a 16 kHz"],
    ["storage/", "IndexedDB", "Turnos y scores. Nunca audio crudo"],
  ];
  layers.forEach((row, i) => {
    const y = 1.45 + i * 0.95;
    card(s, MX, y, 11.8, 0.85);
    s.addText(row[0], {
      x: MX + 0.3, y, w: 1.7, h: 0.85,
      fontFace: FONT.mono, fontSize: 18, color: COLOR.forest, valign: "middle", margin: 0,
    });
    s.addText(row[1], {
      x: MX + 2.1, y, w: 3.2, h: 0.85,
      fontFace: FONT.head, fontSize: 16, color: COLOR.ink, valign: "middle", margin: 0,
    });
    s.addText(row[2], {
      x: MX + 5.5, y, w: 6.8, h: 0.85,
      fontFace: FONT.body, fontSize: 16, color: COLOR.body, valign: "middle", margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "2:00. El dsp no importa React. El Analyser solo pinta onda; la STFT de curso es nuestra FFT radix-2. Los pesos van a Cache API; las sesiones a IndexedDB. GitHub es CI, no el runtime.",
  );
}

function slidePipeline() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "UN TURNO", "05 / 12");
  s.addText("Del clic a la respuesta, sin servidor.", {
    x: MX, y: 0.7, w: 12, h: 0.5,
    fontFace: FONT.head, fontSize: 28, color: COLOR.ink, margin: 0,
  });

  const steps = [
    ["1", "Hablar", "getUserMedia. Onda, espectro y pitch en vivo."],
    ["2", "VAD", "Auto-stop ~0.9 s de silencio, o Detener."],
    ["3", "ASR", "MediaRecorder → FIR 16 kHz → Whisper."],
    ["4", "Chat", "Burbuja del estudiante antes del tutor."],
    ["5", "Tutor", "Reglas al instante. SmolLM2 en paralelo."],
    ["6", "Voz", "SpeechT5 o voz local. Score solo en Repetir."],
  ];
  steps.forEach((st, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MX + col * 4.0;
    const y = 1.45 + row * 2.45;
    card(s, x, y, 3.8, 2.25);
    s.addText(st[0], {
      x: x + 0.25, y: y + 0.2, w: 0.55, h: 0.45,
      fontFace: FONT.head, fontSize: 22, color: COLOR.forest, margin: 0,
    });
    s.addText(st[1], {
      x: x + 0.85, y: y + 0.22, w: 2.7, h: 0.45,
      fontFace: FONT.head, fontSize: 20, color: COLOR.ink, margin: 0,
    });
    s.addText(st[2], {
      x: x + 0.25, y: y + 0.85, w: 3.3, h: 1.15,
      fontFace: FONT.body, fontSize: 15, color: COLOR.body, margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "1:30. Insistir: el worklet de STFT cuelga de una pista clonada, no del Analyser, para que la onda no se muera en Realtek. El 0-100 no aparece en conversación. Luego mostrar pantallas.",
  );
}

function slideShell() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "INTERFAZ", "06 / 12");
  s.addText("Rail, chat y panel. Textos en español.", {
    x: MX, y: 0.65, w: 5.4, h: 0.7,
    fontFace: FONT.head, fontSize: 24, color: COLOR.ink, margin: 0,
  });
  s.addText(
    "Tres escenarios: restaurante, aeropuerto, entrevista. Hablar abre Señales. El tutor de apertura es un guion curado; cada turno del estudiante recibe corrección y respuesta.",
    {
      x: MX, y: 1.45, w: 5.4, h: 1.7,
      fontFace: FONT.body, fontSize: 15, color: COLOR.body, margin: 0,
    },
  );
  s.addText("Captura: shell en reposo, 1280×800.", {
    x: MX, y: 3.3, w: 5.4, h: 0.35,
    fontFace: FONT.mono, fontSize: 12, color: COLOR.muted, margin: 0,
  });
  const imgW = 6.55;
  const imgH = imgW * (800 / 1280);
  s.addImage({
    path: IMG.idle,
    x: 6.45, y: 0.85, w: imgW, h: imgH,
    shadow: shadow(),
    altText: "Shell Teacher en reposo",
  });
  addFooter(s);
  s.addNotes(
    "1:00. Señalar rail, composer y panel cerrado. La marca visible es Teacher. Luego pasar a la captura de Señales.",
  );
}

function slideSignals() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "SEÑALES EN VIVO", "07 / 12");
  s.addText("Tres visualizaciones mientras habla.", {
    x: MX, y: 0.65, w: 6.2, h: 0.55,
    fontFace: FONT.head, fontSize: 24, color: COLOR.ink, margin: 0,
  });
  s.addText([
    { text: "Onda y nivel", options: { bold: true, breakLine: true } },
    { text: "AnalyserNode, tiempo real.", options: { breakLine: true } },
    { text: "", options: { breakLine: true } },
    { text: "Espectrograma STFT", options: { bold: true, breakLine: true } },
    { text: "FFT radix-2 propia, 25/10 ms. No es el FFT del Analyser.", options: { breakLine: true } },
    { text: "", options: { breakLine: true } },
    { text: "Pitch YIN", options: { bold: true, breakLine: true } },
    { text: "70–400 Hz sobre PCM de una pista clonada.", options: { breakLine: true } },
  ], {
    x: MX, y: 1.35, w: 5.5, h: 3.8,
    fontFace: FONT.body, fontSize: 15, color: COLOR.body, margin: 0,
  });
  const natW = 958;
  const natH = 888;
  const boxH = 5.55;
  const boxW = boxH * (natW / natH);
  s.addImage({
    path: IMG.signals,
    x: W - MX - boxW, y: 0.85, w: boxW, h: boxH,
    shadow: shadow(),
    altText: "Espectrograma y formantes tras una captura real",
  });
  addFooter(s);
  s.addNotes(
    "1:30. Esta captura es de la app real, no un mock. El Analyser no es la STFT del curso. Al detener se recalcula la utterance completa con las mismas funciones. Si el pitch queda oscuro, decir: YIN solo pinta frames voiced.",
  );
}

function slideDemo() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "GUION DE DEMO", "08 / 12");
  s.addText("Checklist de aula. Solo localhost.", {
    x: MX, y: 0.7, w: 12, h: 0.5,
    fontFace: FONT.head, fontSize: 28, color: COLOR.ink, margin: 0,
  });

  const left = [
    ["Antes", "Chromium. pnpm build && pnpm preview. Precargar modelos. No Ctrl+Shift+R."],
    ["En vivo", "Restaurante → Hablar → ver Señales → callarse o Detener → chat + gramática."],
    ["Repetir", "Modo drill: repetir la última línea del tutor. Ahí vive el 0–100."],
  ];
  const right = [
    ["Si no hay GPU", "Decirlo. Pasar a pnpm dev:latency (tiny-en). No afirmar < 2 s."],
    ["Si falla el mic", "http://127.0.0.1:5173/?forzar-ensayo=1#practice-mock o pnpm build:ensayo."],
    ["Si el SW está viejo", "Ventana privada, o Unregister service worker + F5."],
  ];
  left.forEach((row, i) => {
    const y = 1.4 + i * 1.7;
    card(s, MX, y, 5.75, 1.55);
    s.addText(row[0], {
      x: MX + 0.25, y: y + 0.15, w: 5.25, h: 0.35,
      fontFace: FONT.head, fontSize: 16, color: COLOR.forest, margin: 0,
    });
    s.addText(row[1], {
      x: MX + 0.25, y: y + 0.55, w: 5.25, h: 0.85,
      fontFace: FONT.body, fontSize: 14, color: COLOR.body, margin: 0,
    });
  });
  right.forEach((row, i) => {
    const y = 1.4 + i * 1.7;
    card(s, MX + 6.05, y, 5.75, 1.55);
    s.addText(row[0], {
      x: MX + 6.3, y: y + 0.15, w: 5.25, h: 0.35,
      fontFace: FONT.head, fontSize: 16, color: COLOR.blush, margin: 0,
    });
    s.addText(row[1], {
      x: MX + 6.3, y: y + 0.55, w: 5.25, h: 0.85,
      fontFace: FONT.body, fontSize: 14, color: COLOR.body, margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "2:00. Esta es la slide operativa. Ideal: preview con modelos ya en caché. Si la red del aula está muerta y no se precargó, ir al ensayo. El ensayo no sustituye la demo con mic; es el plan B. Nunca proponer Pages o Vercel.",
  );
}

function slideDsp() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "PROCESAMIENTO DE SEÑALES", "09 / 12");
  s.addText("Cifras que podemos defender.", {
    x: MX, y: 0.7, w: 12, h: 0.5,
    fontFace: FONT.head, fontSize: 28, color: COLOR.ink, margin: 0,
  });

  const cells = [
    ["FFT propia", "< 1e-10", "Radix-2 vs DFT O(N²). No usamos la FFT del Analyser."],
    ["MFCC", "13 / 40 mel", "Hann 25 ms, hop 10 ms. Sin Meyda. Dorados a 1e-5."],
    ["YIN", "70–400 Hz", "Diferencia normalizada acumulada. Menos errores de octava."],
    ["FIR 16 kHz", "≥ 50 dB", "Fase lineal. 48 kHz ×3; 44.1 es 160/441. Alias ~85 dB."],
    ["DTW", "L2 + path", "Alinea ritmo user vs TTS. Score 0–100 en Repetir."],
    ["VAD", "~0.9 s", "Hangover de silencio. Auto-stop sin cortar a mitad de frase."],
  ];
  cells.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = MX + col * 4.0;
    const y = 1.4 + row * 2.55;
    card(s, x, y, 3.8, 2.35);
    s.addText(c[0], {
      x: x + 0.25, y: y + 0.2, w: 3.3, h: 0.4,
      fontFace: FONT.body, fontSize: 13, color: COLOR.muted, margin: 0,
    });
    s.addText(c[1], {
      x: x + 0.25, y: y + 0.6, w: 3.3, h: 0.55,
      fontFace: FONT.head, fontSize: 22, color: COLOR.forest, margin: 0,
    });
    s.addText(c[2], {
      x: x + 0.25, y: y + 1.25, w: 3.3, h: 0.9,
      fontFace: FONT.body, fontSize: 14, color: COLOR.body, margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "2:00. Esta es la slide de nota técnica. FFT propia, MFCC propios, YIN, FIR medido. Si preguntan Nyquist: capturamos nativo y bajamos a 16 kHz porque la voz útil está bajo 8 kHz. No forzar sampleRate en getUserMedia.",
  );
}

function slideScore() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "SCORE E IA", "10 / 12");
  s.addText("Medimos pronunciación donde el número no miente.", {
    x: MX, y: 0.7, w: 12, h: 0.55,
    fontFace: FONT.head, fontSize: 26, color: COLOR.ink, margin: 0,
  });

  card(s, MX, 1.45, 5.85, 4.85);
  s.addText("Sesgo de locutor", {
    x: MX + 0.3, y: 1.65, w: 5.25, h: 0.4,
    fontFace: FONT.head, fontSize: 18, color: COLOR.ink, margin: 0,
  });
  s.addText("Δlocutor  11.4", {
    x: MX + 0.3, y: 2.2, w: 5.25, h: 0.55,
    fontFace: FONT.head, fontSize: 28, color: COLOR.blush, margin: 0,
  });
  s.addText("Δerror vocal  9.2   ·   ratio  1.23", {
    x: MX + 0.3, y: 2.8, w: 5.25, h: 0.4,
    fontFace: FONT.body, fontSize: 16, color: COLOR.body, margin: 0,
  });
  s.addText(
    "Cambiar de locutor sintético mueve el score tanto o más que un error de vocal. Por eso conversación no muestra 0–100. La nota está en Repetir. Sin habla usable no se puntúa.",
    {
      x: MX + 0.3, y: 3.4, w: 5.25, h: 2.4,
      fontFace: FONT.body, fontSize: 15, color: COLOR.body, margin: 0,
    },
  );

  card(s, MX + 6.15, 1.45, 5.85, 4.85);
  s.addText("Modelos en el navegador", {
    x: MX + 6.45, y: 1.65, w: 5.25, h: 0.4,
    fontFace: FONT.head, fontSize: 18, color: COLOR.ink, margin: 0,
  });
  const models = [
    "Whisper small.en  ·  WER 0.000 en nuestras fixtures  ·  ~3.4 s WebGPU",
    "T5 gramática  ·  WASM  ·  se ve en el chat antes del tutor",
    "SmolLM2  ·  timeout 10 s  ·  respaldo de reglas con insignia honesta",
    "SpeechT5  ·  referencia acústica y voz del tutor",
  ];
  models.forEach((line, i) => {
    s.addText(line, {
      x: MX + 6.45, y: 2.2 + i * 0.85, w: 5.25, h: 0.75,
      fontFace: FONT.body, fontSize: 14, color: COLOR.body, margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "1:30. Ser explícitos: no cumplimos 2 s con small-en. Lo elegimos por WER. tiny-en existe y su latencia no está medida. El presupuesto de 2 s es ASR+T5 visible, no SmolLM2.",
  );
}

function slideLimits() {
  const s = pres.addSlide();
  s.background = { color: COLOR.cream };
  addEyebrow(s, "HACIA LA ENTREGA FINAL", "11 / 12");
  s.addText("Lo que no cerramos, y por qué no lo escondemos.", {
    x: MX, y: 0.7, w: 12, h: 0.55,
    fontFace: FONT.head, fontSize: 26, color: COLOR.ink, margin: 0,
  });

  const open = [
    ["#58", "Energía y formantes dentro del score, no solo en el panel."],
    ["#73", "Pasa-banda idéntico en user y referencia TTS."],
    ["#76", "Mapa F1–F2 de vocales."],
    ["#63", "Filtrado adaptativo de ruido (innovación RF-23)."],
  ];
  open.forEach((row, i) => {
    const y = 1.45 + i * 1.2;
    card(s, MX, y, 11.8, 1.05);
    s.addText(row[0], {
      x: MX + 0.3, y, w: 1.2, h: 1.05,
      fontFace: FONT.mono, fontSize: 18, color: COLOR.forest, valign: "middle", margin: 0,
    });
    s.addText(row[1], {
      x: MX + 1.7, y, w: 9.7, h: 1.05,
      fontFace: FONT.body, fontSize: 18, color: COLOR.ink, valign: "middle", margin: 0,
    });
  });
  addFooter(s);
  s.addNotes(
    "1:00. No vender el score como ya cerrado con formantes. No vender 2 s. Primera visita > 1 GB. Eso basta para parecer serios. Luego plan B y preguntas.",
  );
}

function slideClose() {
  const s = pres.addSlide();
  s.background = { color: COLOR.darkBg };
  addEyebrow(s, "PLAN B Y CIERRE", "12 / 12", true);
  s.addText("Si el aula falla, no improvisamos un host.", {
    x: MX, y: 1.3, w: 11.5, h: 0.8,
    fontFace: FONT.head, fontSize: 30, color: COLOR.titleOnDark, margin: 0,
  });
  s.addText([
    { text: "Ensayo de UI  ·  pnpm build:ensayo  +  #practice-mock", options: { breakLine: true } },
    { text: "Maniquí Playwright  ·  #shell-preview-filled", options: { breakLine: true } },
    { text: "Perfil rápido  ·  pnpm dev:latency  (tiny-en, cifra no medida)", options: { breakLine: true } },
    { text: "Preguntas: Nyquist, FFT propia, WER, por qué no Vercel.", options: { breakLine: true } },
  ], {
    x: MX, y: 2.4, w: 11, h: 2.4,
    fontFace: FONT.body, fontSize: 18, color: COLOR.subtitleOnDark, margin: 0,
  });
  s.addText("Gracias. ¿Preguntas?", {
    x: MX, y: 5.4, w: 11, h: 0.6,
    fontFace: FONT.head, fontSize: 22, color: COLOR.titleOnDark, margin: 0,
  });
  addFooter(s, true);
  s.addNotes(
    "0:30. Cerrar con el plan B y abrir preguntas. Si preguntan WER 0: solo en nuestras fixtures de referencia, no en cualquier acento. Si preguntan deploy: el producto es offline-first; GitHub es repo y CI.",
  );
}

slideCover();
slideAgenda();
slideProblem();
slideArchitecture();
slidePipeline();
slideShell();
slideSignals();
slideDemo();
slideDsp();
slideScore();
slideLimits();
slideClose();

const out = path.join(__dirname, "avance-2-presentacion.pptx");
pres.writeFile({ fileName: out }).then(() => {
  console.log("Wrote", out);
});
