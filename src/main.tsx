import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { migratePlannerStorage } from "./storage-migration";
try {
  migratePlannerStorage(localStorage);
} catch {
  /* Storage may be disabled. */
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
