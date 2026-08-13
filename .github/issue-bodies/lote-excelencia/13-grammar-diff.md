## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** ia
- **Requisito:** RF-08 gramática + feedback visual con colores (enunciado)
- **Tipo:** story
- **Asignado (reparto equitativo):** Rebeca (@alvarezrebeca753-sudo)
- **Rama:** `rebeca-frontend`
- **Prioridad:** P1 (UX de corrección “profe-visible”)

## 1–2. Contexto / problema
T5 devuelve texto corregido, pero el feedback suele ser “antes / después” en bloque. El enunciado pide **feedback visual con colores**. Un **diff por tokens/palabras** (inserciones, borrados, sustituciones) hace la corrección gramatical inmediatamente legible.

## 3. Objetivo
Dado `original` y `corrected`, calcular ediciones y renderizar highlights (p. ej. rojo eliminado, verde añadido, ámbar sustituido) en el chat o panel de gramática.

## 4–5. Por qué / para qué
Cumple feedback visual; mejora percepción de calidad frente a solo texto plano.

## 6. Alcance
### Incluye
- Función pura `diffEnglishWords` / LCS o Myers simplificado a nivel palabra.
- Componente o integración en `PracticeChatPanel` / mensajes.
- Tests de casos: idénticos, una inserción, swap, vacío.
- Textos ES de leyenda.
### No incluye
- Reentrenar T5.
- Diff a nivel carácter obligatorio (palabra basta).

## 7. Mapa
- `ia/grammar-correction.ts`
- `ui/practice-chat-messages.ts`, `PracticeChatPanel.tsx`
- `interface-texts.ts`

## 9. Enfoques
1. **Recomendado:** diff de palabras puro en `ui/` o `ia/` sin deps nuevas.
2. Librería liviana de diff — solo si no infla bundle y hay justificación.

## 12. Criterios
- [ ] Se ven colores de edición cuando T5 cambia algo
- [ ] Si no hay cambio, mensaje claro “sin correcciones”
- [ ] Tests del diff
- [ ] lint/test/build

## 14. DoD
PR mergeado.

**Labels:** `avance-2`, `entrega-final`, `type:story`, `layer:ui`, `layer:ia`, `person:rebeca`, `enhancement`
