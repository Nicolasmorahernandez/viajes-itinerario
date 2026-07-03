# Nota de Horarios Libres (mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a text note at the bottom of the mobile single-day activity list summarizing the free (unscheduled) time ranges between 07:00 and 23:00 for that day.

**Architecture:** Pure client-side derivation. A new `Render.freeTimeNote(trip, day)` function in `js/render.js` reuses the existing 30-minute slot helpers (`timeToSlotIndex`, `slotIndexToTime`) to build an occupancy array for the 07:00–23:00 window, extract the free runs, and return a rendered `<div class="free-time-note">`. `Render.dayList()` appends it after the activity cards (or after the empty-state message). No changes to data model, `app.js`, or the desktop grid / "ver todos los días" view.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, no bundler). This repo has no test runner or `package.json` — verification throughout this project has been done with ad-hoc Python Playwright scripts run against the local static server (`python3 -m http.server 8765` from the project root), which is the pattern this plan follows instead of inventing new tooling.

---

## Before you start

- Confirm the local static server is running and serving the current `index.html`:
  ```bash
  curl -sI http://localhost:8765/index.html | head -1
  ```
  Expected: `HTTP/1.0 200 OK`. If it's not running, start it from the project root: `python3 -m http.server 8765 &`
- Confirm `playwright` is installed for the system Python: `python3 -c "import playwright; print('ok')"`. If it errors, install with `pip3 install --user playwright && python3 -m playwright install chromium`.
- **Do not** let any Playwright script in this plan hit `https://unnhdbjfrxcjorhneuxm.supabase.co` — that's the real production database backing the deployed app. Every script below opens a fresh browser context, clears `localStorage`, and routes `**://*.supabase.co/**` to `route.abort()` before navigating, so the app falls back to local-only storage and creates a throwaway trip. Do not remove that routing line from any script.

---

### Task 1: Implement `Render.freeTimeNote` and wire it into `Render.dayList`

**Files:**
- Modify: `js/render.js:65-81` (the existing `dayList` method)
- Test script (not committed to the repo): `/tmp/test_free_time.py`

- [ ] **Step 1: Write the failing verification script**

Create `/tmp/test_free_time.py`:

```python
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"
results = []

def log(step, ok, detail=""):
    results.append((step, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} - {step} {detail}")

def setup_trip(page, start, end):
    page.route("**://*.supabase.co/**", lambda route: route.abort())
    page.goto(URL)
    page.wait_for_load_state('networkidle')
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_timeout(4000)  # allow Storage.load()'s 3 retries to exhaust and fall through
    if page.locator('#setup-screen').is_visible():
        page.fill('#setup-name', 'Free Time Test')
        page.fill('#setup-start', start)
        page.fill('#setup-end', end)
        page.click('#setup-form button[type=submit]')
        page.wait_for_timeout(400)

def add_activity(page, hora_inicio, hora_fin, titulo):
    page.click('#add-activity-btn')
    page.wait_for_selector('#activity-form')
    page.fill('#f-titulo', titulo)
    page.fill('#f-hora-inicio', hora_inicio)
    page.fill('#f-hora-fin', hora_fin)
    page.click('#activity-form button[type=submit]')
    page.wait_for_timeout(300)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Scenario A: empty day -> "Libre todo el día"
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    setup_trip(page, '2026-08-01', '2026-08-01')
    note = page.locator('.free-time-note')
    log("Empty day: note element exists", note.count() == 1, note.count())
    log("Empty day: says 'Libre todo el día'", 'Libre todo el día' in (note.inner_text() if note.count() else ''), note.inner_text() if note.count() else 'MISSING')
    ctx.close()

    # Scenario B: activities with gaps -> lists correct free ranges
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    setup_trip(page, '2026-08-02', '2026-08-02')
    add_activity(page, '09:00', '10:00', 'Actividad A')
    add_activity(page, '14:00', '15:00', 'Actividad B')
    note = page.locator('.free-time-note')
    text = note.inner_text()
    log("Gaps: shows 07:00–09:00", '07:00' in text and '09:00' in text, text)
    log("Gaps: shows 10:00–14:00", '10:00' in text and '14:00' in text, text)
    log("Gaps: shows 15:00–23:00", '15:00' in text and '23:00' in text, text)
    ctx.close()

    # Scenario C: activity crossing the window edges gets clipped, not negative/duplicated
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    setup_trip(page, '2026-08-03', '2026-08-03')
    add_activity(page, '05:00', '08:00', 'Antes del amanecer')  # starts before 07:00
    add_activity(page, '22:00', '23:30', 'Cierre tarde')  # ends after 23:00
    note = page.locator('.free-time-note')
    text = note.inner_text()
    log("Clipping: first free range starts at 08:00 (not before)", '08:00' in text, text)
    log("Clipping: no free range mentions 23:30 or beyond", '23:30' not in text, text)
    ctx.close()

    # Scenario D: fully booked day -> "Sin huecos libres"
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    setup_trip(page, '2026-08-04', '2026-08-04')
    add_activity(page, '07:00', '23:00', 'Todo el día')
    note = page.locator('.free-time-note')
    text = note.inner_text()
    log("Fully booked: says 'Sin huecos libres'", 'Sin huecos libres' in text, text)
    ctx.close()

    # Scenario E: note must NOT appear in "ver todos los días" mode
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    setup_trip(page, '2026-08-05', '2026-08-06')
    page.click('#view-toggle-btn')
    page.wait_for_timeout(300)
    note_in_all_days = page.locator('.free-time-note').count()
    log("All-days mode: no free-time note anywhere", note_in_all_days == 0, note_in_all_days)
    ctx.close()

    # Scenario F: note must NOT appear on desktop grid view
    ctx2 = browser.new_context(viewport={"width": 1400, "height": 900})
    page2 = ctx2.new_page()
    setup_trip(page2, '2026-08-07', '2026-08-07')
    desktop_note = page2.locator('#calendar-grid .free-time-note').count()
    log("Desktop: no free-time note inside the grid", desktop_note == 0, desktop_note)
    ctx2.close()

    browser.close()

print("\n--- Summary ---")
failed = [s for s, ok, d in results if not ok]
for step, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}: {step}")
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
python3 /tmp/test_free_time.py
```

