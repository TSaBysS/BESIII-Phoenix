// Export BESIII MUC strip geometry map from GDML.
// Usage:
//   root -l -b -q 'scripts/export_muc_strip_map.C("/path/Muc.gdml","/path/muc_strip_map.json")'

#include <TGeoBBox.h>
#include <TGeoManager.h>
#include <TGeoMatrix.h>
#include <TGeoNode.h>
#include <TGeoShape.h>
#include <TGeoVolume.h>
#include <TMath.h>

#include <cstdio>
#include <fstream>
#include <map>
#include <string>

struct StripRow {
  double x, y, z;
  double sx, sy, sz;
  double ex[3], ey[3], ez[3];
};

static bool parse_muc_name(const char* s, int& part, int& seg, int& gap, int& strip) {
  // Common names:
  //   lMucP1S2G3s013
  //   pv_lMucP1S2G3s013_13
  if (std::sscanf(s, "lMucP%dS%dG%ds%d", &part, &seg, &gap, &strip) == 4) return true;
  int dummy = 0;
  if (std::sscanf(s, "pv_lMucP%dS%dG%ds%d_%d", &part, &seg, &gap, &strip, &dummy) == 5) return true;
  return false;
}

static void norm3(double v[3]) {
  double n = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (n < 1e-12) {
    v[0] = 1.0;
    v[1] = 0.0;
    v[2] = 0.0;
    return;
  }
  v[0] /= n;
  v[1] /= n;
  v[2] /= n;
}

static void walk_node(TGeoHMatrix& acc, TGeoNode* node, std::map<std::string, StripRow>& out) {
  if (!node) return;
  TGeoVolume* vol = node->GetVolume();
  if (!vol) return;

  TGeoHMatrix cur(acc);
  TGeoMatrix* m = node->GetMatrix();
  if (m) cur.Multiply(m);

  int part = -1, seg = -1, gap = -1, strip = -1;
  bool ok = parse_muc_name(node->GetName(), part, seg, gap, strip) ||
            parse_muc_name(vol->GetName(), part, seg, gap, strip);
  if (ok && part >= 0 && seg >= 0 && gap >= 0 && strip >= 0) {
    TGeoShape* sh = vol->GetShape();
    if (sh && sh->InheritsFrom(TGeoBBox::Class())) {
      auto* box = (TGeoBBox*)sh;
      double o[3] = {0, 0, 0};
      double lx[3] = {1, 0, 0};
      double ly[3] = {0, 1, 0};
      double lz[3] = {0, 0, 1};
      double wo[3], wx[3], wy[3], wz[3];
      cur.LocalToMaster(o, wo);
      cur.LocalToMaster(lx, wx);
      cur.LocalToMaster(ly, wy);
      cur.LocalToMaster(lz, wz);
      double ex[3] = {wx[0] - wo[0], wx[1] - wo[1], wx[2] - wo[2]};
      double ey[3] = {wy[0] - wo[0], wy[1] - wo[1], wy[2] - wo[2]};
      double ez[3] = {wz[0] - wo[0], wz[1] - wo[1], wz[2] - wo[2]};
      norm3(ex);
      norm3(ey);
      norm3(ez);

      StripRow r;
      // ROOT geometry unit is cm; convert to mm-like numeric (consistent with current pipeline).
      r.x = wo[0] * 10.0;
      r.y = wo[1] * 10.0;
      r.z = wo[2] * 10.0;
      r.sx = box->GetDX() * 20.0;
      r.sy = box->GetDY() * 20.0;
      r.sz = box->GetDZ() * 20.0;
      r.ex[0] = ex[0]; r.ex[1] = ex[1]; r.ex[2] = ex[2];
      r.ey[0] = ey[0]; r.ey[1] = ey[1]; r.ey[2] = ey[2];
      r.ez[0] = ez[0]; r.ez[1] = ez[1]; r.ez[2] = ez[2];

      char key[128];
      std::snprintf(key, sizeof(key), "P%dS%dG%dR%d", part, seg, gap, strip);
      out[std::string(key)] = r;
    }
  }

  int nd = vol->GetNdaughters();
  for (int i = 0; i < nd; ++i) {
    TGeoNode* ch = vol->GetNode(i);
    walk_node(cur, ch, out);
  }
}

void export_muc_strip_map(const char* inGdml, const char* outJson) {
  if (!TGeoManager::Import(inGdml)) {
    std::printf("Failed to import GDML: %s\n", inGdml);
    return;
  }
  if (!gGeoManager || !gGeoManager->GetTopNode()) {
    std::printf("No top node from GDML: %s\n", inGdml);
    return;
  }

  std::map<std::string, StripRow> rows;
  TGeoHMatrix I;
  I.SetName("I");
  TGeoNode* top = gGeoManager->GetTopNode();
  TGeoVolume* tv = top->GetVolume();
  for (int i = 0; tv && i < tv->GetNdaughters(); ++i) {
    walk_node(I, tv->GetNode(i), rows);
  }

  std::ofstream ofs(outJson, std::ios::out | std::ios::trunc);
  ofs << "{\n";
  ofs << "  \"version\": 1,\n";
  ofs << "  \"source\": \"Muc.gdml\",\n";
  ofs << "  \"n_strips\": " << rows.size() << ",\n";
  ofs << "  \"strips\": {\n";
  bool first = true;
  for (const auto& kv : rows) {
    if (!first) ofs << ",\n";
    first = false;
    const auto& r = kv.second;
    ofs << "    \"" << kv.first << "\": {"
        << "\"x\":" << r.x << ",\"y\":" << r.y << ",\"z\":" << r.z
        << ",\"sx\":" << r.sx << ",\"sy\":" << r.sy << ",\"sz\":" << r.sz
        << ",\"ex\":[" << r.ex[0] << "," << r.ex[1] << "," << r.ex[2] << "]"
        << ",\"ey\":[" << r.ey[0] << "," << r.ey[1] << "," << r.ey[2] << "]"
        << ",\"ez\":[" << r.ez[0] << "," << r.ez[1] << "," << r.ez[2] << "]"
        << "}";
  }
  ofs << "\n  }\n";
  ofs << "}\n";
  ofs.close();
  std::printf("Wrote %s with %zu strips\n", outJson, rows.size());
}

