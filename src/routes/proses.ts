import { Router, Request } from "express";
import { randomInt } from "crypto";

import { db } from "../db/database";
import { buatNotif } from "../db/notifikasi";
import { requireAuth, requireGroup } from "./auth";
import {
  parseId,
  ambilDetailRow,
  cekAkses,
  ubahStatus
} from "./pengajuan";
import type { Row } from "./pengajuan";
import { AppError } from "../domain/errors";
import { pindahStatus } from "../domain/status";
import { DOKUMEN_WAJIB } from "../domain/validators";
import { infoSla } from "../domain/sla";

export const prosesRouter = Router();
prosesRouter.use(requireAuth);

export const notifRouter = Router();
notifRouter.use(requireAuth);
export const esignRouter = Router();

function notifGroup(
  namaGroup: string,
  idPengajuan: number,
  pesan: string
): void {
  const users = db.prepare(`
    SELECT u.iduser
    FROM master_user u
    JOIN master_group_user g
      ON g.idgroup = u.idgroup
    WHERE g.nama_group = ?
      AND u.is_active = 1
  `).all(namaGroup) as Row[];

  for (const user of users) {
    buatNotif(user.iduser, idPengajuan, pesan);
  }
}

function notifDealer(
  idDealer: number,
  idPengajuan: number,
  pesan: string
): void {
  const users = db.prepare(`
    SELECT iduser
    FROM master_user
    WHERE iddealer = ?
      AND is_active = 1
  `).all(idDealer) as Row[];

  for (const user of users) {
    buatNotif(user.iduser, idPengajuan, pesan);
  }
}


function cekCabangAtasan(
  idCabangAtasan: number,
  pengajuan: Row
): void {
  const marketing = db.prepare(`
    SELECT idcabang
    FROM master_user
    WHERE iduser = ?
  `).get(pengajuan.idmarketing) as Row | undefined;

  if (
    !marketing ||
    marketing.idcabang !== idCabangAtasan
  ) {
    throw new AppError(
      "Pengajuan ini bukan di cabang Anda",
      403
    );
  }
}


function cekKelengkapan(idPengajuan: number): string[] {
  const kurang: string[] = [];

  const dokumenYangAda = (
    db.prepare(`
      SELECT jenis
      FROM pengajuan_dokumen
      WHERE idpengajuan = ?
    `).all(idPengajuan) as Row[]
  ).map((dokumen) => dokumen.jenis);

  for (const jenis of DOKUMEN_WAJIB) {
    if (!dokumenYangAda.includes(jenis)) {
      kurang.push(`Dokumen ${jenis} belum ada`);
    }
  }

  const tandaTangan = db.prepare(`
    SELECT
      kd.jenis,
      t.pihak,
      t.signed_date
    FROM kontrak_dokumen kd
    LEFT JOIN tanda_tangan t
      ON t.idkontrak = kd.idkontrak
    WHERE kd.idpengajuan = ?
  `).all(idPengajuan) as Row[];

  for (const jenis of ["KONTRAK", "PO"]) {
    const dokumen = tandaTangan.find(
      (item) => item.jenis === jenis
    );

    if (!dokumen) {
      kurang.push(`${jenis} belum dibuat`);
    } else if (!dokumen.signed_date) {
      kurang.push(
        `${jenis} belum ditandatangani ${dokumen.pihak}`
      );
    }
  }

  return kurang;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]!)
  );
}

function formatRupiah(nilai: number) {
  return "Rp " + Number(nilai).toLocaleString("id-ID");
}

