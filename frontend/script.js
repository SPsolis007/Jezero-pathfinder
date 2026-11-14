
"use strict";

// ======================================================
// MARS PATHFINDER
// PHASE 6E: SCIENTIFIC INVESTIGATION + TERRAIN HAZARDS
//
// NASA MOLA | Jezero CTX | Scientific Investigation
// Mission Destination | Hazard Overlay | Diagnostics
// ======================================================

// ======================================================
// 1. DOM ELEMENTS
// ======================================================

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

// ======================================================
// 2. MARS COORDINATE DISPLAY
// ======================================================

const BASE_WIDTH = 512;
const BASE_HEIGHT = 256;

// Mars coordinates to Leaflet's display grid.
// This is the existing Mars Trek tile-display assumption.
// Actual raster reprojection happens in Python.

function marsToMap(latitude, longitude) {
  const x = ((longitude + 180) / 360) * BASE_WIDTH;
  const y = ((90 - latitude) / 180) * BASE_HEIGHT;

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

// ======================================================
// 3. MAP INITIALISATION
// ======================================================

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 13,
  zoomControl: true
});

const JEZERO = {
  latitude: 18.4,
  longitude: 77.5
};

map.setView(
  marsToMap(JEZERO.latitude, JEZERO.longitude),
  9
);

// ======================================================
// 4. NASA MARS TREK IMAGERY
// ======================================================

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

// ======================================================
// 5. CTX COVERAGE BOUNDARY
// ======================================================

const coverageOutline = L.rectangle(ctxCoverage, {
  color: "#00e5ff",
  weight: 2,
  fillOpacity: 0,
  dashArray: "6, 6"
}).addTo(map);

coverageOutline.bindPopup(
  "<strong>Jezero CTX Mosaic Coverage</strong>" +
  "<p>NASA Mars Trek imagery footprint.</p>" +
  "<p>This boundary does not represent a hazard.</p>"
);

// ======================================================
// 6. SCIENTIFIC INVESTIGATION PANEL
// ======================================================

// Restore the original Scientific Investigation panel
// if it is missing from the GitHub version of index.html.

function ensureScientificPanel() {
  if (document.getElementById("science-title")) {
    return;
  }

  const sidebar =
    document.querySelector(".sidebar") ||
    document.querySelector("aside");

  if (!sidebar) {
    console.warn(
      "Sidebar not found. Scientific panel unavailable."
    );
    return;
  }

  const section = document.createElement("section");

  section.className = "scientific-investigation-section";

  section.innerHTML = `
    <h3>Scientific Investigation</h3>

    <div id="science-panel" class="science-panel">

      <h4 id="science-title">No site selected</h4>

      <p id="science-description">
        Click an orange scientific marker to investigate
        a potential research location.
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
          Awaiting site-specific terrain assessment.
        </p>
      </div>

      <button id="select-destination" disabled>
        Set as Mission Destination
      </button>

    </div>
  `;

  const statusHeading =
    [...sidebar.querySelectorAll("h3")]
      .find(element =>
        element.textContent.trim() === "Mission Status"
      );

  if (statusHeading) {
    sidebar.insertBefore(section, statusHeading);
  } else {
    sidebar.appendChild(section);
  }
}

ensureScientificPanel();

// ======================================================
// 7. SCIENTIFIC SITES
// ======================================================

const scientificSites = L.layerGroup().addTo(map);

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
      "Jezero Crater contains an ancient river delta. " +
      "Sedimentary deposits can preserve evidence of " +
      "past water-related environments.",

    evidence:
      "Regional interpretation supported by Mars mission " +
      "science. The exact investigation point is conceptual."
  },

  {
    name: "Crater geology",
    latitude: 18.38,
    longitude: 77.55,

    description:
      "Conceptual investigation of crater-floor geology.",

    objective:
      "Investigate geological materials on the crater floor.",

    significance:
      "Crater-floor rocks provide information about " +
      "Jezero Crater's geological history.",

    evidence:
      "Regional geological context is established. " +
      "This particular target remains conceptual."
  },

  {
    name: "Mineral investigation",
    latitude: 18.42,
    longitude: 77.48,

    description:
      "Conceptual investigation of mineralogical evidence.",

    objective:
      "Investigate possible mineralogical indicators.",

    significance:
      "Mineral composition can help scientists understand " +
      "past geological and aqueous processes.",

    evidence:
      "This is an investigation objective, not a confirmed " +
      "mineral detection at these exact coordinates."
  }
];

let selectedScientificSite = null;
let missionDestination = null;

