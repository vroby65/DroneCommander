# Drone Commander

![Drone Commander overview](screenshots/overview.png)

Drone Commander is an interactive browser app for programming and simulating drone flight with Blockly and Three.js. Build a flight plan with blocks, run it, and watch the drone move inside a 3D scene.

## Online Demo

Open the hosted version:

https://vroby65.github.io/DroneCommander/

## Features

- **Visual programming** with Blockly blocks for logic, loops, math, variables, functions, flow, sensors, and drone commands.
- **3D simulation** powered by Three.js, with terrain-aware altitude and landing behavior.
- **Drone commands** for take off, land, set/change altitude, set/change angle, walk, slide, absolute/relative 3D movement, smooth curved flight, return to base, wait, smoke trail, and speed control.
- **Smooth curve handling** with arc-based curved flight, continuous drone orientation, and clean cardinal direction endings such as 0 and 180 degrees.
- **Sensor blocks** for keyboard input, X/Z position, altitude, direction, and speed.
- **Scenarios**: flight field, urban track, metropolis, and tropical island.
- **Graphics profiles**: Performance, Balanced, and Quality.
- **Program management** with New, Save, Load, autosave to browser local storage, and remembered file names.
- **Multilingual UI and help** in English, Italian, French, German, Spanish, and Portuguese.
- **Resizable layout** with a Blockly editor, 3D viewer, toolbar, and status panel.

## Screenshots

### Take Off And Land

![Take off and land program](screenshots/takeoff-land.png)

### Speed And Smoke Trail

![Speed and smoke trail program](screenshots/smoke-flight.png)

## Run Locally

Clone the repository and serve it with any static HTTP server:

```sh
git clone https://github.com/vroby65/DroneCommander.git
cd DroneCommander
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

Using an HTTP server is recommended because the app loads scenarios, textures, models, sounds, and help pages from local files.

## Usage

1. Drag a **Start** block into the Blockly workspace.
2. Attach drone blocks such as **take off**, **set altitude**, **walk**, **go to**, **move by**, **curve abs**, **curve**, **return to base**, **change angle**, and **land**.
3. Click the green play button to run the program in the 3D viewer.
4. Use the status panel to inspect or adjust X, Z, altitude, direction, and flight status.
5. Use **Save** and **Load** to export or import Blockly XML programs.
6. Switch scenario or graphics profile from the toolbar when needed.

## Curved Flight Notes

The **curve** and **curve abs** blocks fly through the current position, an intermediate point, and a destination point. Curves are interpolated as smooth arcs where possible, so repeated circular or semicircular paths avoid sharp direction changes between segments.

For relative **curve** blocks, X/Y/Z values are interpreted as offsets in the program coordinate system. Near-cardinal final headings are snapped to exact values, so a semicircle can finish at 180 degrees and a full circle can finish at 0 degrees without tiny floating-point drift.

## Project Structure

- `index.html` - Main app, Blockly blocks, generators, UI, and Three.js simulation.
- `doc/` - Help pages in supported languages.
- `backgrounds/` - Scenario definitions.
- `models/` - Drone and scene models.
- `textures/` - Terrain, sky, and object textures.
- `sounds/` - Drone audio assets.
- `libs/` - Vendored Blockly and Three.js libraries.
- `screenshots/` - README screenshots generated from the current app.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. Open an issue or pull request to suggest fixes, new blocks, new scenarios, translations, or documentation improvements.
