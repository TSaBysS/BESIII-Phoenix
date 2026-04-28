#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${BASE_DIR}/data/views"
WEB_DIR="${BASE_DIR}/web"
MACRO="${BASE_DIR}/scripts/export_gdml_to_rootjson.C"
APPROX="${BASE_DIR}/scripts/approximate_emc_gdml.py"
MDC_SPLIT="${BASE_DIR}/scripts/split_mdc_gdml_views.py"
REC2PHX="${BASE_DIR}/scripts/rec_to_phoenix_event.py"
MUC_STRIP_MAP_MACRO="${BASE_DIR}/scripts/export_muc_strip_map.C"

BES_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Bes.gdml"
TOF_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Tof.gdml"
MUC_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Muc.gdml"
CGEM_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Cgem_noHole_noStrip_effDen.gdml"
EMC_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Emc.gdml"
MDC_GDML="/afs/ihep.ac.cn/users/y/yanjiazhen/besfs5/boss-cgem/BOSS_Data/GdmlManagement/dat/Mdc.gdml"

ROOT_EXPORT() {
  local in_gdml="$1"
  local out_json="$2"
  root -l -b -q "${MACRO}(\"${in_gdml}\",\"${out_json}\")"
}

WRITE_GEOMETRY_MAP() {
  cat > "${WEB_DIR}/geometries.js" <<'EOF'
window.BES3_GEOMETRIES = {
  assembled_besiii: "__assembled__",
  mdc: "../data/views/mdc_approx.root.json",
  tof: "../data/views/tof.root.json",
  muc: "../data/views/muc.root.json",
  cgem: "../data/views/cgem.root.json",
  emc: "../data/views/emc_approx.root.json"
};
window.BES3_DEFAULT_VIEW = "assembled_besiii";
EOF
}

PREPARE() {
  mkdir -p "${DATA_DIR}"
  echo "[1/9] Export full geometry..."
  ROOT_EXPORT "${BES_GDML}" "${DATA_DIR}/full.root.json"

  echo "[2/9] Export TOF geometry..."
  ROOT_EXPORT "${TOF_GDML}" "${DATA_DIR}/tof.root.json"

  echo "[3/9] Export MUC geometry..."
  ROOT_EXPORT "${MUC_GDML}" "${DATA_DIR}/muc.root.json"
  echo "[3b/9] Export MUC strip map..."
  root -l -b -q "${MUC_STRIP_MAP_MACRO}(\"${MUC_GDML}\",\"${DATA_DIR}/muc_strip_map.json\")"

  echo "[4/9] Export CGEM geometry..."
  ROOT_EXPORT "${CGEM_GDML}" "${DATA_DIR}/cgem.root.json"

  echo "[5/9] Build MDC approximate geometry..."
  python "${APPROX}" "${MDC_GDML}" "${DATA_DIR}/Mdc_approx.gdml"
  ROOT_EXPORT "${DATA_DIR}/Mdc_approx.gdml" "${DATA_DIR}/mdc_approx.root.json"

  echo "[6/9] Split MDC inner/outer views..."
  python "${MDC_SPLIT}" "${DATA_DIR}/Mdc_approx.gdml" "${DATA_DIR}/mdc"
  ROOT_EXPORT "${DATA_DIR}/mdc_inner.gdml" "${DATA_DIR}/mdc_inner_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer.gdml" "${DATA_DIR}/mdc_outer_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer_axial.gdml" "${DATA_DIR}/mdc_outer_axial_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer_stereo.gdml" "${DATA_DIR}/mdc_outer_stereo_approx.root.json"

  echo "[7/9] Build EMC approximate geometry..."
  python "${APPROX}" "${EMC_GDML}" "${DATA_DIR}/Emc_approx.gdml"
  ROOT_EXPORT "${DATA_DIR}/Emc_approx.gdml" "${DATA_DIR}/emc_approx.root.json"

  echo "[8/9] Writing geometry map..."
  WRITE_GEOMETRY_MAP
  echo "[9/9] Prepare completed."
  echo "Done. Use: bash scripts/bes3_visualize.sh serve"
}

PREPARE_EVENT() {
  local rec_file="/afs/ihep.ac.cn/users/y/yanjiazhen/nphy/Knunubar/rawData/outputs/44113_374390.rec"
  local rec_dir=""
  local helix_debug=0
  for arg in "$@"; do
    if [[ "$arg" == "--helix-debug" ]]; then
      helix_debug=1
    elif [[ -d "$arg" ]]; then
      rec_dir="$arg"
    elif [[ -n "$arg" ]]; then
      rec_file="$arg"
    fi
  done
  local out_json="${BASE_DIR}/data/events/event.rec.json"
  mkdir -p "${BASE_DIR}/data/events"
  if [[ -n "${rec_dir}" ]]; then
    echo "[event] Convert all REC files in directory: ${rec_dir}"
    if [[ "${helix_debug}" -eq 1 ]]; then
      python3 "${REC2PHX}" --with-helix5 --rec-dir "${rec_dir}" "${out_json}"
    else
      python3 "${REC2PHX}" --rec-dir "${rec_dir}" "${out_json}"
    fi
  else
    echo "[event] Convert REC to Phoenix JSON..."
    if [[ "${helix_debug}" -eq 1 ]]; then
      python3 "${REC2PHX}" --with-helix5 "${rec_file}" "${out_json}"
    else
      python3 "${REC2PHX}" "${rec_file}" "${out_json}"
    fi
  fi
  echo "[event] Wrote: ${out_json}"
}

SERVE() {
  local port="${1:-8010}"
  echo "Open: http://127.0.0.1:${port}/web/"
  cd "${BASE_DIR}"
  python3 -m http.server "${port}"
}

VIEW() {
  local det="${1:-assembled_besiii}"
  local helix_debug=0
  for arg in "$@"; do
    if [[ "$arg" == "--helix-debug" ]]; then
      helix_debug=1
    fi
  done
  cat > "${WEB_DIR}/config.js" <<EOF
window.BES3_SELECTED_VIEW = "${det}";
window.BES3_ENABLE_HELIX_DEBUG = ${helix_debug};
EOF
  echo "Selected view: ${det} (helix debug=${helix_debug})"
}

LIST() {
  echo "Available views:"
  echo "  assembled_besiii"
  echo "  mdc"
  echo "  tof"
  echo "  muc"
  echo "  cgem"
  echo "  emc"
}

cmd="${1:-help}"
case "${cmd}" in
  prepare) PREPARE ;;
  prepare-event) shift; PREPARE_EVENT "$@" ;;
  serve) shift; SERVE "${1:-8010}" ;;
  view) shift; VIEW "${1:-assembled_besiii}" "$@" ;;
  list) LIST ;;
  *)
    echo "Usage:"
    echo "  bash scripts/bes3_visualize.sh prepare"
    echo "  bash scripts/bes3_visualize.sh prepare-event [rec-file|rec-dir] [--helix-debug]"
    echo "  bash scripts/bes3_visualize.sh list"
    echo "  bash scripts/bes3_visualize.sh view <assembled_besiii|mdc|tof|muc|cgem|emc> [--helix-debug]"
    echo "  bash scripts/bes3_visualize.sh serve [port]"
    ;;
esac
