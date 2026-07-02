const STORAGE_KEY = 'viaje-itinerario';

const SUPABASE_URL = 'https://unnhdbjfrxcjorhneuxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVubmhkYmpmcnhjam9yaG5ldXhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTQzMjEsImV4cCI6MjA5ODU5MDMyMX0.xAzXFCaTUUJO1nFinJvM9atH7FzZuDQate3d1JxQeH8';
const TRIP_ID = 'trip-actual';

const Storage = {
  async load() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/itinerario?id=eq.${TRIP_ID}&select=data`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);
      const rows = await res.json();
      if (rows.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rows[0].data));
        return rows[0].data;
      }
    } catch (e) {
      console.warn('No se pudo cargar desde Supabase, usando copia local', e);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
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