prosesRouter.get(
  "/antrian-approval",
  requireGroup("Atasan Marketing"),
  (req, res) => {
    const data = db.prepare(`
      SELECT
        p.idpengajuan,
        p.no_pengajuan,
        k.nama,
        p.merk,
        p.model,
        p.harga,
        p.angsuran_per_bulan,
        p.status,
        p.updated_date
      FROM pengajuan p
      JOIN konsumen k
        ON k.idkonsumen = p.idkonsumen
      JOIN master_user m
        ON m.iduser = p.idmarketing
      WHERE p.status = 'DIAJUKAN'
        AND m.idcabang = ?
      ORDER BY p.updated_date ASC
    `).all(req.user!.idcabang) as Row[];

    res.json(
      data.map((pengajuan) => ({
        ...pengajuan,
        sla: infoSla(
          pengajuan.status,
          pengajuan.updated_date
        )
      }))
    );
  }
);

function putuskan(
  req: Request,
  keputusan: "APPROVE" | "REJECT"
): Row {
  const id = parseId(req);
  const user = req.user!;
  const pengajuan = ambilDetailRow(id);

  cekCabangAtasan(
    user.idcabang,
    pengajuan
  );

  const alasan =
    typeof req.body?.alasan === "string"
      ? req.body.alasan.trim()
      : "";

  if (
    keputusan === "REJECT" &&
    alasan.length < 5
  ) {
    throw new AppError(
      "Alasan penolakan wajib diisi (minimal 5 karakter)",
      422
    );
  }

  const statusBaru = pindahStatus(
    pengajuan.status,
    keputusan === "APPROVE"
      ? "DISETUJUI"
      : "DITOLAK"
  );

  db.transaction(() => {
    ubahStatus(id, statusBaru);

    db.prepare(`
      INSERT INTO approval_log (
        idpengajuan,
        iduser,
        keputusan,
        alasan
      )
      VALUES (?, ?, ?, ?)
    `).run(
      id,
      user.iduser,
      keputusan,
      alasan || null
    );

    if (keputusan === "APPROVE") {
      buatNotif(
        pengajuan.idmarketing,
        id,
        `Pengajuan ${pengajuan.no_pengajuan} DISETUJUI`
      );

      notifGroup(
        "Admin Backoffice",
        id,
        `Pengajuan ${pengajuan.no_pengajuan} disetujui, siap dibuat kontrak dan PO`
      );
    } else {
      buatNotif(
        pengajuan.idmarketing,
        id,
        `Pengajuan ${pengajuan.no_pengajuan} DITOLAK: ${alasan}`
      );
    }
  })();

  return ambilDetailRow(id);
}

prosesRouter.post(
  "/:id/approve",
  requireGroup("Atasan Marketing"),
  (req, res) => {
    res.json(
      putuskan(req, "APPROVE")
    );
  }
);

prosesRouter.post(
  "/:id/reject",
  requireGroup("Atasan Marketing"),
  (req, res) => {
    res.json(
      putuskan(req, "REJECT")
    );
  }
);

prosesRouter.post(
  "/:id/dokumen-kontrak",
  requireGroup("Admin Backoffice"),
  (req, res) => {
    const id = parseId(req);
    const pengajuan = ambilDetailRow(id);

    const statusBaru = pindahStatus(
      pengajuan.status,
      "MENUNGGU_TTD"
    );

    const tahun = new Date().getFullYear();
    const nomorUrut = String(id).padStart(5, "0");

    const buatDokumen = db.prepare(`
      INSERT INTO kontrak_dokumen (
        idpengajuan,
        jenis,
        nomor_dokumen
      )
      VALUES (?, ?, ?)
    `);

    const buatTandaTangan = db.prepare(`
      INSERT INTO tanda_tangan (
        idkontrak,
        pihak,
        kode_otp
      )
      VALUES (?, ?, ?)
    `);

    const hasil = db.transaction(() => {
      const dokumen: Row[] = [];

      const daftarDokumen = [
        ["KONTRAK", "KONSUMEN", "KTR"],
        ["PO", "DEALER", "PO"]
      ] as const;

      for (const [
        jenis,
        pihak,
        prefix
      ] of daftarDokumen) {
        const nomorDokumen =
          `${prefix}/JKL/${tahun}/${nomorUrut}`;

        const otp = String(
          randomInt(100000, 1000000)
        );

        const result = buatDokumen.run(
          id,
          jenis,
          nomorDokumen
        );

        const idKontrak = Number(
          result.lastInsertRowid
        );

        buatTandaTangan.run(
          idKontrak,
          pihak,
          otp
        );

        dokumen.push({
          idkontrak: idKontrak,
          jenis,
          pihak,
          nomor_dokumen: nomorDokumen,
          link_esign: `/?esign=${idKontrak}`,
          otp_simulasi: otp
        });
      }

      ubahStatus(id, statusBaru);

      buatNotif(
        pengajuan.idmarketing,
        id,
        `Kontrak dan PO ${pengajuan.no_pengajuan} sudah dibuat, menunggu tanda tangan`
      );

      return dokumen;
    })();

    for (const dokumen of hasil) {
      const media =
        dokumen.pihak === "KONSUMEN"
          ? "SMS"
          : "EMAIL";

      console.log(
        `[SIMULASI ${media}] ${dokumen.pihak}: buka ${dokumen.link_esign}, OTP ${dokumen.otp_simulasi}`
      );
    }

    res.status(201).json(hasil);
  }
);

