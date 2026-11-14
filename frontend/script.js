
"use strict";

// =====================================================
// MARS PATHFINDER
// HUMAN EXPLORATION SYSTEM
//
// NASA Mars Trek imagery
// Scientific investigation
// Base Camp Alpha
// Terrain hazards
// A* route comparison
// Round-trip mission simulation
// Map-first destination selection
// =====================================================

// -----------------------------------------------------
// 1. CONFIGURATION
// -----------------------------------------------------

const API = "http://127.0.0.1:8000";

const BASE_CAMP = {
  name: "Base Camp Alpha",
  latitude: 18.4,
  longitude: 77.5,
  hypothetical: true
};

const BASE_WIDTH = 512;
const BASE_HEIGHT = 256;

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");
const hazardsCheckbox = document.getElementById("show-hazards");
const ctxCheckbox = document.getElementById("show-ctx");
const coverageCheckbox = document.getElementById("show-coverage");

let selectedScientificSite = null;
let missionDestination = null;

let hazardLayer = null;
let hazardMetadata = null;

let requestVersion = 0;

// -----------------------------------------------------
// 2. UTILITIES
// -----------------------------------------------------

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = String(value);
  }
}

function marsToMap(latitude, longitude) {
  const x =
    ((longitude + 180) / 360) * BASE_WIDTH;

  const y =
    ((90 - latitude) / 180) * BASE_HEIGHT;

  return [-y, x];
}

function mapToMars(position) {
  return {
    latitude:
      90 + (position.lat / BASE_HEIGHT) * 180,

    longitude:
      (position.lng / BASE_WIDTH) * 360 - 180
  };
}

function marsBounds(south, west, north, east) {
  return L.latLngBounds(
    marsToMap(south, west),
    marsToMap(north, east)
  );
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function clearElement(element) {
  if (element) {
    element.replaceChildren();
  }
}

function addResultRow(container, label, value) {
  const row = document.createElement("p");

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;

  row.appendChild(strong);
  row.appendChild(
    document.createTextNode(String(value))
  );

  container.appendChild(row);
}

function getErrorDetail(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map(item => item.msg || JSON.stringify(item))
      .join("; ");
  }

  return fallback;
}

// -----------------------------------------------------
// 3. MAP INITIALISATION
// -----------------------------------------------------

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 13,
  zoomControl: true
});

map.setView(
  marsToMap(
    BASE_CAMP.latitude,
    BASE_CAMP.longitude
  ),
  9
);

// -----------------------------------------------------
// 4. NASA MARS TREK IMAGERY
// -----------------------------------------------------

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
  opacity: 1,
  attribution: "NASA Mars Trek | MRO CTX Jezero"
}).addTo(map);

const coverageOutline = L.rectangle(
  ctxCoverage,
  {
    color: "#00e5ff",
    weight: 2,
    fillOpacity: 0,
    dashArray: "6,6"
  }
).addTo(map);

coverageOutline.bindPopup(
  "<strong>Jezero CTX Mosaic Coverage</strong>" +
  "<p>NASA Mars Trek imagery footprint.</p>" +
  "<p>Not a terrain hazard boundary.</p>"
);

// -----------------------------------------------------
// 5. MAP LAYERS
// -----------------------------------------------------

const scientificSites = L.layerGroup().addTo(map);

const routeLayer = L.layerGroup().addTo(map);

const roundTripLayer = L.layerGroup().addTo(map);

const layerControl = L.control.layers(
  {
    "MOLA Global Topography": mola
  },
  {
    "Jezero CTX Imagery": ctx,
    "CTX Coverage Boundary": coverageOutline,
    "Scientific Sites": scientificSites
  },
  {
    collapsed: true,
    position: "topright"
  }
).addTo(map);

// -----------------------------------------------------
// 6. WORKSPACE TABS
// -----------------------------------------------------

function openTab(tabName) {
  document.querySelectorAll(
    ".workspace-tab"
  ).forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.tab === tabName
    );
  });

  document.querySelectorAll(
    ".tab-content"
  ).forEach(section => {
    section.classList.toggle(
      "active",
      section.id === `tab-${tabName}`
    );
  });

  map.invalidateSize();
}

document.querySelectorAll(
  ".workspace-tab"
).forEach(button => {
  button.addEventListener("click", () => {
    openTab(button.dataset.tab);
  });
});

