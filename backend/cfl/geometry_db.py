"""
ZAP Geometry Database & CAS Dimension Intent Engine
Provides indexed access to 2D shapes, 3D solids, 2D nets, formulas, and KaTeX notation.
"""

import os
import json
import math
import re
from typing import Dict, Any, Optional, List

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "zap_geometry_database.json")

class GeometryDatabase:
    _instance: Optional["GeometryDatabase"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeometryDatabase, cls).__new__(cls)
            cls._instance._load_db()
        return cls._instance

    def _load_db(self):
        if os.path.exists(DB_PATH):
            with open(DB_PATH, "r", encoding="utf-8") as f:
                self.data = json.load(f)
        else:
            self.data = {"shapes_2d": [], "shapes_3d": [], "nets_2d": []}

        # Build alias lookup
        self.lookup: Dict[str, Dict[str, Any]] = {}
        for category in ["shapes_2d", "shapes_3d", "nets_2d"]:
            for item in self.data.get(category, []):
                self.lookup[item["id"].lower()] = item
                for alias in item.get("aliases", []):
                    self.lookup[alias.lower().strip()] = item

    def get_shape(self, name_or_alias: str) -> Optional[Dict[str, Any]]:
        return self.lookup.get(name_or_alias.lower().strip())

    def list_all_shapes(self) -> List[Dict[str, Any]]:
        results = []
        for cat in ["shapes_2d", "shapes_3d", "nets_2d"]:
            results.extend(self.data.get(cat, []))
        return results

    def resolve_intent(self, text: str) -> Optional[Dict[str, Any]]:
        t = text.lower().strip()
        if not t or len(t) > 500:
            return None

        has_2d = bool(re.search(r"\b(2d|2-d|dua dimensi|bangun datar|jaring-jaring|jaring jaring)\b", t))
        has_3d = bool(re.search(r"\b(3d|3-d|tiga dimensi|bangun ruang|ruang 3d|solid 3d)\b", t))
        has_visual_cmd = bool(re.search(r"\b(buatkan|buatin|buat|bikinin|bikin|tampilkan|gambarkan|gambar|visualisasikan|render|modelkan|buka|lihat|plot)\b", t))

        def has_alias(item: Dict[str, Any]) -> bool:
            return any(bool(re.search(r"\b" + re.escape(alias.strip().lower()) + r"\b", t)) for alias in item.get("aliases", []))

        # Prioritas 2D
        if has_2d or "jaring" in t:
            if re.search(r"\b(prisma|prism)\b", t):
                return self.get_shape("jaring_prisma")
            if re.search(r"\b(kubus|cube)\b", t):
                return self.get_shape("jaring_kubus")
            if re.search(r"\b(limas|piramida|piramid|pyramid)\b", t):
                return self.get_shape("jaring_limas")
            if re.search(r"\b(balok|cuboid)\b", t):
                return self.get_shape("jaring_balok")
            if re.search(r"\b(tabung|silinder|cylinder)\b", t):
                return self.get_shape("jaring_tabung")

            for item in self.data.get("shapes_2d", []):
                if has_alias(item):
                    return item

        # Prioritas 3D (hanya jika ada kata kunci 3D atau perintah visualisasi)
        if has_3d or has_visual_cmd:
            for item in self.data.get("shapes_3d", []):
                if has_alias(item):
                    return item

            # Cek sisa bangun datar
            for item in self.data.get("shapes_2d", []):
                if has_alias(item):
                    return item

        return None

# Singleton accessor
geometry_db = GeometryDatabase()
