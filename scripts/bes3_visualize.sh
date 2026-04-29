#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${BASE_DIR}/data/views"
WEB_DIR="${BASE_DIR}/web"
MACRO="${BASE_DIR}/scripts/export_geometry.C"
GEOM_PY="${BASE_DIR}/scripts/prepare_geometry.py"
REC2PHX="${BASE_DIR}/scripts/prepare_events.py"

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

PREPARE() {
  mkdir -p "${DATA_DIR}"
  echo "[1/7] Export full Bes geometry..."
  ROOT_EXPORT "${BES_GDML}" "${DATA_DIR}/full.root.json"

  echo "[2/7] Export TOF geometry..."
  ROOT_EXPORT "${TOF_GDML}" "${DATA_DIR}/tof.root.json"

  echo "[3/7] Export MUC geometry + strip map..."
  ROOT_EXPORT "${MUC_GDML}" "${DATA_DIR}/muc.root.json"
  root -l -b -q "${MACRO}(\"${MUC_GDML}\",\"${DATA_DIR}/muc_strip_map.json\",\"muc_strip_map\")"

  echo "[4/7] Export CGEM geometry..."
  ROOT_EXPORT "${CGEM_GDML}" "${DATA_DIR}/cgem.root.json"

  echo "[5/7] Build MDC approximate geometry..."
  python3 "${GEOM_PY}" approximate "${MDC_GDML}" "${DATA_DIR}/Mdc_approx.gdml"
  ROOT_EXPORT "${DATA_DIR}/Mdc_approx.gdml" "${DATA_DIR}/mdc_approx.root.json"

  echo "[6/7] Split MDC inner/outer views..."
  python3 "${GEOM_PY}" split-mdc "${DATA_DIR}/Mdc_approx.gdml" "${DATA_DIR}/mdc"
  ROOT_EXPORT "${DATA_DIR}/mdc_inner.gdml" "${DATA_DIR}/mdc_inner_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer.gdml" "${DATA_DIR}/mdc_outer_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer_axial.gdml" "${DATA_DIR}/mdc_outer_axial_approx.root.json"
  ROOT_EXPORT "${DATA_DIR}/mdc_outer_stereo.gdml" "${DATA_DIR}/mdc_outer_stereo_approx.root.json"

  echo "[7/7] Build EMC approximate geometry..."
  python3 "${GEOM_PY}" approximate "${EMC_GDML}" "${DATA_DIR}/Emc_approx.gdml"
  ROOT_EXPORT "${DATA_DIR}/Emc_approx.gdml" "${DATA_DIR}/emc_approx.root.json"

  echo "Prepare completed. Use: bash scripts/bes3_visualize.sh serve"
}

PREPARE_EVENT() {
  local rec_file="/afs/ihep.ac.cn/users/y/yanjiazhen/nphy/Knunubar/rawData/outputs/44113_374390.rec"
  local rec_dir=""
  for arg in "$@"; do
    if [[ -d "$arg" ]]; then
      rec_dir="$arg"
    elif [[ -n "$arg" ]]; then
      rec_file="$arg"
    fi
  done
  local out_json="${BASE_DIR}/data/events/event.rec.json"
  mkdir -p "${BASE_DIR}/data/events"
  if [[ -n "${rec_dir}" ]]; then
    echo "[event] Convert all REC files in directory: ${rec_dir}"
    python3 "${REC2PHX}" --rec-dir "${rec_dir}" "${out_json}"
  else
    echo "[event] Convert REC to Phoenix JSON..."
    python3 "${REC2PHX}" "${rec_file}" "${out_json}"
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
  # Patch the inline defaults in index.html in-place.
  sed -i \
    -e "s|window\.BES3_SELECTED_VIEW\s*=.*|window.BES3_SELECTED_VIEW      = \"${det}\";|" \
    "${WEB_DIR}/index.html"
  echo "Selected view: ${det}"
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
    echo "  bash scripts/bes3_visualize.sh prepare-event [rec-file|rec-dir]"
    echo "  bash scripts/bes3_visualize.sh list"
    echo "  bash scripts/bes3_visualize.sh view <assembled_besiii|mdc|tof|muc|cgem|emc>"
    echo "  bash scripts/bes3_visualize.sh serve [port]"
    ;;
esac