// ======================================================
// 8. SCIENTIFIC PANEL UPDATES
// ======================================================

function updateSciencePanel(site) {
  selectedScientificSite = site;

  setText("science-title", site.name);
  setText("science-description", site.description);
  setText("science-objective", site.objective);
  setText("science-significance", site.significance);
  setText("science-evidence", site.evidence);

  setText(
    "science-safety",
    "Terrain hazard classification is available. " +
    "Site-specific traversability has not yet been assessed."
  );

  const button =
    document.getElementById("select-destination");

  if (button) {
    button.disabled = false;
  }

  setStatus(
    `Scientific investigation selected: ${site.name}`
  );
}

// ======================================================
// 9. SCIENTIFIC MAP MARKERS
// ======================================================

sites.forEach(site => {
  const marker = L.circleMarker(
    marsToMap(site.latitude, site.longitude),
    {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff9633",
      fillOpacity: 0.9
    }
  );

  marker.bindPopup(
    `<strong>${site.name}</strong>` +
    `<p>${site.description}</p>` +
    "<small>Conceptual investigation target</small>"
  );

  marker.on("click", () => {
    updateSciencePanel(site);
  });

  marker.addTo(scientificSites);
});

// ======================================================
// 10. MISSION DESTINATION SELECTION
// ======================================================

const destinationButton =
  document.getElementById("select-destination");

if (destinationButton) {
  destinationButton.addEventListener("click", () => {
    if (!selectedScientificSite) {
      return;
    }

    missionDestination = selectedScientificSite;

    map.flyTo(
      marsToMap(
        missionDestination.latitude,
        missionDestination.longitude
      ),
      11
    );

    setStatus(
      `Mission destination selected: ${missionDestination.name}`
    );

    console.log(
      "Mission destination:",
      missionDestination
    );
  });
}

// ======================================================
// 11. LAYER CONTROL
// ======================================================

const layerControl = L.control.layers(
  {
    "MOLA Global Topography": mola
  },
  {
    "Jezero CTX Imagery": ctx,
    "CTX Coverage Boundary": coverageOutline
  },
  {
    collapsed: false,
    position: "topright"
  }
).addTo(map);

// ======================================================
// 12. REPROJECTED HAZARD OVERLAY
// ======================================================

let hazardLayer = null;
let hazardMetadata = null;

async function loadHazardOverlay() {
  try {
    const response = await fetch(
      "assets/jezero_hazards.json",
      { cache: "no-store" }
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
      throw new Error("Invalid hazard metadata bounds");
    }

    const [[south, west], [north, east]] = data.bounds;

    if (
      ![south, west, north, east].every(Number.isFinite) ||
      south >= north ||
      west >= east
    ) {
      throw new Error("Invalid geographic coordinates");
    }

    if (
      south < 15 ||
      north > 21 ||
      west < 75 ||
      east > 80
    ) {
      throw new Error(
        "Hazard raster is outside the Jezero region"
      );
    }

    hazardMetadata = data;

    hazardLayer = L.imageOverlay(
  `${data.image}?v=${Date.now()}`,
      marsBounds(south, west, north, east),
      {
        opacity: 0.85,
        interactive: false,
        alt: "Jezero terrain hazard classification"
      }
    );

    hazardLayer.on("load", () => {
      console.log("Hazard image loaded successfully");
    });

    hazardLayer.on("error", () => {
      console.error("Hazard image failed to load");

      setStatus(
        "Hazard image failed to load. Check browser console."
      );
    });

    layerControl.addOverlay(
      hazardLayer,
      "Jezero Terrain Hazards"
    );

    console.log(
      "Hazard metadata:",
      hazardMetadata
    );

    console.log(
      "Hazard geographic bounds:",
      data.bounds
    );

    setStatus(
      "Hazard classification ready. Enable it in Layers."
    );

  } catch (error) {
    console.error(
      "Hazard overlay error:",
      error
    );

    setStatus(
      "Hazard overlay unavailable. Check browser console."
    );
  }
}

loadHazardOverlay();

// ======================================================
// 13. USER CONTROLS
// ======================================================

if (sitesCheckbox) {
  sitesCheckbox.addEventListener("change", event => {
    if (event.target.checked) {
      map.addLayer(scientificSites);
    } else {
      map.removeLayer(scientificSites);
    }
  });

  if (!sitesCheckbox.checked) {
    map.removeLayer(scientificSites);
  }
}

if (objectiveSelect) {
  objectiveSelect.addEventListener("change", () => {
    setStatus(
      `Objective: ${objectiveSelect.selectedOptions[0].text}`
    );
  });
}

