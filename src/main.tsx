import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useGame } from "./state/store";

// Console access to the save — handy for bug reports and local QA.
(window as unknown as { __fmStore?: typeof useGame }).__fmStore = useGame;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
