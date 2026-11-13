
"use strict";

// ==========================================
// MARS PATHFINDER
// Phase 3: Jezero Crater Mission Area
// ==========================================

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");

// NASA Mars Trek global equirectangular tiles:
// zoom 0 = 512 x 256 pixels
// longitude: -180 to +180 degrees
// latitude: +90 to -90 degrees

const BASE_WIDTH = 512;
const BASE_HEIGHT = 256;

function marsToMap(latitude, longitude) {
  const x = ((longitude + 180) / 360) * BASE_WIDTH;
  const y = ((90 - latitude) / 180) * BASE_HEIGHT;

  // Leaflet CRS.Simple uses negative y for image rows.
  return [-y, x];
}

function mapToMars(position) {
  const longitude = (position.lng / BASE_WIDTH) * 360 - 180;
  const latitude = 90 + (position.lat / BASE_HEIGHT) * 180;

  return { latitude, longitude };
}

// ------------------------------------------
// Initialise map
// ------------------------------------------

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 12,
  zoomControl: true,
  attributionControl: true
});

const NASA_TILE_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/" +
  "Mars_MGS_MOLA_ClrShade_merge_global_463m/" +
  "1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

const marsTiles = L.tileLayer(NASA_TILE_URL, {
  minZoom: 0,
  maxNativeZoom: 5,
  maxZoom: 12,
  tileSize: 256,
  noWrap: true,
  bounds: [[-256, 0], [0, 512]],
  attribution: "NASA Mars Trek | MGS MOLA"
}).addTo(map);

// ------------------------------------------
// Jezero Crater
// ------------------------------------------

const JEZERO = {
  name: "Jezero Crater",
  latitude: 18.4,
  longitude: 77.5
};

map.setView(
  marsToMap(JEZERO.latitude, JEZERO.longitude),
  6
);

// This marker identifies the approximate
// Jezero Crater study area, not a landing site.

const studyArea = L.circleMarker(
  marsToMap(JEZERO.latitude, JEZERO.longitude),
  {
    radius: 9,
    color: "#ffffff",
    weight: 2,
    fillColor: "#ff7b35",
    fillOpacity: 0.9
  }
).addTo(map);

studyArea.bindPopup(
  "<strong>Jezero Crater</strong>" +
  "<p>Mars Pathfinder study area</p>" +
  "<p>Approx. 18.4°N, 77.5°E</p>"
);

// ------------------------------------------
// Scientific objectives
// ------------------------------------------

const scientificSites = L.layerGroup().addTo(map);

// These are conceptual regional targets.
// They are NOT verified sampling locations.

const sampleSites = [
  {
    name: "Delta investigation",
    latitude: 18.45,
    longitude: 77.40,
    description:
      "Investigate sedimentary environments associated with the ancient delta."
  },
  {
    name: "Crater geology",
    latitude: 18.38,
    longitude: 77.55,
    description:
      "Investigate regional geological characteristics."
  },
  {
    name: "Mineral investigation",
    latitude: 18.42,
    longitude: 77.48,
    description:
      "Investigate candidate mineralogical evidence."
  }
];

sampleSites.forEach((site) => {
  L.circleMarker(
    marsToMap(site.latitude, site.longitude),
    {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#4da6ff",
      fillOpacity: 0.9
    }
  )
    .bindPopup(
      `<strong>${site.name}</strong>` +
      `<p>${site.description}</p>` +
      `<small>Conceptual target, not validated</small>`
    )
    .addTo(scientificSites);
});

// ------------------------------------------
// Layer controls
// ------------------------------------------

sitesCheckbox.addEventListener("change", (event) => {
  if (event.target.checked) {
    map.addLayer(scientificSites);
  } else {
    map.removeLayer(scientificSites);
  }
});

// ------------------------------------------
// Scientific objective selector
// ------------------------------------------

objectiveSelect.addEventListener("change", () => {
  statusElement.textContent =
    `Objective: ${objectiveSelect.selectedOptions[0].text}`;
});

// ------------------------------------------
// Display clicked Mars coordinates
// ------------------------------------------

map.on("click", (event) => {
  const coordinates = mapToMars(event.latlng);

  L.popup()
    .setLatLng(event.latlng)
    .setContent(
      `<strong>Mars coordinates</strong>` +
      `<p>Latitude: ${coordinates.latitude.toFixed(5)}°</p>` +
      `<p>Longitude: ${coordinates.longitude.toFixed(5)}°E</p>`
    )
    .openOn(map);
});

// ------------------------------------------
// Tile status
// ------------------------------------------

let successfulTiles = 0;

marsTiles.on("tileload", () => {
  successfulTiles++;
  statusElement.textContent =
    `Jezero study area | ${successfulTiles} tiles loaded`;
});

marsTiles.on("tileerror", (error) => {
  console.error("Tile error:", error);
  if (successfulTiles === 0) {
    statusElement.textContent =
      "Mars imagery unavailable. Check console.";
  }
});

statusElement.textContent =
  "Loading Jezero Crater study area...";

console.log("Mars Pathfinder: Jezero Crater mode");
