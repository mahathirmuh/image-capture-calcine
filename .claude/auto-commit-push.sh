#!/usr/bin/env bash
# Auto-commit + push setiap Claude selesai satu giliran.
#
# Dipanggil oleh hook Stop di .claude/settings.local.json (berkas itu tidak
# ikut git, jadi clone orang lain mendapat skrip ini dalam keadaan mati).
# Menerima payload JSON di stdin dan mengabaikannya -- Stop tidak membawa
# apa pun yang dibutuhkan di sini.
#
# Tidak pernah mengembalikan status gagal: hook Stop yang keluar dengan kode 2
# akan memblokir giliran, dan kegagalan push tidak layak melakukan itu. Semua
# jalur berakhir `exit 0`, kabarnya disampaikan lewat systemMessage.
set -uo pipefail

# Identitas ditulis eksplisit, bukan menumpang `git config`, supaya author
# tidak bisa hanyut kalau konfigurasi mesin berubah. Nilainya sama persis
# dengan riwayat yang sudah ada; Claude tidak pernah jadi author, dan tidak
# ada trailer Co-Authored-By.
AUTHOR_NAME='mahathirmuh'
AUTHOR_EMAIL='mahathirmuh@users.noreply.github.com'

# systemMessage harus JSON valid. Backslash dan petik ganda dibuang, baris
# baru dijadikan spasi, lalu dipotong -- pesan error git bisa panjang dan
# berisi keduanya.
emit() {
  local text
  text=$(printf '%s' "$1" | tr -d '\\"' | tr '\n\r\t' '   ' | cut -c1-300)
  printf '{"systemMessage":"%s"}\n' "$text"
}

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

git add -A >/dev/null 2>&1 || exit 0

# Giliran yang hanya membaca berkas atau menjawab pertanyaan tidak
# meninggalkan apa pun untuk di-commit. Diam saja, jangan berisik.
if git diff --cached --quiet; then
  exit 0
fi

files=$(git diff --cached --name-only | wc -l | tr -d ' ')
stamp=$(date '+%Y-%m-%d %H:%M')
msg="chore: auto-commit ${stamp} (${files} berkas)"

if ! commit_err=$(git -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" \
  commit -q -m "$msg" 2>&1); then
  emit "auto-commit GAGAL, tidak ada yang di-push: ${commit_err}"
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)

# Push apa adanya. Sengaja tidak ada pull/rebase otomatis: kalau remote sudah
# bergerak, menyelesaikannya diam-diam di latar belakang justru cara membuat
# konflik yang tidak dilihat siapa pun. Lapor, lalu berhenti.
if push_err=$(git push -q origin "HEAD:${branch}" 2>&1); then
  emit "auto-commit + push -> ${branch}: ${msg}"
else
  emit "auto-commit OK (${msg}) tetapi PUSH GAGAL ke ${branch}: ${push_err}"
fi
exit 0
