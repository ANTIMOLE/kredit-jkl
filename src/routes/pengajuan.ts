import { Router, Request } from "express";
import { db } from "../db/database";
import { buatNotif } from "../db/notifikasi";
import { requireAuth, requireGroup, AuthUser } from "./auth";
import { AppError } from "../domain/errors";
import { hitungAngsuran } from "../domain/angsuran";
import { pindahStatus, Status } from "../domain/status";
import {
  validatePengajuan,
  DOKUMEN_WAJIB
} from "../domain/validators";

export const pengajuanRouter = Router();

pengajuanRouter.use(requireAuth);

export type Row = Record<string, any>;

const BISA_EDIT: Status[] = [
  "MENUNGGU_MARKETING",
  "DITOLAK"
];

export function parseId(req: Request): number {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("ID tidak valid", 400);
  }

  return id;
}

export function ambilDetailRow(id: number): Row {
  const pengajuan = db.prepare(`
    SELECT
      p.*,
      k.nama,
      k.nik,
      k.tanggal_lahir,
      k.status_perkawinan,
      k.no_telepon,
      k.nama_pasangan,
      k.nik_pasangan,
      d.nama_dealer
    FROM pengajuan p
    JOIN konsumen k
      ON k.idkonsumen = p.idkonsumen
    JOIN master_dealer d
      ON d.iddealer = p.iddealer
    WHERE p.idpengajuan = ?
  `).get(id) as Row | undefined;

  if (!pengajuan) {
    throw new AppError("Pengajuan tidak ditemukan", 404);
  }

  return pengajuan;
}

function ambilDetail(id: number) {
  const pengajuan = ambilDetailRow(id);

  const dokumen = db.prepare(`
    SELECT
      jenis,
      nama_file,
      uploaded_date
    FROM pengajuan_dokumen
    WHERE idpengajuan = ?
  `).all(id);

  const riwayat = db.prepare(`
    SELECT
      a.keputusan,
      a.alasan,
      a.created_date,
      u.username
    FROM approval_log a
    JOIN master_user u
      ON u.iduser = a.iduser
    WHERE a.idpengajuan = ?
    ORDER BY a.idlog
  `).all(id);

  return {
    ...pengajuan,
    dokumen,
    riwayat
  };
}

export function cekAkses(user: AuthUser, pengajuan: Row): void {
  let boleh = true;

  if (user.nama_group === "Sales Dealer") {
    boleh = pengajuan.iddealer === user.iddealer;
  } else if (user.nama_group === "Marketing") {
    boleh = pengajuan.idmarketing === user.iduser;
  }

  if (!boleh) {
    throw new AppError(
      "Tidak punya akses ke pengajuan ini",
      403
    );
  }
}

export function ubahStatus(id: number, status: Status): void {
  db.prepare(`
    UPDATE pengajuan
    SET status = ?, updated_date = CURRENT_TIMESTAMP
    WHERE idpengajuan = ?
  `).run(status, id);
}

function noPengajuan(): string {
  const tanggal = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const result = db.prepare(`
    SELECT COUNT(*) AS total
    FROM pengajuan
    WHERE no_pengajuan LIKE ?
  `).get(`PJ-${tanggal}-%`) as { total: number };

  return `PJ-${tanggal}-${String(result.total + 1).padStart(4, "0")}`;
}

function pilihMarketing(idcabang: number): number {
  const marketing = db.prepare(`
    SELECT
      u.iduser,
      COUNT(p.idpengajuan) AS beban
    FROM master_user u
    JOIN master_group_user g
      ON g.idgroup = u.idgroup
      AND g.nama_group = 'Marketing'
    LEFT JOIN pengajuan p
      ON p.idmarketing = u.iduser
      AND p.status IN ('MENUNGGU_MARKETING', 'DIAJUKAN')
    WHERE u.is_active = 1
      AND u.idcabang = ?
    GROUP BY u.iduser
    ORDER BY beban ASC, u.iduser ASC
    LIMIT 1
  `).get(idcabang) as { iduser: number } | undefined;

  if (!marketing) {
    throw new AppError(
      "Tidak ada marketing aktif di cabang ini",
      422
    );
  }

  return marketing.iduser;
}

