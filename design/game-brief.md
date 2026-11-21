# Palkon Auto · Stage F Final Brief

Palkon Auto is an original, sunlit open-world crime game set in Solmar, a coastal city measuring 3,840 by 3,456 units. Its seven districts are Old Solmar, Canal Ward, South Market, Citrus Quarter, Pearl Marina, Glasspoint, and Sunstrand Beach.

Coastal courier Mara Venn uncovers a private security racket run by Bastion Civic and its broker, Silas Rook. Archivist Neri and organizer Oren help her expose it. All game text is English. Names, art, and fonts are original; the project uses no Rockstar marks or assets and copies no commercial game.

The eight linked missions are: 1. A Receipt for Sunshine; 2. Salt Ledger; 3. After the Shutters; 4. Glass Debt; 5. The Long Way Home; 6. Unbought Ground; 7. Open Contract; 8. Everyone Gets the Morning. The first receipt names broker Silas Rook; the dock ledger, Oren's witness statement, payment chain, authenticated archive, relay attestations, and master agreement complete a public independently mirrored archive.

Zero health triggers recovery, a cash penalty, and mission failure. A timer, boundary, destroyed required vehicle, lost required evidence, or incapacitated required ally fails the active mission, which can be retried.

The visual palette is limestone `#ead8b2`, coral `#d77f69`, teal `#398e99`, ink `#142d38`, and leaf `#56856b`.

## Six-stage plan

- Stage A (complete): handwritten WebGL 2 renderer, deterministic city, district travel, day/sunset/night lighting, and park.
- Stage B (complete): four driving profiles, vehicle entry/exit, traffic queues, sidewalk pedestrians, working 3D signals, road-lighting headlights, minimap and driving HUD.
- Stage C (complete): missions one through four.
- Stage D (complete): missions five through eight, multi-stop relay work, the master agreement, and the public broadcast finale.
- Stage E (complete): witnessed crimes, escalating police response, on-foot combat, garages, WebAudio radio, denser streets, and updated lighting.
- Stage F (complete): living-city title screen, original vector title alphabet, save-aware Continue / New Game / Controls menu, final four screenshots, full browser verification, deterministic packaging, and build report.

Stage B adds compact, sedan, van and coupe handling using acceleration, braking, reverse, speed-dependent steering and swept oriented collisions against architecture and street furniture. Parked cars persist after exit. Traffic follows connected lane loops and slows for preceding vehicles and red signals, with yellow and all-red clearance phases.

The handwritten WebGL 2 renderer lights road surfaces, vehicle paint, people, and walls with world-space headlight cones. The native canvas minimap shows local streets, building footprints, cars, police, garages, and player heading. The deterministic entrypoint packages the title cover, daytime drive, active mission and moonlit pursuit views in `screenshots/`.

The mission dossier uses ordered unlocks, a saved evidence log, cash rewards, timed operation HUDs, minimap boundary outlines, objective beacons and a compass arrow. Q collects, delivers, or activates relay evidence, X drops carried cargo, E retains the existing vehicle controls, and Oren follows Mara during the escort. The finale broadcasts all eight evidence entries before free exploration resumes. Arrest and zero health both recover Mara to the civic park for a cash penalty and fail any active operation. Retry resets the selected operation.

Stage E introduces an armed guard at the Glasspoint office, a five-star warrant level, a 2.5-second arrest meter, and patrol, roadblock, and helicopter response. Garage purchases use mission earnings and persist alongside evidence. Solmar Common carries original local news headlines over a synthesized bulletin bed. More sidewalk pedestrians and road traffic share a render budget maintained by distance-based geometry limits. Reflections and lit office panes distinguish Glasspoint across the three lighting presets.

Stage F presents Solmar at sunset before gameplay: a live aerial camera slowly drifts above the same rendered city while real traffic and pedestrians move below. The original two-line PALKON AUTO vector lettering sits above THE SOLMAR STORY and the tagline “The city has a price. Find out who is paying.” The keyboard-accessible menu hides Continue on a fresh or malformed save, starts the next unlocked operation from saved evidence, and returns completed stories to exploration. New Game clears local progress and garage ownership. A complete controls guide is available from the title and pause dossier. Local presentation fixes keep the on-foot status on one line and give district and objective text a dark readable backing. Gameplay systems retain their Stage E rules.

Final lighting verification freezes a night scene with an open lane between two cars. It projects patches of bare asphalt, painted roof, and asphalt outside the beam into the WebGL framebuffer. With headlights enabled, each lit patch must gain at least 20 levels in mean RGB, and at least 90 percent of its pixels must gain more than 10 levels. The unlit patch must stay within one level. The same thresholds apply with the decorative haze disabled. Nearby traffic is moved out of the test lane so it cannot cover the target or add competing beams.