// ======================================================
// 14. MAP COORDINATE INSPECTION
// ======================================================

map.on("click", event => {
  const coordinates = mapToMars(event.latlng);

  L.popup()
    .setLatLng(event.latlng)
    .setContent(
      "<strong>Mars Coordinates</strong>" +
      `<p>Latitude: ${coordinates.latitude.toFixed(5)}°</p>` +
      `<p>Longitude: ${coordinates.longitude.toFixed(5)}°E</p>`
    )
    .openOn(map);
});

// ======================================================
// 15. HAZARD AND CTX LAYER EVENTS
// ======================================================

map.on("overlayadd", event => {
  if (event.layer === ctx) {
    setStatus("Jezero CTX imagery enabled");
  }

  if (event.layer === hazardLayer) {
    setStatus(
      "Terrain hazards enabled | Prototype classification"
    );
  }
});

map.on("overlayremove", event => {
  if (event.layer === ctx) {
    setStatus("MOLA topography active");
  }

  if (event.layer === hazardLayer) {
    setStatus("Terrain hazard overlay disabled");
  }
});

// ======================================================
// 16. TILE DIAGNOSTICS
// ======================================================

let molaLoaded = 0;
let ctxLoaded = 0;
let ctxErrors = 0;

mola.on("tileload", () => {
  molaLoaded++;

  if (!map.hasLayer(ctx)) {
    setStatus(
      `MOLA topography active | ${molaLoaded} tiles loaded`
    );
  }
});

ctx.on("tileload", () => {
  ctxLoaded++;

  if (
    !hazardLayer ||
    !map.hasLayer(hazardLayer)
  ) {
    setStatus(
      `CTX imagery active | ${ctxLoaded} tiles loaded`
    );
  }
});

ctx.on("tileerror", event => {
  ctxErrors++;

  console.error(
    "CTX tile failed:",
    event.tile?.src || event
  );

  setStatus(
    `CTX tile errors: ${ctxErrors}. Check browser console.`
  );
});

// ======================================================
// 17. INITIAL STATUS
// ======================================================

setStatus(
  "Jezero mission map ready. Loading hazard metadata..."
);


// ======================================================
// PHASE 7B: FIRST A* ROUTE VISUALISATION
// ======================================================

const routeLayer = L.layerGroup().addTo(map);

async function calculateAndDisplayRoute() {
  setStatus("Calculating terrain-aware route...");

  try {
    const response = await fetch(
      "http://127.0.0.1:8000/api/route",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          start: {
            latitude: 18.4,
            longitude: 77.5
          },
          destination: {
            latitude: 18.42,
            longitude: 77.48
          },
          mode: "safest"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Routing failed: HTTP ${response.status}`
      );
    }

    if (
      !Array.isArray(data.coordinates) ||
      data.coordinates.length < 2
    ) {
      throw new Error("No drawable route returned.");
    }

    routeLayer.clearLayers();

    const routePoints = data.coordinates.map(
      ([latitude, longitude]) =>
        marsToMap(latitude, longitude)
    );

    const routeLine = L.polyline(routePoints, {
      color: "#00e5ff",
      weight: 5,
      opacity: 0.95
    }).addTo(routeLayer);

    routeLine.bindPopup(
      `<strong>A* Safest Route</strong>` +
      `<p>Distance: ${data.distance_km} km</p>` +
      `<p>Terrain exposure: ${(
        data.class_2_fraction * 100
      ).toFixed(1)}%</p>`
    );

    map.fitBounds(routeLine.getBounds(), {
      padding: [60, 60],
      maxZoom: 12
    });

    setStatus(
      `Route calculated | ${data.distance_km} km`
    );

    console.log("A* route:", data);

  } catch (error) {
    console.error("Route calculation failed:", error);
    setStatus(`Routing error: ${error.message}`);
  }
}

// Temporary test button
const routeTestButton = document.createElement("button");

routeTestButton.textContent = "Calculate A* Test Route";
routeTestButton.style.cssText = `
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 16px;
  background: #087e91;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
`;

routeTestButton.addEventListener(
  "click",
  calculateAndDisplayRoute
);

const routeSidebar =
  document.querySelector(".sidebar") ||
  document.querySelector("aside");

if (routeSidebar) {
  routeSidebar.appendChild(routeTestButton);
}


console.log("MARS PATHFINDER");
console.log("Phase 6E: Scientific Investigation + Hazards");
console.log("MOLA URL:", MOLA_URL);
console.log("CTX URL:", CTX_URL);
console.log("CTX coverage:", ctxCoverage.toBBoxString());
