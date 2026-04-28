#include <fstream>

#include "TBufferJSON.h"
#include "TGeoManager.h"
#include "TSystem.h"

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
