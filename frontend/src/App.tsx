import React from "react";
import { CameraPosePanel } from "./components/CameraPosePanel";

function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "24px 16px 40px",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: 8 }}>
          Yoga Pose Assistant
        </h1>
        <p style={{ color: "#555", marginBottom: 20 }}>
          Live posture feedback using your browser camera.
        </p>
        <CameraPosePanel />
      </div>
    </div>
  );
}

export default App;