function simpanKonsumen(data: Row): number {
  const konsumenLama = db.prepare(`
    SELECT idkonsumen
    FROM konsumen
    WHERE nik = ?
  `).get(data.nik) as Row | undefined;

  const sudahKawin = data.status_perkawinan === "KAWIN";

  const dataKonsumen = [
    data.nama,
    data.tanggal_lahir,
    data.status_perkawinan,
    data.no_telepon,
    sudahKawin ? data.nama_pasangan : null,
    sudahKawin ? data.nik_pasangan : null
  ];

  if (konsumenLama) {
    db.prepare(`
      UPDATE konsumen
      SET
        nama = ?,
        tanggal_lahir = ?,
        status_perkawinan = ?,
        no_telepon = ?,
        nama_pasangan = ?,
        nik_pasangan = ?
      WHERE idkonsumen = ?
    `).run(
      ...dataKonsumen,
      konsumenLama.idkonsumen
    );

    return konsumenLama.idkonsumen;
  }

  const result = db.prepare(`
    INSERT INTO konsumen (
      nama,
      tanggal_lahir,
      status_perkawinan,
      no_telepon,
      nama_pasangan,
      nik_pasangan,
      nik
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    ...dataKonsumen,
    data.nik
  );

  return Number(result.lastInsertRowid);
}

pengajuanRouter.post("/simulasi", (req, res) => {
  const {
    harga,
    down_payment,
    tenor_bulan
  } = req.body ?? {};

  const dataValid =
    Number.isInteger(harga) &&
    harga > 0 &&
    Number.isInteger(down_payment) &&
    down_payment >= 0 &&
    down_payment < harga;

  if (!dataValid) {
    throw new AppError(
      "harga dan down_payment tidak valid",
      422
    );
  }

  res.json(
    hitungAngsuran(
      harga,
      down_payment,
      tenor_bulan
    )
  );
});


pengajuanRouter.post(
  "/",
  requireGroup("Sales Dealer"),
  (req, res) => {
    const data: Row = req.body ?? {};
    const errors = validatePengajuan(data);

    if (errors.length > 0) {
      throw new AppError(
        "Validasi gagal",
        422,
        errors
      );
    }

    const user = req.user!;

    if (!user.iddealer) {
      throw new AppError(
        "User ini belum terhubung ke dealer",
        403
      );
    }

    const pengajuanAktif = db.prepare(`
      SELECT p.no_pengajuan
      FROM pengajuan p
      JOIN konsumen k
        ON k.idkonsumen = p.idkonsumen
      WHERE k.nik = ?
        AND p.status NOT IN ('DITOLAK', 'DICAIRKAN')
    `).get(data.nik) as Row | undefined;

    if (pengajuanAktif) {
      throw new AppError(
        `NIK ini sudah punya pengajuan aktif (${pengajuanAktif.no_pengajuan})`,
        409
      );
    }

    const idmarketing = pilihMarketing(user.idcabang);
    const hasilAngsuran = hitungAngsuran(
      data.harga,
      data.down_payment,
      data.tenor_bulan
    );

    const status = pindahStatus(
      "DRAFT",
      "MENUNGGU_MARKETING"
    );

    const idpengajuan = db.transaction(() => {
      const idkonsumen = simpanKonsumen(data);
      const nomorPengajuan = noPengajuan();

      const result = db.prepare(`
        INSERT INTO pengajuan (
          no_pengajuan,
          idkonsumen,
          iddealer,
          idmarketing,
          merk,
          model,
          tipe,
          warna,
          harga,
          asuransi,
          down_payment,
          tenor_bulan,
          angsuran_per_bulan,
          status,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nomorPengajuan,
        idkonsumen,
        user.iddealer,
        idmarketing,
        data.merk,
        data.model,
        data.tipe,
        data.warna,
        data.harga,
        data.asuransi,
        data.down_payment,
        data.tenor_bulan,
        hasilAngsuran.angsuran,
        status,
        user.iduser
      );

      const id = Number(result.lastInsertRowid);

      buatNotif(
        idmarketing,
        id,
        `Pengajuan baru ${nomorPengajuan} a.n. ${data.nama} perlu dilengkapi`
      );

      return id;
    })();

    res.status(201).json(
      ambilDetail(idpengajuan)
    );
  }
);

