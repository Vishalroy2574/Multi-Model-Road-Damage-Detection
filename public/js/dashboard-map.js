(function () {
  function initMiniMap(container) {
    if (!container || !window.L) return;

    const lat = Number(container.dataset.lat);
    const lng = Number(container.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    if (container._leafletMap) {
      container._leafletMap.invalidateSize();
      return;
    }

    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([lat, lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.circleMarker([lat, lng], {
      radius: 9,
      color: "#dc3545",
      weight: 2,
      fillColor: "#dc3545",
      fillOpacity: 0.95,
    })
      .addTo(map)
      .bindPopup("Report location")
      .openPopup();

    container._leafletMap = map;
  }

  document.addEventListener("shown.bs.modal", function (event) {
    const modal = event.target;
    const container = modal.querySelector(".report-mini-map");
    if (!container) return;

    window.setTimeout(function () {
      initMiniMap(container);
    }, 50);
  });
})();
