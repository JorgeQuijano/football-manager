import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initPwa } from "./pwa";
import { useGame } from "./state/store";

// Console access to the save — handy for bug reports and local QA.
(window as unknown as { __fmStore?: typeof useGame }).__fmStore = useGame;
// Build stamp — lets you (and bug reports) tell exactly which deploy is running.
(window as unknown as { __fmVersion?: string }).__fmVersion = __APP_VERSION__;

initPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