prosesRouter.get(
  "/:id/dokumen-kontrak",
  (req, res) => {
    const id = parseId(req);

    cekAkses(
      req.user!,
      ambilDetailRow(id)
    );

    const isAdmin =
      req.user!.nama_group === "Admin Backoffice";

    const dokumen = db.prepare(`
      SELECT
        kd.idkontrak,
        kd.jenis,
        kd.nomor_dokumen,
        t.pihak,
        t.signed_date,
        t.kode_otp
      FROM kontrak_dokumen kd
      JOIN tanda_tangan t
        ON t.idkontrak = kd.idkontrak
      WHERE kd.idpengajuan = ?
      ORDER BY kd.idkontrak
    `).all(id) as Row[];

    res.json(
      dokumen.map((item) => {
        const {
          kode_otp,
          ...data
        } = item;

        return {
          ...data,
          link_esign: `/?esign=${item.idkontrak}`,
          sudah_ttd: !!item.signed_date,
          ...(isAdmin && !item.signed_date
            ? { otp_simulasi: kode_otp }
            : {})
        };
      })
    );
  }
);

prosesRouter.get(
  "/:id/kontrak/:jenis",
  (req, res) => {
    const id = parseId(req);
    const jenis =
      String(req.params.jenis).toUpperCase();

    const pengajuan = ambilDetailRow(id);

    cekAkses(
      req.user!,
      pengajuan
    );

    const dokumen = db.prepare(`
      SELECT
        kd.nomor_dokumen,
        t.pihak,
        t.signed_date
      FROM kontrak_dokumen kd
      JOIN tanda_tangan t
        ON t.idkontrak = kd.idkontrak
      WHERE kd.idpengajuan = ?
        AND kd.jenis = ?
    `).get(
      id,
      jenis
    ) as Row | undefined;

    if (!dokumen) {
      throw new AppError(
        "Dokumen belum dibuat",
        404
      );
    }

    const judul =
      jenis === "PO"
        ? "PURCHASE ORDER"
        : "KONTRAK PEMBIAYAAN";

    const detail: [string, string][] = [
      [
        "Konsumen",
        `${pengajuan.nama} (NIK ${pengajuan.nik})`
      ],
      ["Dealer", pengajuan.nama_dealer],
      [
        "Kendaraan",
        `${pengajuan.merk} ${pengajuan.model} ${pengajuan.tipe} - ${pengajuan.warna}`
      ],
      ["Harga", formatRupiah(pengajuan.harga)],
      [
        "Down payment",
        formatRupiah(pengajuan.down_payment)
      ],
      ["Asuransi", pengajuan.asuransi],
      [
        "Lama kredit",
        `${pengajuan.tenor_bulan} bulan`
      ],
      [
        "Angsuran per bulan",
        formatRupiah(
          pengajuan.angsuran_per_bulan
        )
      ]
    ];

    const statusTandaTangan = dokumen.signed_date
      ? `Ditandatangani digital oleh ${dokumen.pihak} pada ${dokumen.signed_date} (UTC)`
      : `Menunggu tanda tangan ${dokumen.pihak}`;

    res.type("html").send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>
            ${escapeHtml(judul)}
            ${escapeHtml(dokumen.nomor_dokumen)}
          </title>

          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 720px;
              margin: 30px auto;
            }

            table {
              border-collapse: collapse;
              width: 100%;
            }

            td {
              padding: 7px;
              border-bottom: 1px solid #ddd;
            }

            td:first-child {
              width: 36%;
              color: #555;
            }
          </style>
        </head>

        <body>
          <h2>${escapeHtml(judul)}</h2>

          <p>
            No. ${escapeHtml(dokumen.nomor_dokumen)}
            |
            Pengajuan ${escapeHtml(
              pengajuan.no_pengajuan
            )}
          </p>

          <table>
            ${detail
              .map(
                ([label, nilai]) => `
                  <tr>
                    <td>${escapeHtml(label)}</td>
                    <td>${escapeHtml(nilai)}</td>
                  </tr>
                `
              )
              .join("")}
          </table>

          <p>
            <i>
              ${escapeHtml(statusTandaTangan)}
            </i>
          </p>
        </body>
      </html>
    `);
  }
);

prosesRouter.get(
  "/:id/kelengkapan",
  requireGroup("Admin Backoffice"),
  (req, res) => {
    const kurang = cekKelengkapan(
      parseId(req)
    );

    res.json({
      lengkap: kurang.length === 0,
      kurang
    });
  }
);

prosesRouter.post(
  "/:id/cairkan",
  requireGroup("Admin Backoffice"),
  (req, res) => {
    const id = parseId(req);
    const pengajuan = ambilDetailRow(id);

    const statusBaru = pindahStatus(
      pengajuan.status,
      "DICAIRKAN"
    );

    const dokumenKurang = cekKelengkapan(id);

    if (dokumenKurang.length > 0) {
      throw new AppError(
        "Dokumen belum lengkap, pencairan ditahan",
        422,
        dokumenKurang
      );
    }

    db.transaction(() => {
      ubahStatus(id, statusBaru);

      const pesan =
        `Dana pengajuan ${pengajuan.no_pengajuan} sudah dicairkan`;

      buatNotif(
        pengajuan.idmarketing,
        id,
        pesan
      );

      notifDealer(
        pengajuan.iddealer,
        id,
        pesan
      );
    })();

    res.json(
      ambilDetailRow(id)
    );
  }
);

notifRouter.get("/", (req, res) => {
  const notifikasi = db.prepare(`
    SELECT
      idnotif,
      idpengajuan,
      pesan,
      is_read,
      created_date
    FROM notifikasi
    WHERE iduser = ?
    ORDER BY idnotif DESC
    LIMIT 50
  `).all(req.user!.iduser);

  res.json(notifikasi);
});

notifRouter.post(
  "/:id/baca",
  (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(
        "ID tidak valid",
        400
      );
    }

    const result = db.prepare(`
      UPDATE notifikasi
      SET is_read = 1
      WHERE idnotif = ?
        AND iduser = ?
    `).run(
      id,
      req.user!.iduser
    );

    if (result.changes === 0) {
      throw new AppError(
        "Notifikasi tidak ditemukan",
        404
      );
    }

    res.json({ ok: true });
  }
);

const gagalOtp = new Map<number, number>();

function parseIdKontrak(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      "ID dokumen tidak valid",
      400
    );
  }

  return id;
}

function ambilTandaTangan(
  idKontrak: number
): Row {
  const data = db.prepare(`
    SELECT
      kd.idkontrak,
      kd.jenis,
      kd.nomor_dokumen,
      kd.idpengajuan,
      t.idttd,
      t.pihak,
      t.kode_otp,
      t.signed_date,
      p.status,
      p.no_pengajuan,
      p.idmarketing,
      p.iddealer,
      k.nama,
      d.nama_dealer
    FROM kontrak_dokumen kd
    JOIN tanda_tangan t
      ON t.idkontrak = kd.idkontrak
    JOIN pengajuan p
      ON p.idpengajuan = kd.idpengajuan
    JOIN konsumen k
      ON k.idkonsumen = p.idkonsumen
    JOIN master_dealer d
      ON d.iddealer = p.iddealer
    WHERE kd.idkontrak = ?
  `).get(idKontrak) as Row | undefined;

  if (!data) {
    throw new AppError(
      "Dokumen tidak ditemukan",
      404
    );
  }

  return data;
}


esignRouter.get(
  "/:idkontrak",
  (req, res) => {
    const data = ambilTandaTangan(
      parseIdKontrak(req.params.idkontrak)
    );

    res.json({
      jenis: data.jenis,
      nomor_dokumen: data.nomor_dokumen,
      no_pengajuan: data.no_pengajuan,
      pihak: data.pihak,
      penanda_tangan:
        data.pihak === "KONSUMEN"
          ? data.nama
          : data.nama_dealer,
      sudah_ttd: !!data.signed_date,
      dapat_ditandatangani:
        data.status === "MENUNGGU_TTD" &&
        !data.signed_date
    });
  }
);

esignRouter.post(
  "/:idkontrak",
  (req, res) => {
    const idKontrak = parseIdKontrak(
      req.params.idkontrak
    );

    const data =
      ambilTandaTangan(idKontrak);

    if (data.status !== "MENUNGGU_TTD") {
      throw new AppError(
        "Dokumen tidak dapat ditandatangani pada status ini",
        409
      );
    }

    if (data.signed_date) {
      throw new AppError(
        "Dokumen ini sudah ditandatangani",
        409
      );
    }

    const jumlahGagal =
      gagalOtp.get(idKontrak) ?? 0;

    if (jumlahGagal >= 5) {
      throw new AppError(
        "Terlalu banyak OTP salah, hubungi marketing",
        429
      );
    }

    const otp =
      String(req.body?.kode_otp ?? "").trim();

    if (otp !== data.kode_otp) {
      gagalOtp.set(
        idKontrak,
        jumlahGagal + 1
      );

      throw new AppError(
        "Kode OTP salah",
        403
      );
    }

    const semuaSudahTtd = db.transaction(() => {
      db.prepare(`
        UPDATE tanda_tangan
        SET signed_date = CURRENT_TIMESTAMP
        WHERE idttd = ?
      `).run(data.idttd);

      const hasil = db.prepare(`
        SELECT COUNT(*) AS belum
        FROM tanda_tangan t
        JOIN kontrak_dokumen kd
          ON kd.idkontrak = t.idkontrak
        WHERE kd.idpengajuan = ?
          AND t.signed_date IS NULL
      `).get(
        data.idpengajuan
      ) as { belum: number };

      if (hasil.belum > 0) {
        return false;
      }

      const statusBaru = pindahStatus(
        data.status,
        "TTD_LENGKAP"
      );

      ubahStatus(
        data.idpengajuan,
        statusBaru
      );

      const pesan =
        `Semua tanda tangan ${data.no_pengajuan} lengkap, siap dicairkan`;

      buatNotif(
        data.idmarketing,
        data.idpengajuan,
        pesan
      );

      notifGroup(
        "Admin Backoffice",
        data.idpengajuan,
        pesan
      );

      return true;
    })();

    res.json({
      pesan: "Berhasil ditandatangani",
      semua_ttd_lengkap: semuaSudahTtd
    });
  }
);