// -----------------------------------------------------
// 7. SCIENTIFIC SITES
// -----------------------------------------------------

const sites = [
  {
    name: "Delta investigation",
    latitude: 18.45,
    longitude: 77.40,

    description:
      "Conceptual investigation of ancient " +
      "delta sedimentary deposits.",

    objective:
      "Study ancient sedimentary environments.",

    significance:
      "Jezero Crater contains an ancient river " +
      "delta. Sedimentary deposits may preserve " +
      "evidence of past water-related environments.",

    evidence:
      "Regional geological context is supported " +
      "by Mars mission science. The exact " +
      "investigation point is conceptual."
  },

  {
    name: "Crater geology",
    latitude: 18.38,
    longitude: 77.55,

    description:
      "Conceptual investigation of " +
      "crater-floor geological materials.",

    objective:
      "Investigate geological materials " +
      "on the crater floor.",

    significance:
      "Crater-floor rocks can provide " +
      "information about Jezero Crater's " +
      "geological history.",

    evidence:
      "Regional geological interpretation " +
      "is established. The exact target " +
      "is not independently validated."
  },

  {
    name: "Mineral investigation",
    latitude: 18.42,
    longitude: 77.48,

    description:
      "Conceptual investigation of " +
      "possible mineralogical indicators.",

    objective:
      "Investigate possible mineralogical evidence.",

    significance:
      "Mineral composition can help " +
      "scientists understand past " +
      "geological and aqueous processes.",

    evidence:
      "This is an investigation objective, " +
      "not a confirmed mineral detection " +
      "at these exact coordinates."
  }
];

// -----------------------------------------------------
// 8. SCIENTIFIC INFORMATION
// -----------------------------------------------------

function updateSciencePanel(site) {
  selectedScientificSite = site;

  setText("science-title", site.name);
  setText("science-description", site.description);
  setText("science-objective", site.objective);
  setText("science-significance", site.significance);
  setText("science-evidence", site.evidence);

  setText(
    "science-safety",
    "Terrain hazard classification and " +
    "routing are available. Site-specific " +
    "human safety has not been validated."
  );
}

// -----------------------------------------------------
// 9. DESTINATION SELECTION
// -----------------------------------------------------

function setMissionDestination(site) {
  if (!site) return;

  missionDestination = site;
  selectedScientificSite = site;

  updateSciencePanel(site);

  setText(
    "routing-destination",
    site.name
  );

  // Invalidate requests started for an old destination.
  requestVersion++;

  // Clear route results for previous destinations.
  routeLayer.clearLayers();
  roundTripLayer.clearLayers();

  clearElement(
    document.getElementById("routing-results")
  );

  clearElement(
    document.getElementById("roundtrip-results")
  );

  setStatus(
    `Mission destination assigned: ${site.name}`
  );

  console.log(
    "Mission destination:",
    missionDestination
  );
}

// -----------------------------------------------------
// 10. SCIENTIFIC MARKERS AND MAP POPUPS
// -----------------------------------------------------

function createSitePopup(site) {
  const popup = document.createElement("div");
  popup.className = "mars-site-popup";

  const title = document.createElement("h3");
  title.textContent = site.name;

  const description = document.createElement("p");
  description.textContent = site.description;

  const coordinates = document.createElement("p");
  coordinates.textContent =
    `${site.latitude.toFixed(5)}° N, ` +
    `${site.longitude.toFixed(5)}° E`;

  const evidence = document.createElement("p");
  evidence.textContent = site.evidence;

  const destinationButton =
    document.createElement("button");

  destinationButton.type = "button";
  destinationButton.className =
    "popup-destination-button";

  destinationButton.textContent =
    "Set Destination";

  destinationButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      setMissionDestination(site);

      map.closePopup();

      map.panTo(
        marsToMap(
          site.latitude,
          site.longitude
        )
      );
    }
  );

  const detailsButton =
    document.createElement("button");

  detailsButton.type = "button";
  detailsButton.className =
    "popup-details-button";

  detailsButton.textContent =
    "View Scientific Details";

  detailsButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      updateSciencePanel(site);

      map.closePopup();

      openTab("science");

      setStatus(
        `Viewing scientific evidence: ${site.name}`
      );
    }
  );

  popup.append(
    title,
    description,
    coordinates,
    evidence,
    destinationButton,
    detailsButton
  );

  return popup;
}

