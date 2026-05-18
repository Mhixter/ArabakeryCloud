import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getToken } from "./lib/auth";
import { API_BASE } from "./lib/api";

setAuthTokenGetter(() => getToken());
setBaseUrl(API_BASE || null);

createRoot(document.getElementById("root")!).render(<App />);
