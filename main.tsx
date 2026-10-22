import { createRoot } from "react-dom/client";
import P34Atlas from "./app/p34-atlas";
import "./app/globals.css";
const root = document.getElementById("root");
if (!root) throw new Error("Missing simulator root element");
createRoot(root).render(<P34Atlas />);
