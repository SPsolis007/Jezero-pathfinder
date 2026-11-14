
"use strict";

// =====================================================
// MARS PATHFINDER | PHASE 7C
// HUMAN EXPLORATION: BASE CAMP ALPHA
// Scientific Investigation + A* Routing + Hazard Map
// =====================================================

const API = "http://127.0.0.1:8000";

const BASE_CAMP = {
  name: "Base Camp Alpha",
  latitude: 18.4,
  longitude: 77.5,
  hypothetical: true
};

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");

function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

// =====================================================
// MARS MAP COORDINATES
// =====================================================

const BASE_WIDTH = 512;
const BASE_HEIGHT = 256;

function marsToMap(latitude, longitude) {
  return [
    -((90 - latitude) / 180) * BASE_HEIGHT,
    ((longitude + 180) / 360) * BASE_WIDTH
  ];
}

function mapToMars(position) {
  return {
    latitude: 90 + position.lat / BASE_HEIGHT * 180,
    longitude: position.lng / BASE_WIDTH * 360 - 180
  };
}

function marsBounds(south, west, north, east) {
  return L.latLngBounds(
    marsToMap(south, west),
    marsToMap(north, east)
  );
}

// =====================================================
// MAP
// =====================================================

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 13
});

map.setView(
  marsToMap(BASE_CAMP.latitude, BASE_CAMP.longitude),
  9
);

const MOLA_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/" +
  "Mars_MGS_MOLA_ClrShade_merge_global_463m/" +
  "1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

const CTX_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/" +
  "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/" +
  "1.0.0/default/default028mm/{z}/{y}/{x}.png";

const mola = L.tileLayer(MOLA_URL, {
  tileSize: 256,
  minZoom: 0,
  maxNativeZoom: 5,
  maxZoom: 13,
  noWrap: true,
  bounds: [[-256, 0], [0, 512]],
  attribution: "NASA Mars Trek | MGS MOLA"
}).addTo(map);

const ctxCoverage = marsBounds(
  18.2110274,
  77.1604655,
  18.7211945,
  77.6991776
);

const ctx = L.tileLayer(CTX_URL, {
  tileSize: 256,
  minZoom: 0,
  maxZoom: 13,
  noWrap: true,
  bounds: ctxCoverage,
  attribution: "NASA Mars Trek | MRO CTX Jezero"
}).addTo(map);

const coverageOutline = L.rectangle(ctxCoverage, {
  color: "#00e5ff",
  weight: 2,
  fillOpacity: 0,
  dashArray: "6,6"
}).addTo(map);

coverageOutline.bindPopup(
  "NASA Jezero CTX imagery coverage"
);

// =====================================================
// SCIENTIFIC INVESTIGATION PANEL
// =====================================================

const sidebar = document.querySelector(".sidebar");

function ensureScientificPanel() {
  if (document.getElementById("science-title")) return;

  const section = document.createElement("section");
  section.className = "scientific-investigation-section";

  section.innerHTML = `
    <h3>Scientific Investigation</h3>

    <div id="science-panel" class="science-panel">
      <h4 id="science-title">No site selected</h4>

      <p id="science-description">
        Click an orange marker to investigate a site.
      </p>

      <div class="science-detail">
        <strong>Scientific Objective</strong>
        <p id="science-objective">Not selected</p>
      </div>

      <div class="science-detail">
        <strong>Scientific Significance</strong>
        <p id="science-significance">Not available</p>
      </div>

      <div class="science-detail">
        <strong>Evidence and Confidence</strong>
        <p id="science-evidence">Not assessed</p>
      </div>

      <div class="science-detail">
        <strong>Safety Assessment</strong>
        <p id="science-safety">
          Site-specific safety not assessed.
        </p>
      </div>

      <button id="select-destination" disabled>
        Set as Mission Destination
      </button>
    </div>
  `;

  const statusHeading = [...sidebar.querySelectorAll("h3")]
    .find(h => h.textContent.trim() === "Mission Status");

  if (statusHeading) {
    sidebar.insertBefore(section, statusHeading);
  } else {
    sidebar.appendChild(section);
  }
}

