(function () {
  const mapId = "authority-map";
  let map = null;
  let markers = [];

  function el(id) {
    return document.getElementById(id);
  }

  function statusColor(status) {
    const value = String(status || "submitted");
    if (value === "completed") return "#22c55e";
    if (value === "approved") return "#2563eb";
    if (value === "working") return "#f59e0b";
    if (value === "cancelled") return "#ef4444";
    return "#ef4444";
  }

  function statusColorClass(status) {
    const value = String(status || "submitted");
    if (value === "completed") return "bg-success";
    if (value === "approved") return "bg-primary";
    if (value === "working") return "bg-warning text-dark";
    if (value === "cancelled") return "bg-danger";
    return "bg-danger";
  }

  function parseReports() {
    const node = el("authority-report-data");
    if (!node) return [];
    try {
      const data = JSON.parse(node.textContent || "[]");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  }

  function clearMarkers() {
    markers.forEach(function (marker) {
      if (map) map.removeLayer(marker);
    });
    markers = [];
  }

  function initMap() {
    const container = el(mapId);
    if (!container || !window.L || map) return;

    map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([20, 78], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const reports = parseReports();
    const bounds = [];
    clearMarkers();

    reports.forEach(function (rep) {
      const lat = Number(rep.latitude);
      const lng = Number(rep.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color: statusColor(rep.status),
        weight: 2,
        fillColor: statusColor(rep.status),
        fillOpacity: 0.9,
      }).bindPopup(
        "<strong>Case #" +
          String(rep.case_id) +
          "</strong><br/>" +
          String(rep.reporterName || "Reporter") +
          "<br/>" +
          String(rep.location || "") +
          "<br/><strong>Status:</strong> " +
          String(rep.status || "submitted")
      );
      marker.addTo(map);
      markers.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  function applyFilter() {
    const select = el("status-filter");
    const value = select ? select.value : "all";
    document.querySelectorAll("[data-status][data-case-id]").forEach(function (row) {
      const rowStatus = row.getAttribute("data-status");
      row.style.display = value === "all" || rowStatus === value ? "" : "none";
    });
  }

  async function saveStatus(caseId, status) {
    const response = await fetch("/api/reports/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        data: { caseId: Number(caseId), status: status },
      }),
    });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return response.json();
  }

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error("Upload failed");
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.filename) || !data.filename[0]) {
      throw new Error("Upload returned no file");
    }
    return data.filename[0];
  }

  async function sendProof(caseId, file) {
    const proofImageURL = await uploadFile(file);
    const response = await fetch("/api/reports/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        data: { caseId: Number(caseId), proofImageURL: proofImageURL },
      }),
    });
    if (!response.ok) {
      throw new Error("Proof save failed");
    }
    return response.json();
  }

  async function deleteReport(caseId) {
    const response = await fetch("/api/reports/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        data: { caseId: Number(caseId) },
      }),
    });
    if (!response.ok) {
      let message = "Delete failed";
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch (_err) {}
      throw new Error(message);
    }
    return response.json();
  }

  window.deleteAuthorityReport = function (button, caseId) {
    if (!button || !caseId) return;
    if (button.dataset && button.dataset.deleteHandled === "1") return;
    if (button.dataset) button.dataset.deleteHandled = "1";

    const ok = window.confirm("Delete this report permanently? This will remove the report, its comments, and any uploaded images.");
    if (!ok) {
      if (button.dataset) delete button.dataset.deleteHandled;
      return;
    }

    setBusy(button, true, "Deleting...");
    deleteReport(caseId)
      .then(function () {
        window.location.reload();
      })
      .catch(function (err) {
        alert(err && err.message ? err.message : "Could not delete report.");
      })
      .finally(function () {
        if (button.dataset) delete button.dataset.deleteHandled;
        setBusy(button, false);
      });
  };

  async function saveUser(userId, role, isActive) {
    const response = await fetch("/api/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        data: { userId: userId, role: role, isActive: Boolean(isActive) },
      }),
    });
    if (!response.ok) {
      throw new Error("User save failed");
    }
    return response.json();
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (button.tagName === "BUTTON") {
        button.dataset.originalText = button.textContent;
      }
      button.disabled = true;
      if (button.tagName === "BUTTON") {
        button.textContent = label || "Saving...";
      }
      return;
    }
    button.disabled = false;
    if (button.tagName === "BUTTON") {
      button.textContent = button.dataset.originalText || button.textContent;
    }
  }

  document.addEventListener("change", function (ev) {
    if (ev.target && ev.target.id === "status-filter") {
      applyFilter();
      return;
    }

    if (ev.target && ev.target.classList.contains("authority-status-select")) {
      const select = ev.target;
      const caseId = select.getAttribute("data-case-id");
      const row = select.closest("[data-status]");
      const oldStatus = row ? row.getAttribute("data-status") : "";
      setBusy(select, true, "Saving...");
      saveStatus(caseId, select.value)
        .then(function () {
          window.location.reload();
        })
        .catch(function () {
          if (select) select.value = oldStatus;
          alert("Could not update report status.");
        })
        .finally(function () {
          setBusy(select, false);
        });
    }

    if (ev.target && ev.target.classList.contains("user-role-select")) {
      const select = ev.target;
      const userId = select.getAttribute("data-user-id");
      const row = select.closest("[data-user-id]");
      const activeSwitch = row ? row.querySelector(".user-active-switch") : null;
      const wasRole = select.dataset.previousRole || select.value;
      const wasActive = activeSwitch ? activeSwitch.checked : true;
      select.dataset.previousRole = select.value;
      setBusy(select, true);
      if (activeSwitch) activeSwitch.disabled = true;
      saveUser(userId, select.value, wasActive)
        .then(function () {
          window.location.reload();
        })
        .catch(function () {
          select.value = wasRole;
          alert("Could not update user role.");
        })
        .finally(function () {
          setBusy(select, false);
          if (activeSwitch) activeSwitch.disabled = false;
        });
    }

    if (ev.target && ev.target.classList.contains("user-active-switch")) {
      const toggle = ev.target;
      const userId = toggle.getAttribute("data-user-id");
      const row = toggle.closest("[data-user-id]");
      const roleSelect = row ? row.querySelector(".user-role-select") : null;
      const wasActive = toggle.dataset.previousActive !== undefined ? toggle.dataset.previousActive === "true" : toggle.checked;
      const role = roleSelect ? roleSelect.value : "user";
      toggle.dataset.previousActive = String(toggle.checked);
      setBusy(toggle, true);
      if (roleSelect) roleSelect.disabled = true;
      saveUser(userId, role, toggle.checked)
        .then(function () {
          window.location.reload();
        })
        .catch(function () {
          toggle.checked = wasActive;
          alert("Could not update user status.");
        })
        .finally(function () {
          setBusy(toggle, false);
          if (roleSelect) roleSelect.disabled = false;
        });
    }
  });

  document.addEventListener("shown.bs.tab", function (ev) {
    if (ev.target && ev.target.id === "map-tab") {
      window.setTimeout(function () {
        if (map) {
          map.invalidateSize();
        } else {
          initMap();
        }
      }, 80);
    }
  });

  document.addEventListener("submit", function (ev) {
    const form = ev.target;
    if (!form.classList.contains("authority-proof-form")) return;
    ev.preventDefault();

    const caseId = form.getAttribute("data-case-id");
    const fileInput = form.querySelector(".authority-proof-input");
    const button = form.querySelector("button[type='submit']");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      alert("Choose a proof image first.");
      return;
    }

    setBusy(button, true, "Uploading...");
    sendProof(caseId, file)
      .then(function () {
        window.location.reload();
      })
      .catch(function (err) {
        alert(err && err.message ? err.message : "Could not upload proof.");
      })
      .finally(function () {
        setBusy(button, false);
    });
  });

  document.addEventListener("click", function (ev) {
    const button = ev.target && ev.target.closest ? ev.target.closest(".authority-delete") : null;
    if (!button) return;
    if (button.dataset && button.dataset.deleteHandled === "1") return;
    const caseId = button.getAttribute("data-case-id");
    window.deleteAuthorityReport(button, caseId);
  });

  document.addEventListener("DOMContentLoaded", function () {
    applyFilter();
  });
})();
