#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVENT_PY="${BASE_DIR}/scripts/prepare_events.py"

RAW2REC_TEMPLATE="/afs/ihep.ac.cn/users/y/yanjiazhen/nphy/Knunubar/rawData/rec/44113_374390.txt"

WORK_ROOT="${BASE_DIR}/data/convert_work"
OUT_DIR="${BASE_DIR}/data/events/converted"
SCRIPT_STAGE="auto"
DEFAULT_LIST_FILE="/afs/ihep.ac.cn/users/y/yanjiazhen/nphy/Jpsi2PhiEtap/SignalMC/KSSLDecay/KLrec/run_rec.txt"
DEFAULT_SEARCH_BASE="/bes3fs/offline/data/708-1/jpsi"
PREPARED_JOBS=()
DST_CACHE_FILE="${WORK_ROOT}/dst_event_range_cache.tsv"
declare -A DST_RANGE_MIN_CACHE=()
declare -A DST_RANGE_MAX_CACHE=()
DST_CACHE_LOADED=0

usage() {
  echo "Usage:"
  echo "  bash scripts/convert.sh [--prepare|--finalize|--auto] <run> <event> <path-to-rec-or-search>"
  echo "  bash scripts/convert.sh [--prepare|--finalize|--auto] <run_event_list.txt> <path-to-rec-or-search>"
  echo "  bash scripts/convert.sh   # use defaults"
  echo ""
  echo "Stages:"
  echo "  --prepare : data mode only, generate pair/raw/jobOptions txt, do NOT run boss.exe"
  echo "  --finalize: convert rec to json (requires existing rec output)"
  echo "  --auto    : data mode: if rec exists => finalize, else prepare (default)"
  echo ""
  echo "Auto mode:"
  echo "  - MC: <path> is a .rec file or directory containing .rec files"
  echo "  - Data: otherwise, <path> is dst search base (skip '/tag/' dst)"
  echo ""
  echo "Defaults (when no args provided):"
  echo "  list file : ${DEFAULT_LIST_FILE}"
  echo "  data base : ${DEFAULT_SEARCH_BASE}"
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
  local run_abs="${run#-}" cand checked=0 matched=0
  local -a candidates=() valid_candidates=() shortlist=() unknownlist=()
  local -a sfo1_paths=() sfo2_paths=() sfo_other_paths=()
  local -a sfo1_guess=() sfo2_guess=() sfo_other_guess=()
  local sfo_id cand_group
  local fast_checked=0
  local fno
  local rmin rmax
  echo "[trace] search dst begin: run=${run} event=${evt} base=${base}" >&2
  while IFS= read -r -d '' cand; do
    candidates+=("${cand}")
  done < <(find -L "${base}" -type f -name "*${run_abs}*.dst" -print0 2>/dev/null | sort -z)

  for cand in "${candidates[@]}"; do
    if [[ "${cand}" == *"/mc/"* ]]; then
      checked=$((checked + 1))
      echo "[trace] skip(mc) dst #${checked}: ${cand}" >&2
      continue
    fi
    if [[ "${cand}" == *"/tag/"* ]]; then
      checked=$((checked + 1))
      echo "[trace] skip(tag) dst #${checked}: ${cand}" >&2
      continue
    fi
    valid_candidates+=("${cand}")
    sfo_id="$(extract_dst_sfo_id "${cand}")"
    case "${sfo_id}" in
      1) sfo1_paths+=("${cand}") ;;
      2) sfo2_paths+=("${cand}") ;;
      *) sfo_other_paths+=("${cand}") ;;
    esac
  done

  # SFO-aware fast path: model/search within each SFO stream first.
  ((${#sfo1_paths[@]} > 0)) && build_group_guess_order "${evt}" sfo1_guess "${sfo1_paths[@]}"
  ((${#sfo2_paths[@]} > 0)) && build_group_guess_order "${evt}" sfo2_guess "${sfo2_paths[@]}"
  ((${#sfo_other_paths[@]} > 0)) && build_group_guess_order "${evt}" sfo_other_guess "${sfo_other_paths[@]}"
  for cand_group in sfo1_guess sfo2_guess sfo_other_guess; do
    local -n group_ref="${cand_group}"
    for cand in "${group_ref[@]}"; do
      checked=$((checked + 1))
      fast_checked=$((fast_checked + 1))
      read -r rmin rmax < <(get_dst_event_range "${cand}")
      if [[ "${rmin}" =~ ^-?[0-9]+$ && "${rmax}" =~ ^-?[0-9]+$ ]]; then
        echo "[trace] fast-check(${cand_group}) range dst #${checked}: [${rmin},${rmax}] ${cand}" >&2
      else
        echo "[trace] fast-check(${cand_group}) range dst #${checked}: unknown ${cand}" >&2
      fi
      echo "[trace] fast-check(${cand_group}) dst #${checked}: ${cand}" >&2
      if dst_contains_event "${cand}" "${evt}"; then
        matched=1
        echo "[trace] found dst by sfo-fast-guess: ${cand}" >&2
        echo "${cand}"
        return 0
      fi
      (( fast_checked >= 12 )) && break 2
    done
  done

  echo "[trace] fallback range shortlist mode start" >&2
  for cand in "${candidates[@]}"; do
    checked=$((checked + 1))
    if [[ "${cand}" == *"/mc/"* ]]; then
      echo "[trace] skip(mc) dst #${checked}: ${cand}" >&2
      continue
    fi
    if [[ "${cand}" == *"/tag/"* ]]; then
      echo "[trace] skip(tag) dst #${checked}: ${cand}" >&2
      continue
    fi
    read -r rmin rmax < <(get_dst_event_range "${cand}")
    if [[ "${rmin}" =~ ^-?[0-9]+$ && "${rmax}" =~ ^-?[0-9]+$ ]]; then
      echo "[trace] dst #${checked} range=[${rmin},${rmax}] ${cand}" >&2
      if (( evt >= rmin && evt <= rmax )); then
        shortlist+=("${cand}")
      fi
    else
      echo "[trace] dst #${checked} range=unknown ${cand}" >&2
      unknownlist+=("${cand}")
    fi
  done

  if ((${#shortlist[@]} > 0)); then
    echo "[trace] shortlist size=${#shortlist[@]} for event=${evt}" >&2
    for cand in "${shortlist[@]}"; do
      if dst_contains_event "${cand}" "${evt}"; then
        matched=1
        echo "[trace] found dst in shortlist: ${cand}" >&2
        echo "${cand}"
        return 0
      fi
    done
  fi

  if ((${#unknownlist[@]} > 0)); then
    echo "[trace] fallback unknown-range checks=${#unknownlist[@]}" >&2
    for cand in "${unknownlist[@]}"; do
      if dst_contains_event "${cand}" "${evt}"; then
        matched=1
        echo "[trace] found dst in fallback: ${cand}" >&2
        echo "${cand}"
        return 0
      fi
    done
  fi

  if (( matched == 0 )); then
    echo "[trace] no dst found: run=${run} event=${evt}, checked=${checked}, shortlist=${#shortlist[@]}" >&2
  fi
  return 1
}

extract_dst_file_index() {
  local dst="$1" base
  base="$(basename "${dst}")"
  if [[ "${base}" =~ file0*([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

build_guess_candidates_by_file_distance() {
  local target="$1" out_arr_name="$2"
  shift 2
  local -a paths=("$@")
  local -a scored=()
  local p f d
  for p in "${paths[@]}"; do
    f="$(extract_dst_file_index "${p}" || true)"
    [[ "${f}" =~ ^[0-9]+$ ]] || continue
    d=$(( f > target ? f - target : target - f ))
    scored+=("$(printf "%08d|%s" "${d}" "${p}")")
  done
  IFS=$'\n' scored=($(printf "%s\n" "${scored[@]}" | sort))
  local -n _out="${out_arr_name}"
  _out=()
  for p in "${scored[@]}"; do
    _out+=("${p#*|}")
  done
}

extract_dst_sfo_id() {
  local dst="$1" base
  base="$(basename "${dst}")"
  if [[ "${base}" =~ SFO-([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  echo "0"
}

build_group_guess_order() {
  local evt="$1" out_arr_name="$2"
  shift 2
  local -a group_paths=("$@")
  local -a sampled_files=() sampled_min=() guess_order=()
  local cand fno rmin rmax f0 f1 r0 r1 step_evt_per_file target_fno
  local -n _out="${out_arr_name}"
  _out=()
  for cand in "${group_paths[@]}"; do
    fno="$(extract_dst_file_index "${cand}" || true)"
    [[ -n "${fno}" ]] || continue
    sampled_files+=("${fno}")
    read -r rmin rmax < <(get_dst_event_range "${cand}")
    sampled_min+=("${rmin}")
    echo "[trace] sample range(sfo=$(extract_dst_sfo_id "${cand}")): file=${fno} range=[${rmin},${rmax}] ${cand}" >&2
    ((${#sampled_files[@]} >= 2)) && break
  done
  if ((${#sampled_files[@]} < 2)); then
    _out=("${group_paths[@]}")
    return 0
  fi
  f0="${sampled_files[0]}"; f1="${sampled_files[1]}"
  r0="${sampled_min[0]}"; r1="${sampled_min[1]}"
  if [[ "${f0}" =~ ^[0-9]+$ && "${f1}" =~ ^[0-9]+$ && "${r0}" =~ ^-?[0-9]+$ && "${r1}" =~ ^-?[0-9]+$ ]] && (( f1 != f0 )); then
    step_evt_per_file=$(( (r1 - r0) / (f1 - f0) ))
    if (( step_evt_per_file > 0 )); then
      target_fno=$(( f0 + (evt - r0) / step_evt_per_file ))
      echo "[trace] fast-guess model(sfo=$(extract_dst_sfo_id "${group_paths[0]}")): base(file=${f0},evt=${r0}) step=${step_evt_per_file}, target_file=${target_fno}" >&2
      build_guess_candidates_by_file_distance "${target_fno}" guess_order "${group_paths[@]}"
      _out=("${guess_order[@]}")
      return 0
    fi
  fi
  _out=("${group_paths[@]}")
}

load_dst_range_cache_once() {
  (( DST_CACHE_LOADED == 1 )) && return 0
  if [[ -f "${DST_CACHE_FILE}" ]]; then
    while IFS=$'\t' read -r path rmin rmax; do
      [[ -n "${path}" ]] || continue
      [[ "${rmin}" =~ ^-?[0-9]+$ && "${rmax}" =~ ^-?[0-9]+$ ]] || continue
      DST_RANGE_MIN_CACHE["${path}"]="${rmin}"
      DST_RANGE_MAX_CACHE["${path}"]="${rmax}"
    done < "${DST_CACHE_FILE}"
  fi
  DST_CACHE_LOADED=1
}

append_dst_range_cache() {
  local path="$1" rmin="$2" rmax="$3"
  [[ "${rmin}" =~ ^-?[0-9]+$ && "${rmax}" =~ ^-?[0-9]+$ ]] || return 0
  mkdir -p "$(dirname "${DST_CACHE_FILE}")"
  printf "%s\t%s\t%s\n" "${path}" "${rmin}" "${rmax}" >> "${DST_CACHE_FILE}"
}

get_dst_event_range() {
  local dst="$1"
  local rmin rmax
  load_dst_range_cache_once
  if [[ -n "${DST_RANGE_MIN_CACHE[${dst}]:-}" && -n "${DST_RANGE_MAX_CACHE[${dst}]:-}" ]] \
    && [[ "${DST_RANGE_MIN_CACHE[${dst}]}" =~ ^-?[0-9]+$ && "${DST_RANGE_MAX_CACHE[${dst}]}" =~ ^-?[0-9]+$ ]]; then
    echo "${DST_RANGE_MIN_CACHE[${dst}]} ${DST_RANGE_MAX_CACHE[${dst}]}"
    return 0
  fi
  read -r rmin rmax < <(root -l -b -q -e "TFile *f=TFile::Open(\"${dst}\"); if (!f || f->IsZombie() || !f->Get(\"Event\")) { std::cout << \"nan nan\" << std::endl; if (f) f->Close(); return; } TTree *t=(TTree*)f->Get(\"Event\"); if (!t || t->GetEntries()<=0) { std::cout << \"nan nan\" << std::endl; if (f) f->Close(); return; } double mn=t->GetMinimum(\"m_eventId\"); double mx=t->GetMaximum(\"m_eventId\"); if (!(mn==mn) || !(mx==mx)) { mn=t->GetMinimum(\"TEvtHeader/m_eventId\"); mx=t->GetMaximum(\"TEvtHeader/m_eventId\"); } if (!(mn==mn) || !(mx==mx)) { std::cout << \"nan nan\" << std::endl; } else { std::cout << (long long)mn << \" \" << (long long)mx << std::endl; } f->Close();" 2>/dev/null | awk 'NF{v=$0} END{print v}')
  if [[ "${rmin}" =~ ^-?[0-9]+$ && "${rmax}" =~ ^-?[0-9]+$ ]]; then
    DST_RANGE_MIN_CACHE["${dst}"]="${rmin}"
    DST_RANGE_MAX_CACHE["${dst}"]="${rmax}"
  fi
  append_dst_range_cache "${dst}" "${rmin}" "${rmax}"
  echo "${rmin} ${rmax}"
}

dst_contains_event() {
  local dst="$1" evt="$2" count
  count="$(root -l -b -q -e "TFile *f=TFile::Open(\"${dst}\"); if (f && f->Get(\"Event\")) { TTree *t=(TTree*)f->Get(\"Event\"); std::cout << t->GetEntries(\"m_eventId==${evt}\") << std::endl; } else { std::cout << 0 << std::endl; } if (f) f->Close();" 2>/dev/null | awk 'NF{v=$0} END{print v}')"
  echo "[trace] event match check: dst=${dst} event=${evt} count=${count:-0}" >&2
  [[ "${count:-0}" =~ ^[0-9]+$ ]] && (( count > 0 ))
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

build_batch_job_from_template() {
  local work_dir="$1"
  shift
  local rec_dir="${work_dir}/rec"
  local out_dir="${work_dir}/outputs"
  local job_file="${rec_dir}/batch.txt"
  local raw_inputs=("$@")
  local joined_inputs=""
  local raw_path

  mkdir -p "${rec_dir}" "${out_dir}"
  cp "${RAW2REC_TEMPLATE}" "${job_file}"

  for raw_path in "${raw_inputs[@]}"; do
    if [[ -n "${joined_inputs}" ]]; then
      joined_inputs+=","
    fi
    joined_inputs+="\"${raw_path}\""
  done

  sed -i "s#RawDataInputSvc.InputFiles=.*#RawDataInputSvc.InputFiles={${joined_inputs}};#g" "${job_file}"
  if grep -q "EventPreSelect.WriteDst" "${job_file}"; then
    sed -i "s#EventPreSelect.WriteDst=.*#EventPreSelect.WriteDst=true;#g" "${job_file}"
  else
    printf "\nEventPreSelect.WriteDst=true;\n" >> "${job_file}"
  fi
  if grep -q "WriteDst.digiRootOutputFile" "${job_file}"; then
    sed -i "s#WriteDst.digiRootOutputFile=.*#WriteDst.digiRootOutputFile=\"../outputs/batch.dst\";#g" "${job_file}"
  else
    printf "WriteDst.digiRootOutputFile=\"../outputs/batch.dst\";\n" >> "${job_file}"
  fi
  if grep -q "EventPreSelect.WriteRec" "${job_file}"; then
    sed -i "s#EventPreSelect.WriteRec=.*#EventPreSelect.WriteRec=true;#g" "${job_file}"
  else
    printf "\nEventPreSelect.WriteRec=true;\n" >> "${job_file}"
  fi
  if grep -q "WriteRec.digiRootOutputFile" "${job_file}"; then
    sed -i "s#WriteRec.digiRootOutputFile=.*#WriteRec.digiRootOutputFile=\"../outputs/batch.rec\";#g" "${job_file}"
  else
    printf "WriteRec.digiRootOutputFile=\"../outputs/batch.rec\";\n" >> "${job_file}"
  fi
  if grep -q "EventCnvSvc.digiRootOutputFile" "${job_file}"; then
    sed -i "s#EventCnvSvc.digiRootOutputFile=.*#EventCnvSvc.digiRootOutputFile=\"../outputs/batch.digi\";#g" "${job_file}"
  else
    printf "\nEventCnvSvc.digiRootOutputFile=\"../outputs/batch.digi\";\n" >> "${job_file}"
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
  PREPARED_JOBS+=("${job_file}")
  echo "[ok] prepared:"
  echo "     pair   : ${pair_file}"
  echo "     raw    : ${filtered_raw}"
  echo "     job    : ${job_file}"
  echo "     rec out: ${work_dir}/outputs/${run}_${evt}.rec"
  echo "[next] run manually:"
  echo "     cd \"$(dirname "${job_file}")\" && boss.exe \"$(basename "${job_file}")\""
}

write_batch_boss_script() {
  local list_file="$1" job_file="$2"
  local out_script="${WORK_ROOT}/run_boss_all.sh"
  local source_name
  source_name="$(basename "${list_file}")"
  {
    echo "#!/usr/bin/env bash"
    echo "set -euo pipefail"
    echo ""
    echo "# Auto-generated by convert.sh from ${source_name}"
    echo "# Run one aggregated boss job for all filtered raw files."
    echo ""
    echo "echo \"[run] ${job_file}\""
    echo "cd \"$(dirname "${job_file}")\" && boss.exe \"$(basename "${job_file}")\""
    echo ""
  } > "${out_script}"
  chmod +x "${out_script}"
  echo "[ok] batch boss script: ${out_script}"
}

prepare_data_pair_raw_only() {
  local run="$1" evt="$2" search_base="$3" work_dir="$4" pair_out="$5" filtered_raw_out="$6"
  local dst raw work_pair

  echo "[event] begin prepare: run=${run} event=${evt}" >&2
  dst="$(find_first_dst_with_event "${run}" "${evt}" "${search_base}")" || { echo "[warn] no dst for ${run} ${evt}"; return 1; }
  echo "[info] DST: ${dst}"
  echo "[event] extract raw path from dst: ${dst}" >&2
  raw="$(extract_first_raw_from_dst "${dst}" || true)"
  [[ -n "${raw}" && -f "${raw}" ]] || { echo "[warn] no raw path from dst"; return 1; }
  echo "[info] RAW: ${raw}"

  mk_pair_file "${run}" "${evt}" "${pair_out}"
  work_pair="${work_dir}/pair.txt"
  cp "${pair_out}" "${work_pair}"
  echo "[event] pair file prepared: ${pair_out}" >&2
  rm -f "${work_dir}/pair.raw" "${work_dir}/pair.txt.raw"
  echo "[event] raw filter start: pair=$(basename "${work_pair}") raw=${raw}" >&2
  ( cd "${work_dir}" && raw_evt_filter.exe "pair.txt" "${raw}" )
  echo "[event] raw filter done: run=${run} event=${evt}" >&2

  if [[ -f "${work_dir}/pair.txt.raw" ]]; then
    cp "${work_dir}/pair.txt.raw" "${filtered_raw_out}"
  elif [[ -f "${work_dir}/$(basename "${pair_out}").raw" ]]; then
    cp "${work_dir}/$(basename "${pair_out}").raw" "${filtered_raw_out}"
  elif [[ -f "${work_dir}/pair.raw" ]]; then
    cp "${work_dir}/pair.raw" "${filtered_raw_out}"
  else
    echo "[warn] raw_evt_filter output missing"
    return 1
  fi
  echo "[event] filtered raw saved: ${filtered_raw_out}" >&2
}

run_data_list_batch() {
  local list="$1" input="$2"
  local batch_name="${list##*/}"
  batch_name="${batch_name%.txt}"
  local batch_dir="${WORK_ROOT}/batch_${batch_name}"
  local pairs_dir="${batch_dir}/pairs"
  local raws_dir="${batch_dir}/raw"
  local out_rec="${batch_dir}/outputs/batch.rec"
  local batch_job="${batch_dir}/rec/batch.txt"
  local run evt tag run_for_name json_out pair_file filtered_raw merged_json
  local fail=0
  local raw_inputs=()

  mkdir -p "${batch_dir}" "${pairs_dir}" "${raws_dir}" "${OUT_DIR}"
  [[ -d "${input}" ]] || { echo "[error] data mode requires a search directory"; return 1; }

  if [[ "${SCRIPT_STAGE}" == "finalize" || ( "${SCRIPT_STAGE}" == "auto" && -f "${out_rec}" ) ]]; then
    validate_rec_file "${out_rec}" || { echo "[warn] batch rec output invalid or missing: ${out_rec}"; return 1; }
    merged_json="${OUT_DIR}/${batch_name}.json"
    echo "[info] finalize merged json from batch rec: ${out_rec}"
    if python3 "${EVENT_PY}" "${out_rec}" "${merged_json}" --select "${list}"; then
      echo "[ok] merged json: ${merged_json}"
    else
      return 1
    fi
    return 0
  fi

  if ! command -v raw_evt_filter.exe >/dev/null 2>&1; then
    echo "[error] raw_evt_filter.exe not found in current env"
    echo "[hint] please setup your BOSS env manually, then rerun with --prepare"
    return 1
  fi

  while read -r run evt _; do
    [[ "${run:-}" =~ ^-?[0-9]+$ && "${evt:-}" =~ ^[0-9]+$ ]] || continue
    tag="${run}_${evt}"
    pair_file="${pairs_dir}/${tag}.txt"
    filtered_raw="${raws_dir}/${tag}.raw"
    echo "[info] prepare run=${run} event=${evt} (batch mode)"
    echo "[trace] event tag=${tag} pair=${pair_file} out_raw=${filtered_raw}" >&2
    prepare_data_pair_raw_only "${run}" "${evt}" "${input}" "${batch_dir}" "${pair_file}" "${filtered_raw}" || { fail=$((fail + 1)); continue; }
    raw_inputs+=("${filtered_raw}")
    echo "[ok] prepared pair: ${tag}"
  done < "${list}"

  (( fail == 0 )) || return 1
  ((${#raw_inputs[@]} > 0)) || { echo "[warn] no valid pairs prepared"; return 1; }
  batch_job="$(build_batch_job_from_template "${batch_dir}" "${raw_inputs[@]}")"
  echo "[ok] prepared batch job:"
  echo "     job    : ${batch_job}"
  echo "     rec out: ${out_rec}"
  echo "[next] run manually:"
  echo "     cd \"$(dirname "${batch_job}")\" && boss.exe \"$(basename "${batch_job}")\""
  write_batch_boss_script "${list}" "${batch_job}"
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

  if (( $# == 0 )); then
    echo "[info] no args provided, using defaults"
    set -- "${DEFAULT_LIST_FILE}" "${DEFAULT_SEARCH_BASE}"
  fi

  (( $# >= 2 )) || { usage; return 1; }
  [[ -f "${RAW2REC_TEMPLATE}" ]] || { echo "[error] missing template: ${RAW2REC_TEMPLATE}"; return 1; }
  mkdir -p "${WORK_ROOT}" "${OUT_DIR}"

  local fail=0
  if [[ -f "$1" && "$1" == *.txt ]]; then
    local list="$1" input="$2" mode="data" run evt
    is_mc_input "${input}" && mode="mc"
    if [[ "${mode}" == "data" ]]; then
      run_data_list_batch "${list}" "${input}"
      return $?
    fi
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
