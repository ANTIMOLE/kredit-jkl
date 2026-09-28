import express from "express";
import { initDb } from "./db/database";

initDb();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("src/public"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server jalan di http://localhost:${port}`);
});