type Input = Record<string, any>;

export const STATUS_KAWIN = [
  "BELUM_KAWIN",
  "KAWIN",
  "CERAI"
];

export const ASURANSI = [
  "ALL_RISK",
  "TLO"
];

export const TENOR = [12, 24, 36, 48, 60];

export const DOKUMEN_WAJIB = [
  "KTP",
  "SPK",
  "BUKTI_TANDA_JADI",
  "FORM_APLIKASI",
  "KARTU_KELUARGA"
];

export const MIN_DP_PERSEN = 0.2;
export const MIN_UMUR = 21;
export const MAX_UMUR_LUNAS = 65;

function kosong(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  );
}

export function isNikValid(nik: unknown) {
  return typeof nik === "string" && /^\d{16}$/.test(nik);
}

export function isTeleponValid(noTelepon: unknown) {
  return (
    typeof noTelepon === "string" &&
    /^(?:\+62|62|0)8\d{8,11}$/.test(noTelepon)
  );
}

export function umur(tanggalLahir: string, sekarang = new Date()) {
  const tanggal = new Date(tanggalLahir);

  if (isNaN(tanggal.getTime())) {
    return NaN;
  }

  let usia =
    sekarang.getFullYear() - tanggal.getFullYear();

  const belumUlangTahun =
    sekarang.getMonth() < tanggal.getMonth() ||
    (
      sekarang.getMonth() === tanggal.getMonth() &&
      sekarang.getDate() < tanggal.getDate()
    );

  if (belumUlangTahun) {
    usia--;
  }

  return usia;
}

export function validatePengajuan(data: Input): string[] {
  const errors: string[] = [];

  const fieldWajib = [
    "nama",
    "nik",
    "tanggal_lahir",
    "status_perkawinan",
    "no_telepon",
    "merk",
    "model",
    "tipe",
    "warna",
    "asuransi"
  ];

  for (const field of fieldWajib) {
    if (kosong(data[field])) {
      errors.push(`${field} wajib diisi`);
    }
  }

  if (!kosong(data.nik) && !isNikValid(data.nik)) {
    errors.push("NIK harus 16 digit angka");
  }

  if (
    !kosong(data.no_telepon) &&
    !isTeleponValid(data.no_telepon)
  ) {
    errors.push("Format nomor telepon tidak valid");
  }

  if (
    !kosong(data.status_perkawinan) &&
    !STATUS_KAWIN.includes(data.status_perkawinan)
  ) {
    errors.push(
      `status_perkawinan harus salah satu dari: ${STATUS_KAWIN.join(", ")}`
    );
  }

  if (data.status_perkawinan === "KAWIN") {
    if (kosong(data.nama_pasangan)) {
      errors.push(
        "Nama pasangan wajib diisi jika status KAWIN"
      );
    }

    if (!isNikValid(data.nik_pasangan)) {
      errors.push("NIK pasangan harus 16 digit angka");
    }
  }

  if (
    !kosong(data.asuransi) &&
    !ASURANSI.includes(data.asuransi)
  ) {
    errors.push(
      `asuransi harus salah satu dari: ${ASURANSI.join(", ")}`
    );
  }

  const tenorValid = TENOR.includes(data.tenor_bulan);

  if (!tenorValid) {
    errors.push(
      `Tenor harus salah satu dari: ${TENOR.join(", ")} bulan`
    );
  }

  if (!kosong(data.tanggal_lahir)) {
    const usia = umur(data.tanggal_lahir);

    if (isNaN(usia)) {
      errors.push("Tanggal lahir tidak valid");
    } else if (usia < MIN_UMUR) {
      errors.push(`Umur minimal ${MIN_UMUR} tahun`);
    } else if (
      tenorValid &&
      usia + data.tenor_bulan / 12 > MAX_UMUR_LUNAS
    ) {
      errors.push(
        `Umur konsumen saat kredit berakhir maksimal ${MAX_UMUR_LUNAS} tahun`
      );
    }
  }

  const hargaValid =
    Number.isInteger(data.harga) && data.harga > 0;

  if (!hargaValid) {
    errors.push(
      "Harga harus bilangan bulat lebih dari 0"
    );
  }

  if (
    !Number.isInteger(data.down_payment) ||
    data.down_payment < 0
  ) {
    errors.push(
      "Down payment harus bilangan bulat 0 atau lebih"
    );
  } else if (hargaValid) {
    if (data.down_payment >= data.harga) {
      errors.push(
        "Down payment harus lebih kecil dari harga"
      );
    } else if (
      data.down_payment < data.harga * MIN_DP_PERSEN
    ) {
      errors.push(
        "Down payment minimal 20% dari harga"
      );
    }
  }

  return errors;
}