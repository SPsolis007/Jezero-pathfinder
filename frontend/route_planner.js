"use strict";
/* JEZERO_WAYPOINT_PLANNER_V1
 * Uses the map and CRS helpers from script.js.
 * Separate layers prevent alteration of original Basecamp mission overlays.
 */
(() => {
  const root = document.getElementById("point-to-point-planner");
  if (!root) return;
  const byId = id => document.getElementById(id);
  const wpStartLayer = L.layerGroup().addTo(map);
  const wpEndLayer = L.layerGroup().addTo(map);
  const wpRouteLayer = L.layerGroup().addTo(map);
  layerControl.addOverlay(wpStartLayer, "Point-to-point start");
  layerControl.addOverlay(wpEndLayer, "Point-to-point destination");
  layerControl.addOverlay(wpRouteLayer, "Point-to-point routes");

  const locations = [
    {name: "Basecamp", latitude: BASE_CAMP.latitude, longitude: BASE_CAMP.longitude},
    ...sites.filter(s => s.routable && Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
  ];
  const siteByName = new Map(locations.map(p => [p.name, p]));
  let start = null;
  let end = null;
  let version = 0;
  let pickMode = null;
  let calculating = false;

  const selectStart = byId("wp-start-select");
  const selectEnd = byId("wp-end-select");
  for (const [select, label] of [
    [selectStart, "Select start point"],
    [selectEnd, "Select destination"]
  ]) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = label;
    select.appendChild(placeholder);
  }
  const choices = locations.map(p => ({value:p.name, label:p.name}));
  for (const select of [selectStart, selectEnd]) {
    for (const option of choices) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    }
  }
  selectStart.value = "";
  selectEnd.value = "";

  const fmt = v => Number(v).toFixed(3);
  function setMessage(message) {
    const target = byId("wp-results");
    target.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    target.appendChild(paragraph);
  }
  function resetRoutes() {
    version++;
    wpRouteLayer.clearLayers();
    byId("wp-results").replaceChildren();
  }
  function drawEndpoint(group, point, color, letter) {
    group.clearLayers();
    if (!point) return;
    L.circleMarker(marsToMap(point.latitude, point.longitude), {
      radius:9, weight:3, color:"#ffffff", fillColor:color, fillOpacity:1
    }).addTo(group).bindTooltip(`${letter}: ${point.name}`);
  }
  function sync() {
    byId("wp-start-readout").textContent = start
      ? `Start: ${start.name} (${start.latitude.toFixed(5)}°N, ${start.longitude.toFixed(5)}°E)`
      : "Start: not selected";
    byId("wp-end-readout").textContent = end
      ? `Destination: ${end.name} (${end.latitude.toFixed(5)}°N, ${end.longitude.toFixed(5)}°E)`
      : "Destination: not selected";
    drawEndpoint(wpStartLayer, start, "#ef4444", "START");
    drawEndpoint(wpEndLayer, end, "#ef4444", "END");
    byId("wp-calculate").disabled = !start || !end || calculating;
  }
  function assignPoint(which, point) {
    resetRoutes();
    if (which === "start") start = {...point};
    else end = {...point};
    const selector = which === "start" ? selectStart : selectEnd;
    selector.value = siteByName.has(point.name) ? point.name : "";
    sync();
  }
  selectStart.addEventListener("change", () => {
    if (siteByName.has(selectStart.value)) {
      assignPoint("start", siteByName.get(selectStart.value));
    } else {
      resetRoutes();
      start = null;
      sync();
    }
  });
  selectEnd.addEventListener("change", () => {
    if (siteByName.has(selectEnd.value)) {
      assignPoint("end", siteByName.get(selectEnd.value));
    } else {
      resetRoutes();
      end = null;
      sync();
    }
  });

  function setPickMode(mode) {
    if (mode) map.fire("measurementfinish");
    pickMode = pickMode === mode ? null : mode;
    byId("wp-pick-start").classList.toggle("wp-active", pickMode === "start");
    byId("wp-pick-end").classList.toggle("wp-active", pickMode === "end");
    map.getContainer().style.cursor = pickMode ? "crosshair" : "";
    if (pickMode) setMessage(`Click a traversable point on the map to set ${pickMode}.`);
  }
  byId("wp-pick-start").addEventListener("click", () => setPickMode("start"));
  byId("wp-pick-end").addEventListener("click", () => setPickMode("end"));
  map.on("measurementstart", () => {
    if (pickMode) setPickMode(null);
  });
 
const mapContainer = map.getContainer();

mapContainer.addEventListener("click", function (event) {
  if (!pickMode) return;

  if (event.target.closest(".leaflet-control, .leaflet-popup")) {
    return;
  }

  const position = map.mouseEventToLatLng(event);
  const coordinates = mapToMars(position);

  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude)
  ) {
    setMessage("Invalid coordinates. Try another location.");
    return;
  }

  const mode = pickMode;

  event.stopImmediatePropagation();
  setPickMode(null);
  map.closePopup();

  assignPoint(mode, {
    name: "Map point",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  });

  setMessage(
    `${mode === "start" ? "START" : "DESTINATION"} selected: ` +
    `${coordinates.latitude.toFixed(5)}°N, ` +
    `${coordinates.longitude.toFixed(5)}°E`
  );
}, true);


  const getValue = (id, min, max) => {
    const el = byId(id);
    if (el.value.trim() === "") throw new Error(`Enter a value for ${id}.`);
    const value = Number(el.value);
    if (!Number.isFinite(value) || value <= min || value > max)
      throw new Error(`Invalid ${id}: use a value above ${min} and up to ${max}.`);
    return value;
  };

  async function fetchPlan(mode, inputs) {
    const res = await fetch(`${API}/api/mission/point-to-point`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...inputs, mode})
    });
    const payload = await res.json();
    if (!res.ok) {
      const detail = payload?.detail;
      const reason = typeof detail === "string" ? detail : JSON.stringify(detail ?? payload);
      throw new Error(reason || `HTTP ${res.status}`);
    }
    if (!Array.isArray(payload?.route?.coordinates) || payload.route.coordinates.length < 2)
      throw new Error("Backend returned no drawable path.");
    return payload;
  }
  function addMetric(container, label, value) {
    const p = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    p.append(strong, document.createTextNode(String(value)));
    container.appendChild(p);
  }
  function displayPlan(data, mode) {
    const color = mode === "safest" ? "#00e5ff" : "#ffb347";
    L.polyline(data.route.coordinates.map(([latitude, longitude]) => marsToMap(latitude, longitude)), {
      color, weight:mode === "safest" ? 5 : 3, dashArray:mode === "shortest" ? "7,6" : null
    }).addTo(wpRouteLayer).bindPopup(`${mode.toUpperCase()} | ${data.route.distance_km} km`);
    const card = document.createElement("div");
    card.className = "wp-result";
    const header = document.createElement("strong");
    header.textContent = mode === "safest" ? "SAFER ROUTE" : "SHORTEST ROUTE";
    card.appendChild(header);
    addMetric(card, "Distance", `${fmt(data.mission.distance_km)} km`);
    addMetric(card, "Travel time", `${fmt(data.mission.travel_hours)} h`);
    addMetric(card, "Terrain-adjusted energy", `${fmt(data.mission.required_energy_kwh)} kWh`);
    addMetric(card, "Class 2 exposure", `${fmt(data.route.class_2_fraction * 100)}%`);
    addMetric(card, "Slope", `${fmt(data.terrain.mean_slope_deg)}°`);
    addMetric(card, "Remaining energy after reserve", `${fmt(data.mission.energy_margin_kwh)} kWh`);
    addMetric(card, "Remaining time after reserve", `${fmt(data.mission.time_margin_hours)} h`);
    const verdict = document.createElement("p");
    verdict.className = data.mission.within_modelled_budget ? "wp-pass" : "wp-fail";
    verdict.textContent = data.mission.assessment;
    card.appendChild(verdict);
    byId("wp-results").appendChild(card);
  }
  byId("wp-calculate").addEventListener("click", async () => {
    const button = byId("wp-calculate");
    if (!start || !end || calculating) return;
    const mine = ++version;
    wpRouteLayer.clearLayers();
    byId("wp-results").replaceChildren();
    try {
      if (!start || !end) throw new Error("Choose both start and destination.");
      if (start.latitude === end.latitude && start.longitude === end.longitude)
        throw new Error("Start and destination must be different.");
      const inputs = {
        start:{latitude:start.latitude, longitude:start.longitude},
        destination:{latitude:end.latitude, longitude:end.longitude},
        speed_kmh:getValue("wp-speed", 0, 20),
        energy_kwh_per_km:getValue("wp-energy-rate", 0, 50),
        available_energy_kwh:getValue("wp-energy-budget", 0, 1000),
        maximum_mission_hours:getValue("wp-time-budget", 0, 72),
        energy_reserve_fraction:0.25,
        time_reserve_fraction:0.20
      };
      calculating = true;
      button.disabled = true;
      button.textContent = "Calculating both routes...";
      setMessage("Evaluating hazard exposure, slope, ruggedness, time and energy...");
      const modes = ["safest", "shortest"];
      const results = await Promise.allSettled(modes.map(mode => fetchPlan(mode, inputs)));
      if (mine !== version) return;
      byId("wp-results").replaceChildren();
      results.forEach((item, index) => {
        if (item.status === "fulfilled") displayPlan(item.value, modes[index]);
        else {
          const msg = document.createElement("p");
          msg.className = "wp-error";
          msg.textContent = `${modes[index].toUpperCase()}: ${item.reason.message}`;
          byId("wp-results").appendChild(msg);
        }
      });
      const footnote = document.createElement("p");
      footnote.className = "small-text";
      footnote.textContent = "One-way prototype estimates only. Not a certified human or rover route. For Basecamp returns, use the Mission tab.";
      byId("wp-results").appendChild(footnote);
    } catch (err) {
      if (mine === version) setMessage(`Unable to calculate: ${err.message}`);
    } finally {
      calculating = false;
      sync();
      button.textContent = "Compare two-point A* routes";
    }
  });
  sync();
})();
