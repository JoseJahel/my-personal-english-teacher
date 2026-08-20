# Temario de estudio

El alumno no sube documentos. El humano deja el material original en `bruto/`
y las lecciones listas para la app se escriben en `procesado/` (un `.md` por
tema). Estudio carga ese temario empaquetado, no un PDF del navegador.
El temario sale de English File Beginner 5th. Las lecciones son solo de
explicación y aprendizaje: sin ejercicios ni audio/listening.

## bruto/

PDF, DOCX o EPUB en crudo. No los edita el estudiante. No se importan en la UI.

## procesado/

Un archivo por lección, ordenado (`01-…md`). Frontmatter YAML: `id` (texto),
`order` (entero ≥ 1), `title` (español), `titleEn` (opcional), y opcionales
`tema` / `bloque` / `bloqueEs` (claves `/^[a-z][a-z0-9]*$/`; el índice agrupa
por bloque). Si un campo es inválido se descarta; el archivo no se tira.
La lección es solo explicación; las prácticas (tarjetas, completar, traducir,
transformar) viven en otra vista de Estudio, no en este markdown.

Cuerpo, en este orden: Qué vas a aprender, Explicación, Vocabulario, Frases
modelo. Objetivos y explicación en español; vocabulario con el término EN en
negrita y el equivalente ES; frases modelo en inglés. Sin sección de ejercicios.

La app muestra el índice en español y el cuerpo como lección (no markdown
crudo). IndexedDB solo guarda el progreso, no el texto.
