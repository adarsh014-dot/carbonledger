import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WalletProvider } from "./context/WalletContext";
import { RefreshProvider } from "./context/RefreshContext";
import { ToastProvider } from "./context/ToastContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WalletProvider>
      <RefreshProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </RefreshProvider>
    </WalletProvider>
  </React.StrictMode>
);
