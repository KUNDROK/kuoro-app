import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "13px",
            borderRadius: "10px",
            border: "0.5px solid var(--border)",
            background: "var(--card)",
            color: "var(--foreground)",
          }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
