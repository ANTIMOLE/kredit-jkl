CREATE TABLE IF NOT EXISTS master_area (
  idarea    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_area TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS master_cabang (
  idcabang    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_cabang TEXT NOT NULL,
  idarea      INTEGER NOT NULL REFERENCES master_area(idarea)
);

CREATE TABLE IF NOT EXISTS master_group_user (
  idgroup    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_group TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS master_menu (
  idmenu      INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_menu   TEXT NOT NULL,
  parent_menu INTEGER REFERENCES master_menu(idmenu),
  url_menu    TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mapping_group_menu (
  idgroup INTEGER NOT NULL REFERENCES master_group_user(idgroup),
  idmenu  INTEGER NOT NULL REFERENCES master_menu(idmenu),
  PRIMARY KEY (idgroup, idmenu)
);

CREATE TABLE IF NOT EXISTS master_dealer (
  iddealer    INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_dealer TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS master_user (
  iduser        INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1,
  idcabang      INTEGER NOT NULL REFERENCES master_cabang(idcabang),
  idgroup       INTEGER NOT NULL REFERENCES master_group_user(idgroup),
  iddealer      INTEGER REFERENCES master_dealer(iddealer),
  created_date  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    INTEGER REFERENCES master_user(iduser),
  updated_date  TEXT,
  updated_by    INTEGER REFERENCES master_user(iduser)
);

CREATE TABLE IF NOT EXISTS konsumen (
  idkonsumen        INTEGER PRIMARY KEY AUTOINCREMENT,
  nama              TEXT NOT NULL,
  nik               TEXT NOT NULL UNIQUE CHECK (length(nik) = 16),
  tanggal_lahir     TEXT NOT NULL,
  status_perkawinan TEXT NOT NULL,
  no_telepon        TEXT NOT NULL,
  nama_pasangan     TEXT,
  nik_pasangan      TEXT
);

CREATE TABLE IF NOT EXISTS pengajuan (
  idpengajuan        INTEGER PRIMARY KEY AUTOINCREMENT,
  no_pengajuan       TEXT NOT NULL UNIQUE,
  idkonsumen         INTEGER NOT NULL REFERENCES konsumen(idkonsumen),
  iddealer           INTEGER NOT NULL REFERENCES master_dealer(iddealer),
  idmarketing        INTEGER REFERENCES master_user(iduser),
  merk               TEXT NOT NULL,
  model              TEXT NOT NULL,
  tipe               TEXT NOT NULL,
  warna              TEXT NOT NULL,
  harga              INTEGER NOT NULL CHECK (harga > 0),
  asuransi           TEXT NOT NULL,
  down_payment       INTEGER NOT NULL,
  tenor_bulan        INTEGER NOT NULL CHECK (tenor_bulan > 0),
  angsuran_per_bulan INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN
    ('DRAFT','MENUNGGU_MARKETING','DIAJUKAN','DISETUJUI','DITOLAK',
     'MENUNGGU_TTD','TTD_LENGKAP','DICAIRKAN')),
  created_by         INTEGER NOT NULL REFERENCES master_user(iduser),
  created_date       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date       TEXT,
  CHECK (down_payment >= 0 AND down_payment < harga)
);

CREATE TABLE IF NOT EXISTS pengajuan_dokumen (
  iddokumen     INTEGER PRIMARY KEY AUTOINCREMENT,
  idpengajuan   INTEGER NOT NULL REFERENCES pengajuan(idpengajuan),
  jenis         TEXT NOT NULL CHECK (jenis IN
    ('KTP','SPK','BUKTI_TANDA_JADI','FORM_APLIKASI','KARTU_KELUARGA')),
  nama_file     TEXT NOT NULL,
  uploaded_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (idpengajuan, jenis)
);

CREATE TABLE IF NOT EXISTS approval_log (
  idlog        INTEGER PRIMARY KEY AUTOINCREMENT,
  idpengajuan  INTEGER NOT NULL REFERENCES pengajuan(idpengajuan),
  iduser       INTEGER NOT NULL REFERENCES master_user(iduser),
  keputusan    TEXT NOT NULL CHECK (keputusan IN ('APPROVE','REJECT')),
  alasan       TEXT,
  created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kontrak_dokumen (
  idkontrak     INTEGER PRIMARY KEY AUTOINCREMENT,
  idpengajuan   INTEGER NOT NULL REFERENCES pengajuan(idpengajuan),
  jenis         TEXT NOT NULL CHECK (jenis IN ('KONTRAK','PO')),
  nomor_dokumen TEXT NOT NULL UNIQUE,
  created_date  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (idpengajuan, jenis)
);

-- KONTRAK ditandatangani KONSUMEN, PO ditandatangani DEALER
CREATE TABLE IF NOT EXISTS tanda_tangan (
  idttd       INTEGER PRIMARY KEY AUTOINCREMENT,
  idkontrak   INTEGER NOT NULL UNIQUE REFERENCES kontrak_dokumen(idkontrak),
  pihak       TEXT NOT NULL CHECK (pihak IN ('KONSUMEN','DEALER')),
  kode_otp    TEXT NOT NULL,
  signed_date TEXT
);

CREATE TABLE IF NOT EXISTS notifikasi (
  idnotif      INTEGER PRIMARY KEY AUTOINCREMENT,
  iduser       INTEGER NOT NULL REFERENCES master_user(iduser),
  idpengajuan  INTEGER REFERENCES pengajuan(idpengajuan),
  pesan        TEXT NOT NULL,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);