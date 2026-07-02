# Nota de horarios libres (vista mobile)

## Contexto

En la vista mobile de "un día a la vez" (día-tabs + lista vertical de actividades), el usuario quiere ver de un vistazo qué horas del día quedan libres, sin tener que revisar manualmente los huecos entre actividades. Esto ayuda a decidir dónde meter una actividad nueva sin abrir el formulario de creación primero.

## Alcance

- Aplica **solo** a la vista mobile de un día a la vez (`Render.dayList`), debajo de la última tarjeta de actividad.
- **No** aplica al modo "Ver todos los días" (lista apilada) ni a la grilla de escritorio — en ambos casos los huecos ya son visibles de un vistazo en el propio layout.
- Rango horario considerado: **07:00 a 23:00**. Fuera de ese rango (madrugada) no se considera para el cálculo, aunque técnicamente esté libre en la grilla de 4:00-24:00.

## Cálculo de huecos libres

Se reutilizan los helpers ya existentes en `render.js`: `timeToSlotIndex(time)` y `slotIndexToTime(index)`, que trabajan sobre franjas de 30 minutos indexadas desde las 4:00 (`DAY_START_HOUR = 4`, `SLOT_MINUTES = 30`).

Algoritmo para un día `selectedDay`:

1. Definir `WINDOW_START = timeToSlotIndex('07:00')` y `WINDOW_END = timeToSlotIndex('23:00')`.
2. Crear un arreglo booleano `occupied` de tamaño `WINDOW_END - WINDOW_START`, todo `false`.
3. Para cada actividad del día: calcular su `startSlot`/`endSlot` con `timeToSlotIndex`, recortarlos al rango `[WINDOW_START, WINDOW_END]` (una actividad que empiece a las 05:00 y termine a las 07:30 solo ocupa desde `WINDOW_START` hasta su `endSlot`), y marcar esas posiciones como `true` en `occupied`.
4. Recorrer `occupied` de izquierda a derecha agrupando corridas consecutivas de `false` en rangos `[inicioSlot, finSlot]`.
5. Convertir cada rango a texto con `slotIndexToTime`, formato `HH:MM–HH:MM`, uniendo múltiples rangos con ` · `.

Casos especiales:
- Si `occupied` queda completamente `false` (día sin actividades en el rango): mostrar `Libre todo el día (07:00–23:00)`.
- Si `occupied` queda completamente `true` (sin huecos): mostrar `Sin huecos libres hoy 🙌`.

## Implementación

- **`js/render.js`**: nueva función `Render.freeTimeNote(trip, day)` que devuelve un `HTMLElement` con la nota (clase `free-time-note`). Se apoya en los helpers de slots ya existentes en el mismo archivo (no se duplica lógica de fechas/slots).
- **`Render.dayList(trip, container, selectedDay, handlers)`**: al final (después de renderizar las tarjetas, o del estado vacío), hace `container.appendChild(this.freeTimeNote(trip, selectedDay))`. `Render.dayListAll` no se toca.
- **`css/style.css`**: estilo discreto para `.free-time-note` — fondo suave (`--surface-alt`), texto pequeño, ícono, consistente con el resto de la paleta/tipografía ya establecida.
- No requiere cambios en `app.js` ni en el modelo de datos — es puramente derivado de `trip.actividades` en el momento de renderizar.

## Verificación

- Día sin actividades → nota dice "Libre todo el día (07:00–23:00)".
- Día con actividades que dejan huecos → nota lista los rangos libres correctos, separados por " · ".
- Actividad que cruza el borde de la ventana (ej. termina a las 06:30 o empieza a las 22:00) → se recorta correctamente al rango 07:00-23:00 sin generar rangos negativos ni duplicados.
- Día completamente ocupado dentro de 07:00-23:00 → nota dice "Sin huecos libres hoy 🙌".
- La nota **no aparece** en el modo "Ver todos los días" ni en la grilla de escritorio.
