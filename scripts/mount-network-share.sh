#!/usr/bin/env bash
# Pasang share \\10.1.1.44\Data Analytics sebagai /mnt/mti di APP SERVER.
#
# Jalankan skrip ini di 10.60.10.59 -- host Docker tempat image-capture-calcine
# berjalan. Sejak penyimpanan dipindahkan ke app server, yang menulis berkas
# hasil capture adalah proses Node di dalam container itu, bukan edge di
# 10.60.20.155. App menarik byte-nya dari edge lewat /v1/media/:id/content lalu
# menulis sendiri ke NETWORK_SAVE_ROOT:
#
#   edge 20.155  ──GET /content──►  app 10.59  ──fs.writeFile──►  10.1.1.44
#
# Jadi mount ini harus ada DI SINI, dan NETWORK_SAVE_ROOT dibaca sebagai path
# di dalam container:
#
#   NETWORK_SAVE_ROOT=/mnt/mti/ML/MTI   ==   \\10.1.1.44\Data Analytics\ML\MTI
#
# docker-compose.yml mem-bind /mnt/mti host ke /mnt/mti container, jadi kedua
# sisi memakai path yang sama persis dan tidak ada yang perlu diterjemahkan.
#
#   sudo bash mount-network-share.sh
#
# Password TIDAK disimpan di skrip ini (scripts/ ikut ter-commit). Skrip
# menanyakannya saat dijalankan, lalu menuliskannya ke /etc/cifs-mti.cred
# dengan mode 600. Nilainya ada di .env pada baris NETWORK_SAVE_PASSWORD.
set -euo pipefail

SHARE='//10.1.1.44/Data Analytics'
MOUNTPOINT='/mnt/mti'
CRED_FILE='/etc/cifs-mti.cred'
SUBDIR='ML/MTI'          # sub-folder tujuan, harus sudah ada di share
DOMAIN='mbma'
USERNAME='mti.sysadmin'

# CIFS mengunci kepemilikan berkas saat mount, bukan lewat chown belakangan.
# Nilainya harus cocok dengan user `node` di dalam image (lihat baris USER di
# Dockerfile) -- uid 1000 pada image node resmi. Salah uid berarti container
# melihat share yang tidak bisa ditulisnya.
MOUNT_UID="${MOUNT_UID:-1000}"
MOUNT_GID="${MOUNT_GID:-1000}"

if [[ $EUID -ne 0 ]]; then
  echo "Harus root. Jalankan: sudo bash $0" >&2
  exit 1
fi

echo "Share      : $SHARE"
echo "Mountpoint : $MOUNTPOINT  (di-bind ke $MOUNTPOINT di dalam container)"
echo "Pemilik    : uid=$MOUNT_UID gid=$MOUNT_GID (user 'node' di container)"
echo

if ! command -v mount.cifs >/dev/null 2>&1; then
  echo "==> memasang cifs-utils"
  apt-get update -qq
  apt-get install -y cifs-utils
fi

if [[ -f "$CRED_FILE" ]]; then
  echo "==> $CRED_FILE sudah ada, dipakai apa adanya"
else
  echo "==> membuat $CRED_FILE"
  read -rsp "Password untuk ${DOMAIN}\\${USERNAME}: " SMB_PASSWORD
  echo
  # Nilai ditulis polos tanpa kutip: mount.cifs membaca sampai akhir baris,
  # jadi '#' di dalam password aman, sedangkan kutip justru ikut terbaca
  # sebagai bagian dari password.
  umask 077
  printf 'username=%s\npassword=%s\ndomain=%s\n' \
    "$USERNAME" "$SMB_PASSWORD" "$DOMAIN" >"$CRED_FILE"
  unset SMB_PASSWORD
  chmod 600 "$CRED_FILE"
fi

mkdir -p "$MOUNTPOINT"

# nofail + _netdev: host tetap bisa boot walau 10.1.1.44 sedang tidak
# terjangkau. Konsekuensinya /mnt/mti bisa jadi direktori kosong biasa, dan
# itulah yang ditangkap pemeriksaan TARGET_ROOT_MISSING di network-save.ts --
# app menolak menulis, bukan diam-diam menimbun berkas di disk lokal.
OPTS="credentials=${CRED_FILE},uid=${MOUNT_UID},gid=${MOUNT_GID},file_mode=0664,dir_mode=0775,iocharset=utf8,vers=3.0,nofail,_netdev"

# Spasi pada '//10.1.1.44/Data Analytics' harus ditulis \040 di fstab; di baris
# mount biasa cukup dikutip.
FSTAB_LINE="//10.1.1.44/Data\\040Analytics ${MOUNTPOINT} cifs ${OPTS} 0 0"
if grep -qF " ${MOUNTPOINT} " /etc/fstab; then
  echo "==> /etc/fstab sudah menyebut ${MOUNTPOINT}, tidak diubah"
else
  echo "==> menambahkan entri /etc/fstab agar mount kembali setelah reboot"
  cp /etc/fstab "/etc/fstab.bak.$(date +%Y%m%d%H%M%S)"
  printf '%s\n' "$FSTAB_LINE" >>/etc/fstab
