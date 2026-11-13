
"use strict";

// ==========================================
// MARS PATHFINDER
// Phase 4: Jezero Imagery and Layer Controls
// ==========================================

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");

const BASE_WIDTH = 512;
const BASE_HEIGHT = 256;

// Mars geographic coordinates -> Leaflet display grid.
// Assumes the global equirectangular tile grid
// uses 512 x 256 pixels at zoom level 0.
function marsToMap(latitude, longitude) {
  const x = ((longitude + 180) / 360) * BASE_WIDTH;
  const y = ((90 - latitude) / 180) * BASE_HEIGHT;
  return [-y, x];
}

function mapToMars(position) {
  return {
    latitude: 90 + (position.lat / BASE_HEIGHT) * 180,
    longitude: (position.lng / BASE_WIDTH) * 360 - 180
  };
}

function marsBounds(south, west, north, east) {
  return L.latLngBounds(
    marsToMap(south, west),
    marsToMap(north, east)
  );
}

// ==========================================
// 1. MAP
// ==========================================

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 13,
  zoomControl: true
});

// ==========================================
// 2. DATA SOURCES
// ==========================================

const MOLA_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/" +
  "Mars_MGS_MOLA_ClrShade_merge_global_463m/" +
  "1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

// NASA Mars Trek catalogue layer ID:
// JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0
//
// This REST template is a candidate endpoint.
// Tile availability and matrix compatibility
// must be checked in the browser.

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
});

// ==========================================
// 3. JEZERO STUDY AREA
// ==========================================

const JEZERO = {
  latitude: 18.4,
  longitude: 77.5
};

map.setView(
  marsToMap(JEZERO.latitude, JEZERO.longitude),
  9
);

// CTX coverage boundary
const coverageOutline = L.rectangle(ctxCoverage, {
  color: "#00e5ff",
  weight: 2,
  fillOpacity: 0,
  dashArray: "6, 6"
}).addTo(map);

coverageOutline.bindPopup(
  "<strong>Jezero CTX mosaic coverage</strong>" +
  "<p>NASA Mars Trek catalogue footprint</p>" +
  "<p>This boundary does not represent a hazard.</p>"
);

// ==========================================
// 4. SCIENTIFIC SITES
// ==========================================

const scientificSites = L.layerGroup().addTo(map);

const sites = [
  {
    name: "Delta investigation",
    latitude: 18.45,
    longitude: 77.40,
    description:
      "Conceptual investigation of ancient delta sediments."
  },
  {
    name: "Crater geology",
    latitude: 18.38,
    longitude: 77.55,
    description:
      "Conceptual investigation of crater-floor geology."
  },
  {
    name: "Mineral investigation",
    latitude: 18.42,
    longitude: 77.48,
    description:
      "Conceptual investigation of mineralogical evidence."
  }
];

sites.forEach(site => {
  L.circleMarker(
    marsToMap(site.latitude, site.longitude),
    {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff9633",
      fillOpacity: 0.9
    }
  )
    .bindPopup(
      `<strong>${site.name}</strong>` +
      `<p>${site.description}</p>` +
      `<small>Conceptual target, not a validated sampling site.</small>`
    )
    .addTo(scientificSites);
});

// ==========================================
// 5. LAYER SWITCHER
// ==========================================

const baseLayers = {
  "MOLA Global Topography": mola
};

const overlays = {
  "Jezero CTX Imagery (experimental)": ctx,
  "CTX Coverage Boundary": coverageOutline
};

L.control.layers(baseLayers, overlays, {
  collapsed: false,
  position: "topright"
}).addTo(map);

// ==========================================
// 6. USER CONTROLS
// ==========================================

sitesCheckbox.addEventListener("change", event => {
  if (event.target.checked) {
    map.addLayer(scientificSites);
  } else {
    map.removeLayer(scientificSites);
  }
});

objectiveSelect.addEventListener("change", () => {
  statusElement.textContent =
    `Objective: ${objectiveSelect.selectedOptions[0].text}`;
});

map.on("click", event => {
  const coordinates = mapToMars(event.latlng);

  L.popup()
    .setLatLng(event.latlng)
    .setContent(
      "<strong>Mars coordinates</strong>" +
      `<p>Latitude: ${coordinates.latitude.toFixed(5)}°</p>` +
      `<p>Longitude: ${coordinates.longitude.toFixed(5)}°E</p>`
    )
    .openOn(map);
});

// ==========================================
// 7. TILE STATUS AND DIAGNOSTICS
// ==========================================

let molaLoaded = 0;
let ctxLoaded = 0;
let ctxErrors = 0;

mola.on("tileload", () => {
  molaLoaded++;
  if (!map.hasLayer(ctx)) {
    statusElement.textContent =
      `MOLA topography active | ${molaLoaded} tiles loaded`;
  }
});

ctx.on("tileload", () => {
  ctxLoaded++;
  statusElement.textContent =
    `CTX imagery active | ${ctxLoaded} tiles loaded`;
});

ctx.on("tileerror", event => {
  ctxErrors++;

  console.error(
    "CTX tile failed:",
    event.tile?.src || event
  );

  statusElement.textContent =
    `CTX tile errors: ${ctxErrors}. Check Safari Console.`;
});

map.on("overlayadd", event => {
  if (event.layer === ctx) {
    statusElement.textContent =
      "Loading Jezero CTX imagery...";
  }
});

map.on("overlayremove", event => {
  if (event.layer === ctx) {
    statusElement.textContent =
      "MOLA topography active";
  }
});

statusElement.textContent =
  "Jezero map ready. Select CTX imagery in the layer panel.";

console.log("Mars Pathfinder: Phase 4");
console.log("MOLA URL:", MOLA_URL);
console.log("CTX URL:", CTX_URL);
console.log("CTX coverage:", ctxCoverage.toBBoxString());