ensureScientificPanel();

// =====================================================
// SCIENTIFIC TARGETS
// =====================================================

const sites = [
  {
    name: "Delta investigation",
    latitude: 18.45,
    longitude: 77.40,
    description:
      "Conceptual investigation of ancient delta sediments.",
    objective:
      "Study ancient sedimentary environments.",
    significance:
      "Jezero's ancient delta may preserve evidence " +
      "of past water-related environments.",
    evidence:
      "Regional scientific context. Exact coordinates " +
      "are conceptual investigation targets."
  },
  {
    name: "Crater geology",
    latitude: 18.38,
    longitude: 77.55,
    description:
      "Conceptual investigation of crater-floor geology.",
    objective:
      "Investigate crater-floor geological materials.",
    significance:
      "Crater-floor rocks provide information about " +
      "Jezero's geological evolution.",
    evidence:
      "Regional geological interpretation. " +
      "Exact target not independently validated."
  },
  {
    name: "Mineral investigation",
    latitude: 18.42,
    longitude: 77.48,
    description:
      "Conceptual mineralogical investigation.",
    objective:
      "Investigate possible mineralogical indicators.",
    significance:
      "Mineral composition may reveal past " +
      "geological and aqueous processes.",
    evidence:
      "Investigation objective only. No confirmed " +
      "mineral detection at this exact coordinate."
  }
];

const scientificSites = L.layerGroup().addTo(map);

let selectedScientificSite = null;
let missionDestination = null;

function updateSciencePanel(site) {
  selectedScientificSite = site;

  setText("science-title", site.name);
  setText("science-description", site.description);
  setText("science-objective", site.objective);
  setText("science-significance", site.significance);
  setText("science-evidence", site.evidence);

  setText(
    "science-safety",
    "Terrain-aware routing available. " +
    "Human safety and site suitability not validated."
  );

  document.getElementById(
    "select-destination"
  ).disabled = false;

  setStatus(`Scientific site selected: ${site.name}`);
}

sites.forEach(site => {
  const marker = L.circleMarker(
    marsToMap(site.latitude, site.longitude),
    {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff9633",
      fillOpacity: 0.95
    }
  );

  marker.bindPopup(
    `<strong>${site.name}</strong>` +
    `<p>${site.description}</p>` +
    "<small>Conceptual scientific target</small>"
  );

  marker.on("click", () => updateSciencePanel(site));
  marker.addTo(scientificSites);
});

// =====================================================
// BASE CAMP ALPHA
// =====================================================

const baseCampMarker = L.circleMarker(
  marsToMap(BASE_CAMP.latitude, BASE_CAMP.longitude),
  {
    radius: 11,
    color: "#ffffff",
    weight: 3,
    fillColor: "#238bff",
    fillOpacity: 1
  }
).addTo(map);

baseCampMarker.bindTooltip(
  "BASE CAMP ALPHA",
  {
    permanent: false,
    direction: "top"
  }
);

baseCampMarker.bindPopup(
  "<strong>BASE CAMP ALPHA</strong>" +
  "<p>Hypothetical human exploration base camp</p>" +
  "<p>Terrain screening pending</p>"
);

