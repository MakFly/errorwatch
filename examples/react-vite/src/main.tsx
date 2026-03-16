import React from "react";
import ReactDOM from "react-dom/client";
import { init } from "@errorwatch/sdk";
import { createErrorBoundary } from "@errorwatch/sdk/react";
import App from "./App";

// Initialize ErrorWatch
init({
  dsn: import.meta.env.VITE_ERRORWATCH_DSN || "http://localhost:3333",
  apiKey: import.meta.env.VITE_ERRORWATCH_API_KEY || "ew_test_xxx",
  debug: true,
});

// Create ErrorBoundary with React
const ErrorBoundary = createErrorBoundary(React);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
