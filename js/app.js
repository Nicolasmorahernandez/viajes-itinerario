let trip = null;
let selectedDay = null;

const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const modalOverlay = document.getElementById('modal-overlay');
const modalEl = document.getElementById('modal');
const gridEl = document.getElementById('calendar-grid');
const dayTabsEl = document.getElementById('day-tabs');
const dayListEl = document.getElementById('day-list');
const budgetEl = document.getElementById('budget-summary');
const tripNameEl = document.getElementById('trip-name');

async function init() {
  trip = await Storage.load();
  if (trip) {
    normalizeTrip(trip);
    showApp();
  } else {
    showSetup();
  }
}

function normalizeTrip(trip) {
  trip.actividades.forEach(a => {
    if (!a.horaInicio) {
      a.horaInicio = a.hora || '07:00';
      a.horaFin = slotIndexToTime(Math.min(SLOT_COUNT, timeToSlotIndex(a.horaInicio) + 2));
      delete a.hora;
    }
    if (a.completado === undefined) a.completado = false;
  });
}

function showSetup() {
  setupScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  setupScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  renderAll();
}

function renderAll() {
  const days = getTripDays(trip);
  if (!selectedDay || !days.includes(selectedDay)) {
    const today = new Date().toISOString().slice(0, 10);
    selectedDay = days.includes(today) ? today : days[0];
  }

  tripNameEl.textContent = trip.nombreViaje;

  Render.grid(trip, gridEl, {
    onCellClick: openCreateModal,
    onCardClick: openEditModal,
    onCellDrop: handleDrop,
    onToggleComplete: toggleComplete
  });

  Render.dayTabs(trip, dayTabsEl, selectedDay, day => {
    selectedDay = day;
    renderAll();
  });
  Render.dayList(trip, dayListEl, selectedDay, {
    onCardClick: openEditModal,
    onToggleComplete: toggleComplete
  });

  Render.budget(trip, budgetEl);
}

document.getElementById('setup-form').addEventListener('submit', e => {
  e.preventDefault();
  const nombreViaje = document.getElementById('setup-name').value.trim();
  const fechaInicio = document.getElementById('setup-start').value;
  const fechaFin = document.getElementById('setup-end').value;

  if (!nombreViaje || !fechaInicio || !fechaFin || fechaFin < fechaInicio) {
    alert('Revisa el nombre y que la fecha de fin no sea anterior a la de inicio.');
    return;
  }

  trip = { nombreViaje, fechaInicio, fechaFin, actividades: [] };
  Storage.save(trip);
  showApp();
});

document.getElementById('add-activity-btn').addEventListener('click', () => openCreateModal(selectedDay));

function openCreateModal(day, slot) {
  const days = getTripDays(trip);
  const presetHoraInicio = slot !== undefined ? slotIndexToTime(slot) : undefined;
  const presetHoraFin = slot !== undefined ? slotIndexToTime(Math.min(SLOT_COUNT, slot + 2)) : undefined;
  Render.modal(modalEl, { activity: null, presetDay: day, presetHoraInicio, presetHoraFin, days }, modalCallbacks());
  modalOverlay.classList.remove('hidden');
}

function openEditModal(activity) {
  const days = getTripDays(trip);
  Render.modal(modalEl, { activity, days }, modalCallbacks());
  modalOverlay.classList.remove('hidden');
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalEl.innerHTML = '';
}

function modalCallbacks() {
  return {
    onSave: data => {
      if (data.id) {
        const idx = trip.actividades.findIndex(a => a.id === data.id);
        trip.actividades[idx] = { ...trip.actividades[idx], ...data };
      } else {
        trip.actividades.push({ ...data, id: crypto.randomUUID() });
      }
      Storage.save(trip);
      closeModal();
      renderAll();
    },
    onDelete: id => {
      trip.actividades = trip.actividades.filter(a => a.id !== id);
      Storage.save(trip);
      closeModal();
      renderAll();
    },
    onClose: closeModal
  };
}

function handleDrop(e, day, slot) {
  const id = e.dataTransfer.getData('text/plain');
  const activity = trip.actividades.find(a => a.id === id);
  if (!activity) return;

  const duration = timeToSlotIndex(activity.horaFin) - timeToSlotIndex(activity.horaInicio);
  let startSlot = slot;
  let endSlot = startSlot + duration;
  if (endSlot > SLOT_COUNT) {
    endSlot = SLOT_COUNT;
    startSlot = Math.max(0, endSlot - duration);
  }

  activity.dia = day;
  activity.horaInicio = slotIndexToTime(startSlot);
  activity.horaFin = slotIndexToTime(endSlot);
  Storage.save(trip);
  renderAll();
}

function toggleComplete(activity) {
  activity.completado = !activity.completado;
  Storage.save(trip);
  renderAll();
}

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

init();
