import { db } from "./database";

export function buatNotif(
  iduser: number,
  idpengajuan: number | null,
  pesan: string
) {
  const query = `
    INSERT INTO notifikasi (iduser, idpengajuan, pesan)
    VALUES (?, ?, ?)
  `;

  db.prepare(query).run(
    iduser,
    idpengajuan,
    pesan
  );
}