import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { createGlobalStyle } from "styled-components";
import { theme } from "./styles/theme";

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${theme.colors.bg}; margin: 0; padding: 0; }
  ::-webkit-scrollbar { height: 4px; background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; }
`;

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <GlobalStyle />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