function ensureBaseCampPanel() {
  if (document.getElementById("basecamp-assessment")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "basecamp-section";

  section.innerHTML = `
    <h3>Human Exploration Base Camp</h3>

    <div class="basecamp-panel">
      <p><strong>Base Camp Alpha</strong></p>

      <p>Hypothetical candidate site</p>

      <p>
        Terrain assessment:
        <strong id="basecamp-assessment">Loading...</strong>
      </p>

      <p>
        Human survivability:
        <strong>Not assessed</strong>
      </p>

      <p id="basecamp-details"></p>
    </div>
  `;

  const scienceSection =
    sidebar.querySelector(
      ".scientific-investigation-section"
    );

  if (scienceSection) {
    sidebar.insertBefore(section, scienceSection);
  } else {
    sidebar.appendChild(section);
  }
}

ensureBaseCampPanel();

async function assessBaseCamp() {
  try {
    const response = await fetch(
      `${API}/api/basecamp`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Terrain screening failed"
      );
    }

    setText(
      "basecamp-assessment",
      data.assessment
    );

    setText(
      "basecamp-details",
      `Class 1: ${data.class_counts["1"]} cells | ` +
      `Class 2: ${data.class_counts["2"]} cells | ` +
      `Class 3: ${data.class_counts["3"]} cells | ` +
      `Unknown: ${data.unknown_cells} cells`
    );

    baseCampMarker.setPopupContent(
      "<strong>BASE CAMP ALPHA</strong>" +
      `<p>${data.assessment}</p>` +
      "<p>100 m terrain screening radius</p>" +
      "<small>Hypothetical site. Not landing-certified.</small>"
    );

  } catch (error) {
    setText(
      "basecamp-assessment",
      "Screening unavailable"
    );

    setText(
      "basecamp-details",
      error.message
    );

    console.error(error);
  }
}

// =====================================================
// DESTINATION SELECTION
// =====================================================

document.getElementById(
  "select-destination"
).addEventListener("click", () => {
  if (!selectedScientificSite) return;

  missionDestination = selectedScientificSite;

  setText(
    "routing-destination",
    missionDestination.name
  );

  setStatus(
    `Destination assigned: ${missionDestination.name}`
  );

  map.flyTo(
    marsToMap(
      missionDestination.latitude,
      missionDestination.longitude
    ),
    10
  );
});

// =====================================================
// MAP LAYERS
// =====================================================

const layerControl = L.control.layers(
  {
    "MOLA Global Topography": mola
  },
  {
    "Jezero CTX Imagery": ctx,
    "CTX Coverage Boundary": coverageOutline,
    "Scientific Sites": scientificSites,
    "Base Camp Alpha": baseCampMarker
  },
  {
    collapsed: false,
    position: "topright"
  }
).addTo(map);

let hazardLayer = null;

async function loadHazards() {
  try {
    const response = await fetch(
      "assets/jezero_hazards.json",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Hazard metadata unavailable");
    }

    const data = await response.json();
    const [[south, west], [north, east]] = data.bounds;

    if (
      ![south, west, north, east].every(Number.isFinite) ||
      south >= north ||
      west >= east ||
      south < 15 ||
      north > 21 ||
      west < 75 ||
      east > 80
    ) {
      throw new Error("Invalid Mars hazard bounds");
    }

    hazardLayer = L.imageOverlay(
      `${data.image}?v=${Date.now()}`,
      marsBounds(south, west, north, east),
      {
        opacity: 0.85,
        interactive: false
      }
    );

    layerControl.addOverlay(
      hazardLayer,
      "Jezero Terrain Hazards"
    );

    setStatus("Jezero hazard layer ready");

  } catch (error) {
    console.error(error);
    setStatus("Hazard overlay unavailable");
  }
}

// =====================================================
// PHASE 7C: INTERACTIVE ROUTE COMPARISON
// =====================================================

const routeLayer = L.layerGroup().addTo(map);

function ensureRoutingPanel() {
  if (document.getElementById("calculate-routes")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "routing-section";

  section.innerHTML = `
    <h3>Mission Navigation</h3>

    <p>
      Starting point:
      <strong>Base Camp Alpha</strong>
    </p>

    <p>
      Destination:
      <strong id="routing-destination">
        Not assigned
      </strong>
    </p>

    <button id="calculate-routes">
      Calculate Mission Routes
    </button>

    <div id="routing-results"></div>
  `;

  const statusHeading = [...sidebar.querySelectorAll("h3")]
    .find(h => h.textContent.trim() === "Mission Status");

  if (statusHeading) {
    sidebar.insertBefore(section, statusHeading);
  } else {
    sidebar.appendChild(section);
  }
}

ensureRoutingPanel();

async function requestRoute(mode) {
  const response = await fetch(
    `${API}/api/route`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        start: {
          latitude: BASE_CAMP.latitude,
          longitude: BASE_CAMP.longitude
        },
        destination: {
          latitude: missionDestination.latitude,
          longitude: missionDestination.longitude
        },
        mode
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || `HTTP ${response.status}`
    );
  }

  if (
    !Array.isArray(data.coordinates) ||
    data.coordinates.length < 2
  ) {
    throw new Error("No drawable route returned");
  }

  return data;
}

