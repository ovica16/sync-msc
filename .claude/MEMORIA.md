# MEMORIA DEL PROYECTO — Sync MSC

## Capítulo 2: Comprensión de las Necesidades (requerimientos.md)

---

### Contexto General

**Empresa:** Minera San Cristóbal (MSC)  
**Sistema ERP:** JD Edwards (JDE) de Oracle  
**Problema:** El llenado de Órdenes de Trabajo (OTs) de Mantenimiento Planta es manual en papel. Los técnicos llenan formularios impresos y luego los supervisores transcriben todo al JDE — trabajo doble, lento y propenso a errores.  
**Solución:** App digital multiplataforma llamada **Sync MSC MP** (PC, tablet, celular).

---

### 2.2 — Roles de Usuario

| Rol | Nombre         | Acceso                                                      |
|-----|----------------|-------------------------------------------------------------|
| 1   | Administrador  | Total                                                       |
| 2   | Superintendente| Áreas de su superintendencia + estadísticas + funciones Rol 3 |
| 3   | Supervisor     | Editar, aprobar, generar información de técnicos            |
| 4   | Técnico        | Introducción de datos en formularios                        |

---

### 2.4 — Áreas (Grupos de Trabajo según JD Edwards)

| Código | Área                          | Superintendencia         |
|--------|-------------------------------|--------------------------|
| 3310   | Mecánico de Chancado          | Superintendente Mecánico |
| 3311   | Mecánico Sistema de Aguas     | Superintendente Mecánico |
| 3312   | Mecánico de Flotación         | Superintendente Mecánico |
| 3313   | Mecánico de Filtros           | Superintendente Mecánico |
| 3315   | Taller Mantenimiento General  | Superintendente Mecánico |
| 3316   | Servicios Técnicos            | Superintendente Mecánico |
| 3318   | Contratista TTMB              | Superintendente Mecánico |
| 3319   | Eléctrico Planta              | Superintendente Eléctrico|
| 3320   | Instrumentación Planta        | Superintendente Eléctrico|
| 3321   | Ingeniería                    | Superintendente Ingeniería|

> **Regla especial:** El botón "Registro de Calibración" solo aparece para el área **3320** (Instrumentación Planta).

---

### 2.5 — Registro de OT (Formulario principal — Wizard en 3 pasos)

#### Paso 1: Datos de Cabecera
- Técnico activo, turno (Diurno / Nocturno / Parada de Planta / Otro), fecha
- Grupos: 2 técnicos normalmente, hasta 6 en paradas de planta → campo "Adicionar Técnico"
- Buscador predictivo de **TAG** del equipo → auto-rellena área y tipo de equipo

#### Paso 2: Árbol de Fallas (solo para Correctivos)
- Selectores en cascada dependientes: **Síntoma → Causa Probable → Resolución Aplicada**
- Resolución es texto libre editable (la sugerencia automática es punto de partida)
- Campo **Tiempo Real (HH:MM)** editable

#### Tipos de OT
| Código | Nombre                         | Equivalencia ISO 14224            |
|--------|--------------------------------|-----------------------------------|
| CMP    | Correctivo Mayor Programado    | Corrective maintenance – Major    |
| CMR    | Correctivo Menor Rutinario     | Corrective maintenance – Minor    |
| PMP    | Preventivo Mayor Programado    | Preventive maintenance – Major    |
| PMT    | Preventivo Menor de Turno      | Preventive maintenance – Minor    |
| PTJ    | Proyecto / Trabajo de Ingeniería | Project / Engineering work      |

#### Paso 3: Resumen y Confirmación
- Número de OT auto-generado
- Botones: GUARDAR ORDEN / AÑADIR OTRA OT

#### Características adicionales del Registro de OT
- Múltiples líneas de equipo por OT (varios TAGs en una misma orden)
- Adjuntar fotos (cámara en móvil, subida de archivo en PC) y reportes PDF/Excel
- Para OTs de tipo PMP: formularios predefinidos por TAG (desde base de datos)
- Caja de observaciones final
- **Módulo de Configuración/Adición de Datos** (Roles 1, 2, 3): agregar TAGs, árbol de fallas, personal, áreas

---

### 2.5 (cont.) — Reporte de OT y Flujo de Revisión

**Flujo de estados:**
```
Técnico llena (Pendiente Revisión)
  → Supervisor revisa
    → Aprueba: "Revisado y Concluido"
    → Rechaza: "Solicitar Corrección" → técnico corrige → vuelve a Pendiente
```

