# storage/

Capa de **infraestructura de persistencia**: guardará localmente el progreso del
usuario (sesiones de práctica, puntuaciones, historial) usando IndexedDB para
que la aplicación funcione completamente offline.

**Estado actual:** carpeta reservada; no hay implementación de IndexedDB aún.
Los pesos de modelos los cachea `transformers.js` vía Cache API del navegador
(fuera de esta capa). No hay repositorio de sesiones en el código de la app.

El esquema de la base de datos debe ser **versionado desde el inicio**, con
migraciones explícitas entre versiones, para poder evolucionar la forma de los
datos guardados sin romper el progreso de usuarios que ya tienen datos locales.

Archivos previstos a futuro:

- `database-schema.ts`: definición versionada del esquema de IndexedDB y sus
  migraciones (`onupgradeneeded` por versión).
- `session-repository.ts`: operaciones de lectura/escritura sobre sesiones de
  práctica guardadas, aisladas del resto de la aplicación detrás de una interfaz.
