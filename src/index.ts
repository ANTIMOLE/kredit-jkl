// import express from "express";
// import { initDb } from "./db/database";

// initDb();

// const app = express();
// const port = 3000;

// app.use(express.json());
// app.use(express.static("src/public"));

// app.get("/health", (_req, res) => {
//   res.json({ status: "ok" });
// });

// app.listen(port, () => {
//   console.log(`Server jalan di http://localhost:${port}`);
// });


// import express, { NextFunction, Request, Response } from "express";
// import { initDb } from "./db/database";
// import { authRouter } from "./routes/auth";
// import { pengajuanRouter } from "./routes/pengajuan";
// import { AppError } from "./domain/errors";

// initDb();

// const app = express();
// app.use(express.json());
// app.use(express.static("src/public"));

// app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
// app.use("/api/auth", authRouter);
// app.use("/api/pengajuan", pengajuanRouter);

// app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
//   if (err instanceof AppError) {
//     res.status(err.statusCode).json({ error: err.message, detail: err.detail });
//     return;
//   }
//   if (err?.type === "entity.parse.failed") {
//     res.status(400).json({ error: "JSON tidak valid" });
//     return;
//   }
//   console.error(err);
//   res.status(500).json({ error: "Kesalahan server" });
// });

// app.listen(3000, () => console.log("server jalan di http://localhost:3000"));


import express, {
  NextFunction,
  Request,
  Response
} from "express";

import { initDb } from "./db/database";
import { authRouter } from "./routes/auth";
import { pengajuanRouter } from "./routes/pengajuan";
import {
  prosesRouter,
  esignRouter,
  notifRouter
} from "./routes/proses";
import { AppError } from "./domain/errors";

initDb();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("src/public"));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/esign", esignRouter);
app.use("/api/notifikasi", notifRouter);

// prosesRouter dipasang lebih dulu supaya route seperti
// /antrian-approval tidak dianggap sebagai parameter :id
app.use("/api/pengajuan", prosesRouter);
app.use("/api/pengajuan", pengajuanRouter);

// Penanganan error
app.use(
  (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.message,
        detail: err.detail
      });
      return;
    }

    if (err?.type === "entity.parse.failed") {
      res.status(400).json({
        error: "JSON tidak valid"
      });
      return;
    }

    console.error(err);

    res.status(500).json({
      error: "Kesalahan server"
    });
  }
);

app.listen(port, () => {
  console.log(
    `Server jalan di http://localhost:${port}`
  );
});