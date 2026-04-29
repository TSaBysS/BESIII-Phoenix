#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVENT_PY="${BASE_DIR}/scripts/prepare_events.py"

RAW2REC_TEMPLATE="/afs/ihep.ac.cn/users/y/yanjiazhen/nphy/Knunubar/rawData/rec/44113_374390.txt"

WORK_ROOT="${BASE_DIR}/data/convert_work"
OUT_DIR="${BASE_DIR}/data/events/converted"
SCRIPT_STAGE="auto"

usage() {
  echo "Usage:"
  echo "  bash scripts/convert.sh [--prepare|--finalize|--auto] <run> <event> <path-to-rec-or-search>"
  echo "  bash scripts/convert.sh [--prepare|--finalize|--auto] <run_event_list.txt> <path-to-rec-or-search>"
  echo ""
  echo "Stages:"
  echo "  --prepare : data mode only, generate pair/raw/jobOptions txt, do NOT run boss.exe"
  echo "  --finalize: convert rec to json (requires existing rec output)"
  echo "  --auto    : data mode: if rec exists => finalize, else prepare (default)"
  echo ""
  echo "Auto mode:"
  echo "  - MC: <path> is a .rec file or directory containing .rec files"
  echo "  - Data: otherwise, <path> is dst search base (skip '/tag/' dst)"
}

is_mc_input() {
  local path="$1"
  [[ -f "${path}" && "${path}" == *.rec ]] && return 0
  [[ -d "${path}" ]] && compgen -G "${path}/*.rec" >/dev/null && return 0
  return 1
}

mk_pair_file() {
  local run="$1" evt="$2" out="$3"
  printf "%s %s\n" "${run}" "${evt}" > "${out}"
}

find_first_dst_with_event() {
  local run="$1" evt="$2" base="$3"
  local run_abs="${run#-}" cand count
  while IFS= read -r -d '' cand; do
    [[ "${cand}" == *"/tag/"* ]] && continue
    count="$(root -l -b -q -e "TFile *f=TFile::Open(\"${cand}\"); if (f && f->Get(\"Event\")) { TTree *t=(TTree*)f->Get(\"Event\"); std::cout << t->GetEntries(\"m_eventId==${evt}\") << std::endl; } else { std::cout << 0 << std::endl; } if (f) f->Close();" 2>/dev/null | awk 'NF{v=$0} END{print v}')"
    if [[ "${count:-0}" =~ ^[0-9]+$ ]] && (( count > 0 )); then
      echo "${cand}"
      return 0
    fi
  done < <(find "${base}" -type f -name "*${run_abs}*.dst" -print0 2>/dev/null)
  return 1
}

extract_first_raw_from_dst() {
  local dst="$1"
  root -l -b -q -e "TFile *f=TFile::Open(\"${dst}\"); TTree *t=(TTree*)f->Get(\"JobInfoTree\"); if (t) { TJobInfo *ji=nullptr; t->SetBranchAddress(\"JobInfo\", &ji); t->GetEntry(0); auto v=ji->getJobOptions(); for (auto &s:v) std::cout << s << std::endl; } if (f) f->Close();" 2>/dev/null \
    | awk '/RawDataInputSvc\.InputFiles/ { if (match($0, /\/[^" ]+\.raw/)) { print substr($0, RSTART, RLENGTH); exit } }'
}

