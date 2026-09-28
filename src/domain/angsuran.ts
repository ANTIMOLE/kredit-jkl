import { AppError } from "./errors";

// Bunga flat per tahun, tergantung dari lama tenor !!DUMMY!!
const BUNGA_FLAT_PER_TAHUN: Record<number, number> = {
  12: 0.08,
  24: 0.09,
  36: 0.10,
  48: 0.11,
  60: 0.12
};

export function hitungAngsuran(
  harga: number,
  downPayment: number,
  tenorBulan: number
) {
  const bunga = BUNGA_FLAT_PER_TAHUN[tenorBulan];

  if (bunga === undefined) {
    throw new AppError("Tenor tidak didukung", 422);
  }

  const pokok = harga - downPayment;

  const totalBunga = Math.round(
    pokok * bunga * (tenorBulan / 12)
  );

  const totalBayar = pokok + totalBunga;

  const angsuran = Math.ceil(
    totalBayar / tenorBulan
  );

  return {
    pokok,
    bungaPersenPerTahun: bunga * 100,
    totalBunga,
    totalBayar,
    angsuran
  };
}