function drawRoute(data, mode) {
  const color = mode === "safest"
    ? "#00e5ff"
    : "#ffb347";

  const points = data.coordinates.map(
    ([latitude, longitude]) =>
      marsToMap(latitude, longitude)
  );

  const line = L.polyline(points, {
    color,
    weight: mode === "safest" ? 5 : 3,
    opacity: 0.95,
    dashArray: mode === "shortest"
      ? "8,6"
      : null
  }).addTo(routeLayer);

  line.bindPopup(
    `<strong>${mode.toUpperCase()} ROUTE</strong>` +
    `<p>Distance: ${data.distance_km} km</p>` +
    `<p>Class 2 exposure: ${(
      data.class_2_fraction * 100
    ).toFixed(1)}%</p>` +
    "<small>Prototype terrain-aware route</small>"
  );

  return line;
}

async function calculateMissionRoutes() {
  if (!missionDestination) {
    setStatus(
      "Select a scientific destination first"
    );
    return;
  }

  const button = document.getElementById(
    "calculate-routes"
  );

  const results = document.getElementById(
    "routing-results"
  );

  button.disabled = true;
  button.textContent = "Calculating...";

  routeLayer.clearLayers();
  results.replaceChildren();

  setStatus("Calculating mission routes...");

  try {
    // Request both modes. A mode may fail independently.
    const modes = ["safest", "shortest"];

    const responses = await Promise.allSettled(
      modes.map(mode => requestRoute(mode))
    );

    const lines = [];

    responses.forEach((response, index) => {
      const mode = modes[index];

      const paragraph = document.createElement("p");

      if (response.status === "fulfilled") {
        const data = response.value;

        lines.push(drawRoute(data, mode));

        paragraph.textContent =
          `${mode.toUpperCase()}: ` +
          `${data.distance_km} km | ` +
          `${(data.class_2_fraction * 100).toFixed(1)}% ` +
          "Class 2 exposure";
      } else {
        paragraph.textContent =
          `${mode.toUpperCase()}: ` +
          response.reason.message;
      }

      results.appendChild(paragraph);
    });

    if (lines.length > 0) {
      const bounds = L.featureGroup(
        lines
      ).getBounds();

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 12
      });

      setStatus(
        `${lines.length} mission route(s) calculated`
      );
    } else {
      setStatus(
        "No feasible routes within search limits"
      );
    }

  } catch (error) {
    console.error(error);
    setStatus(`Routing error: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Calculate Mission Routes";
  }
}

document.getElementById(
  "calculate-routes"
).addEventListener(
  "click",
  calculateMissionRoutes
);

// =====================================================
// USER CONTROLS AND DIAGNOSTICS
// =====================================================

if (sitesCheckbox) {
  sitesCheckbox.addEventListener(
    "change",
    event => {
      if (event.target.checked) {
        map.addLayer(scientificSites);
      } else {
        map.removeLayer(scientificSites);
      }
    }
  );
}

if (objectiveSelect) {
  objectiveSelect.addEventListener(
    "change",
    () => {
      setStatus(
        `Scientific objective: ${
          objectiveSelect.selectedOptions[0].text
        }`
      );
    }
  );
}

map.on("click", event => {
  const coords = mapToMars(event.latlng);

  L.popup()
    .setLatLng(event.latlng)
    .setContent(
      `<strong>Mars Coordinates</strong>` +
      `<p>${coords.latitude.toFixed(5)}° N</p>` +
      `<p>${coords.longitude.toFixed(5)}° E</p>`
    )
    .openOn(map);
});

map.on("overlayadd", event => {
  if (event.layer === hazardLayer) {
    setStatus("Terrain hazards enabled");
  }
});

map.on("overlayremove", event => {
  if (event.layer === hazardLayer) {
    setStatus("Terrain hazards hidden");
  }
});

let ctxTiles = 0;

ctx.on("tileload", () => {
  ctxTiles++;

  if (!routeLayer.getLayers().length) {
    setStatus(
      `CTX imagery active | ${ctxTiles} tiles loaded`
    );
  }
});

ctx.on("tileerror", event => {
  console.error(
    "CTX tile error:",
    event.tile?.src
  );
});

// =====================================================
// INITIALISE
// =====================================================

setStatus("Initialising human exploration mission...");

loadHazards();
assessBaseCamp();


// =====================================================
// PHASE 7D: ROUND-TRIP MISSION FEASIBILITY
// =====================================================

const roundTripLayer = L.layerGroup().addTo(map);

function createRoundTripPanel() {
  if (document.getElementById("roundtrip-button")) {
    return;
  }

  const section = document.createElement("section");
  section.className = "roundtrip-section";

  section.innerHTML = `
    <h3>Round-Trip Mission Analysis</h3>

    <p>
      Evaluate whether the crew can travel from
      Base Camp Alpha to the selected scientific
      destination and return within modelled
      time and energy budgets.
    </p>

    <label for="mission-route-mode">
      Routing objective
    </label>

    <select id="mission-route-mode">
      <option value="safest">Terrain-aware route</option>
      <option value="shortest">Shortest traversable route</option>
    </select>

    <label for="rover-speed">
      Rover speed (km/h)
    </label>
    <input id="rover-speed" type="number"
      min="0.1" max="20" step="0.5" value="4">

    <label for="rover-energy">
      Travel energy (kWh/km)
    </label>
    <input id="rover-energy" type="number"
      min="0.1" max="50" step="0.1" value="1.5">

    <label for="mission-energy">
      Available energy (kWh)
    </label>
    <input id="mission-energy" type="number"
      min="1" max="1000" step="1" value="20">

    <label for="mission-hours">
      Maximum mission duration (hours)
    </label>
    <input id="mission-hours" type="number"
      min="1" max="72" step="1" value="8">

    <label for="science-hours">
      Science activity duration (hours)
    </label>
    <input id="science-hours" type="number"
      min="0" max="24" step="0.5" value="1">

    <p>
      <small>
        Scenario assumptions: 25% energy reserve
        and 20% time reserve. These are not
        validated Mars mission requirements.
      </small>
    </p>

    <button id="roundtrip-button">
      Analyse Round-Trip Mission
    </button>

    <div id="roundtrip-results"
      aria-live="polite"></div>
  `;

  const statusHeading = [
    ...sidebar.querySelectorAll("h3")
  ].find(
    h => h.textContent.trim() === "Mission Status"
  );

  if (statusHeading) {
    sidebar.insertBefore(section, statusHeading);
  } else {
    sidebar.appendChild(section);
  }
}

createRoundTripPanel();

function missionInput(id) {
  return Number(
    document.getElementById(id).value
  );
}

function displayRoundTrip(data) {
  const mission = data.mission;
  const results = document.getElementById(
    "roundtrip-results"
  );

  results.replaceChildren();

  const fields = [
    ["Assessment", mission.assessment],
    [
      "Round-trip distance",
      `${mission.roundtrip_distance_km} km`
    ],
    [
      "Travel time",
      `${mission.travel_hours} hours`
    ],
    [
      "Total mission duration",
      `${mission.total_hours} hours`
    ],
    [
      "Travel energy",
      `${mission.travel_energy_kwh} kWh`
    ],
    [
      "Energy margin",
      `${mission.energy_margin_kwh} kWh`
    ],
    [
      "Time margin",
      `${mission.time_margin_hours} hours`
    ],
    [
      "Energy budget",
      mission.energy_pass ? "PASS" : "FAIL"
    ],
    [
      "Time budget",
      mission.time_pass ? "PASS" : "FAIL"
    ]
  ];

  fields.forEach(([label, value]) => {
    const row = document.createElement("p");

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;

    row.appendChild(strong);
    row.appendChild(
      document.createTextNode(String(value))
    );

    results.appendChild(row);
  });

  const note = document.createElement("p");
  note.textContent =
    "Prototype scenario only. This does not " +
    "establish actual astronaut survivability.";

  results.appendChild(note);
}

function drawRoundTrip(data) {
  roundTripLayer.clearLayers();

  const outboundPoints =
    data.outbound.coordinates.map(
      ([lat, lon]) => marsToMap(lat, lon)
    );

  const returnPoints =
    data.return.coordinates.map(
      ([lat, lon]) => marsToMap(lat, lon)
    );

  // Wide dark line to distinguish mission
  // navigation from the underlying hazard map.
  L.polyline(outboundPoints, {
    color: "#081c2c",
    weight: 9,
    opacity: 0.85
  }).addTo(roundTripLayer);

  const outboundLine = L.polyline(
    outboundPoints,
    {
      color: "#00e5ff",
      weight: 5,
      opacity: 1
    }
  ).addTo(roundTripLayer);

  // The return journey follows the same route
  // in reverse, so it is drawn as a dashed line.
  L.polyline(returnPoints, {
    color: "#ffffff",
    weight: 2,
    opacity: 0.95,
    dashArray: "5,9"
  }).addTo(roundTripLayer);

  outboundLine.bindPopup(
    "<strong>Round-Trip Mission</strong>" +
    `<p>Outbound: ${data.outbound.distance_km} km</p>` +
    `<p>Return: ${data.return.distance_km} km</p>` +
    "<p>Return follows the outbound route in reverse.</p>"
  );

  map.fitBounds(
    outboundLine.getBounds(),
    {
      padding: [60, 60],
      maxZoom: 12
    }
  );
}

async function analyseRoundTrip() {
  if (!missionDestination) {
    setStatus(
      "Select a scientific destination first."
    );
    return;
  }

  const button = document.getElementById(
    "roundtrip-button"
  );

  button.disabled = true;
  button.textContent = "Analysing mission...";

  setStatus(
    "Evaluating round-trip mission feasibility..."
  );

  try {
    const request = {
      destination: {
        latitude: missionDestination.latitude,
        longitude: missionDestination.longitude
      },
      mode: document.getElementById(
        "mission-route-mode"
      ).value,
      speed_kmh: missionInput("rover-speed"),
      energy_kwh_per_km:
        missionInput("rover-energy"),
      available_energy_kwh:
        missionInput("mission-energy"),
      maximum_mission_hours:
        missionInput("mission-hours"),
      science_activity_hours:
        missionInput("science-hours"),
      energy_reserve_fraction: 0.25,
      time_reserve_fraction: 0.20
    };

    const response = await fetch(
      `${API}/api/mission/roundtrip`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const detail = data.detail;
      throw new Error(
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail || "Request failed")
      );
    }

    displayRoundTrip(data);

    // Hide comparison lines while showing
    // the selected round-trip mission.
    routeLayer.clearLayers();

    drawRoundTrip(data);

    setStatus(
      data.mission.within_modelled_budget
        ? "Round-trip mission within modelled budget"
        : "WARNING: Mission exceeds modelled budget"
    );

    console.log("Round-trip analysis:", data);

  } catch (error) {
    console.error("Round-trip error:", error);
    setStatus(`Mission analysis failed: ${error.message}`);

  } finally {
    button.disabled = false;
    button.textContent = "Analyse Round-Trip Mission";
  }
}

document.getElementById(
  "roundtrip-button"
).addEventListener(
  "click",
  analyseRoundTrip
);


console.log("MARS PATHFINDER | PHASE 7C");
console.log("Base Camp Alpha:", BASE_CAMP);
