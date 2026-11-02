# ebts project

This folder is an ebts event simulation. Everything is plain files, so you (Claude Code, Codex or any coding agent) can read and edit it directly while the person runs the ebts app on the same folder. After a change, tell them to press Save or reopen the folder in the app.

## Files

- `event.json`: the whole event. Schema below.
- `assets/`: every image and video, at canonical paths. Any image extension (png, jpg, jpeg, webp) or video extension (mp4, webm, mov) is accepted at those paths.
- `providers.json`: generation provider settings (optional): `active` plus one config per `kind` (comfyui with its workflow paths and node mapping, reactor). API keys are never in the project.
- `workflows/`: ComfyUI workflows in API format; `comfy-txt2img.json` is the sample the app writes.
- `export/`: generated exports (optional).

## Canonical asset paths

```
assets/event/map.png | loop.mp4 | widget.png     event map, its loop and its blueprint minimap (only when there is more than one site)
assets/sites/<site>/map.png | loop.mp4 | widget.png
assets/sites/<site>/zones/<zone>/poster.png | loop.mp4
<any of the folders above>/variants/<HHMM>-<HHMM>/poster.png | loop.mp4 | widget.png   timed variant, e.g. assets/sites/sf/zones/salon/variants/1430-1600/loop.mp4
```

## event.json

```
name            string, the title; "\n" splits it into lines
date            "YYYY-MM-DD"
description     string, optional
style           { art_direction, palette: ["#hex"], mood, references: [], avoid }  prefix of every image prompt
sites           [{ id, label, city, venue, timezone (IANA), open "HH:MM", close, crew_open, crew_close, zones: [...], map }]
  zones         [{ id, label, format, who, what, brief, rhythm, open|null, close|null, capacity, media: { poster, loop_video, width, height, variants }, schedule: [...] }]
  schedule      [{ id, title, kind, description, start "HH:MM", end, who, channel (free text), status, link: { site, zone } | null, production, tasks }]
  production    idea | in-progress | confirmed | cancelled  (is the talent/slot confirmed; cancelled rows never go live in the simulation)
  tasks         [{ id, label, done, owner }]  to-dos; the event, each site, each zone and each schedule row carry their own list
people          [{ id, name, role, contact, status: not-contacted | contacted | confirmed | declined, notes, log: [{ date "YYYY-MM-DD", channel: email | dm | call | in-person | other, note }] }]  production record for a name that appears in some row's `who`; names are matched case-insensitively, and `who` is split on commas, + and & ("Ana Ruiz, Bo Lee" is two people)
  map           { poster, loop_video, width, height, hotspots: [{ id, label, target (zone id), polygon: [{x,y}], window }], video_hotspots: same shape | null (null = the loop video shares `hotspots`), widget: { image, width, height, hotspots } | null, variants }
  variants      [{ window: { start "HH:MM", end "HH:MM" }, poster, loop_video, widget }]  each slot replaces the base file while the clock is inside the window (null slot = keep the base); the variant with the latest start wins
  window        { start, end } | null on a hotspot: null = always visible, otherwise shown only inside the window
map             same shape as a site map; hotspot targets are site ids
content         { "<content item id>": { prompt | null, negative_prompt, init_images [project-relative paths], seed | null, sampler { steps | null, cfg | null, denoise | null } } }  per-asset overrides; ids come from `ebts manifest`; sampler values patch the matching inputs of the ComfyUI workflow for that asset only
```

Enumerations: zone `format` is one of salon, demo-station, performance-zone, screening-room, mingle-space, tinker-space, video-wall, spatial-installation, telepresence-zone, refractory, back-of-house, custom. `rhythm` is continuous, scheduled, open-plus-scheduled, loops, crew-only. Schedule `status` is feed-up, linked, scheduled, open, food-service, installed, on-floor, interstitial, load-in, crew, strike, screening, workshop, room-change.

All coordinates (hotspot polygons) are pixels of the image they sit on, using the `width`/`height` declared next to them.

Time windows are inclusive, in the site's local time for site maps and zone media and in UTC for the event map. A window whose end is not after its start wraps past midnight. Without any window or variant everything is live all day.

## Typical jobs

- **Trace a map hotspot**: open the map image, write a polygon (3+ points, pixels) into `map.hotspots` with `target` = the site or zone id. A hotspot whose `target` starts with `area:` is a free highlight with no navigation.
- **Write a program**: write `schedule` rows by hand; that is where real content belongs: titles, people, descriptions. Times are local to the site. Cross-site rows carry a `link` to another site/zone and must overlap in UTC with something programmed there.
- **Track production**: the people are whoever is named in the rows' `who`. For each name keep a `people` entry with a `status` and a `log` entry per message sent (date, channel, note), and set each row's `production` as slots confirm. To-dos can live in `tasks` at the level they belong to. `ebts check <folder>` reports who is confirmed, "Confirmed n of m" per zone and open tasks per level under the Production step.
- **Produce art**: `ebts manifest <folder>` lists every file the event needs with its id, path, size, the prompt the person wrote (`prompt`, empty until someone writes one in `content[id]`) and a generated `hint` describing the slot. Write prompts into `content[id].prompt` (and `init_images`, `seed`) so the app can generate, or put a file at the path and the app picks it up.
- **Change the art over the day**: add a variant to a zone's `media.variants` or a map's `variants` with a `window` and drop the file at `.../variants/<HHMM>-<HHMM>/poster.png|loop.mp4|widget.png`. The manifest lists those files too. Give a hotspot a `window` to show a zone only during part of the day.

## CLI

Build once with `cargo build --release -p ebts-cli` from the ebts repository (binary at `target/release/ebts`), then:

```
ebts check <folder>              checklist of every step, as JSON
ebts manifest <folder>           every asset to produce: path, exists, size, prompt
ebts conflicts <folder>          gaps, double bookings, broken links
ebts simulate <folder> <HH:MM>   what is live in every zone at that UTC time
ebts export <folder>             the mitv-shaped config JSON
```

Keep `event.json` valid JSON with the keys above; the app refuses to load anything else.
