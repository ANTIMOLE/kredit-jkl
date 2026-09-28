import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { hashPassword } from "../domain/password";

export const db = new Database(
  path.join(process.cwd(), "kredit.db")
);

db.pragma("foreign_keys = ON");

export function initDb() {
  const schemaPath = path.join(process.cwd(), "src/db/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema);
  seedData();
}

function seedData() {
  const result = db
    .prepare("SELECT COUNT(*) AS total FROM master_area")
    .get() as { total: number };

  // Sudah Ada Datanya
  if (result.total > 0) {
    return;
  }

  const insertData = db.transaction(() => {
    db.exec(`
      INSERT INTO master_area (nama_area)
      VALUES ('Jawa Tengah'), ('DKI Jakarta');

      INSERT INTO master_cabang (nama_cabang, idarea)
      VALUES
        ('Semarang', 1),
        ('Solo', 1),
        ('Jakarta Pusat', 2);

      INSERT INTO master_group_user (nama_group)
      VALUES
        ('Sales Dealer'),
        ('Marketing'),
        ('Atasan Marketing'),
        ('Admin Backoffice');

      INSERT INTO master_menu (nama_menu, parent_menu, url_menu)
      VALUES
        ('Pengajuan', NULL, NULL),
        ('Form Pengajuan', 1, '/form'),
        ('Daftar Pengajuan', 1, '/daftar'),
        ('Review Approval', 1, '/review'),
        ('Dokumen dan E-Sign', NULL, '/dokumen'),
        ('Pencairan', NULL, '/pencairan'),
        ('Notifikasi', NULL, '/notifikasi');

      INSERT INTO mapping_group_menu (idgroup, idmenu)
      VALUES
        (1, 1), (1, 2), (1, 3), (1, 7),
        (2, 1), (2, 3), (2, 7),
        (3, 1), (3, 3), (3, 4), (3, 7),
        (4, 1), (4, 3), (4, 5), (4, 6), (4, 7);

      INSERT INTO master_dealer (nama_dealer)
      VALUES
        ('Dealer Maju Jaya'),
        ('Dealer Sumber Motor');
    `);

    const insertUser = db.prepare(`
      INSERT INTO master_user
      (username, password_hash, idcabang, idgroup, iddealer)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run(
      "dealer_budi",
      hashPassword("password123"),
      1,
      1,
      1
    );

    insertUser.run(
      "marketing_siti",
      hashPassword("password123"),
      1,
      2,
      null
    );

    insertUser.run(
      "atasan_andi",
      hashPassword("password123"),
      1,
      3,
      null
    );

    insertUser.run(
      "admin_rina",
      hashPassword("password123"),
      3,
      4,
      null
    );
  });

  insertData();
}