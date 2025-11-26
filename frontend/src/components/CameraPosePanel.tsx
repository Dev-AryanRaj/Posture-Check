import React, { useEffect, useRef, useState } from "react";

type AnalysisResponse = {
  pose_name: string;
  score: number;
  hints: string[];
  angles: Record<string, number>;
};

const API_BASE = "http://localhost:8000";

export const CameraPosePanel: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [poses, setPoses] = useState<string[]>([]);
  const [selectedPose, setSelectedPose] = useState<string>(""); // "" = none selected
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isSending, setIsSending] = useState(false);

  const isManualWithoutPose = mode === "manual" && !selectedPose;

  // --- fetch pose list ---
  useEffect(() => {
    fetch(`${API_BASE}/api/poses`)
      .then((r) => r.json())
      .then(setPoses)
      .catch(console.error);
  }, []);

  // --- setup camera ---
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.error("Camera error", e);
      }
    }
    setupCamera();
  }, []);

  // --- periodic frame sending ---
  useEffect(() => {
    const interval = setInterval(() => {
      sendFrame();
    }, 1200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedPose]);

  const sendFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Manual mode with no pose selected → clear analysis & do nothing
    if (mode === "manual" && !selectedPose) {
      if (analysis) setAnalysis(null);
      return;
    }

    if (isSending) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8)
    );
    if (!blob) return;

    const form = new FormData();
    form.append("image", blob, "frame.jpg");
    form.append("mode", mode);
    if (mode === "manual" && selectedPose) {
      form.append("pose_name", selectedPose);
    }

    try {
      setIsSending(true);
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        console.warn("Analysis error", await res.text());
        return;
      }
      const data: AnalysisResponse = await res.json();
      setAnalysis(data);
      if (mode === "auto" && !selectedPose) {
        setSelectedPose(data.pose_name);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  // simple inline styles so it works even without Tailwind
  const panelStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: 16,
    marginTop: 16,
  };

  const leftColStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const rightColStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* CAMERA (always visible, 16:9) */}
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          margin: "0 auto",
          borderRadius: 16,
          overflow: "hidden",
          background: "#000",
          position: "relative",
          aspectRatio: "16 / 9", // native CSS aspect-ratio, works without Tailwind
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            padding: "2px 8px",
            background: "rgba(0,0,0,0.6)",
            borderRadius: 999,
            color: "#fff",
            fontSize: 12,
          }}
        >
          {isSending ? "Analyzing..." : "Live"}
        </div>
      </div>

      {/* INFO PANELS BELOW CAMERA */}
      <div style={panelStyle}>
        {/* LEFT: mode, pose, hints */}
        <div style={leftColStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setMode("auto");
                  setAnalysis(null);
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #aaa",
                  background: mode === "auto" ? "#2563eb" : "#eee",
                  color: mode === "auto" ? "#fff" : "#222",
                  cursor: "pointer",
                }}
              >
                Auto Detect
              </button>
              <button
                onClick={() => {
                  setMode("manual");
                  setSelectedPose("");
                  setAnalysis(null);
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #aaa",
                  background: mode === "manual" ? "#2563eb" : "#eee",
                  color: mode === "manual" ? "#fff" : "#222",
                  cursor: "pointer",
                }}
              >
                Manual
              </button>
            </div>

            {mode === "manual" && (
              <select
                value={selectedPose}
                onChange={(e) => setSelectedPose(e.target.value)}
                style={{
                  minWidth: 140,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#fafafa",
                }}
              >
                <option value="">Choose pose</option>
                {poses.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p style={{ fontSize: 12, color: "#666" }}>
            Mode:{" "}
            <strong>
              {mode === "auto"
                ? "Auto Detect (system finds closest pose)"
                : selectedPose
                ? `Manual (${selectedPose})`
                : "Manual (select a pose to start)"}
            </strong>
          </p>

          {isManualWithoutPose ? (
            <div style={{ fontSize: 13, marginTop: 4 }}>
              <div style={{ color: "#b45309", fontWeight: 600 }}>
                Select a pose to begin
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>
                Choose a pose from the dropdown above. Live feedback will appear
                once a pose is selected.
              </div>
            </div>
          ) : (
            <>
              <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
                <div style={sectionTitle}>Pose</div>
                <div style={{ fontSize: 13 }}>
                  {analysis?.pose_name ??
                    (mode === "auto"
                      ? "Detecting..."
                      : selectedPose || "--")}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
                <div style={sectionTitle}>Score</div>
                <div
                  style={{
                    fontSize: 13,
                    color:
                      analysis && analysis.score < 10 ? "#16a34a" : "#b45309",
                    fontWeight: 600,
                  }}
                >
                  {analysis ? analysis.score.toFixed(1) : "--"}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
                <div style={sectionTitle}>Hints</div>
                <div
                  style={{
                    fontSize: 12,
                    maxHeight: 150,
                    overflowY: "auto",
                  }}
                >
                  {analysis?.hints && analysis.hints.length > 0 ? (
                    analysis.hints.map((h, idx) => (
                      <div key={idx} style={{ marginBottom: 4 }}>
                        {h}
                      </div>
                    ))
                  ) : (
                    <span style={{ color: "#777" }}>
                      No hints yet. Hold a pose in front of the camera.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: angles */}
        <div style={rightColStyle}>
          <div style={sectionTitle}>Live Angles</div>
          {isManualWithoutPose ? (
            <span style={{ fontSize: 12, color: "#777" }}>
              Select a pose in manual mode to see joint angles here.
            </span>
          ) : (
            <div
              style={{
                fontSize: 12,
                maxHeight: 200,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 4,
              }}
            >
              {analysis?.angles &&
                Object.entries(analysis.angles).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "2px 4px",
                      background: "#f4f4f5",
                      borderRadius: 4,
                    }}
                  >
                    <span>{k}</span>
                    <span>{Math.round(v)}</span>
                  </div>
                ))}
              {!analysis?.angles && (
                <span style={{ color: "#777" }}>No angle data yet.</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