sites.forEach(site => {
  const marker = L.circleMarker(
    marsToMap(
      site.latitude,
      site.longitude
    ),
    {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff9633",
      fillOpacity: 0.95
    }
  );

  marker.bindPopup(
    createSitePopup(site),
    {
      maxWidth: 310,
      minWidth: 230
    }
  );

  marker.on("click", event => {
    updateSciencePanel(site);

    // Prevent the general coordinate popup
    // from replacing the scientific popup.
    if (event.originalEvent) {
      L.DomEvent.stopPropagation(
        event.originalEvent
      );
    }
  });

  marker.addTo(scientificSites);
});

// -----------------------------------------------------
// 11. BASE CAMP ALPHA
// -----------------------------------------------------

const baseCampMarker = L.circleMarker(
  marsToMap(
    BASE_CAMP.latitude,
    BASE_CAMP.longitude
  ),
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
    direction: "top"
  }
);

baseCampMarker.bindPopup(
  "<strong>BASE CAMP ALPHA</strong>" +
  "<p>Hypothetical human exploration base camp</p>" +
  "<p>Terrain assessment loading...</p>"
);

baseCampMarker.on("click", event => {
  if (event.originalEvent) {
    L.DomEvent.stopPropagation(
      event.originalEvent
    );
  }
});

layerControl.addOverlay(
  baseCampMarker,
  "Base Camp Alpha"
);

// -----------------------------------------------------
// 12. BASE CAMP TERRAIN SCREENING
// -----------------------------------------------------

async function assessBaseCamp() {
  try {
    const response = await fetch(
      `${API}/api/basecamp`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        getErrorDetail(
          data,
          `HTTP ${response.status}`
        )
      );
    }

    setText(
      "basecamp-assessment",
      data.assessment
    );

    const counts = data.class_counts || {};

    setText(
      "basecamp-details",
      `Class 1: ${counts["1"] ?? "?"} | ` +
      `Class 2: ${counts["2"] ?? "?"} | ` +
      `Class 3: ${counts["3"] ?? "?"} | ` +
      `Unknown: ${data.unknown_cells ?? "?"}`
    );

    baseCampMarker.setPopupContent(
      "<strong>BASE CAMP ALPHA</strong>" +
      `<p>${data.assessment}</p>` +
      "<p>Terrain-only screening</p>" +
      "<small>Hypothetical. Not landing-certified.</small>"
    );

  } catch (error) {
    console.error(
      "Base camp screening error:",
      error
    );

    setText(
      "basecamp-assessment",
      "Screening unavailable"
    );

    setText(
      "basecamp-details",
      error.message
    );
  }
}

// -----------------------------------------------------
// 13. HAZARD OVERLAY
// -----------------------------------------------------

async function loadHazardOverlay() {
  try {
    const response = await fetch(
      "assets/jezero_hazards.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Hazard metadata HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (
      !Array.isArray(data.bounds) ||
      data.bounds.length !== 2
    ) {
      throw new Error(
        "Invalid hazard metadata bounds"
      );
    }

    const [[south, west], [north, east]] =
      data.bounds;

    if (
      ![south, west, north, east].every(Number.isFinite) ||
      south >= north ||
      west >= east ||
      south < 15 ||
      north > 21 ||
      west < 75 ||
      east > 80
    ) {
      throw new Error(
        "Invalid geographic hazard bounds"
      );
    }

    hazardMetadata = data;

    hazardLayer = L.imageOverlay(
      `${data.image}?v=${Date.now()}`,
      marsBounds(
        south,
        west,
        north,
        east
      ),
      {
        opacity: 0.85,
        interactive: false,
        alt: "Jezero terrain hazard classification"
      }
    );

    layerControl.addOverlay(
      hazardLayer,
      "Jezero Terrain Hazards"
    );

    if (hazardsCheckbox?.checked) {
      hazardLayer.addTo(map);
    }

    hazardLayer.on("error", () => {
      setStatus(
        "Hazard image failed to load"
      );
    });

    console.log(
      "Hazard metadata:",
      hazardMetadata
    );

  } catch (error) {
    console.error(
      "Hazard overlay error:",
      error
    );

    setStatus(
      "Hazard overlay unavailable"
    );
  }
}

// -----------------------------------------------------
// 14. ROUTE API
// -----------------------------------------------------

