(function () {
  let pond = null;
  let reportMap = null;
  let reportMarker = null;
  let selectedPlace = null;
  let permissionPlace = null;
  let lastAnalysis = null;

  function el(id) {
    return document.getElementById(id);
  }

  function show(id, on) {
    const node = el(id);
    if (node) node.classList.toggle("d-none", !on);
  }

  function escAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setLocationStatus(message, kind) {
    const node = el("location-status");
    if (!node) return;
    node.className = "small mt-2 " + (kind === "error" ? "text-danger" : "text-secondary");
    node.textContent = message || "";
  }

  function updateReportMap(place) {
    if (!reportMap || !place || !place.latLng) return;

    const lat = Number(place.latLng.lat);
    const lng = Number(place.latLng.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (!reportMarker) {
      reportMarker = L.marker([lat, lng]).addTo(reportMap);
    } else {
      reportMarker.setLatLng([lat, lng]);
    }

    reportMap.setView([lat, lng], 16);
  }

  function setSelectedPlace(place, updateInput) {
    if (!place || !place.latLng) return;

    selectedPlace = place;
    if (updateInput !== false) {
      const input = el("loc-input");
      if (input) input.value = place.address || "";
    }
    setLocationStatus(place.address ? "Selected location: " + place.address : "Location selected.");
    updateReportMap(place);
  }

  function clearSelectedPlace() {
    selectedPlace = null;
    permissionPlace = null;
    const input = el("loc-input");
    if (input) input.value = "";
    setLocationStatus("Location cleared. Search again or use the map.");
    if (reportMap && reportMarker) {
      reportMap.removeLayer(reportMarker);
      reportMarker = null;
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return response.json();
  }

  async function geocodeAddress(query) {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
      encodeURIComponent(query);
    const rows = await fetchJson(url);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return {
      address: rows[0].display_name,
      latLng: {
        lat: Number(rows[0].lat),
        lng: Number(rows[0].lon),
      },
    };
  }

  async function reverseGeocode(lat, lng) {
    const url =
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lng);
    const data = await fetchJson(url);
    const address = data && data.display_name ? data.display_name : "";
    return {
      address: address || lat.toFixed(5) + ", " + lng.toFixed(5),
      latLng: { lat: Number(lat), lng: Number(lng) },
    };
  }

  function initReportMap() {
    if (!window.L || reportMap) return;
    const container = el("report-location-map");
    if (!container) return;

    reportMap = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([20, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(reportMap);

    reportMap.on("click", async function (event) {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      setSelectedPlace(
        {
          address: lat.toFixed(5) + ", " + lng.toFixed(5),
          latLng: { lat: lat, lng: lng },
        },
        true
      );
      try {
        const resolved = await reverseGeocode(lat, lng);
        setSelectedPlace(resolved, true);
      } catch (err) {
        setLocationStatus(
          "Map point selected. Reverse geocoding was unavailable, so the coordinate will be used.",
          "error"
        );
      }
    });
  }

  async function resolveSubmissionPlace() {
    if (selectedPlace && selectedPlace.latLng) {
      return selectedPlace;
    }

    const input = el("loc-input");
    const typed = input ? input.value.trim() : "";
    if (typed) {
      return geocodeAddress(typed).catch(function () {
        return null;
      });
    }

    if (permissionPlace && permissionPlace.latLng) {
      return permissionPlace;
    }

    return null;
  }

  function buildFormHtml(imageUrl, analysis) {
    const types = (analysis && analysis.damageTypes) || [];
    const analyzer = (analysis && analysis.analyzer) || "model";
    const severity = (analysis && analysis.severity) || "";
    const areaRatio =
      analysis && analysis.areaRatio != null ? Math.round(Number(analysis.areaRatio) * 100) : null;
    const analyzerLabels = {
      "gemini-vision": "Gemini vision",
      "openai-vision": "OpenAI vision",
      "local-cv-heuristic": "Local CV heuristic",
      demo: "Demo mode",
      fallback: "Fallback",
    };
    const analyzerLabel = analyzerLabels[analyzer] || analyzer.replace(/-/g, " ");
    const confidencePct =
      analysis && analysis.confidence != null ? Math.round(analysis.confidence * 100) : null;
    const confidenceTone =
      confidencePct == null ? "secondary" : confidencePct >= 75 ? "success" : confidencePct >= 50 ? "warning text-dark" : "danger";
    const confidenceBar = confidencePct == null ? "bg-secondary" : confidencePct >= 75 ? "bg-success" : confidencePct >= 50 ? "bg-warning" : "bg-danger";
    const typeBadges = types
      .map(function (t) {
        return '<span class="badge rounded-pill bg-info text-dark me-1 mb-1">' + escAttr(t) + "</span>";
      })
      .join("");
    const summaryText = analysis && analysis.description ? escAttr(analysis.description) : "No AI summary was returned for this image.";
    const primaryLabel = types.length
      ? types
          .map(function (t) {
            return String(t).replace(/_/g, " ");
          })
          .join(", ")
      : "road surface review";
    const confidenceLabel =
      confidencePct == null
        ? "Confidence unavailable"
        : confidencePct >= 75
        ? "High confidence"
        : confidencePct >= 50
        ? "Moderate confidence"
        : "Low confidence";
    const severityLabel = severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : "Unclassified";

    return (
      '<div class="surface-card overflow-hidden">' +
      '<div class="report-preview">' +
      '<img src="' +
      escAttr(imageUrl) +
      '" class="card-img-top report-preview__image" alt="Detected" />' +
      '<div class="report-preview__overlay">' +
      '<span class="badge bg-dark border border-light text-light">Inspection ready</span>' +
      '<span class="badge bg-primary">' +
      (confidencePct != null ? confidencePct + "% confidence" : "Confidence pending") +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="card-body p-4 p-md-5">' +
      '<div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">' +
      '<div>' +
      '<div class="section-label">AI inspection summary</div>' +
      "<h5 class=\"mb-1\">Detected " +
      escAttr(primaryLabel) +
      "</h5>" +
      '<p class="text-secondary mb-0">The system has prepared a report-ready draft you can review before submitting.</p>' +
      "</div>" +
      '<div class="text-md-end">' +
      '<div class="badge rounded-pill bg-' +
      confidenceTone +
      ' px-3 py-2">' +
      confidenceLabel +
      "</div>" +
      '<div class="small text-secondary mt-2">Source: ' +
      escAttr(analyzerLabel) +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="analysis-meter mb-3">' +
      '<div class="progress analysis-progress">' +
      '<div class="progress-bar ' +
      confidenceBar +
      '" role="progressbar" style="width: ' +
      (confidencePct != null ? confidencePct : 0) +
      '%" aria-valuenow="' +
      (confidencePct != null ? confidencePct : 0) +
      '" aria-valuemin="0" aria-valuemax="100"></div>' +
      "</div>" +
      "</div>" +
      '<div class="d-flex flex-wrap gap-2 mb-3">' +
      '<span class="badge bg-dark border border-secondary text-light">Severity: ' +
      escAttr(severityLabel) +
      "</span>" +
      '<span class="badge bg-dark border border-secondary text-light">Area: ' +
      (areaRatio != null ? areaRatio + "%" : "--") +
      "</span>" +
      "</div>" +
      (typeBadges
        ? '<div class="mb-3">' +
          '<div class="small text-secondary mb-2">Damage types</div>' +
          '<div>' +
          typeBadges +
          "</div></div>"
        : "") +
      '<div class="summary-note mb-3">' +
      "<strong>Model summary</strong><br />" +
      summaryText +
      "</div>" +
      '<div class="row g-3 align-items-start">' +
      '<div class="col-lg-7">' +
      '<label class="form-label">Location</label>' +
      '<div class="input-group">' +
      '<input type="text" id="loc-input" class="form-control bg-dark text-light border-secondary" placeholder="Search an address, landmark, or city" />' +
      '<button type="button" class="btn btn-outline-light" id="loc-search-btn">Search</button>' +
      "</div>" +
      '<div class="d-flex flex-wrap gap-2 mt-2">' +
      '<button type="button" class="btn btn-outline-primary btn-sm" id="use-current-location">Use current location</button>' +
      '<button type="button" class="btn btn-outline-secondary btn-sm" id="clear-location">Clear</button>' +
      "</div>" +
      '<div id="location-status" class="small text-secondary mt-2">Search a location, click the map, or use your current position.</div>' +
      '<div id="report-location-map" class="report-location-map rounded border border-secondary mt-3"></div>' +
      "</div>" +
      '<div class="col-lg-5">' +
      '<label class="form-label">Severity (1-10)</label>' +
      '<input type="range" id="sev-range" class="form-range" min="1" max="10" value="5" />' +
      '<div class="text-center mb-3"><span id="sev-label" class="badge bg-primary">5 / 10</span></div>' +
      '<label class="form-label">Your description</label>' +
      '<textarea id="desc-input" class="form-control bg-dark text-light border-secondary" rows="8"></textarea>' +
      '<div class="mt-3 d-grid gap-2">' +
      '<button type="button" class="btn btn-primary" id="submit-report">Submit report</button>' +
      '<a href="/dashboard" class="btn btn-outline-light">Cancel</a>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div id="form-alert" class="alert alert-warning mt-3 d-none" role="alert"></div>' +
      '<div id="done-msg" class="d-none mt-3">' +
      '<div class="alert alert-success mb-0">Complaint registered! View progress under <a href="/dashboard">All Reports</a>.</div>' +
      "</div>" +
      "</div></div>"
    );
  }

  function bindFormEvents(imageUrl) {
    const descTa = el("desc-input");
    if (descTa && lastAnalysis && lastAnalysis.description) {
      descTa.value = lastAnalysis.description;
    }

    initReportMap();
    if (permissionPlace && !selectedPlace) {
      setSelectedPlace(permissionPlace, true);
    } else if (selectedPlace) {
      updateReportMap(selectedPlace);
    }

    const input = el("loc-input");
    const searchBtn = el("loc-search-btn");
    const currentBtn = el("use-current-location");
    const clearBtn = el("clear-location");

    if (input) {
      input.addEventListener("input", function () {
        selectedPlace = null;
        if (reportMap && reportMarker) {
          reportMap.removeLayer(reportMarker);
          reportMarker = null;
        }
        setLocationStatus("Type a location and search, or click the map.");
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (searchBtn) searchBtn.click();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", async function () {
        const query = input ? input.value.trim() : "";
        if (!query) {
          setLocationStatus("Enter a location before searching.", "error");
          return;
        }
        setLocationStatus("Searching for location...");
        try {
          const place = await geocodeAddress(query);
          if (!place) {
            setLocationStatus("Could not find that location.", "error");
            return;
          }
          setSelectedPlace(place, true);
        } catch (err) {
          setLocationStatus("Location search failed. Try a simpler address.", "error");
        }
      });
    }

    if (currentBtn) {
      currentBtn.addEventListener("click", function () {
        if (!navigator.geolocation) {
          setLocationStatus("Geolocation is not supported by this browser.", "error");
          return;
        }
        setLocationStatus("Finding your current location...");
        navigator.geolocation.getCurrentPosition(
          async function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
              const place = await reverseGeocode(lat, lng);
              permissionPlace = place;
              setSelectedPlace(place, true);
            } catch (err) {
              const fallback = {
                address: lat.toFixed(5) + ", " + lng.toFixed(5),
                latLng: { lat: lat, lng: lng },
              };
              permissionPlace = fallback;
              setSelectedPlace(fallback, true);
              setLocationStatus(
                "Could not reverse geocode the current position, so the coordinates will be used.",
                "error"
              );
            }
          },
          function () {
            setLocationStatus("Unable to access your current location.", "error");
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", clearSelectedPlace);
    }

    const range = el("sev-range");
    const label = el("sev-label");
    if (range && label) {
      range.addEventListener("input", function () {
        label.textContent = range.value + " / 10";
      });
    }

    const submitBtn = el("submit-report");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        submitReport(imageUrl);
      });
    }
  }

  async function submitReport(imageUrl) {
    const submitBtn = el("submit-report");
    const desc = (el("desc-input") && el("desc-input").value.trim()) || "";
    const severityNode = el("sev-range");
    const severity = severityNode ? severityNode.value : "";

    if (!desc || !severity) {
      const alertNode = el("form-alert");
      if (alertNode) {
        alertNode.textContent = "Please fill location, severity, and description.";
        alertNode.classList.remove("d-none");
      }
      return;
    }

    const place = await resolveSubmissionPlace();
    if (!place || !place.latLng) {
      setLocationStatus("Please search for a location or use the map before submitting.", "error");
      return;
    }

    const analysis = lastAnalysis || {};
    fetch("/api/submit/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          description: desc,
          location: place.address || "",
          locationLatLng: {
            lat: Number(place.latLng.lat),
            lng: Number(place.latLng.lng),
          },
          imageURL: imageUrl,
          severity: Number(severity),
          damageTypes: analysis.damageTypes || [],
          aiDescription: analysis.description || "",
          analysisAnalyzer: analysis.analyzer || "",
          analysisLabel: analysis.label || "",
          analysisSeverity: analysis.severity || "",
          analysisAreaRatio: analysis.areaRatio,
          analysisConfidence: analysis.confidence,
        },
      }),
      credentials: "same-origin",
    })
      .then(function (response) {
        if (!response.ok) throw new Error("submit failed");
        return response.json();
      })
      .then(function (body) {
        const doneMsg = el("done-msg");
        if (doneMsg) {
          doneMsg.classList.remove("d-none");
          if (body.triage) {
            const extra = document.createElement("p");
            extra.className = "small text-secondary mb-0 mt-2";
            extra.textContent =
              "AI triage: priority " +
              body.triage.priorityScore +
              "/100 | " +
              body.triage.impactLevel +
              " impact | " +
              (body.triage.triageStatus === "resolved" ? "auto-resolved (low impact)" : "pending review");
            doneMsg.appendChild(extra);
          }
        }
        if (submitBtn) submitBtn.disabled = true;
      })
      .catch(function () {
        alert("Submit failed.");
      });
  }

  function setupPond() {
    FilePond.registerPlugin(
      FilePondPluginFileValidateType,
      FilePondPluginFileValidateSize,
      FilePondPluginImagePreview
    );

    pond = FilePond.create(el("pond"), {
      acceptedFileTypes: ["image/png", "image/jpeg", "image/jpg"],
      maxFileSize: "10MB",
      labelIdle: "Drag & drop or click to upload",
      server: {
        process: {
          url: "/api/upload",
          withCredentials: true,
          onload: function (response) {
            const json = JSON.parse(response);
            return json.filename[0];
          },
        },
      },
    });

    pond.on("processfile", function (error, file) {
      if (error) return;
      const imageUrl = file.serverId;
      show("step-choose", false);
      show("pond-wrap", false);
      runDetect(imageUrl);
    });
  }

  function runDetect(imageUrl) {
    show("detect-loading", true);
    fetch("/api/detect/single", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
      credentials: "same-origin",
    })
      .then(function (response) {
        return response.json().catch(function () {
          return null;
        });
      })
      .then(function (payload) {
        show("detect-loading", false);
        if (!payload || typeof payload.valid !== "boolean") {
          alert("Detection response not recognized.");
          return;
        }

        lastAnalysis = payload.analysis || null;

        const img = payload.imageUrl || imageUrl;
        if (payload.valid) {
          show("report-invalid", false);
          show("report-form", true);
          el("report-form").innerHTML = buildFormHtml(img, lastAnalysis);
          bindFormEvents(img);
        } else {
          show("report-form", false);
          show("report-invalid", true);
          const reason =
            (lastAnalysis && lastAnalysis.description) ||
            "This image does not show clear road damage suitable for a report.";
          el("report-invalid").innerHTML =
            '<div class="card border-secondary bg-secondary-subtle">' +
            '<img src="' +
            escAttr(img) +
            '" class="card-img-top" alt="" />' +
            '<div class="card-body"><h5>Image not accepted</h5>' +
            '<p class="text-secondary">' +
            escAttr(reason) +
            "</p>" +
            '<button type="button" class="btn btn-primary" id="retry-btn">Retry</button> ' +
            '<a href="/dashboard" class="btn btn-outline-light">All Reports</a></div></div>';
          const retryBtn = el("retry-btn");
          if (retryBtn) {
            retryBtn.addEventListener("click", function () {
              window.location.reload();
            });
          }
        }
      })
      .catch(function () {
        show("detect-loading", false);
        alert("Detection request failed.");
      });
  }

  function captureCurrentPosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    reverseGeocode(lat, lng)
      .then(function (place) {
        permissionPlace = place;
        if (!selectedPlace) {
          setSelectedPlace(place, true);
          setLocationStatus("Current location is ready. You can submit it or search another place.");
        }
      })
      .catch(function () {
        permissionPlace = {
          address: lat.toFixed(5) + ", " + lng.toFixed(5),
          latLng: { lat: lat, lng: lng },
        };
        if (!selectedPlace) {
          setSelectedPlace(permissionPlace, true);
        }
      });
  }

  function initCurrentLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(captureCurrentPosition, function () {}, {
      enableHighAccuracy: true,
      timeout: 8000,
    });
  }

  const uploadBtn = el("btn-upload");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", function () {
      show("step-choose", false);
      show("pond-wrap", true);
      if (!pond) setupPond();
    });
  }

  const cameraBtn = el("btn-camera");
  if (cameraBtn) {
    cameraBtn.addEventListener("click", function () {
      show("step-choose", false);
      show("camera-wrap", true);
      const video = el("cam-video");
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" }, audio: false })
        .then(function (stream) {
          video.srcObject = stream;
        })
        .catch(function () {
          alert("Camera not available.");
        });
    });
  }

  const camCloseBtn = el("cam-close");
  if (camCloseBtn) {
    camCloseBtn.addEventListener("click", function () {
      const video = el("cam-video");
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(function (track) {
          track.stop();
        });
      }
      show("camera-wrap", false);
      show("step-choose", true);
    });
  }

  const camCaptureBtn = el("cam-capture");
  if (camCaptureBtn) {
    camCaptureBtn.addEventListener("click", function () {
      const video = el("cam-video");
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob(function (blob) {
        if (!blob) return;
        show("camera-wrap", false);
        show("pond-wrap", true);
        if (!pond) setupPond();
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        pond.addFile(file);
      }, "image/jpeg");
    });
  }

  initCurrentLocation();
})();
