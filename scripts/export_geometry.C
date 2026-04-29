// export_geometry.C — ROOT macros for exporting BESIII geometry data.
//
// Two entry points (called by bes3_visualize.sh):
//
//   export_gdml_to_rootjson(inGdml, outJson)
//       Convert any GDML file to ROOT JSON format readable by JSROOT / Phoenix.
//       Usage:  root -l -b -q 'scripts/export_geometry.C("in.gdml","out.json")'
//
//   export_muc_strip_map(inGdml, outJson)
//       Walk the MUC GDML geometry and emit a JSON map of every strip with its
//       world-space position, half-sizes, and orientation axes (mm units).
//       Usage:  root -l -b -q 'scripts/export_geometry.C+("Muc.gdml","muc_strip_map.json")'
//       (The macro is #included as text so both functions are available regardless
//        of which entry point ROOT uses; just call the one you need.)

#include <TBufferJSON.h>
#include <TGeoBBox.h>
#include <TGeoManager.h>
#include <TGeoMatrix.h>
#include <TGeoNode.h>
#include <TGeoShape.h>
#include <TGeoVolume.h>
#include <TMath.h>
#include <TSystem.h>

#include <cstdio>
#include <fstream>
#include <map>
#include <string>


// ── export_gdml_to_rootjson ───────────────────────────────────────────────────

void export_gdml_to_rootjson(const char* inGdml, const char* outJson) {
  gErrorIgnoreLevel = kWarning;
  TGeoManager* geom = TGeoManager::Import(inGdml);
  if (!geom) {
    Error("export_gdml_to_rootjson", "Failed to import GDML: %s", inGdml);
    gSystem->Exit(2);
    return;
  }
  if (!geom->GetTopVolume()) {
    Error("export_gdml_to_rootjson", "Geometry has no top volume: %s", inGdml);
    gSystem->Exit(3);
    return;
  }
  // TGeoManager::Export("*.json") is not guaranteed to emit plain JSON text.
  // Use TBufferJSON to force valid text JSON for web loaders.
  TString jsonText = TBufferJSON::ToJSON(geom).Data();
  std::ofstream ofs(outJson, std::ios::out | std::ios::trunc);
  if (!ofs.is_open()) {
    Error("export_gdml_to_rootjson", "Cannot open output file: %s", outJson);
    gSystem->Exit(4);
    return;
  }
  ofs << jsonText.Data();
  ofs.close();
  Info("export_gdml_to_rootjson", "Exported text ROOT JSON: %s", outJson);
  gSystem->Exit(0);
}


// ── export_muc_strip_map ──────────────────────────────────────────────────────

struct StripRow {
  double x, y, z;
  double sx, sy, sz;
  double ex[3], ey[3], ez[3];
};

static bool _parse_muc_name(const char* s, int& part, int& seg, int& gap, int& strip) {
  if (std::sscanf(s, "lMucP%dS%dG%ds%d", &part, &seg, &gap, &strip) == 4) return true;
  int dummy = 0;
  if (std::sscanf(s, "pv_lMucP%dS%dG%ds%d_%d", &part, &seg, &gap, &strip, &dummy) == 5) return true;
  return false;
}

static void _norm3(double v[3]) {
  double n = std::sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  if (n < 1e-12) { v[0]=1.0; v[1]=0.0; v[2]=0.0; return; }
  v[0]/=n; v[1]/=n; v[2]/=n;
}

