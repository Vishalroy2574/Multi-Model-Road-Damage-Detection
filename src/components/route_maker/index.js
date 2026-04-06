import React from "react";
import axios from "axios";
import { Card, CardContent, Chip, Typography } from "@material-ui/core";
import {
  GET_ALL_REPORTS,
  ROUTE_ICON_IMAGE_HIGH,
  ROUTE_ICON_IMAGE_MEDIUM,
  ROUTE_ICON_IMAGE_LOW,
} from "./../../utility/constants.js";

function toRad(d) {
  return (d * Math.PI) / 180;
}

function project(lat, lng, refLat) {
  const earthRadius = 6371000;
  const x = toRad(lng) * Math.cos(toRad(refLat)) * earthRadius;
  const y = toRad(lat) * earthRadius;
  return { x, y };
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

function severityIcon(severity) {
  const n = parseInt(severity, 10) || 0;
  if (n <= 3) return ROUTE_ICON_IMAGE_LOW;
  if (n <= 6) return ROUTE_ICON_IMAGE_MEDIUM;
  return ROUTE_ICON_IMAGE_HIGH;
}

export default function RouteMaker(props) {
  const [routeInfo, setRouteInfo] = React.useState(null);
  const [selectedReports, setSelectedReports] = React.useState([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function loadRoute() {
      const startLat = parseFloat(props.startLat);
      const startLng = parseFloat(props.startLng);
      const endLat = parseFloat(props.endLat);
      const endLng = parseFloat(props.endLng);

      if (
        Number.isNaN(startLat) ||
        Number.isNaN(startLng) ||
        Number.isNaN(endLat) ||
        Number.isNaN(endLng)
      ) {
        setRouteInfo(null);
        setSelectedReports([]);
        return;
      }

      try {
        const routeResponse = await axios.get(
          "https://router.project-osrm.org/route/v1/driving/" +
            startLng +
            "," +
            startLat +
            ";" +
            endLng +
            "," +
            endLat +
            "?overview=full&geometries=geojson&steps=false"
        );
        const route = routeResponse.data.routes && routeResponse.data.routes[0];
        if (!route || !route.geometry || !route.geometry.coordinates) {
          throw new Error("Route unavailable");
        }

        const reportsResponse = await axios.post(GET_ALL_REPORTS);
        const routeCoords = route.geometry.coordinates;
        const filtered = (reportsResponse.data || []).filter((item) => {
          const lat = parseFloat(item.latitude);
          const lng = parseFloat(item.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
          return distancePointToPolylineMeters({ lat, lng }, routeCoords) <= 80;
        });

        if (!active) return;

        setRouteInfo(route);
        setSelectedReports(filtered);
        setError("");
        props.manageCounts(
          filtered.length,
          route.legs[0].duration.text + " (" + route.legs[0].distance.text + ")",
          7
        );
      } catch (err) {
        if (!active) return;
        setError("Route preview is unavailable right now.");
        setRouteInfo(null);
        setSelectedReports([]);
      }
    }

    loadRoute();
    return () => {
      active = false;
    };
  }, [props.startLat, props.startLng, props.endLat, props.endLng]);

  const startLat = parseFloat(props.startLat);
  const startLng = parseFloat(props.startLng);
  const endLat = parseFloat(props.endLat);
  const endLng = parseFloat(props.endLng);

  const routeUrl =
    "https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=" +
    startLat +
    "%2C" +
    startLng +
    "%3B" +
    endLat +
    "%2C" +
    endLng;

  return (
    <Card style={{ marginTop: "15px", border: "2px SOLID white" }}>
      <CardContent>
        <Typography gutterBottom variant="h5" component="h2">
          Route Preview
        </Typography>
        {error ? (
          <Typography variant="body2" color="textSecondary" component="p">
            {error}
          </Typography>
        ) : (
          <React.Fragment>
            <Typography variant="body2" color="textSecondary" component="p">
              OpenStreetMap routing is used here instead of the old map service.
            </Typography>
            <Typography variant="body2" color="textSecondary" component="p">
              Source: {props.startAddress || "Selected source"}
              <br />
              Destination: {props.endAddress || "Selected destination"}
            </Typography>
            <div style={{ margin: "15px 0" }}>
              <Chip
                label={
                  routeInfo && routeInfo.legs && routeInfo.legs[0]
                    ? routeInfo.legs[0].duration.text +
                      " (" +
                      routeInfo.legs[0].distance.text +
                      ")"
                    : "Loading route..."
                }
                color="primary"
                style={{ marginRight: "10px" }}
              />
              <Chip label={selectedReports.length + " potholes on route"} />
            </div>
            <a href={routeUrl} target="_blank" rel="noreferrer">
              Open route in OpenStreetMap
            </a>
            <div style={{ marginTop: "15px" }}>
              {selectedReports.map((report, index) => (
                <Card
                  key={index}
                  style={{
                    marginBottom: "12px",
                    backgroundColor: "#222",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle1">
                      Case #{report.case_id} | Severity {report.severity}/10
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {report.location}
                    </Typography>
                    <div style={{ marginTop: "8px" }}>
                      <img
                        src={severityIcon(report.severity)}
                        alt="Severity icon"
                        width="36"
                        height="36"
                      />
                      <span style={{ marginLeft: "10px" }}>
                        {report.triageStatus || "pending"} | Priority{" "}
                        {report.priorityScore != null ? report.priorityScore : "-"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </React.Fragment>
        )}
      </CardContent>
    </Card>
  );
}