async function requestRoute(mode, destination) {
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
          latitude: destination.latitude,
          longitude: destination.longitude
        },
        mode
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      getErrorDetail(
        data,
        `Routing HTTP ${response.status}`
      )
    );
  }

  if (
    !Array.isArray(data.coordinates) ||
    data.coordinates.length < 2
  ) {
    throw new Error(
      "No drawable route returned"
    );
  }

  return data;
}

// -----------------------------------------------------
// 15. DRAW A* ROUTES
// -----------------------------------------------------

function drawRoute(data, mode) {
  const color =
    mode === "safest"
      ? "#00e5ff"
      : "#ffb347";

  const points = data.coordinates.map(
    ([latitude, longitude]) =>
      marsToMap(latitude, longitude)
  );

  const line = L.polyline(
    points,
    {
      color,
      weight:
        mode === "safest" ? 5 : 3,
      opacity: 0.95,
      dashArray:
        mode === "shortest"
          ? "8,6"
          : null
    }
  ).addTo(routeLayer);

  line.bindPopup(
    `<strong>${mode.toUpperCase()} ROUTE</strong>` +
    `<p>Distance: ${data.distance_km} km</p>` +
    `<p>Class 2 exposure: ${(
      data.class_2_fraction * 100
    ).toFixed(1)}%</p>` +
    "<small>Prototype terrain-aware routing</small>"
  );

  return line;
}

// -----------------------------------------------------
// 16. ROUTE COMPARISON
// -----------------------------------------------------

async function calculateMissionRoutes() {
  if (!missionDestination) {
    setStatus(
      "Select a destination from a scientific marker."
    );
    return;
  }

  const destination = {
    ...missionDestination
  };

  const currentVersion = ++requestVersion;

  const button = document.getElementById(
    "calculate-routes"
  );

  const results = document.getElementById(
    "routing-results"
  );

  button.disabled = true;
  button.textContent = "Calculating...";

  routeLayer.clearLayers();
  roundTripLayer.clearLayers();
  clearElement(results);

  setStatus(
    "Calculating safest and shortest A* routes..."
  );

  try {
    const modes = [
      "safest",
      "shortest"
    ];

    const responses = await Promise.allSettled(
      modes.map(mode =>
        requestRoute(mode, destination)
      )
    );

    if (currentVersion !== requestVersion) {
      return;
    }

    const lines = [];

    responses.forEach((response, index) => {
      const mode = modes[index];

      if (response.status === "fulfilled") {
        const data = response.value;

        lines.push(
          drawRoute(data, mode)
        );

        addResultRow(
          results,
          mode.toUpperCase(),
          `${data.distance_km} km | ` +
          `${(
            data.class_2_fraction * 100
          ).toFixed(1)}% Class 2 exposure`
        );

      } else {
        addResultRow(
          results,
          mode.toUpperCase(),
          `Unavailable: ${response.reason.message}`
        );
      }
    });

    if (lines.length > 0) {
      const bounds = L.featureGroup(
        lines
      ).getBounds();

      map.fitBounds(
        bounds,
        {
          padding: [60, 60],
          maxZoom: 12
        }
      );

      setStatus(
        `${lines.length} route(s) calculated`
      );

    } else {
      setStatus(
        "No route found within the current search limits"
      );
    }

  } catch (error) {
    console.error(
      "Route comparison error:",
      error
    );

    setStatus(
      `Routing error: ${error.message}`
    );

  } finally {
    button.disabled = false;
    button.textContent = "Compare A* Routes";
  }
}

document.getElementById(
  "calculate-routes"
).addEventListener(
  "click",
  calculateMissionRoutes
);

// -----------------------------------------------------
// 17. ROUND-TRIP MISSION REQUEST
// -----------------------------------------------------

function missionInput(id) {
  return Number(
    document.getElementById(id).value
  );
}

function validateMissionInputs(request) {
  const limits = [
    ["speed_kmh", 0, 20, false],
    ["energy_kwh_per_km", 0, 50, false],
    ["available_energy_kwh", 0, 1000, false],
    ["maximum_mission_hours", 0, 72, false],
    ["science_activity_hours", 0, 24, true]
  ];

  for (const [
    field,
    minimum,
    maximum,
    allowZero
  ] of limits) {
    const value = request[field];

    if (
      !Number.isFinite(value) ||
      value > maximum ||
      (allowZero ? value < minimum : value <= minimum)
    ) {
      throw new Error(
        `Invalid value for ${field}`
      );
    }
  }
}

