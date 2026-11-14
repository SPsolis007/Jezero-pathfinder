#!/usr/bin/env python3
"""Phase 12 static + synthetic API smoke test. Run from repository root."""
from pathlib import Path
import ast
import importlib
import sys
from unittest.mock import patch

root = Path.cwd()
sys.path.insert(0, str(root))
script = root / "frontend" / "route_planner.js"
backend = root / "backend" / "point_to_point.py"
main = root / "backend" / "main.py"
assert script.exists() and backend.exists() and main.exists(), "Missing Phase 12 files"
ast.parse(backend.read_text())
ast.parse(main.read_text())
assert "point_to_point_router" in main.read_text()
assert 'id="point-to-point-planner"' in (root / "frontend" / "index.html").read_text()
assert "route_planner.js" in (root / "frontend" / "index.html").read_text()

module = importlib.import_module("backend.point_to_point")
from fastapi import HTTPException
sample_route = {
    "coordinates": [[18.42871,77.41327],[18.43074,77.44437]],
    "distance_km": 2.5, "class_2_fraction": 0.15
}
sample_terrain = {
    "route_distance_km": 2.5, "mean_slope_deg": 4,
    "mean_tri": 3, "valid_terrain_coverage_fraction": 1
}
from backend.energy_model import calculate_terrain_energy
with (patch.object(module, "calculate_route", return_value=sample_route),
      patch.object(module, "analyse_route_terrain", return_value=sample_terrain)):
    req = module.PointToPointRequest(
        start={"latitude":18.42871,"longitude":77.41327},
        destination={"latitude":18.43074,"longitude":77.44437}
    )
    out = module.plan_point_to_point(req)
    assert out["mission"]["travel_hours"] == 0.625
    assert out["mission"]["required_energy_kwh"] > 3.75
    assert out["mission"]["within_modelled_budget"]
    try:
        module.PointToPointRequest(start=req.start, destination=req.start)
        raise AssertionError("Matching points should be rejected")
    except ValueError:
        pass
print("PASS: Phase 12 static checks, one-way computation and identical-point rejection")