find_mc_rec_for_pair() {
  local run="$1" evt="$2" input="$3" rec
  if [[ -f "${input}" && "${input}" == *.rec ]]; then
    echo "${input}"
    return 0
  fi
  [[ -d "${input}" ]] || return 1
  for rec in "${input}"/*.rec; do
    [[ -f "${rec}" ]] || continue
    if python3 - "$rec" "$run" "$evt" <<'PY'
import sys, uproot
rec, run, evt = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
try:
    t = uproot.open(rec)["Event"]
    runs = t["TEvtHeader/m_runId"].array(library="np")
    evts = t["TEvtHeader/m_eventId"].array(library="np")
    ok = any(int(r) == run and int(e) == evt for r, e in zip(runs.tolist(), evts.tolist()))
    raise SystemExit(0 if ok else 1)
except Exception:
    raise SystemExit(1)
PY
    then
      echo "${rec}"
      return 0
    fi
  done
  return 1
}

build_job_from_template() {
  local work_dir="$1" raw_in="$2" run="$3" evt="$4"
  local rec_dir="${work_dir}/rec"
  local raw_dir="${work_dir}/raw"
  local out_dir="${work_dir}/outputs"
  local tag="${run}_${evt}"
  local raw_local="${raw_dir}/${tag}.raw"
  local job_file="${rec_dir}/${tag}.txt"

  mkdir -p "${rec_dir}" "${raw_dir}" "${out_dir}"
  cp "${raw_in}" "${raw_local}"
  cp "${RAW2REC_TEMPLATE}" "${job_file}"
  sed -i "s#RawDataInputSvc.InputFiles=.*#RawDataInputSvc.InputFiles={\"../raw/${tag}.raw\"};#g" "${job_file}"
  if grep -q "EventPreSelect.WriteDst" "${job_file}"; then
    sed -i "s#EventPreSelect.WriteDst=.*#EventPreSelect.WriteDst=true;#g" "${job_file}"
  else
    printf "\nEventPreSelect.WriteDst=true;\n" >> "${job_file}"
  fi
  if grep -q "WriteDst.digiRootOutputFile" "${job_file}"; then
    sed -i "s#WriteDst.digiRootOutputFile=.*#WriteDst.digiRootOutputFile=\"../outputs/${tag}.dst\";#g" "${job_file}"
  else
    printf "WriteDst.digiRootOutputFile=\"../outputs/%s.dst\";\n" "${tag}" >> "${job_file}"
  fi
  if grep -q "EventPreSelect.WriteRec" "${job_file}"; then
    sed -i "s#EventPreSelect.WriteRec=.*#EventPreSelect.WriteRec=true;#g" "${job_file}"
  else
    printf "\nEventPreSelect.WriteRec=true;\n" >> "${job_file}"
  fi
  if grep -q "WriteRec.digiRootOutputFile" "${job_file}"; then
    sed -i "s#WriteRec.digiRootOutputFile=.*#WriteRec.digiRootOutputFile=\"../outputs/${tag}.rec\";#g" "${job_file}"
  else
    printf "WriteRec.digiRootOutputFile=\"../outputs/%s.rec\";\n" "${tag}" >> "${job_file}"
  fi
  if grep -q "EventCnvSvc.digiRootOutputFile" "${job_file}"; then
    sed -i "s#EventCnvSvc.digiRootOutputFile=.*#EventCnvSvc.digiRootOutputFile=\"../outputs/${tag}.digi\";#g" "${job_file}"
  else
    printf "\nEventCnvSvc.digiRootOutputFile=\"../outputs/%s.digi\";\n" "${tag}" >> "${job_file}"
  fi
  echo "${job_file}"
}

validate_rec_file() {
  local rec="$1"
  [[ -f "${rec}" ]] || return 1
  local n
  n="$(root -l -b -q -e "TFile *f=TFile::Open(\"${rec}\"); if (f && !f->IsZombie() && f->Get(\"Event\")) { TTree *t=(TTree*)f->Get(\"Event\"); std::cout << t->GetEntries() << std::endl; } else { std::cout << -1 << std::endl; } if (f) f->Close();" 2>/dev/null | awk 'NF{v=$0} END{print v}')"
  [[ "${n:-0}" =~ ^-?[0-9]+$ ]] || return 1
  (( n > 0 ))
}

prepare_data_pair() {
  local run="$1" evt="$2" search_base="$3" work_dir="$4"
  local dst raw pair_file filtered_raw job_file

  dst="$(find_first_dst_with_event "${run}" "${evt}" "${search_base}")" || { echo "[warn] no dst for ${run} ${evt}"; return 1; }
  echo "[info] DST: ${dst}"
  raw="$(extract_first_raw_from_dst "${dst}" || true)"
  [[ -n "${raw}" && -f "${raw}" ]] || { echo "[warn] no raw path from dst"; return 1; }
  echo "[info] RAW: ${raw}"

  pair_file="${work_dir}/pair.txt"
  mk_pair_file "${run}" "${evt}" "${pair_file}"
  rm -f "${work_dir}/pair.raw" "${work_dir}/pair.txt.raw"
  if ! command -v raw_evt_filter.exe >/dev/null 2>&1; then
    echo "[error] raw_evt_filter.exe not found in current env"
    echo "[hint] please setup your BOSS env manually, then rerun with --prepare"
    return 1
  fi
  ( cd "${work_dir}" && raw_evt_filter.exe "pair.txt" "${raw}" )

  if [[ -f "${work_dir}/pair.txt.raw" ]]; then
    filtered_raw="${work_dir}/pair.txt.raw"
  elif [[ -f "${work_dir}/pair.raw" ]]; then
    filtered_raw="${work_dir}/pair.raw"
  else
    echo "[warn] raw_evt_filter output missing"
    return 1
  fi

  job_file="$(build_job_from_template "${work_dir}" "${filtered_raw}" "${run}" "${evt}")"
  echo "[ok] prepared:"
  echo "     pair   : ${pair_file}"
  echo "     raw    : ${filtered_raw}"
  echo "     job    : ${job_file}"
  echo "     rec out: ${work_dir}/outputs/${run}_${evt}.rec"
  echo "[next] run manually:"
  echo "     cd \"$(dirname "${job_file}")\" && boss.exe \"$(basename "${job_file}")\""
}

finalize_data_pair() {
  local run="$1" evt="$2" work_dir="$3" json_out="$4"
  local pair_file="${work_dir}/pair.txt"
  local rec_file="${work_dir}/outputs/${run}_${evt}.rec"
  [[ -f "${pair_file}" ]] || mk_pair_file "${run}" "${evt}" "${pair_file}"
  validate_rec_file "${rec_file}" || {
    echo "[warn] rec output invalid or missing: ${rec_file}"
    echo "[hint] please run boss.exe manually first"
    return 1
  }
  python3 "${EVENT_PY}" "${rec_file}" "${json_out}" --select "${pair_file}"
}

convert_mc_pair() {
  local run="$1" evt="$2" rec_input="$3" work_dir="$4" json_out="$5"
  local rec_file
  rec_file="$(find_mc_rec_for_pair "${run}" "${evt}" "${rec_input}")" || {
    echo "[warn] no mc rec for ${run} ${evt}"
    return 1
  }
  mk_pair_file "${run}" "${evt}" "${work_dir}/pair.txt"
  python3 "${EVENT_PY}" "${rec_file}" "${json_out}" --select "${work_dir}/pair.txt"
}

run_one_pair() {
  local run="$1" evt="$2" input="$3" mode="$4"
  local run_for_name="${run#-}"
  [[ -n "${run_for_name}" ]] || run_for_name="0"
  local work_dir="${WORK_ROOT}/${run}_${evt}"
  local json_out="${OUT_DIR}/${run_for_name}_${evt}.json"
  mkdir -p "${work_dir}" "${OUT_DIR}"
  echo "[info] run=${run} event=${evt} mode=${mode}"
  if [[ "${mode}" == "mc" ]]; then
    convert_mc_pair "${run}" "${evt}" "${input}" "${work_dir}" "${json_out}"
  else
    [[ -d "${input}" ]] || { echo "[error] data mode requires a search directory"; return 1; }
    case "${SCRIPT_STAGE}" in
      prepare)
        prepare_data_pair "${run}" "${evt}" "${input}" "${work_dir}"
        ;;
      finalize)
        finalize_data_pair "${run}" "${evt}" "${work_dir}" "${json_out}"
        ;;
      auto)
        if [[ -f "${work_dir}/outputs/${run}_${evt}.rec" ]]; then
          finalize_data_pair "${run}" "${evt}" "${work_dir}" "${json_out}"
        else
          prepare_data_pair "${run}" "${evt}" "${input}" "${work_dir}"
        fi
        ;;
      *)
        echo "[error] unknown stage: ${SCRIPT_STAGE}"
        return 1
        ;;
    esac
  fi
  if [[ "${mode}" == "mc" || "${SCRIPT_STAGE}" != "prepare" ]]; then
    echo "[ok] ${json_out}"
  fi
}

main() {
  if [[ "${1:-}" == "--prepare" ]]; then
    SCRIPT_STAGE="prepare"
    shift
  elif [[ "${1:-}" == "--finalize" ]]; then
    SCRIPT_STAGE="finalize"
    shift
  elif [[ "${1:-}" == "--auto" ]]; then
    SCRIPT_STAGE="auto"
    shift
  fi

  (( $# >= 2 )) || { usage; return 1; }
  [[ -f "${RAW2REC_TEMPLATE}" ]] || { echo "[error] missing template: ${RAW2REC_TEMPLATE}"; return 1; }
  mkdir -p "${WORK_ROOT}" "${OUT_DIR}"

  local fail=0
  if [[ -f "$1" && "$1" == *.txt ]]; then
    local list="$1" input="$2" mode="data" run evt
    is_mc_input "${input}" && mode="mc"
    while read -r run evt _; do
      [[ "${run:-}" =~ ^-?[0-9]+$ && "${evt:-}" =~ ^[0-9]+$ ]] || continue
      run_one_pair "${run}" "${evt}" "${input}" "${mode}" || fail=$((fail + 1))
    done < "${list}"
    (( fail == 0 )) || return 1
    return 0
  fi

  (( $# >= 3 )) || { usage; return 1; }
  [[ "$1" =~ ^-?[0-9]+$ && "$2" =~ ^[0-9]+$ ]] || { echo "[error] run/event must be integers"; return 1; }
  local mode="data"
  is_mc_input "$3" && mode="mc"
  run_one_pair "$1" "$2" "$3" "${mode}"
}

main "$@"