Expected: every `log(...)` line prints `FAIL` (the `.free-time-note` element doesn't exist yet, so `note.count()` is `0` and `note.inner_text()` on an empty locator raises or returns nothing usable). This confirms the test actually exercises the missing feature.

- [ ] **Step 3: Implement `Render.freeTimeNote`**

Open `js/render.js`. Add this new method to the `Render` object, placed right after the `dayList` method (i.e., between the closing `},` of `dayList` and the `dayListAll` method that currently starts the next block):

```javascript
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
```

- [ ] **Step 4: Wire it into `dayList`**

In `js/render.js`, replace the existing `dayList` method (lines 65-81):

```javascript
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
      return;
    }

    items.forEach(activity => container.appendChild(this.listCard(activity, handlers, days)));
  },
```

with this version (the `return` inside the empty branch is removed so the note always gets appended, and the note is appended unconditionally at the end):

```javascript
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
```

- [ ] **Step 5: Run the verification script again**

```bash
python3 /tmp/test_free_time.py
```

Expected: `10/10 passed` (all `log(...)` lines print `PASS`). If Scenario E or F fail, double check you only modified `dayList` and did not touch `dayListAll` or `grid`.

- [ ] **Step 6: Commit**

```bash
git add js/render.js
git commit -m "$(cat <<'EOF'
Add free-time note to the mobile single-day activity list

Shows which 07:00-23:00 ranges are still unscheduled for the selected
day, reusing the existing 30-minute slot helpers to compute gaps
between activities.
EOF
)"
```

---

### Task 2: Style the free-time note

**Files:**
- Modify: `css/style.css` (insert after the `.day-list-empty.small` rule, around line 305 — search for `.day-list-empty.small`)

- [ ] **Step 1: Add the CSS rule**

In `css/style.css`, immediately after the `.day-list-empty.small { ... }` block, add:

```css
.free-time-note {
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-alt);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  line-height: 1.4;
}
```

- [ ] **Step 2: Visually confirm in a real browser**

```bash
curl -sI http://localhost:8765/index.html | head -1
```

If that returns `200`, open `http://localhost:8765/index.html` in a browser at a narrow viewport (or resize below 700px), create/open a trip with a couple of activities on one day, and confirm the note renders as a soft rounded box below the last card — not raw unstyled text.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "$(cat <<'EOF'
Style the free-time note

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Bump cache-busting version and deploy

**Files:**
- Modify: `index.html` (the `?v=3` query strings on the CSS/JS `<script>`/`<link>` tags)

- [ ] **Step 1: Bump the version**

```bash
cd /Users/katsa/Documents/proyectos/VIAJES
sed -i '' 's/?v=3/?v=4/g' index.html
grep -n "v=4" index.html
```

Expected: 4 matches (1 `<link>`, 3 `<script>` tags).

- [ ] **Step 2: Commit and push**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Bump asset cache-busting version to v=4

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 3: Verify the GitHub Pages deploy**

```bash
gh run list --repo Nicolasmorahernandez/viajes-itinerario --limit 2
```

Expected: the newest run shows `completed  success`. If it shows `completed  failure`, re-run it:

```bash
gh run rerun <run-id> --repo Nicolasmorahernandez/viajes-itinerario
```

(This has happened before in this project — GitHub Pages occasionally returns "Deployment failed, try again later" on the first attempt; a rerun fixes it.)

- [ ] **Step 4: Confirm the live site serves the new version**

```bash
curl -s https://nicolasmorahernandez.github.io/viajes-itinerario/index.html | grep -o 'js/app.js?v=4'
curl -s https://nicolasmorahernandez.github.io/viajes-itinerario/js/render.js | grep -o 'freeTimeNote'
```

Expected: both commands print output (`js/app.js?v=4` and `freeTimeNote` respectively). If either prints nothing, the deploy hasn't finished propagating yet — wait ~60s and retry.

---

## Self-Review Notes

- **Spec coverage:** window 07:00–23:00 (Task 1, `WINDOW_START`/`WINDOW_END`), clipping of out-of-window activities (Task 1 Step 3 `Math.max`/`Math.min`, verified by Scenario C), fully-free day text (Scenario A), fully-booked text (Scenario D), grouping consecutive free slots with ` · ` separator (Task 1 Step 3, Scenario B), scoped to single-day mobile view only — not all-days, not desktop (Scenarios E and F), discreet styling consistent with existing palette (Task 2, reuses `--surface-alt`/`--text-muted` already defined in `css/style.css`). All spec requirements are covered.
- **No placeholders:** every step has literal, runnable code or exact commands with expected output.
- **Type/name consistency:** `Render.freeTimeNote(trip, day)` matches the call site in `dayList` (`this.freeTimeNote(trip, selectedDay)`); reuses the existing global helpers `timeToSlotIndex` and `slotIndexToTime` exactly as named in `js/render.js:6-17` — no new helper names invented.