async function requestRoundTrip(destination) {
  const request = {
    destination: {
      latitude: destination.latitude,
      longitude: destination.longitude
    },

    mode: document.getElementById(
      "mission-route-mode"
    ).value,

    speed_kmh:
      missionInput("rover-speed"),

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

  validateMissionInputs(request);

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
    throw new Error(
      getErrorDetail(
        data,
        `Round-trip HTTP ${response.status}`
      )
    );
  }

  return data;
}

// -----------------------------------------------------
// 18. DISPLAY ROUND-TRIP RESULTS
// -----------------------------------------------------

function displayRoundTrip(data) {
  const results = document.getElementById(
    "roundtrip-results"
  );

  clearElement(results);

  const mission = data.mission;

  addResultRow(
    results,
    "Assessment",
    mission.assessment
  );

  addResultRow(
    results,
    "Round-trip distance",
    `${mission.roundtrip_distance_km} km`
  );

  addResultRow(
    results,
    "Travel time",
    `${mission.travel_hours} hours`
  );

  addResultRow(
    results,
    "Total mission duration",
    `${mission.total_hours} hours`
  );

  addResultRow(
    results,
    "Travel energy",
    `${mission.travel_energy_kwh} kWh`
  );

  addResultRow(
    results,
    "Energy margin",
    `${mission.energy_margin_kwh} kWh`
  );

  addResultRow(
    results,
    "Time margin",
    `${mission.time_margin_hours} hours`
  );

  addResultRow(
    results,
    "Energy budget",
    mission.energy_pass ? "PASS" : "FAIL"
  );

  addResultRow(
    results,
    "Time budget",
    mission.time_pass ? "PASS" : "FAIL"
  );

  const note = document.createElement("p");

  note.className = "small-text";

  note.textContent =
    "Simulation only. The model does not " +
    "certify astronaut safety or survivability.";

  results.appendChild(note);
}

// -----------------------------------------------------
// 19. DRAW ROUND-TRIP ROUTE
// -----------------------------------------------------

function drawRoundTrip(data) {
  roundTripLayer.clearLayers();

  const outboundPoints =
    data.outbound.coordinates.map(
      ([latitude, longitude]) =>
        marsToMap(latitude, longitude)
    );

  const returnPoints =
    data.return.coordinates.map(
      ([latitude, longitude]) =>
        marsToMap(latitude, longitude)
    );

  L.polyline(
    outboundPoints,
    {
      color: "#081c2c",
      weight: 9,
      opacity: 0.85
    }
  ).addTo(roundTripLayer);

  const outboundLine = L.polyline(
    outboundPoints,
    {
      color: "#00e5ff",
      weight: 5,
      opacity: 1
    }
  ).addTo(roundTripLayer);

  L.polyline(
    returnPoints,
    {
      color: "#ffffff",
      weight: 2,
      opacity: 0.95,
      dashArray: "5,9"
    }
  ).addTo(roundTripLayer);

  outboundLine.bindPopup(
    "<strong>ROUND-TRIP MISSION</strong>" +
    `<p>Outbound: ${data.outbound.distance_km} km</p>` +
    `<p>Return: ${data.return.distance_km} km</p>` +
    "<p>Return reverses the outbound route.</p>"
  );

  map.fitBounds(
    outboundLine.getBounds(),
    {
      padding: [60, 60],
      maxZoom: 12
    }
  );
}

// -----------------------------------------------------
// 20. ROUND-TRIP ANALYSIS
// -----------------------------------------------------

async function analyseRoundTrip() {
  if (!missionDestination) {
    setStatus(
      "Select a scientific destination first."
    );
    return;
  }

  const destination = {
    ...missionDestination
  };

  const currentVersion = ++requestVersion;

  const button = document.getElementById(
    "roundtrip-button"
  );

  button.disabled = true;
  button.textContent = "Analysing...";

  setStatus(
    "Evaluating round-trip mission..."
  );

  try {
    const data = await requestRoundTrip(
      destination
    );

    if (currentVersion !== requestVersion) {
      return;
    }

    routeLayer.clearLayers();

    displayRoundTrip(data);
    drawRoundTrip(data);

    setStatus(
      data.mission.within_modelled_budget
        ? "Round trip within modelled resource budget"
        : "WARNING: Mission exceeds modelled budget"
    );

    console.log(
      "Round-trip analysis:",
      data
    );

  } catch (error) {
    if (currentVersion === requestVersion) {
      console.error(
        "Round-trip analysis error:",
        error
      );

      setStatus(
        `Mission analysis failed: ${error.message}`
      );
    }

  } finally {
    button.disabled = false;
    button.textContent = "Analyse Round Trip";
  }
}