static void _walk_muc_node(TGeoHMatrix& acc, TGeoNode* node, std::map<std::string,StripRow>& out) {
  if (!node) return;
  TGeoVolume* vol = node->GetVolume();
  if (!vol) return;

  TGeoHMatrix cur(acc);
  TGeoMatrix* m = node->GetMatrix();
  if (m) cur.Multiply(m);

  int part=-1, seg=-1, gap=-1, strip=-1;
  bool ok = _parse_muc_name(node->GetName(), part, seg, gap, strip) ||
            _parse_muc_name(vol->GetName(),  part, seg, gap, strip);
  if (ok && part>=0 && seg>=0 && gap>=0 && strip>=0) {
    TGeoShape* sh = vol->GetShape();
    if (sh && sh->InheritsFrom(TGeoBBox::Class())) {
      auto* box = (TGeoBBox*)sh;
      double o[3]={0,0,0}, lx[3]={1,0,0}, ly[3]={0,1,0}, lz[3]={0,0,1};
      double wo[3], wx[3], wy[3], wz[3];
      cur.LocalToMaster(o,wo); cur.LocalToMaster(lx,wx);
      cur.LocalToMaster(ly,wy); cur.LocalToMaster(lz,wz);
      double ex[3]={wx[0]-wo[0],wx[1]-wo[1],wx[2]-wo[2]};
      double ey[3]={wy[0]-wo[0],wy[1]-wo[1],wy[2]-wo[2]};
      double ez[3]={wz[0]-wo[0],wz[1]-wo[1],wz[2]-wo[2]};
      _norm3(ex); _norm3(ey); _norm3(ez);
      StripRow r;
      // ROOT geometry unit is cm; convert to mm for consistency with the pipeline.
      r.x=wo[0]*10; r.y=wo[1]*10; r.z=wo[2]*10;
      r.sx=box->GetDX()*20; r.sy=box->GetDY()*20; r.sz=box->GetDZ()*20;
      for(int i=0;i<3;i++){r.ex[i]=ex[i];r.ey[i]=ey[i];r.ez[i]=ez[i];}
      char key[128];
      std::snprintf(key,sizeof(key),"P%dS%dG%dR%d",part,seg,gap,strip);
      out[std::string(key)]=r;
    }
  }
  int nd=vol->GetNdaughters();
  for(int i=0;i<nd;++i) _walk_muc_node(cur, vol->GetNode(i), out);
}

void export_muc_strip_map(const char* inGdml, const char* outJson) {
  if (!TGeoManager::Import(inGdml)) {
    std::printf("Failed to import GDML: %s\n", inGdml); return;
  }
  if (!gGeoManager || !gGeoManager->GetTopNode()) {
    std::printf("No top node from GDML: %s\n", inGdml); return;
  }
  std::map<std::string,StripRow> rows;
  TGeoHMatrix I; I.SetName("I");
  TGeoNode* top = gGeoManager->GetTopNode();
  TGeoVolume* tv = top->GetVolume();
  for (int i=0; tv && i<tv->GetNdaughters(); ++i)
    _walk_muc_node(I, tv->GetNode(i), rows);

  std::ofstream ofs(outJson, std::ios::out | std::ios::trunc);
  ofs << "{\n  \"version\": 1,\n  \"source\": \"Muc.gdml\",\n"
      << "  \"n_strips\": " << rows.size() << ",\n  \"strips\": {\n";
  bool first=true;
  for (const auto& kv : rows) {
    if (!first) ofs << ",\n";
    first=false;
    const auto& r=kv.second;
    ofs << "    \"" << kv.first << "\": {"
        << "\"x\":"<<r.x<<",\"y\":"<<r.y<<",\"z\":"<<r.z
        << ",\"sx\":"<<r.sx<<",\"sy\":"<<r.sy<<",\"sz\":"<<r.sz
        << ",\"ex\":["<<r.ex[0]<<","<<r.ex[1]<<","<<r.ex[2]<<"]"
        << ",\"ey\":["<<r.ey[0]<<","<<r.ey[1]<<","<<r.ey[2]<<"]"
        << ",\"ez\":["<<r.ez[0]<<","<<r.ez[1]<<","<<r.ez[2]<<"]"
        << "}";
  }
  ofs << "\n  }\n}\n";
  ofs.close();
  std::printf("Wrote %s with %zu strips\n", outJson, rows.size());
}

// Wrapper entry points so ROOT can call this file directly as:
//   root -l -b -q 'scripts/export_geometry.C("in.gdml","out.json")'
//   root -l -b -q 'scripts/export_geometry.C("Muc.gdml","muc_strip_map.json","muc_strip_map")'
void export_geometry(const char* inGdml, const char* outJson) {
  export_gdml_to_rootjson(inGdml, outJson);
}

void export_geometry(const char* inGdml, const char* outJson, const char* mode) {
  if (mode && std::string(mode) == "muc_strip_map") {
    export_muc_strip_map(inGdml, outJson);
    return;
  }
  export_gdml_to_rootjson(inGdml, outJson);
}
