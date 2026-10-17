import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import EmailVerificationAction from "./EmailVerificationAction";
import AppRecovery from "./AppRecovery";
import {ActivityOverlay} from './LoadingScreen';
import { installModuleRecovery } from "./module-recovery";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { migratePlannerStorage } from "./storage-migration";
try {
  migratePlannerStorage(localStorage);
} catch {
  /* Storage may be disabled. */
}
installModuleRecovery();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRecovery><div id="site-content">{window.location.pathname === '/verify-email' ? <EmailVerificationAction /> : <App />}</div><ActivityOverlay/></AppRecovery>
  </React.StrictMode>,
);
