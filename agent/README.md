# Drone Commander maintenance

Static browser app for programming simulated drone flights with Blockly and Three.js.
No build step or package installation is required. Serve the repository with
`python3 -m http.server 8000`; open `http://127.0.0.1:8000/`.

- `index.html` loads the bundled libraries, then `js/blockly.js`,
  `js/drone-commands.js`, `js/ui.js`, and `js/app.js`.
- `js/app.js` initializes localization, Blockly, Three.js, and the scenario list.
- `js/drone-commands.js` owns rendering, flight, collision handling and media.
- `js/ui.js` owns UI events, localization and scenario selection.
- `backgrounds/list.json` lists the four selectable scenarios. Each scenario JSON
  references local terrain textures and OBJ/MTL models. Rotations are degrees;
  coordinates are Y-up; scales are uniform. Keep the take-off origin clear.
  Terrain stays flat within 500 units of the origin to support the extended scenery.
- Scenario meshes automatically receive shadows and collision registration.
  The default collision uses the surface height. OBJ objects named
  `flight-obstacle` represent individual axis-aligned solids, such as posts and
  roofs, and are checked along each flight segment. Keep each object's bounds
  tight to the solid it represents so that openings stay clear.
- `libs/` contains the bundled Three.js r124 and Blockly libraries; no CDN needed.
- `tools/build-scenery.py` generates the four `models/details-*.obj` assets and
  `models/scenery.mtl`. Edit the generator and run `python3 tools/build-scenery.py`
  rather than hand-editing generated vertices. No external Python dependencies.

Run `node --test tests/scenery.test.cjs` for scenery validation. Tests use the
bundled Three.js loaders to check assets, materials, geometry size, clearance
at takeoff, and flight through the training course. For manual verification,
load `examples/campo-di-volo.xml` in Campo di volo, switch through all four scenarios,
inspect props and shadows, take off and land, and check the on-board camera.
Check the browser console for missing assets. Check all three graphics profiles
when changing rendering. Inspect the final diff and keep changes scoped.

Update this guide when entrypoints, scenario format, generation, or verification
commands change. Keep feature descriptions synchronized in `README.md`.
