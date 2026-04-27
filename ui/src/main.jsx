import React from "react";
import ReactDOM from "react-dom/client";
import { ApolloProvider } from "@apollo/client";

import App from "./app/App";
import { apolloClient } from "./app/apollo";
import "./shared/styles/styles.css";

async function waitForLayoutFonts() {
  if (!("fonts" in document)) {
    return;
  }

  const fontLoads = Promise.all([
    document.fonts.load('400 14px "JetBrains Mono"'),
    document.fonts.load('500 14px "JetBrains Mono"'),
    document.fonts.load('700 14px "JetBrains Mono"')
  ]);
  const timeout = new Promise((resolve) => window.setTimeout(resolve, 1500));

  await Promise.race([fontLoads, timeout]);
}

async function mountApp() {
  await waitForLayoutFonts();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ApolloProvider client={apolloClient}>
        <App />
      </ApolloProvider>
    </React.StrictMode>
  );
}

void mountApp();
