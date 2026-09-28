export const SLA_JAM = 24;
//Untuk SLA AJA
export function infoSla(
  status: string,
  sejak: string | null,
  sekarang = new Date()
) {
  if (status !== "DIAJUKAN" || !sejak) {
    return null;
  }

  const waktuMulai = new Date(
    sejak.replace(" ", "T") + "Z"
  );

  const jamMenunggu = Math.floor(
    (sekarang.getTime() - waktuMulai.getTime()) /
      3_600_000
  );

  return {
    jam_menunggu: jamMenunggu,
    batas_jam: SLA_JAM,
    melebihi_sla: jamMenunggu >= SLA_JAM
  };
}