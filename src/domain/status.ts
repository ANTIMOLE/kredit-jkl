import { AppError } from "./errors";

export type Status =
  | "DRAFT"
  | "MENUNGGU_MARKETING"
  | "DIAJUKAN"
  | "DISETUJUI"
  | "DITOLAK"
  | "MENUNGGU_TTD"
  | "TTD_LENGKAP"
  | "DICAIRKAN";

const TRANSISI: Record<Status, Status[]> = {
  DRAFT: ["MENUNGGU_MARKETING"],
  MENUNGGU_MARKETING: ["DIAJUKAN"],
  DIAJUKAN: ["DISETUJUI", "DITOLAK"],
  DITOLAK: ["DIAJUKAN"],
  DISETUJUI: ["MENUNGGU_TTD"],
  MENUNGGU_TTD: ["TTD_LENGKAP"],
  TTD_LENGKAP: ["DICAIRKAN"],
  DICAIRKAN: []
};

export function bolehPindah(
  statusSekarang: Status,
  statusBerikutnya: Status
) {
  return TRANSISI[statusSekarang].includes(statusBerikutnya);
}

export function pindahStatus(
  statusSekarang: Status,
  statusBerikutnya: Status
): Status {
  if (!bolehPindah(statusSekarang, statusBerikutnya)) {
    throw new AppError(
      `Status tidak bisa berubah dari ${statusSekarang} ke ${statusBerikutnya}`,
      409
    );
  }

  return statusBerikutnya;
}