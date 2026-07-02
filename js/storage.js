const STORAGE_KEY = 'viaje-itinerario';

const Storage = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  save(trip) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  }
};
