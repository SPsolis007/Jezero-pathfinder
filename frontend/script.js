"use strict";

const statusElement = document.getElementById("status");
const objectiveSelect = document.getElementById("objective");
const sitesCheckbox = document.getElementById("show-sites");

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: 0,
  maxZoom: 5,
  zoomControl: true,
  attributionControl: true
});

const NASA_TILE_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/" +
  "Mars_MGS_MOLA_ClrShade_merge_global_463m/" +
  "1.0.0/default/default028mm/{z}/{y}/{x}.jpg";

const marsTiles = L.tileLayer(NASA_TILE_URL, {
  minZoom: 0,
  maxZoom: 5,
  tileSize: 256,
  noWrap: true,
  attribution: "NASA Mars Trek | MGS MOLA"
});

marsTiles.addTo(map);

map.setView([-128, 256], 0);

const scientificSites = L.layerGroup().addTo(map);

const sampleSites = [
  {
    name: "Candidate Site A",
    position: [-120, 230],
    description:
      "Illustrative sedimentary investigation target"
  },
  {
    name: "Candidate Site B",
    position: [-140, 280],
    description:
      "Illustrative geological boundary target"
  },
  {
    name: "Candidate Site C",
    position: [-100, 310],
    description:
      "Illustrative mineral investigation target"
  }
];

sampleSites.forEach((site) => {
  L.marker(site.position)
    .bindPopup(
      `<strong>${site.name}</strong>` +
      `<p>${site.description}</p>` +
      `<small>Demonstration location only</small>`
    )
    .addTo(scientificSites);
});

sitesCheckbox.addEventListener("change", (event) => {
  if (event.target.checked) {
    map.addLayer(scientificSites);
  } else {
    map.removeLayer(scientificSites);
  }
});

objectiveSelect.addEventListener("change", (event) => {
  const selected =
    event.target.options[event.target.selectedIndex];

  statusElement.textContent =
    `Scientific objective selected: ${selected.text}`;
});

let loadedTileCount = 0;
let failedTileCount = 0;

marsTiles.on("tileload", () => {
  loadedTileCount++;

  statusElement.textContent =
    `NASA Mars imagery loaded (${loadedTileCount} tiles)`;
});

marsTiles.on("tileerror", (error) => {
  failedTileCount++;

  console.error(
    "Mars tile failed:",
    error.tile ? error.tile.src : error
  );

  if (loadedTileCount === 0) {
    statusElement.textContent =
      `Mars imagery unavailable (${failedTileCount} tile errors). ` +
      "Check the browser console.";
  }
});

marsTiles.on("load", () => {
  if (loadedTileCount > 0) {
    statusElement.textContent =
      "NASA Mars topographic tiles loaded successfully";
  } else {
    statusElement.textContent =
      "No Mars imagery loaded. Check the tile endpoint.";
  }
});

statusElement.textContent =
  "Connecting to NASA Mars Trek...";

console.log("Mars Pathfinder frontend initialised");
console.log("Mars imagery source:", NASA_TILE_URL);
console.log(
  "Note: Scientific site positions are illustrative."
);
