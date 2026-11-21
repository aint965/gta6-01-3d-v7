[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Live rank](https://make.fun/badge/gta6-01/aint965/gta6-01-3d-v7/rank.svg)](https://make.fun/bounty/gta6-01)
[![Live reward](https://make.fun/badge/gta6-01/aint965/gta6-01-3d-v7/reward.svg)](https://make.fun/bounty/gta6-01)

[https://make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01)

Palkon Auto is an original WebGL 2 open-world game set in coastal Solmar. As courier Mara Venn, follow the evidence behind a waterfront racket through eight missions. Explore seven districts on foot or from behind the wheel, with city traffic, police pursuits, garages, and three synthesized radio stations.

# Palkon Auto · The Solmar Story

Run `node serve.ts` with Node 22.18 or newer and open `http://localhost:8080`. No dependencies, build step, remote assets, or 3D library are needed.

The title screen opens over a living sunset city with a slowly drifting camera. Its original geometric lettering is drawn from a small vector alphabet in `game/src/title.js`. Choose **New Game** to begin the story with a clean save, **Continue** to resume the next unlocked operation (or free exploration after the finale), or **Controls** for the full field guide. Continue appears only when valid saved progress exists. Progress, cash, evidence, owned cars, and paints save locally in this browser. A new game replaces that progress. Up / Down and Enter operate the title menu; Escape closes the guide. The pause dossier also opens Controls or returns to the title.

- WASD: walk, or accelerate/brake/reverse and steer while driving.
- E: enter a nearby stopped car; exit once below walking speed. Cars remain where you leave them.
- Q: deliver evidence, recover an operation document, or activate a relay at its gold beacon.
- X: drop carried mission evidence (the active operation fails if it is lost).
- Esc: pause, select an unlocked mission, review evidence, or leave for open exploration.
- J cycles jab, cross, and hook on foot. Space dodges on foot and brakes when driving. F takes down a nearby opponent. Shift runs on foot.
- G opens Glasspoint Motor Works or Old Solmar Coachworks near its teal map marker. Use Tab or arrows to choose, Enter or Space to confirm, and Esc to close.
- R switches between Breakwater 88, Night Tide, and Solmar Common. M toggles mute. Solmar Common pairs synthesized station audio with rotating local headlines.
- Drag: orbit the camera. Scroll: zoom. The driving camera follows your heading.
- Day / Sunset / Night buttons, or 1 / 2 / 3: change lighting. N also selects night.
- District tabs: travel on foot to an open location in that district.

Pico is a nimble compact, Vela a balanced sedan, Porter a heavy utility van, and Sirocco a faster coupe. Road traffic follows connected lane routes, queues behind vehicles, and observes a 24-second signal cycle with yellow and all-red clearance intervals. The HUD includes a local street minimap, heading marker, nearby vehicles, speed, district, clock and objective.

The eight linked operations are **A Receipt for Sunshine**, **Salt Ledger**, **After the Shutters**, **Glass Debt**, **The Long Way Home**, **Unbought Ground**, **Open Contract**, and **Everyone Gets the Morning**. Timed jobs show a countdown; every active operation displays its limits on the map and screen. Stage D adds archive cargo protection, three relay stops in any order, a master-agreement handoff, and a finale upload that publishes all eight evidence entries. Retries restart cleanly, mission rewards add cash, and secured evidence remains in the pause-menu log. Solmar stays open for free exploration between or during missions.

Solmar has 120 sidewalk pedestrians, 77 traffic cars, and 74 controlled intersections. Witnesses can report theft, pedestrian strikes, or assault. Officers pursue on foot, patrol cars and roadblocks join at three stars, and a helicopter sweeps the city at four. Breaking line of sight lets heat cool. The garages sell or recall four models, service the current car, and apply five saved paint colors. Headlights and street lamps light their surroundings at night, and Glasspoint's curtain walls reflect the sun and reveal lit offices after dark.

`MAKEFUN_OUTPUT_DIR=<fresh-directory> node main.ts` copies the playable game and exactly four fresh, unedited browser renders, then writes the official dossier using the unchanged kit library. The cover and ordered views are `1-title.jpg`, `2-driving-day.jpg`, `3-mission.jpg`, and `4-night-pursuit.jpg`. Each is a 1280 × 720 JPEG under 256 KiB.

Stage F was verified in headless Chromium with SwiftShader. The verifier used keyboard and mouse input, with position hooks to shorten travel between mission objectives. The headlight check compares WebGL pixels on exposed asphalt and the car ahead in one frozen scene. Both surfaces must brighten with the decorative haze disabled. The build check compares every byte from two fresh `main.ts` runs.
