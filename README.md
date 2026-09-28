# Kredit Kendaraan PT. JKL — Program Web Digitalisasi (Soal 2.a)

Aplikasi ini dibuat menggunakan **Express + TypeScript + SQLite**. Untuk frontend, digunakan satu file HTML di `src/public/index.html`.

## Cara menjalankan

```bash
npm install
npm run dev
```

Aplikasi bisa diakses di `http://localhost:3000`.

Untuk menjalankan unit test:

```bash
npm test
```

Database `kredit.db` akan dibuat otomatis saat aplikasi dijalankan, termasuk beberapa data contoh. Kalau ingin mulai dari awal, cukup hapus file `kredit.db`.

## Akun contoh

Semua akun berikut menggunakan password `password123`:

* `dealer_budi` — Sales Dealer
* `marketing_siti` — Marketing
* `atasan_andi` — Atasan Marketing
* `admin_rina` — Admin Backoffice

## Alur pengajuan

Secara umum, alurnya seperti ini:

**Dealer input pengajuan → Marketing → Atasan approve/reject → Admin buat kontrak dan PO → Konsumen & dealer e-sign → Cek kelengkapan → Pencairan**

Pengajuan dari dealer otomatis diberikan ke marketing dengan beban kerja paling sedikit.

Status pengajuan:

```text
DRAFT
→ MENUNGGU_MARKETING
→ DIAJUKAN
→ DISETUJUI
→ MENUNGGU_TTD
→ TTD_LENGKAP
→ DICAIRKAN
```

Pengajuan yang **DIAJUKAN** juga bisa ditolak. Kalau ditolak, marketing bisa melakukan revisi dan mengajukannya kembali.

Perpindahan status diatur di `src/domain/status.ts`.

## Aturan bisnis

Beberapa aturan yang digunakan dalam aplikasi:

* NIK harus terdiri dari 16 digit dan nomor telepon harus sesuai format.
* Field wajib harus diisi. Kalau status pernikahan **KAWIN**, data pasangan juga wajib diisi.
* DP minimal 20% dari harga kendaraan.
* Umur minimal 21 tahun dan saat kredit lunas maksimal 65 tahun.
* Bunga menggunakan sistem flat per tahun:

  * 12 bulan: 8%
  * 24 bulan: 9%
  * 36 bulan: 10%
  * 48 bulan: 11%
  * 60 bulan: 12%
* Angsuran dibulatkan ke atas.
* Satu NIK hanya boleh memiliki satu pengajuan yang masih aktif.
* Pengajuan hanya bisa disubmit kalau 5 dokumen wajib sudah lengkap.
* Kalau pengajuan ditolak, alasan penolakan wajib diisi minimal 5 karakter.
* Atasan hanya bisa memproses pengajuan dari cabangnya sendiri.
* SLA approval adalah 24 jam. Kalau lebih dari itu, pengajuan akan ditandai sebagai **lewat SLA**.
* Pencairan hanya bisa dilakukan kalau dokumen sudah lengkap dan kontrak dari konsumen serta PO dari dealer sudah ditandatangani.
* Hak akses mengikuti role masing-masing. Menu ditentukan dari `group` dan `mapping_group_menu` sesuai ERD pada soal 1.
* Data dealer dan marketing hanya menampilkan data yang menjadi tanggung jawab mereka.

## Bagian yang masih disimulasikan

Beberapa fitur dibuat dalam bentuk sederhana untuk kebutuhan demo. Dalam implementasi sebenarnya, bagian ini bisa diganti dengan service atau sistem yang sesungguhnya.

* **OCR:** belum digunakan. Data divalidasi langsung dari input.
* **Upload file:** sistem hanya menyimpan nama file.
* **Notifikasi:** masih berupa notifikasi di aplikasi. Email atau WhatsApp belum benar-benar dikirim.
* **OTP:** kode OTP dicetak di console server dan juga ditampilkan ke admin.
* **Kontrak dan PO:** dibuat dalam bentuk HTML yang siap dicetak atau disimpan sebagai PDF dari browser.
* **Session login:** masih disimpan di memory server, jadi akan hilang ketika server restart.
* **E-sign OTP:** maksimal 5 kali percobaan salah untuk setiap dokumen.
