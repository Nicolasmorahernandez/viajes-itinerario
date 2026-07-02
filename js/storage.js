const STORAGE_KEY = 'viaje-itinerario';

const SUPABASE_URL = 'https://unnhdbjfrxcjorhneuxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubmhkYmpmcnhjam9yaG5ldXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTQzMjEsImV4cCI6MjA5ODU5MDMyMX0.xAzXFCaTUUJO1nFinJvM9atH7FzZuDQate3d1JxQeH8';
const TRIP_ID = 'trip-actual';

async function fetchFromSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/itinerario?id=eq.${TRIP_ID}&select=data`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);
  return res.json();
}

const Storage = {
  // Devuelve { trip, networkError }. `trip` es null solo cuando de verdad
  // no existe ningún viaje guardado (nunca por un fallo de red transitorio).
  async load() {
    const attempts = 3;
    for (let i = 0; i < attempts; i++) {
      try {
        const rows = await fetchFromSupabase();
        if (rows.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rows[0].data));
          return { trip: rows[0].data, networkError: false };
        }
        return { trip: null, networkError: false };
      } catch (e) {
        console.warn(`Intento ${i + 1}/${attempts} de cargar desde Supabase falló`, e);
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 800));
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { trip: JSON.parse(raw), networkError: false };
    return { trip: null, networkError: true };
  },

  async save(trip) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/itinerario`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ id: TRIP_ID, data: trip, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);
    } catch (e) {
      console.warn('No se pudo sincronizar con Supabase, se guardó solo localmente', e);
    }
  }
};
