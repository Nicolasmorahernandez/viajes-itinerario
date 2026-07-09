# Presupuesto, Gasto Real y Quién Pagó

## Contexto

Cada actividad hoy tiene un único campo `costo`, sumado en el header como "Presupuesto total: $X". El usuario quiere distinguir cuánto planeaba gastar (presupuesto) de cuánto gastó realmente (gasto real), y quién de los viajeros lo pagó — para poder ver el balance de gasto entre personas al final del viaje.

## Modelo de datos

**Nuevo campo en `trip`:**

```js
{
  // ...campos existentes (nombreViaje, fechaInicio, fechaFin, actividades)...
  viajeros: ["Nico", "Maria"] // array de strings, vacío por defecto
}
```

**Cambios en cada actividad** (dentro de `trip.actividades`):

- `costo` → renombrado a `presupuesto` (número, opcional). Migración automática: si una actividad tiene `costo` pero no `presupuesto`, se copia el valor y se borra `costo` — mismo patrón que la migración ya existente de `hora` → `horaInicio`/`horaFin` en `normalizeTrip()` (`js/app.js`).
- `gastoReal`: número, opcional. Cuánto se gastó realmente.
- `pagadoPor`: string, opcional. Debe coincidir con uno de los nombres en `trip.viajeros` (o quedar vacío si no se ha definido quién pagó).

## Gestión de viajeros

- Nuevo botón "Viajeros" en el header de la app (`app-header`, junto al resumen de presupuesto), visible en desktop y mobile.
- Al tocarlo, abre una tarjeta (reutilizando el patrón de `modal-overlay` ya existente) con: lista de viajeros actuales, cada uno con botón de eliminar, y un input + botón "Agregar" para sumar uno nuevo.
- Cambios se guardan en `trip.viajeros` de inmediato (mismo flujo de `Storage.save(trip)` + `renderAll()` que el resto de la app).
- Si se elimina un viajero que ya estaba asignado como `pagadoPor` en alguna actividad, esas actividades simplemente quedan con `pagadoPor` apuntando a un nombre que ya no está en la lista — se muestran igual (como texto suelto) pero no se pueden volver a seleccionar en el dropdown hasta que se re-agregue el nombre. No se borra el dato de la actividad automáticamente (evita pérdida de información histórica).

## Formulario de actividad (`Render.modal`)

- El input "Costo" (`#f-costo`) se renombra a "Presupuesto", mismo `id` interno reutilizado como `#f-presupuesto` para claridad.
- Nuevo input numérico "Gasto real" (`#f-gasto-real`), opcional, mismo estilo que presupuesto.
- Nuevo `<select>` "¿Quién pagó?" (`#f-pagado-por`), con una opción vacía ("Sin definir") + una opción por cada nombre en `trip.viajeros`. Si `trip.viajeros` está vacío, el select se deshabilita y muestra una única opción "Agrega viajeros primero (botón Viajeros en el header)".

## Tarjetas compactas (grid desktop, lista mobile, secciones "todos los días")

- Se muestra un solo monto, priorizando `gastoReal` si existe; si no, `presupuesto`. Mismo formato `$` que hoy.
- No se agrega el nombre del pagador en la tarjeta compacta (se reserva para las vistas expandidas, para no saturar).

## Vistas expandidas (detalle mobile y popover desktop)

- Muestran ambos montos por separado, con etiqueta: "Presupuesto: $X" y "Gasto real: $Y" (solo la(s) línea(s) que tengan valor).
- Si `pagadoPor` está definido, se muestra "Pagó: <nombre>".

## Resumen del header

- Cambia de "Presupuesto total: $X" a "Presupuesto: $X · Gastado: $Y":
  - **Presupuesto**: suma de `presupuesto` de todas las actividades.
  - **Gastado**: suma de `gastoReal` solo de las actividades que tengan ese campo cargado (no asume gasto en las que no se ha llenado).
- El resumen es tocable/clicable: abre una tarjeta pequeña (mismo patrón `modal-overlay`) con el desglose por persona — para cada nombre en `trip.viajeros`, la suma de `gastoReal` de las actividades donde `pagadoPor === nombre`. Si `trip.viajeros` está vacío, muestra un mensaje invitando a agregar viajeros.

## Fuera de alcance

- No se soporta dividir el pago de una misma actividad entre varios viajeros — un solo `pagadoPor` por actividad.
- No se calcula "quién le debe a quién" (liquidación de deudas entre viajeros) — solo el total pagado por cada uno.

## Verificación

- Cargar el itinerario real de Texas (con actividades que ya tienen `costo`) y confirmar que se migran a `presupuesto` sin perder el valor, y que el total del header sigue cuadrando.
- Agregar 2 viajeros, asignar `pagadoPor` y `gastoReal` a varias actividades, y confirmar que el desglose por persona suma correctamente.
- Actividad sin `gastoReal` cargado no debe contarse en el total "Gastado" del header.
- Eliminar un viajero que ya estaba asignado como pagador en una actividad existente, y confirmar que esa actividad no se rompe (sigue mostrando el nombre viejo, solo que ya no aparece como opción seleccionable en el dropdown).
- Confirmar que las tarjetas compactas muestran `gastoReal` cuando existe, y si no, `presupuesto`.