pengajuanRouter.get("/", (req, res) => {
  const user = req.user!;
  const status =
    typeof req.query.status === "string"
      ? req.query.status
      : null;

  let where = "1=1";
  const params: any[] = [];

  if (user.nama_group === "Sales Dealer") {
    where += " AND p.iddealer = ?";
    params.push(user.iddealer);
  } else if (user.nama_group === "Marketing") {
    where += " AND p.idmarketing = ?";
    params.push(user.iduser);
  }

  if (status) {
    where += " AND p.status = ?";
    params.push(status);
  }

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
      p.created_date
    FROM pengajuan p
    JOIN konsumen k
      ON k.idkonsumen = p.idkonsumen
    WHERE ${where}
    ORDER BY p.idpengajuan DESC
  `).all(...params);

  res.json(data);
});

pengajuanRouter.get("/:id", (req, res) => {
  const id = parseId(req);
  const pengajuan = ambilDetailRow(id);

  cekAkses(req.user!, pengajuan);

  res.json(ambilDetail(id));
});

pengajuanRouter.post(
  "/:id/dokumen",
  requireGroup("Sales Dealer", "Marketing"),
  (req, res) => {
    const id = parseId(req);
    const pengajuan = ambilDetailRow(id);

    cekAkses(req.user!, pengajuan);

    if (!BISA_EDIT.includes(pengajuan.status)) {
      throw new AppError(
        `Dokumen tidak bisa diubah pada status ${pengajuan.status}`,
        409
      );
    }

    const {
      jenis,
      nama_file
    } = req.body ?? {};

    if (!DOKUMEN_WAJIB.includes(jenis)) {
      throw new AppError(
        `jenis harus salah satu dari: ${DOKUMEN_WAJIB.join(", ")}`,
        422
      );
    }

    if (
      typeof nama_file !== "string" ||
      !/\.(pdf|jpg|jpeg|png)$/i.test(nama_file)
    ) {
      throw new AppError(
        "nama_file harus berekstensi pdf, jpg, jpeg, atau png",
        422
      );
    }

    db.prepare(`
      INSERT INTO pengajuan_dokumen (
        idpengajuan,
        jenis,
        nama_file
      )
      VALUES (?, ?, ?)
      ON CONFLICT(idpengajuan, jenis)
      DO UPDATE SET
        nama_file = excluded.nama_file,
        uploaded_date = CURRENT_TIMESTAMP
    `).run(
      id,
      jenis,
      nama_file
    );

    res.status(201).json(
      ambilDetail(id)
    );
  }
);

pengajuanRouter.put(
  "/:id/lengkapi",
  requireGroup("Marketing"),
  (req, res) => {
    const id = parseId(req);
    const pengajuan = ambilDetailRow(id);

    cekAkses(req.user!, pengajuan);

    if (!BISA_EDIT.includes(pengajuan.status)) {
      throw new AppError(
        `Data tidak bisa diubah pada status ${pengajuan.status}`,
        409
      );
    }

    const dataBaru: Row = {
      ...pengajuan,
      ...(req.body ?? {})
    };

    const errors = validatePengajuan(dataBaru);

    if (errors.length > 0) {
      throw new AppError(
        "Validasi gagal",
        422,
        errors
      );
    }

    const nikDipakai = db.prepare(`
      SELECT 1
      FROM konsumen
      WHERE nik = ?
        AND idkonsumen <> ?
    `).get(
      dataBaru.nik,
      pengajuan.idkonsumen
    );

    if (nikDipakai) {
      throw new AppError(
        "NIK sudah dipakai konsumen lain",
        409
      );
    }

    const hasilAngsuran = hitungAngsuran(
      dataBaru.harga,
      dataBaru.down_payment,
      dataBaru.tenor_bulan
    );

    const sudahKawin =
      dataBaru.status_perkawinan === "KAWIN";

    db.transaction(() => {
      db.prepare(`
        UPDATE konsumen
        SET
          nama = ?,
          nik = ?,
          tanggal_lahir = ?,
          status_perkawinan = ?,
          no_telepon = ?,
          nama_pasangan = ?,
          nik_pasangan = ?
        WHERE idkonsumen = ?
      `).run(
        dataBaru.nama,
        dataBaru.nik,
        dataBaru.tanggal_lahir,
        dataBaru.status_perkawinan,
        dataBaru.no_telepon,
        sudahKawin ? dataBaru.nama_pasangan : null,
        sudahKawin ? dataBaru.nik_pasangan : null,
        pengajuan.idkonsumen
      );

      db.prepare(`
        UPDATE pengajuan
        SET
          merk = ?,
          model = ?,
          tipe = ?,
          warna = ?,
          harga = ?,
          asuransi = ?,
          down_payment = ?,
          tenor_bulan = ?,
          angsuran_per_bulan = ?,
          updated_date = CURRENT_TIMESTAMP
        WHERE idpengajuan = ?
      `).run(
        dataBaru.merk,
        dataBaru.model,
        dataBaru.tipe,
        dataBaru.warna,
        dataBaru.harga,
        dataBaru.asuransi,
        dataBaru.down_payment,
        dataBaru.tenor_bulan,
        hasilAngsuran.angsuran,
        id
      );
    })();

    res.json(
      ambilDetail(id)
    );
  }
);

pengajuanRouter.post(
  "/:id/submit",
  requireGroup("Marketing"),
  (req, res) => {
    const id = parseId(req);
    const pengajuan = ambilDetailRow(id);

    cekAkses(req.user!, pengajuan);

    const statusBaru = pindahStatus(
      pengajuan.status,
      "DIAJUKAN"
    );

    const errors = validatePengajuan(pengajuan);

    if (errors.length > 0) {
      throw new AppError(
        "Data belum valid",
        422,
        errors
      );
    }

    const dokumenYangAda = (
      db.prepare(`
        SELECT jenis
        FROM pengajuan_dokumen
        WHERE idpengajuan = ?
      `).all(id) as Row[]
    ).map((dokumen) => dokumen.jenis);

    const dokumenKurang = DOKUMEN_WAJIB.filter(
      (jenis) => !dokumenYangAda.includes(jenis)
    );

    if (dokumenKurang.length > 0) {
      throw new AppError(
        "Dokumen belum lengkap",
        422,
        dokumenKurang.map(
          (jenis) => `${jenis} belum diunggah`
        )
      );
    }

    db.transaction(() => {
      ubahStatus(id, statusBaru);

      const atasan = db.prepare(`
        SELECT u.iduser
        FROM master_user u
        JOIN master_group_user g
          ON g.idgroup = u.idgroup
        WHERE g.nama_group = 'Atasan Marketing'
          AND u.is_active = 1
          AND u.idcabang = ?
      `).all(
        req.user!.idcabang
      ) as Row[];

      for (const user of atasan) {
        buatNotif(
          user.iduser,
          id,
          `Pengajuan ${pengajuan.no_pengajuan} menunggu approval`
        );
      }
    })();

    res.json(
      ambilDetail(id)
    );
  }
);