document.getElementById(
  "roundtrip-button"
).addEventListener(
  "click",
  analyseRoundTrip
);

// -----------------------------------------------------
// 21. TERRAIN LAYER CONTROLS
// -----------------------------------------------------

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

if (hazardsCheckbox) {
  hazardsCheckbox.addEventListener(
    "change",
    event => {
      if (!hazardLayer) {
        setStatus(
          "Hazard overlay not yet available"
        );
        return;
      }

      if (event.target.checked) {
        map.addLayer(hazardLayer);
      } else {
        map.removeLayer(hazardLayer);
      }
    }
  );
}

if (ctxCheckbox) {
  ctxCheckbox.addEventListener(
    "change",
    event => {
      if (event.target.checked) {
        map.addLayer(ctx);
      } else {
        map.removeLayer(ctx);
      }
    }
  );
}

if (coverageCheckbox) {
  coverageCheckbox.addEventListener(
    "change",
    event => {
      if (event.target.checked) {
        map.addLayer(coverageOutline);
      } else {
        map.removeLayer(coverageOutline);
      }
    }
  );
}

if (objectiveSelect) {
  objectiveSelect.addEventListener(
    "change",
    () => {
      const selected =
        objectiveSelect.selectedOptions[0];

      setStatus(
        `Scientific objective: ${selected.text}`
      );
    }
  );
}

// Keep sidebar checkboxes synchronised
// with Leaflet's layer control.
map.on("overlayadd", event => {
  if (event.layer === scientificSites && sitesCheckbox) {
    sitesCheckbox.checked = true;
  }

  if (event.layer === hazardLayer && hazardsCheckbox) {
    hazardsCheckbox.checked = true;
  }

  if (event.layer === ctx && ctxCheckbox) {
    ctxCheckbox.checked = true;
  }

  if (
    event.layer === coverageOutline &&
    coverageCheckbox
  ) {
    coverageCheckbox.checked = true;
  }
});

map.on("overlayremove", event => {
  if (event.layer === scientificSites && sitesCheckbox) {
    sitesCheckbox.checked = false;
  }

  if (event.layer === hazardLayer && hazardsCheckbox) {
    hazardsCheckbox.checked = false;
  }

  if (event.layer === ctx && ctxCheckbox) {
    ctxCheckbox.checked = false;
  }

  if (
    event.layer === coverageOutline &&
    coverageCheckbox
  ) {
    coverageCheckbox.checked = false;
  }
});

// -----------------------------------------------------
// 22. MAP COORDINATE INSPECTION
// -----------------------------------------------------

map.on("click", event => {
  const coordinates = mapToMars(
    event.latlng
  );

  L.popup()
    .setLatLng(event.latlng)
    .setContent(
      "<strong>Mars Coordinates</strong>" +
      `<p>Latitude: ${coordinates.latitude.toFixed(5)}°</p>` +
      `<p>Longitude: ${coordinates.longitude.toFixed(5)}° E</p>`
    )
    .openOn(map);
});

// -----------------------------------------------------
// 23. TILE DIAGNOSTICS
// -----------------------------------------------------

let molaLoaded = 0;
let ctxLoaded = 0;
let ctxErrors = 0;

mola.on("tileload", () => {
  molaLoaded++;
});

ctx.on("tileload", () => {
  ctxLoaded++;
});

ctx.on("tileerror", event => {
  ctxErrors++;

  console.error(
    "CTX tile failed:",
    event.tile?.src || event
  );
});

// -----------------------------------------------------
// 24. INITIALISE
// -----------------------------------------------------

setStatus(
  "Jezero mission map ready. Loading terrain data..."
);

loadHazardOverlay();
assessBaseCamp();

console.log("MARS PATHFINDER");
console.log("Human Exploration System");
console.log("Base Camp Alpha:", BASE_CAMP);
console.log("MOLA URL:", MOLA_URL);
console.log("CTX URL:", CTX_URL);
console.log("CTX coverage:", ctxCoverage.toBBoxString());
