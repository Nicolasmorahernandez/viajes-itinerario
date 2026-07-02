const DAY_START_HOUR = 4;
const SLOT_MINUTES = 30;
const SLOT_COUNT = (24 - DAY_START_HOUR) * 60 / SLOT_MINUTES; // 40 slots, 4:00 - 24:00
const ROW_HEIGHT = 34;

function timeToSlotIndex(time) {
  const [h, m] = time.split(':').map(Number);
  return ((h * 60 + m) - DAY_START_HOUR * 60) / SLOT_MINUTES;
}

function slotIndexToTime(index) {
  const total = DAY_START_HOUR * 60 + index * SLOT_MINUTES;
  if (total >= 24 * 60) return '24:00';
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function roundTimeToSlot(raw) {
  let [h, m] = raw.split(':').map(Number);
  let total = h * 60 + m;
  total = Math.round(total / SLOT_MINUTES) * SLOT_MINUTES;
  total = Math.max(DAY_START_HOUR * 60, Math.min(24 * 60, total));
  if (total >= 24 * 60) return '24:00';
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function formatTimeForInput(time) {
  return time === '24:00' ? '23:59' : time;
}

const Render = {
  CATEGORIES: [
    { id: 'transporte', label: 'Transporte' },
    { id: 'alojamiento', label: 'Alojamiento' },
    { id: 'comida', label: 'Comida' },
    { id: 'tour', label: 'Tour/Actividad' },
    { id: 'otro', label: 'Otro' }
  ],

  formatDayLabel(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  },

  dayTabs(trip, container, selectedDay, onSelect) {
    const days = getTripDays(trip);
    container.innerHTML = '';
    days.forEach(day => {
      const date = new Date(day + 'T00:00:00');
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'day-tab' + (day === selectedDay ? ' active' : '');
      tab.innerHTML = `
        <span class="day-tab-dow">${date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
        <span class="day-tab-num">${date.getDate()}</span>
      `;
      tab.addEventListener('click', () => onSelect(day));
      container.appendChild(tab);
    });
  },

  dayList(trip, container, selectedDay, handlers) {
    container.innerHTML = '';
    const days = getTripDays(trip);
    const items = trip.actividades
      .filter(a => a.dia === selectedDay)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'day-list-empty';
      empty.textContent = 'No hay actividades este día todavía. Toca "+ Actividad" para agregar una.';
      container.appendChild(empty);
    } else {
      items.forEach(activity => container.appendChild(this.listCard(activity, handlers, days)));
    }

    container.appendChild(this.freeTimeNote(trip, selectedDay));
  },

  freeTimeNote(trip, day) {
    const WINDOW_START = timeToSlotIndex('07:00');
    const WINDOW_END = timeToSlotIndex('23:00');
    const size = WINDOW_END - WINDOW_START;
    const occupied = new Array(size).fill(false);

    trip.actividades
      .filter(a => a.dia === day)
      .forEach(a => {
        const start = Math.max(WINDOW_START, timeToSlotIndex(a.horaInicio));
        const end = Math.min(WINDOW_END, timeToSlotIndex(a.horaFin));
        for (let i = start; i < end; i++) {
          occupied[i - WINDOW_START] = true;
        }
      });

    const ranges = [];
    let rangeStart = null;
    for (let i = 0; i < size; i++) {
      if (!occupied[i] && rangeStart === null) {
        rangeStart = i;
      } else if (occupied[i] && rangeStart !== null) {
        ranges.push([rangeStart, i]);
        rangeStart = null;
      }
    }
    if (rangeStart !== null) ranges.push([rangeStart, size]);

    const note = document.createElement('div');
    note.className = 'free-time-note';

    if (ranges.length === 0) {
      note.textContent = '🙌 Sin huecos libres hoy';
    } else if (ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === size) {
      note.textContent = '🕐 Libre todo el día (07:00–23:00)';
    } else {
      const text = ranges
        .map(([s, e]) => `${slotIndexToTime(WINDOW_START + s)}–${slotIndexToTime(WINDOW_START + e)}`)
        .join(' · ');
      note.textContent = `🕐 Libre: ${text}`;
    }

    return note;
  },

  dayListAll(trip, container, handlers) {
    container.innerHTML = '';
    const days = getTripDays(trip);

    days.forEach(day => {
      const section = document.createElement('div');
      section.className = 'day-section';

      const header = document.createElement('div');
      header.className = 'day-section-header';
      header.textContent = this.formatDayLabel(day);
      section.appendChild(header);

      const items = trip.actividades
        .filter(a => a.dia === day)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'day-list-empty small';
        empty.textContent = 'Sin actividades';
        section.appendChild(empty);
      } else {
        items.forEach(activity => section.appendChild(this.listCard(activity, handlers, days)));
      }

      container.appendChild(section);
    });
  },

  listCard(activity, handlers, days) {
    const cat = this.CATEGORIES.find(c => c.id === activity.categoria) || this.CATEGORIES[4];
    const card = document.createElement('div');
    card.className = `list-card cat-${cat.id}` + (activity.completado ? ' completado' : '');
    card.addEventListener('click', () => handlers.onCardClick(activity));

    const check = document.createElement('label');
    check.className = 'list-check';
    check.innerHTML = `<input type="checkbox" ${activity.completado ? 'checked' : ''}>`;
    check.addEventListener('click', e => e.stopPropagation());
    check.querySelector('input').addEventListener('change', () => handlers.onToggleComplete(activity));
    card.appendChild(check);

    if (activity.imagenUrl) {
      const img = document.createElement('img');
      img.className = 'list-image';
      img.src = activity.imagenUrl;
      img.alt = activity.titulo;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'list-body';
    body.innerHTML = `
      <div class="list-time">${activity.horaInicio} – ${activity.horaFin}</div>
      <div class="list-title">${escapeHtml(activity.titulo)}</div>
      ${activity.ubicacion ? `<div class="list-meta">📍 ${escapeHtml(activity.ubicacion)}</div>` : ''}
      ${activity.costo ? `<div class="list-meta">💲 $${Number(activity.costo).toLocaleString()}</div>` : ''}
    `;

    if (days && days.length > 1) {
      const moveRow = document.createElement('div');
      moveRow.className = 'list-move';
      const select = document.createElement('select');
      select.className = 'list-move-select';
      select.innerHTML = days.map(d => `<option value="${d}" ${d === activity.dia ? 'selected' : ''}>📅 ${this.formatDayLabel(d)}</option>`).join('');
      select.addEventListener('click', e => e.stopPropagation());
      select.addEventListener('change', e => {
        e.stopPropagation();
        handlers.onMoveDay(activity, select.value);
      });
      moveRow.appendChild(select);
      body.appendChild(moveRow);
    }

    card.appendChild(body);

    return card;
  },

  grid(trip, container, handlers) {
    const days = getTripDays(trip);
    container.innerHTML = '';
    container.style.gridTemplateColumns = `80px repeat(${days.length}, minmax(160px, 1fr))`;
    container.style.gridTemplateRows = `50px repeat(${SLOT_COUNT}, ${ROW_HEIGHT}px)`;

    const corner = document.createElement('div');
    corner.className = 'grid-corner';
    corner.style.gridColumn = '1';
    corner.style.gridRow = '1';
    container.appendChild(corner);

    days.forEach((day, dayIndex) => {
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = this.formatDayLabel(day);
      header.style.gridColumn = `${dayIndex + 2}`;
      header.style.gridRow = '1';
      container.appendChild(header);
    });

    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const onHour = slot % 2 === 0;

      const hourLabel = document.createElement('div');
      hourLabel.className = 'hour-label' + (onHour ? ' hour-start' : ' half-hour');
      hourLabel.textContent = onHour ? slotIndexToTime(slot) : '';
      hourLabel.style.gridColumn = '1';
      hourLabel.style.gridRow = `${slot + 2}`;
      container.appendChild(hourLabel);

      days.forEach((day, dayIndex) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell' + (onHour ? ' hour-start' : '');
        cell.dataset.day = day;
        cell.dataset.slot = slot;
        cell.style.gridColumn = `${dayIndex + 2}`;
        cell.style.gridRow = `${slot + 2}`;

        cell.addEventListener('dragover', e => e.preventDefault());
        cell.addEventListener('drop', e => {
          e.preventDefault();
          handlers.onCellDrop(e, day, slot);
        });
        cell.addEventListener('click', () => handlers.onCellClick(day, slot));

        container.appendChild(cell);
      });
    }

    trip.actividades.forEach(activity => {
      const dayIndex = days.indexOf(activity.dia);
      if (dayIndex === -1) return;
      const startSlot = Math.max(0, timeToSlotIndex(activity.horaInicio));
      const endSlot = Math.min(SLOT_COUNT, timeToSlotIndex(activity.horaFin));
      if (endSlot <= startSlot) return;

      const card = this.card(activity, handlers);
      card.style.gridColumn = `${dayIndex + 2}`;
      card.style.gridRow = `${startSlot + 2} / ${endSlot + 2}`;
      container.appendChild(card);
    });
  },

  card(activity, handlers) {
    const cat = this.CATEGORIES.find(c => c.id === activity.categoria) || this.CATEGORIES[4];
    const card = document.createElement('div');
    card.className = `activity-card cat-${cat.id}` + (activity.completado ? ' completado' : '');
    card.draggable = true;

    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', activity.id);
      handlers.onCardDragStart && handlers.onCardDragStart(e, activity);
    });

    card.addEventListener('click', e => {
      e.stopPropagation();
      handlers.onCardClick(activity);
    });

    card.addEventListener('mouseenter', () => showPopover(activity, card));
    card.addEventListener('mouseleave', () => hidePopover());

    const check = document.createElement('label');
    check.className = 'card-check';
    check.innerHTML = `<input type="checkbox" ${activity.completado ? 'checked' : ''}>`;
    check.addEventListener('click', e => e.stopPropagation());
    check.querySelector('input').addEventListener('change', () => handlers.onToggleComplete(activity));
    card.appendChild(check);

    if (activity.imagenUrl) {
      const img = document.createElement('img');
      img.className = 'card-image';
      img.src = activity.imagenUrl;
      img.alt = activity.titulo;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
      <div class="card-title">${escapeHtml(activity.titulo)}</div>
      <div class="card-meta">${activity.horaInicio} - ${activity.horaFin}</div>
    `;
    card.appendChild(body);

    return card;
  },

  budget(trip, container) {
    const total = trip.actividades.reduce((sum, a) => sum + (Number(a.costo) || 0), 0);
    container.textContent = `Presupuesto total: $${total.toLocaleString()}`;
  },

  modal(container, { activity, presetDay, presetHoraInicio, presetHoraFin, days }, callbacks) {
    const isEdit = !!activity;
    const a = activity || {
      dia: presetDay || days[0],
      horaInicio: presetHoraInicio || '07:00',
      horaFin: presetHoraFin || '08:00',
      titulo: '', categoria: 'otro', ubicacion: '', costo: '', notas: '', link: '', imagenUrl: '', completado: false
    };

    container.innerHTML = `
      <h2>${isEdit ? 'Editar actividad' : 'Nueva actividad'}</h2>
      <form id="activity-form">
        <label>Día
          <select id="f-dia">
            ${days.map(d => `<option value="${d}" ${d === a.dia ? 'selected' : ''}>${this.formatDayLabel(d)}</option>`).join('')}
          </select>
        </label>
        <div class="form-row">
          <label>Hora inicio
            <input type="time" id="f-hora-inicio" value="${formatTimeForInput(a.horaInicio)}" step="1800" required>
          </label>
          <label>Hora fin
            <input type="time" id="f-hora-fin" value="${formatTimeForInput(a.horaFin)}" step="1800" required>
          </label>
        </div>
        <label>Título
          <input type="text" id="f-titulo" value="${escapeHtml(a.titulo)}" required>
        </label>
        <label>Categoría
          <select id="f-categoria">
            ${this.CATEGORIES.map(c => `<option value="${c.id}" ${c.id === a.categoria ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </label>
        <label>Ubicación
          <input type="text" id="f-ubicacion" value="${escapeHtml(a.ubicacion || '')}">
        </label>
        <label>Costo
          <input type="number" id="f-costo" value="${a.costo || ''}" min="0" step="0.01">
        </label>
        <label>Link (reserva, mapa, web)
          <input type="url" id="f-link" value="${escapeHtml(a.link || '')}">
        </label>
        <label>URL de imagen
          <input type="url" id="f-imagenUrl" value="${escapeHtml(a.imagenUrl || '')}">
        </label>
        <label>Notas
          <textarea id="f-notas">${escapeHtml(a.notas || '')}</textarea>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-completado" ${a.completado ? 'checked' : ''}>
          Actividad realizada
        </label>
        <div class="modal-actions">
          ${isEdit ? '<button type="button" id="f-delete" class="btn-danger">Eliminar</button>' : '<span></span>'}
          <div>
            <button type="button" id="f-cancel" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar</button>
          </div>
        </div>
      </form>
    `;

    document.getElementById('activity-form').addEventListener('submit', e => {
      e.preventDefault();
      const horaInicio = roundTimeToSlot(document.getElementById('f-hora-inicio').value);
      let horaFin = roundTimeToSlot(document.getElementById('f-hora-fin').value);
      if (timeToSlotIndex(horaFin) <= timeToSlotIndex(horaInicio)) {
        horaFin = slotIndexToTime(Math.min(SLOT_COUNT, timeToSlotIndex(horaInicio) + 1));
      }

      callbacks.onSave({
        id: isEdit ? activity.id : undefined,
        dia: document.getElementById('f-dia').value,
        horaInicio,
        horaFin,
        titulo: document.getElementById('f-titulo').value.trim(),
        categoria: document.getElementById('f-categoria').value,
        ubicacion: document.getElementById('f-ubicacion').value.trim(),
        costo: document.getElementById('f-costo').value,
        link: document.getElementById('f-link').value.trim(),
        imagenUrl: document.getElementById('f-imagenUrl').value.trim(),
        notas: document.getElementById('f-notas').value.trim(),
        completado: document.getElementById('f-completado').checked
      });
    });

    document.getElementById('f-cancel').addEventListener('click', () => callbacks.onClose());

    const deleteBtn = document.getElementById('f-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => callbacks.onDelete(activity.id));
    }
  }
};

function getTripDays(trip) {
  const days = [];
  const cursor = new Date(trip.fechaInicio + 'T00:00:00');
  const end = new Date(trip.fechaFin + 'T00:00:00');
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

let popoverEl = null;

function ensurePopover() {
  if (!popoverEl) {
    popoverEl = document.createElement('div');
    popoverEl.className = 'hover-popover';
    document.body.appendChild(popoverEl);
  }
  return popoverEl;
}

function showPopover(activity, cardEl) {
  const pop = ensurePopover();
  const cat = Render.CATEGORIES.find(c => c.id === activity.categoria) || Render.CATEGORIES[4];

  pop.className = `hover-popover cat-${cat.id}`;
  pop.innerHTML = `
    ${activity.imagenUrl ? `<img class="popover-image" src="${activity.imagenUrl}" alt="">` : ''}
    <div class="popover-body">
      <div class="popover-title">${escapeHtml(activity.titulo)}</div>
      <div class="popover-meta">🕐 ${activity.horaInicio} - ${activity.horaFin}</div>
      ${activity.ubicacion ? `<div class="popover-meta">📍 ${escapeHtml(activity.ubicacion)}</div>` : ''}
      ${activity.costo ? `<div class="popover-meta">💲 $${Number(activity.costo).toLocaleString()}</div>` : ''}
      ${activity.notas ? `<div class="popover-notes">${escapeHtml(activity.notas)}</div>` : ''}
      ${activity.link ? `<div class="popover-link">🔗 ${escapeHtml(activity.link)}</div>` : ''}
    </div>
  `;

  pop.style.display = 'flex';
  pop.style.visibility = 'hidden';

  const rect = cardEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();

  let left = rect.right + 12;
  if (left + popRect.width > window.innerWidth - 10) {
    left = rect.left - popRect.width - 12;
  }
  if (left < 10) left = 10;

  let top = rect.top;
  if (top + popRect.height > window.innerHeight - 10) {
    top = Math.max(10, window.innerHeight - popRect.height - 10);
  }

  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.visibility = 'visible';
}

function hidePopover() {
  if (popoverEl) popoverEl.style.display = 'none';
}
