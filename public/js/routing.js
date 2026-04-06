(function () {
  const routeThresholdMeters = 80;

  let map = null;
  let routeLayer = null;
  let reportLayer = null;
  let endpointLayer = null;

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(message) {
    const node = el("route-stats");
    if (node) node.textContent = message || "";
  }

  function esc(text) {
    const node = document.createElement("div");
    node.textContent = String(text == null ? "" : text);
    return node.innerHTML;
  }

  async function fetchJson(url, options) {
    const requestOptions = options || {};
    requestOptions.headers = Object.assign(
      { Accept: "application/json" },
      requestOptions.headers || {}
    );
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return response.json();
  }

  async function geocodePlace(query) {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
      encodeURIComponent(query);
    const rows = await fetchJson(url);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return {
      address: rows[0].display_name,
      lat: Number(rows[0].lat),
      lng: Number(rows[0].lon),
    };
  }

  async function fetchRoute(origin, destination) {
    const url =
      "https://router.project-osrm.org/route/v1/driving/" +
      origin.lng +
      "," +
      origin.lat +
      ";" +
      destination.lng +
      "," +
      destination.lat +
      "?overview=full&geometries=geojson&steps=false";
    const data = await fetchJson(url);
    if (!data.routes || !data.routes.length) return null;
    return data.routes[0];
  }

  function initMap() {
    if (map || !window.L) return;
    const container = el("map-wrap");
    if (!container) return;

    map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    reportLayer = L.layerGroup().addTo(map);
    endpointLayer = L.layerGroup().addTo(map);
  }

  function toRad(value) {
    return (value * Math.PI) / 180;
  }

  function project(lat, lng, refLat) {
    const earthRadius = 6371000;
    const x = toRad(lng) * Math.cos(toRad(refLat)) * earthRadius;
    const y = toRad(lat) * earthRadius;
    return { x: x, y: y };
  }

  function distancePointToSegmentMeters(point, start, end) {
    const refLat = (point.lat + start.lat + end.lat) / 3;
    const p = project(point.lat, point.lng, refLat);
    const a = project(start.lat, start.lng, refLat);
    const b = project(end.lat, end.lng, refLat);

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const ab2 = abx * abx + aby * aby;
    if (!ab2) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    let t = (apx * abx + apy * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const closestX = a.x + abx * t;
    const closestY = a.y + aby * t;
    const dx = p.x - closestX;
    const dy = p.y - closestY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distancePointToPolylineMeters(point, coords) {
    if (!Array.isArray(coords) || coords.length < 2) return Infinity;
    let best = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const start = { lat: coords[i][1], lng: coords[i][0] };
      const end = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
      const distance = distancePointToSegmentMeters(point, start, end);
      if (distance < best) best = distance;
    }
    return best;
  }

  function severityColor(value) {
    const sev = parseInt(value, 10) || 0;
    if (sev <= 3) return "#22c55e";
    if (sev <= 6) return "#f59e0b";
    return "#ef4444";
  }

  function clearLayers() {
    if (routeLayer) routeLayer.clearLayers();
    if (reportLayer) reportLayer.clearLayers();
    if (endpointLayer) endpointLayer.clearLayers();
  }

  function popupHtml(rep) {
    const types =
      rep.damageTypes && rep.damageTypes.length ? rep.damageTypes.join(", ") : "-";
    return (
      '<div style="color:#111;min-width:220px">' +
      "<strong>Case #</strong> " +
      esc(rep.case_id) +
      "<br/><strong>Reported:</strong> " +
      esc(String(rep.created_date || "").split(" ")[0]) +
      "<br/><strong>Workflow:</strong> " +
      esc(rep.status || "-") +
      "<br/><strong>AI triage:</strong> " +
      esc(rep.triageStatus || "pending") +
      " | Pri " +
      esc(rep.priorityScore != null ? rep.priorityScore : "-") +
      "<br/><strong>Types:</strong> " +
      esc(types) +
      "<br/><strong>Severity:</strong> " +
      esc(rep.severity) +
      '/10<br/><img src="' +
      esc(rep.imageURL) +
      '" width="200" style="border-radius:8px;margin-top:6px" /></div>'
    );
  }

  function markerForReport(rep) {
    const lat = Number(rep.latitude);
    const lng = Number(rep.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return L.circleMarker([lat, lng], {
      radius: 8,
      color: severityColor(rep.severity),
      weight: 2,
      fillColor: severityColor(rep.severity),
      fillOpacity: 0.9,
    }).bindPopup(popupHtml(rep));
  }

  function endpointMarker(place, label, color) {
    return L.circleMarker([place.lat, place.lng], {
      radius: 9,
      color: color,
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    }).bindPopup(label);
  }

  async function loadReportsOnRoute(routeCoords) {
    const reports = await fetchJson("/api/reports/all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "same-origin",
    });

    const selected = [];
    reports.forEach(function (rep) {
      const lat = Number(rep.latitude);
      const lng = Number(rep.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const distance = distancePointToPolylineMeters({ lat: lat, lng: lng }, routeCoords);
      if (distance <= routeThresholdMeters) {
        selected.push(rep);
      }
    });

    selected.forEach(function (rep) {
      const marker = markerForReport(rep);
      if (marker) marker.addTo(reportLayer);
    });

    return selected;
  }

  async function buildRoute() {
    const srcValue = (el("src-input") && el("src-input").value.trim()) || "";
    const dstValue = (el("dst-input") && el("dst-input").value.trim()) || "";

    if (!srcValue || !dstValue) {
      setStatus("Enter both source and destination.");
      return;
    }

    initMap();
    clearLayers();
    setStatus("Searching locations...");

    try {
      const origin = await geocodePlace(srcValue);
      const destination = await geocodePlace(dstValue);

      if (!origin || !destination) {
        setStatus("Could not find one or both locations.");
        return;
      }

      const route = await fetchRoute(origin, destination);
      if (!route || !route.geometry || !route.geometry.coordinates) {
        setStatus("Could not get directions for that route.");
        return;
      }

      const routeCoords = route.geometry.coordinates;
      const selected = await loadReportsOnRoute(routeCoords);

      const routeLine = L.polyline(
        routeCoords.map(function (coord) {
          return [coord[1], coord[0]];
        }),
        {
          color: "#38bdf8",
          weight: 5,
          opacity: 0.9,
        }
      ).addTo(routeLayer);

      const startMarker = endpointMarker(origin, "Start", "#22c55e").addTo(endpointLayer);
      const endMarker = endpointMarker(destination, "Destination", "#8b5cf6").addTo(endpointLayer);

      const bounds = routeLine.getBounds();
      bounds.extend(startMarker.getLatLng());
      bounds.extend(endMarker.getLatLng());
      selected.forEach(function (rep) {
        const lat = Number(rep.latitude);
        const lng = Number(rep.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          bounds.extend([lat, lng]);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
      }

      const leg = route.legs && route.legs[0] ? route.legs[0] : null;
      const distanceText = leg && leg.distance ? leg.distance / 1000 : null;
      const durationText = leg && leg.duration ? Math.round(leg.duration / 60) : null;
      setStatus(
        "Potholes on route: " +
          selected.length +
          " | ETA " +
          (durationText != null ? durationText + " min" : "n/a") +
          " (" +
          (distanceText != null ? distanceText.toFixed(1) + " km" : "n/a") +
          ")"
      );
    } catch (err) {
      setStatus("Could not build the route. Please try again.");
    }
  }

  function bindEnterToSearch(inputId) {
    const input = el(inputId);
    if (!input) return;
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const button = el("route-btn");
        if (button) button.click();
      }
    });
  }

  const button = el("route-btn");
  if (button) {
    button.addEventListener("click", function () {
      buildRoute();
    });
  }

  bindEnterToSearch("src-input");
  bindEnterToSearch("dst-input");
  initMap();
})();
