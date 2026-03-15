// ============================================================
// Neural Forge — src/main.tsx
// ============================================================

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Prevent right-click context menu in production Tauri window
if (typeof window !== "undefined" && "__TAURI__" in window) {
  document.addEventListener("contextmenu", e => e.preventDefault());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
