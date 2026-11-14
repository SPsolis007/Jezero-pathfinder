# Jezero Pathfinder

**Terrain-aware mission planning for the exploration of Jezero Crater, Mars**

*A NASA Space Apps Challenge project for **Interplanetary Survival Guide: Martian Map***

[![Project status](https://img.shields.io/badge/status-research%20prototype-2563eb)](#important-limitations) [![NASA data](https://img.shields.io/badge/data-NASA%20Mars%20Trek%20%7C%20PDS-f97316)](#data-sources-and-attribution) [![Python](https://img.shields.io/badge/backend-Python%20%2B%20FastAPI-0f766e)](#technology-stack)

## Overview

**Jezero Pathfinder** is an interactive, Jezero-specific decision-support prototype for exploring how terrain hazards, scientific opportunities and limited mission resources affect hypothetical human and rover excursions on Mars.

The dashboard brings together NASA Mars imagery, a 20 m digital elevation model (DEM) and terrain-derived hazard layers, documented Perseverance science locations, A* route planning, estimated travel time and energy requirements, and **archived** environmental measurements from Perseverance's Mars Environmental Dynamics Analyzer (MEDA).

Instead of showing a path alone, the application helps users ask: **Where should an exploration mission go, which route presents fewer modelled terrain hazards, and can the trip fit a hypothetical time and energy budget?**

> **Research prototype, not operational guidance.** Jezero Pathfinder does not validate astronaut safety, landing suitability or real rover performance. Its energy and time scenarios rely on user-defined and hypothetical assumptions.

## The challenge

Jezero Crater preserves a record of ancient water-related environments and is the exploration setting for NASA's Perseverance rover. Planning an expedition there requires more than identifying a destination: a promising geological target may be separated from a starting location by rough terrain, a long traverse or an excursion that exceeds a mission's resource assumptions.

Jezero Pathfinder addresses the NASA Space Apps **Interplanetary Survival Guide: Martian Map** challenge by placing geological context, terrain accessibility and resource estimates in a single interactive mapping workflow. It is designed as a **planning and educational tool**, not a certified operations system.

## Features

| Feature | What it does |
| --- | --- |
| **Jezero map** | Displays NASA Mars Trek HiRISE imagery (25 cm/pixel in its coverage area), with CTX (6 m/pixel) beneath it and MOLA regional context. |
| **Terrain hazard layers** | Visualises a prototype three-class hazard raster prepared from Jezero terrain analysis. |
| **Six scientific targets** | Explores documented Perseverance investigation/sample locations with descriptions and references. |
| **Point-to-point navigation** | Lets users choose start and destination coordinates by clicking the map or selecting listed locations. |
| **A* route comparison** | Compares shortest and hazard-weighted *safer* traversable paths, subject to raster and search limits. |
| **Resource estimates** | Reports route length, travel time, terrain-adjusted energy, reserve margins and whether a one-way trip falls within the modelled budget. |
| **Basecamp mission analysis** | Screens a hypothetical Basecamp location and evaluates an excursion with a modelled return journey. |
| **Environmental intelligence** | Shows historical air-temperature and atmospheric-pressure measurements from Perseverance MEDA, including sensor selection and time-series plots. |

### Scientific investigation sites

The six currently represented destinations are **Rochette, Brac, Roubion, Wildcat Ridge, Cheyava Falls and Amalik**. Coordinates for Wildcat Ridge, Cheyava Falls and Amalik represent the published **Hazeltop, Sapphire Canyon and Shuyak sample locations**, respectively, rather than entire outcrop boundaries.

**A documented science coordinate is not a certified safe approach point.** A destination's exact raster cell and the complete proposed path must pass the application's terrain and A* constraints; a point may remain scientifically interesting even if no feasible route is returned.

## How it works

1. **Explore:** Open the Jezero map and inspect HiRISE/CTX imagery, scientific locations and terrain overlays.
2. **Choose a mission:** Select a listed scientific target or use **Navigation** to pick any two map points within the supported study area.
3. **Compare routes:** Request the *shortest* and *safer* A* alternatives. Both avoid prototype hazard class 3; the safer mode places a greater penalty on class 2.
4. **Review resources:** Set hypothetical travel speed, baseline energy use, energy availability and mission duration; compare estimated distance, travel time, energy demand and margins.
5. **Examine environmental context:** Open **Weather** to view archived MEDA observations, remembering they were measured near Perseverance rather than at every point in Jezero.
6. **Assess a Basecamp excursion:** Use **Mission** for the separate return-trip planning scenario.

## Scientific methodology

### Terrain and routing

- **Terrain inputs:** A Jezero CTX-derived DEM and three processed GeoTIFFs: slope (degrees), terrain ruggedness index (TRI), and prototype hazard classes. The layers were prepared in **QGIS**.
- **Spatial model:** The terrain rasters use a Mars-specific projected coordinate reference system and 20 m grid spacing. Mars coordinates are transformed using the raster's Mars CRS, not Earth's EPSG:4326.
- **Hazard interpretation:** Class 1 = lower terrain concern; class 2 = elevated terrain concern; class 3 = restricted in the prototype routing model. These classes **do not** imply independently certified real-world safety thresholds.
- **Routing:** An eight-neighbour A* search operates on raster cells. Hazard class 3 is blocked. *Shortest* routing minimises traversable path distance; *safer* routing applies higher movement costs to class 2 cells. Search-size and expansion limits can prevent a route from being returned.
- **Terrain sampling:** The backend samples the calculated route at approximately 10 m intervals and computes distance-weighted slope/TRI summaries. The energy model rejects routes with insufficient valid terrain coverage.

The exact original **QGIS processing algorithms and hazard-class threshold settings** are not fully reconstructed in the repository's current documentation. This is a reproducibility limitation, and the derived rasters should not be mistaken for an independently validated hazard product.

### Travel time and energy

One-way travel time is calculated as estimated route distance divided by the **user-entered rover speed**. The prototype energy model uses route distance, mean slope and mean TRI:

```text
baseline_energy = route_distance_km × baseline_kWh_per_km
slope_penalty   = baseline_energy × 0.30 × (mean_slope_deg / 10)
TRI_penalty     = baseline_energy × 0.15 × (mean_TRI / 10)
required_energy = baseline_energy + slope_penalty + TRI_penalty
```

The default baseline is **1.5 kWh/km**, with default hypothetical speed **4 km/h**. These are adjustable planning assumptions, **not flight-hardware measurements**. The point-to-point planner defaults to a **25% energy reserve** and **20% time reserve**, assesses a **one-way trip only**, and does not independently account for a return. The separate Basecamp mission feature models the return by reversing the outbound route, assuming the same energy penalties in either direction.

The model does not account for directional uphill/downhill effects, detailed wheel-soil mechanics, regenerative braking, science/idle loads, life-support demand, dust storms or radiation exposure.

### MEDA environmental observations

The Weather tab visualises an **archived, calibrated Sol 1859** dataset from NASA's Perseverance MEDA instrument, rather than current or live Martian weather.

- Five **ATS air-temperature** channels are converted from Kelvin to degrees Celsius.
- Three **BAROCAP pressure** channels are presented in pascals, with convenient mbar equivalents where applicable.
- Temperature and pressure records were aligned using their spacecraft-clock timestamps (`SCLK`). The validated local processing produced **48,086 matched observations**, representing approximately **99.13%** of the temperature records for that sol.
- The charts use binned observations and preserve breaks where no measurements were recorded. MEDA's autonomous operating cycle can produce scheduled observation gaps.
- MEDA readings describe conditions **at the rover's observation location and time**. They must not be interpreted as measured weather at Basecamp or as a crater-wide weather map.

The exported frontend data is stored in `frontend/assets/meda_sol1859_summary.json`; the combined observation table was prepared as `data/processed/meda/meda_environment_sol1859.csv` in the local analysis workflow. Dataset availability in a clone depends on which data products are committed or supplied separately.

## Technology stack

- **Frontend:** HTML, CSS, JavaScript and [Leaflet 1.9.4](https://leafletjs.com/), with NASA Mars Trek map tiles.
- **Backend:** Python, [FastAPI](https://fastapi.tiangolo.com/), Pydantic, NumPy, Rasterio and PyProj.
- **Terrain preprocessing:** QGIS and GeoTIFF raster products.
- **Environmental analysis:** Python/pandas in the research-data preparation workflow; the browser reads a prepared JSON summary.

## Run locally

### 1. Clone the project

```bash
git clone https://github.com/SPsolis007/Jezero-Pathfinder.git
cd Jezero-Pathfinder
```

### 2. Create a Python environment

Use a Python version compatible with the installed FastAPI, Pydantic 2, Rasterio and PyProj distributions. On macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install fastapi 'pydantic>=2' uvicorn numpy rasterio pyproj
```

**Dependency note:** At the time this README was prepared, `requirements.txt` in the public repository was **empty**. The command above lists the directly imported backend dependencies rather than claiming a verified, version-locked environment. Pandas is additionally needed if regenerating the MEDA analysis outputs from raw CSVs.

### 3. Confirm terrain inputs

The backend expects these paths relative to the repository root:

```text
data/
├── raw/
│   └── M20_JezeroCrater_CTXDEM_20m.tif
└── processed/
    ├── jezero_hazard_classes.tif
    ├── jezero_slope_deg.tif
    └── jezero_tri.tif
```

Ensure the three processed rasters exist and have matching CRS, dimensions and georeferencing. Large data files may need to be obtained separately if absent from your clone. The browser's weather view also requires `frontend/assets/meda_sol1859_summary.json`.

### 4. Start the API

From the **repository root** in the activated virtual environment:

```bash
python3 -m uvicorn backend.main:app --reload --port 8000
```

Test the backend at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). Interactive API documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 5. Start the frontend

In a **second terminal**, from the same repository root:

```bash
python3 -m http.server 5500 --directory frontend
```

Open [http://localhost:5500/index.html](http://localhost:5500/index.html).

Both servers must remain running. The frontend currently requests the API at `http://127.0.0.1:8000`; update the `API` constant in `frontend/script.js` if deploying to a different backend address. NASA Mars Trek imagery also requires network access.

## Repository structure

```text
backend/
  main.py                 # API and Basecamp/round-trip features
  point_to_point.py       # Two-point mission API
  routing.py              # A* routing on hazard classes
  terrain_analysis.py     # Slope/TRI sampling along routes
  energy_model.py         # Hypothetical terrain energy calculation
  hazards.py              # Terrain-hazard-related utilities
  export_hazard.py        # Hazard-overlay export utility
frontend/
  index.html              # Main dashboard
  script.js               # Jezero map, sites and mission controls
  route_planner.js        # Map-based point-to-point interaction
  environment.js          # MEDA visualisation
  style.css               # Dashboard styling
  assets/                 # Map hazard overlay and MEDA summary
scripts/                  # Diagnostics and validation utilities
data/                     # Original and processed terrain/mission data
docs/                     # Project documentation
README.md
requirements.txt          # Currently empty in the public repository
```

## Validation and known limitations

The project includes scripts for checking scientific-site coordinates against the local hazard raster and for testing routes. For example, from the repository root with dependencies installed:

```bash
python3 scripts/check_six_site_coverage.py
```

This reports raster coverage and each sample point's local hazard class. **It does not guarantee that an A* route exists**, nor does it establish human-safe terrain. Review all route outputs and error messages before drawing conclusions.

Additional limitations:

- This is a **prototype**, not a validated autonomous navigation or human-survival system.
- The DEM, hazard classes, navigation and model estimates have finite spatial resolution and data coverage; a map point may fail raster checks or exceed A* search limits.
- Some scientific targets are documented coring coordinates rather than verified traversable approach points.
- Hazard thresholds and original QGIS processing parameters need stronger, versioned reproducibility documentation.
- Weather observations are **historical and local**; they are not live telemetry, forecasts or inputs to the current route-energy calculation.
- The software does not model radiation dose, breathable atmosphere, communications, rescue logistics, human physiological risk or equipment certification.
- Modelled budget compliance means only that the **selected scenario satisfies the prototype's mathematical assumptions**.
- Public deployment and end-to-end installation from a clean clone have not been independently verified as part of preparing this README.

## Data sources and attribution

Jezero Pathfinder uses, displays or analyses NASA datasets and mission documentation. The scientific teams and data providers retain credit for their work.

| Resource | Role | Reference |
| --- | --- | --- |
| NASA Mars Trek | MOLA context and Jezero CTX/HiRISE map imagery | [Mars Trek](https://trek.nasa.gov/) |
| Mars Reconnaissance Orbiter CTX | Orbital imagery and Jezero terrain context | [NASA MRO mission](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/) |
| Mars Reconnaissance Orbiter HiRISE | High-resolution Jezero imagery in the mosaic footprint | [HiRISE](https://www.uahirise.org/) |
| Jezero CTX DEM | 20 m input terrain raster, processed in QGIS for this prototype | See `data/raw/` and project geospatial metadata |
| NASA PDS, Mars 2020 sample reports | Scientific locations and sample context | [Mars 2020 PDS Geosciences](https://pds-geosciences.wustl.edu/missions/mars2020/) |
| Published crater-floor geology | Context for Roubion, Rochette and Brac | [Simon et al., 2023, DOI:10.1029/2022JE007474](https://doi.org/10.1029/2022JE007474) |
| NASA Mars 2020 Initial Reports | Wildcat Ridge/Hazeltop and Amalik/Shuyak sample-location evidence | [Volume 2](https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf) |
| Mars 2020 Sample Dossier | Cheyava Falls/Sapphire Canyon sample-location evidence | [Volume 4](https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_dossier/initial_reports/initial_reports_volume4.pdf) |
| NASA PDS Atmospheres, MEDA | Historical calibrated air-temperature and pressure observations | [MEDA archive](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html) |

This project is not affiliated with or endorsed by NASA. Use of NASA data does not imply NASA certification of the planning results.

## Team and competition

Developed for the **NASA Space Apps Challenge 2026**, challenge **Interplanetary Survival Guide: Martian Map**.

**Team:** Tolong jangan di pencet itu nya (name as listed in the public GitHub repository description).

**Project repository:** https://github.com/SPsolis007/Jezero-Pathfinder

## License and contributions

**License:** No project software licence has been identified in the public repository. Until the team selects and adds a licence file, do not assume the source code is licensed for unrestricted reuse. NASA imagery, scientific reports and datasets have their own provenance and usage considerations.

For issues or suggestions, use the repository's [Issues](https://github.com/SPsolis007/Jezero-Pathfinder/issues) page. Please provide the affected feature, steps to reproduce, and any console/API error messages.

---

**Jezero Pathfinder: explore scientifically, route cautiously, and make the assumptions visible.**