fi

if mountpoint -q "$MOUNTPOINT"; then
  echo "==> ${MOUNTPOINT} sudah ter-mount"
else
  echo "==> mounting"
  mount -t cifs "$SHARE" "$MOUNTPOINT" -o "$OPTS"
fi

# Propagasi mount. Dibutuhkan oleh bind `propagation: rslave` di
# docker-compose.yml: tanpa sisi host bersifat shared, Docker MENOLAK start
# container -- bukan diam-diam kembali ke perilaku lama. systemd membuat /
# rshared saat boot sehingga mount di bawah /mnt biasanya mewarisinya, tapi itu
# asumsi tentang mesin orang lain, jadi ditegaskan saja di sini. Aman diulang.
mount --make-rshared "$MOUNTPOINT"
echo "==> propagasi ${MOUNTPOINT}: $(findmnt -no PROPAGATION "$MOUNTPOINT")"

TARGET="${MOUNTPOINT}/${SUBDIR}"
echo
echo "==> verifikasi tulis di ${TARGET} sebagai uid=${MOUNT_UID}"
if [[ ! -d "$TARGET" ]]; then
  echo "GAGAL: ${TARGET} tidak ada." >&2
  echo "Mount berhasil tapi sub-folder '${SUBDIR}' tidak terlihat -- cek isi ${MOUNTPOINT}." >&2
  exit 1
fi

# Diuji dengan uid yang sama seperti proses di dalam container, bukan root.
# Mount yang berhasil tapi read-only bagi uid itu tetap membuat capture gagal,
# dan itu justru kegagalan yang paling sering terlewat.
PROBE="${TARGET}/.write-probe-$$"
if setpriv --reuid="$MOUNT_UID" --regid="$MOUNT_GID" --clear-groups \
  touch "$PROBE" 2>/dev/null; then
  rm -f "$PROBE"
  echo "OK: uid=${MOUNT_UID} bisa menulis ke ${TARGET}"

  # --- Urutan boot: Docker vs mount ------------------------------------------
  # Tanpa ini ada balapan saat server reboot. docker.service tidak tahu apa-apa
  # soal mount CIFS, jadi ia bisa start lebih dulu dan container mem-bind
  # /mnt/mti yang saat itu masih direktori kosong. Mount menyusul beberapa detik
  # kemudian, tapi container TIDAK akan pernah melihatnya -- bind sudah terikat
  # ke keadaan lama. Auto-save mati diam-diam sampai ada yang restart container.
  #
  # Sengaja Wants= + After=, BUKAN RequiresMountsFor=. RequiresMountsFor
  # menambahkan Requires=, yang berarti kalau 10.1.1.44 sedang mati saat boot,
  # docker.service gagal start dan SELURUH aplikasi ikut mati. Itu terlalu mahal:
  # app punya fallback yang benar (menolak menulis, capture jatuh ke unduhan
  # browser), jadi share yang mati seharusnya menurunkan fungsi, bukan
  # mematikan layanan. Wants= memberi urutan tanpa menyandera.
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files docker.service >/dev/null 2>&1; then
    MOUNT_UNIT=$(systemd-escape -p --suffix=mount "$MOUNTPOINT")
    DROPIN_DIR=/etc/systemd/system/docker.service.d
    DROPIN="${DROPIN_DIR}/wait-for-network-share.conf"
    echo
    if [[ -f "$DROPIN" ]]; then
      echo "==> ${DROPIN} sudah ada, tidak diubah"
    else
      echo "==> menahan docker.service sampai ${MOUNT_UNIT} selesai dicoba"
      mkdir -p "$DROPIN_DIR"
      cat >"$DROPIN" <<EOF
# Dipasang oleh scripts/mount-network-share.sh.
# Ordering saja: Docker menunggu giliran mount, tapi mount yang gagal tidak
# ikut menjatuhkan Docker. Jangan diganti RequiresMountsFor -- itu membuat
# share yang mati mematikan seluruh aplikasi.
[Unit]
Wants=${MOUNT_UNIT}
After=${MOUNT_UNIT}
EOF
      systemctl daemon-reload
    fi
  fi

  echo
  echo "Selesai. Langkah berikutnya di ${PWD}:"
  echo "  grep NETWORK_SAVE_ROOT .env   # harus /mnt/mti/ML/MTI, bukan bentuk UNC"
  echo "  docker compose up -d --build  # --build wajib: tanpa itu image lama"
  echo "                                # dipakai ulang dan kode barunya tidak jalan"
  echo "  # lalu buka halaman Storage -- probe-nya sekarang menguji mesin ini,"
  echo "  # jadi hasilnya mewakili jalur simpan yang sebenarnya."
else
  echo "GAGAL: uid=${MOUNT_UID} tidak bisa menulis ke ${TARGET}." >&2
  echo "Umumnya uid/gid mount tidak cocok dengan user 'node' di container," >&2
  echo "atau akun SMB ${DOMAIN}\\${USERNAME} memang tidak punya hak tulis." >&2
  exit 1
fi
