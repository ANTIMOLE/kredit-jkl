import test from "node:test";
import assert from "node:assert/strict";

import { hitungAngsuran } from "./angsuran";
import {
  validatePengajuan,
  isNikValid
} from "./validators";
import {
  bolehPindah,
  pindahStatus
} from "./status";
import { infoSla } from "./sla";

const dataValid = {
  nama: "Andi",
  nik: "1234567890123456",
  tanggal_lahir: "1990-05-01",
  status_perkawinan: "BELUM_KAWIN",
  no_telepon: "081234567890",
  merk: "Honda",
  model: "Beat",
  tipe: "CBS",
  warna: "Hitam",
  harga: 20_000_000,
  asuransi: "TLO",
  down_payment: 4_000_000,
  tenor_bulan: 36
};

test("angsuran tenor 12 bulan", () => {
  const hasil = hitungAngsuran(
    20_000_000,
    4_000_000,
    12
  );

  assert.equal(hasil.angsuran, 1_440_000);
});

test("angsuran dibulatkan ke atas", () => {
  const hasil = hitungAngsuran(
    20_000_000,
    4_000_000,
    36
  );

  assert.equal(hasil.angsuran, 577_778);
});

test("NIK harus 16 digit angka", () => {
  assert.equal(
    isNikValid("123"),
    false
  );

  assert.equal(
    isNikValid("1234567890123456"),
    true
  );
});

test("data yang valid lolos validasi", () => {
  const error = validatePengajuan(
    dataValid
  );

  assert.deepEqual(error, []);
});

test("DP di bawah 20 persen ditolak", () => {
  const error = validatePengajuan({
    ...dataValid,
    down_payment: 1_000_000
  });

  assert.ok(
    error.some((pesan) =>
      pesan.includes("20%")
    )
  );
});

test("status KAWIN wajib mengisi data pasangan", () => {
  const error = validatePengajuan({
    ...dataValid,
    status_perkawinan: "KAWIN"
  });

  assert.ok(
    error.some((pesan) =>
      pesan.includes("pasangan")
    )
  );
});

test("status tidak boleh langsung loncat", () => {
  assert.equal(
    bolehPindah("DIAJUKAN", "DICAIRKAN"),
    false
  );

  assert.equal(
    bolehPindah("DITOLAK", "DIAJUKAN"),
    true
  );

  assert.throws(() =>
    pindahStatus("DRAFT", "DISETUJUI")
  );
});

test("SLA approval lewat 24 jam", () => {
  const sekarang = new Date(
    "2026-01-02T01:00:00Z"
  );

  const hasil = infoSla(
    "DIAJUKAN",
    "2026-01-01 00:00:00",
    sekarang
  );

  assert.equal(
    hasil?.melebihi_sla,
    true
  );

  assert.equal(
    infoSla(
      "DISETUJUI",
      "2026-01-01 00:00:00",
      sekarang
    ),
    null
  );
});