# Prompt para auditoría técnica de aplicación TypeScript

Actuá como un **Senior TypeScript Software Architect & Technical Documentation Lead**.

Tengo una aplicación compuesta aproximadamente por 96% TypeScript y el resto HTML. Necesito que analices toda la app en profundidad y generes un archivo `.md` completo documentando cómo funciona el sistema.

Tu trabajo es recorrer y entender toda la estructura del proyecto, archivo por archivo, sin asumir cosas que no estén en el código.

## Analizá especialmente

1. Arquitectura general de la app.
2. Estructura de carpetas y propósito de cada directorio.
3. Framework utilizado, por ejemplo Next.js, React, Node, Express, NestJS, Vite, Angular u otro.
4. Rutas frontend.
5. Rutas backend o API routes.
6. Llamadas a APIs externas.
7. Endpoints internos.
8. Servicios, helpers, utils y módulos compartidos.
9. Cronjobs, schedulers, workers o tareas automáticas.
10. Webhooks.
11. Middlewares.
12. Autenticación y autorización.
13. Manejo de usuarios, sesiones, tokens o permisos.
14. Integraciones externas.
15. Variables de entorno necesarias.
16. Base de datos, modelos, schemas, ORM o queries.
17. Estados globales, stores, contexts o providers.
18. Componentes principales.
19. Flujo de datos entre frontend, backend y servicios.
20. Dependencias importantes del `package.json`.
21. Scripts disponibles: dev, build, start, lint, test, etc.
22. Posibles riesgos técnicos.
23. Código duplicado o mal organizado.
24. Archivos críticos del sistema.
25. Puntos donde la app puede romperse.
26. Recomendaciones de mejora.

Necesito que generes un archivo llamado:

`APP_TECHNICAL_AUDIT.md`

El archivo debe estar escrito en Markdown claro, profesional y ordenado.

---

# APP_TECHNICAL_AUDIT

## 1. Resumen ejecutivo

Explicá en palabras simples qué hace la app, qué tipo de sistema es y cuál parece ser su objetivo principal.

## 2. Stack tecnológico detectado

Listá frameworks, librerías, servicios, herramientas y dependencias principales.

## 3. Estructura general del proyecto

Explicá la estructura de carpetas y para qué sirve cada parte.

## 4. Arquitectura de la aplicación

Describí cómo se organiza la app a nivel frontend, backend, servicios, datos e integraciones.

## 5. Rutas frontend

Listá todas las rutas visibles para el usuario, indicando:

- Ruta
- Archivo asociado
- Qué muestra
- Componentes principales
- Dependencias relevantes

## 6. Rutas API / backend

Listá todos los endpoints internos, indicando:

- Método HTTP
- Ruta
- Archivo asociado
- Qué hace
- Qué datos recibe
- Qué datos devuelve
- Servicios que utiliza

## 7. Llamadas a APIs externas

Listá todas las llamadas externas detectadas, indicando:

- Servicio externo
- URL o dominio
- Archivo donde aparece
- Método usado
- Propósito
- Variables de entorno relacionadas

## 8. Cronjobs, workers y tareas automáticas

Detectá cualquier cronjob, scheduler, worker, intervalo, timeout, queue o tarea programada. Para cada uno indicar:

- Nombre o función
- Archivo
- Frecuencia si está definida
- Qué ejecuta
- Riesgos o dependencias

## 9. Webhooks

Listá todos los webhooks detectados:

- Ruta
- Servicio que lo llama
- Qué evento recibe
- Qué procesamiento realiza
- Riesgos de seguridad o validación

## 10. Autenticación y permisos

Explicá cómo se maneja:

- Login
- Sesiones
- Tokens
- Middleware de autenticación
- Roles o permisos
- Protección de rutas

## 11. Base de datos y modelos

Documentá:

- Tipo de base de datos
- ORM o cliente utilizado
- Modelos o schemas
- Tablas o colecciones principales
- Relaciones importantes
- Queries críticas

## 12. Componentes principales

Listá los componentes más importantes y explicá:

- Qué hacen
- Dónde se usan
- Qué props reciben
- Qué lógica contienen

## 13. Estado global y manejo de datos

Explicá si usa:

- Context API
- Redux
- Zustand
- React Query
- SWR
- Stores personalizados
- Providers

## 14. Variables de entorno

Listá todas las variables de entorno detectadas:

- Nombre
- Dónde se usa
- Para qué sirve
- Si parece obligatoria u opcional

No inventes valores reales. Solo documentá los nombres y usos.

## 15. Scripts y comandos del proyecto

Analizá el `package.json` y explicá:

- Cómo correr la app
- Cómo compilar
- Cómo testear
- Cómo hacer lint
- Otros scripts importantes

## 16. Flujo general del sistema

Explicá paso a paso cómo viaja la información dentro de la app:

- Desde el usuario
- Hacia el frontend
- Hacia APIs internas
- Hacia servicios externos
- Hacia base de datos
- Y de vuelta al usuario

## 17. Mapa de archivos críticos

Listá los archivos más importantes del proyecto y por qué son relevantes.

## 18. Riesgos técnicos detectados

Detectá posibles problemas como:

- Rutas sin protección
- APIs sin validación
- Variables de entorno faltantes
- Código duplicado
- Lógica mezclada
- Manejo débil de errores
- Dependencias sensibles
- Cronjobs peligrosos
- Problemas de escalabilidad

## 19. Recomendaciones de mejora

Proponé mejoras concretas, ordenadas por prioridad:

- Urgente
- Importante
- Opcional

## 20. Conclusión

Explicá el estado general de la app y qué próximos pasos conviene tomar.

---

## Reglas importantes

- No modifiques código todavía.
- Primero analizá todo el proyecto.
- No inventes funcionalidades.
- Si algo no está claro, marcá: “No detectado en el código” o “Requiere revisión manual”.
- Citá siempre los archivos donde encontraste cada cosa.
- Si hay rutas, APIs o cronjobs, listalos en tablas.
- El resultado final debe ser un archivo `.md` claro, útil y profesional.
- Pensá como alguien que tiene que dejar la app documentada para que otro desarrollador pueda entenderla rápidamente.