**Campos que agrega el Supervisor:**
- Código Modo de Falla (ISO 14224)
- Clasificación RCM (Correctivo No Planificado / Correctivo Programado / Mant. Menor / Mayor)
- Criticidad del Equipo (A, B, C)
- Lección Aprendida / RCA
- ¿Requiere Planificación?
- Enlace a OT Relacionada

**Historial de modificaciones** (audit trail completo por OT)

**KPIs automáticos:** Pareto de modos de falla, MTBF por equipo, % correctivo planificado vs no planificado, backlog por criticidad

---

### 2.6 — Reporte de Turno (Shift Handover)

**Módulos:**
1. **Supervisor de turno saliente:** revisa OTs del turno, marca críticas, agrega recomendaciones, genera PDF
2. **Generación automática de PDF** con: resumen ejecutivo, trabajos críticos, pendientes para el siguiente turno, recomendaciones, tabla completa de OTs
3. **Consolidación:** Supervisor General consolida reporte turno día + turno noche → PDF ejecutivo para reunión 07:00 AM

**Estados de OT en el turno:** Concluido / Pendiente / Inconcluso

**KPIs del turno:**
| KPI                        | Fórmula                          |
|----------------------------|----------------------------------|
| % Cumplimiento OT          | OTs concluidas / OTs programadas |
| % Correctivo vs Preventivo | HH correctivo / HH totales       |
| Trabajos Inconclusos       | Cantidad OTs no concluidas       |
| MTTR                       | HH totales / OTs concluidas      |
| Backlog de Pendientes      | OTs pendientes acumuladas        |

---

### 2.7 — Reporte por TAG (Historial de Equipo)

**Datos maestros del activo:** TAG, área, descripción, criticidad, disciplina, fabricante, modelo, serie, fecha instalación, vida útil, MTBF, MTTR, confiabilidad, disponibilidad

**Filtros:** rango de fechas, tipo OT, disciplina, estado, criticidad del evento

**Secciones del reporte:**
1. Resumen ejecutivo de confiabilidad del período
2. Cronología de intervenciones (línea de tiempo)
3. Tabla de intervenciones enriquecida (árbol de falla completo por evento)
4. Análisis de tendencias y patrones (Pareto de modos de falla, tendencia MTBF, componentes más reemplazados)

**Las 5 preguntas ISO 14224 por intervención:**
1. ¿Qué falló? (componente, síntoma)
2. ¿Cómo falló? (modo de falla normalizado)
3. ¿Por qué falló? (causa raíz)
4. ¿Qué se hizo? (acción correctiva, partes cambiadas)
5. ¿Cuánto impactó? (tiempo fuera de servicio, costo)

**Integración de costos:** importación desde JDE vía Excel/CSV

**Comportamiento inteligente:** Al abrir una OT, el sistema muestra automáticamente el historial reciente del TAG, componentes cambiados y RCAs pendientes.

---

### 2.8 — Reporte Semanal / Programación

- Semanas 1–52 con asignación de personal (nombre y apellido)
- Registra técnicos de turno día y turno noche
- Planificación sube la base de datos (CSV/Excel)
- **Dashboard de ejecución en tiempo real** (estado día a día)
- Integración con Registro de OT: al registrar, el técnico puede filtrar por técnico, OT, semana o área para ver sus trabajos asignados
- Ciclo PDCA: Planificación → Ejecución → Control → Mejora

---

### Colecciones MongoDB sugeridas (diseño inicial)

Basado en el Capítulo 2, las colecciones principales a modelar son:

1. **`usuarios`** — id, nombre, apellido, rol (1-4), área(s), turno preferido
2. **`areas`** — código JDE (3310–3321), nombre, superintendencia
3. **`equipos`** (TAGs) — tag, descripción, área, tipo, fabricante, modelo, serie, criticidad, fecha_instalacion, vida_util_estimada
4. **`ordenes_trabajo`** — número_ot (auto), fecha, turno, técnicos[], área, lines[] (cada línea: tag, tipo_ot, arbol_falla, tiempo_real, adjuntos[]), estado, historial_cambios[], observaciones, datos_supervisor{}
5. **`arbol_fallas`** — tipo_equipo, síntoma, causa_probable, resolución_sugerida, tiempo_estimado (tabla maestra viva)
6. **`reportes_turno`** — turno, fecha, supervisor, ots_incluidas[], observaciones[], recomendaciones[], estado (borrador/enviado), pdf_url
7. **`programacion_semanal`** — semana, año, ots_planificadas[], asignaciones_personal[]
8. **`auditoria_ot`** — ot_id, fecha_hora, usuario, cambio_realizado (log inmutable)

---

*Última actualización: 2026-05-07*
