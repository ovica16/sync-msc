@AGENTS.md

# Política de subagentes por modelo

Cuando se necesite delegar trabajo a un subagente, usar el modelo según la naturaleza de la tarea:

## claude-haiku-4-5 — Búsqueda y lectura rápida
Usar para:
- Buscar archivos (Glob, Grep)
- Leer archivos para extraer información puntual
- Lookups de símbolos, rutas, tipos
- Tareas de exploración que no escriben código

## claude-sonnet-4-6 — Escritura y código normal
Usar para:
- Implementar funcionalidades nuevas
- Editar o refactorizar código existente
- Crear componentes, rutas de API, modelos
- Corrección de bugs
- Todo trabajo de desarrollo habitual

## claude-opus-4-7 — Revisión de arquitectura y decisiones críticas
Usar únicamente para:
- Evaluar decisiones de arquitectura de alto impacto
- Revisar diseño de esquemas de base de datos antes de migrar
- Análisis de seguridad o rendimiento crítico
- Decisiones que afecten a múltiples módulos simultáneamente
- No usar para tareas de implementación rutinaria
