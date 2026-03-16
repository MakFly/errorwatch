import { useState } from "react";
import { captureException, captureMessage, addBreadcrumb } from "@errorwatch/sdk";
import { useErrorMonitoring } from "@errorwatch/sdk/react";

// A child component that can throw to demonstrate ErrorBoundary
function BrokenComponent() {
  throw new Error("Test error thrown by BrokenComponent");
}

export default function App() {
  const [throwError, setThrowError] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const { captureException: hookCaptureException } = useErrorMonitoring();

  function appendLog(message: string) {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  }

  function handleThrowBoundaryError() {
    setThrowError(true);
  }

  function handleCaptureException() {
    try {
      throw new Error("Manual test exception from captureException()");
    } catch (e) {
      captureException(e);
      appendLog("captureException() called — check ErrorWatch dashboard");
    }
  }

  function handleCaptureMessage() {
    captureMessage("Hello from ErrorWatch React example", { level: "info" });
    appendLog("captureMessage() called — check ErrorWatch dashboard");
  }

  function handleAddBreadcrumb() {
    addBreadcrumb({
      category: "ui",
      message: "User clicked the Add Breadcrumb button",
      level: "info",
    });
    appendLog("addBreadcrumb() called — breadcrumb added to next event");
  }

  function handleHookCapture() {
    hookCaptureException(new Error("Exception captured via useErrorMonitoring hook"));
    appendLog("useErrorMonitoring hook captureException() called");
  }

  if (throwError) {
    // Renders BrokenComponent — the ErrorBoundary in main.tsx will catch this
    return <BrokenComponent />;
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>ErrorWatch — React + Vite Example</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Use the buttons below to test SDK features. Open the ErrorWatch dashboard to see captured events.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={handleThrowBoundaryError}
          style={btnStyle("#e53e3e")}
        >
          Throw Error (caught by ErrorBoundary)
        </button>

        <button
          onClick={handleCaptureException}
          style={btnStyle("#dd6b20")}
        >
          captureException() — manual exception capture
        </button>

        <button
          onClick={handleCaptureMessage}
          style={btnStyle("#3182ce")}
        >
          captureMessage() — send info message
        </button>

        <button
          onClick={handleAddBreadcrumb}
          style={btnStyle("#38a169")}
        >
          addBreadcrumb() — add UI breadcrumb
        </button>

        <button
          onClick={handleHookCapture}
          style={btnStyle("#805ad5")}
        >
          useErrorMonitoring hook — captureException
        </button>
      </div>

      {log.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Activity log</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {log.map((entry, i) => (
              <li
                key={i}
                style={{
                  padding: "6px 10px",
                  background: i % 2 === 0 ? "#f7fafc" : "#fff",
                  borderLeft: "3px solid #3182ce",
                  marginBottom: 4,
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "10px 16px",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    textAlign: "left",
  };
}
