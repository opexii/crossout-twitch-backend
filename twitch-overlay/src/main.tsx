import React from "react";
import { createRoot } from "react-dom/client";
import { OverlayApp } from "../../app/overlay/OverlayApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <OverlayApp />
    </React.StrictMode>
  );
}
