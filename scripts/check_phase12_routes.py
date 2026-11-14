#!/usr/bin/env python3
"""Run actual terrain/routing regression after starting with full Jezero GeoTIFF files."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path.cwd()))
import rasterio
from backend.routing import HAZARD_FILE, geographic_to_pixel, calculate_route, RoutingError
from backend.point_to_point import PointToPointRequest, plan_point_to_point

BASECAMP = {"latitude":18.42871, "longitude":77.41327}
SITES = {
    "Rochette": (18.43074,77.44437),
    "Brac": (18.43397,77.44301),
    "Roubion": (18.42769,77.45165),
}
print("=== Raster point validation ===")
with rasterio.open(HAZARD_FILE) as raster:
    for name, (latitude, longitude) in [("Basecamp", tuple(BASECAMP.values())), *SITES.items()]:
        row, col = geographic_to_pixel(raster, latitude, longitude)
        cell = raster.read(1, window=((row,row+1),(col,col+1)), masked=True)[0,0]
        print(f"{name}: raster row={row}, col={col}, hazard class={cell}")
        assert not getattr(cell, 'mask', False) and cell in (1,2), f"{name} not traversable"
print("=== Real A* and energy validation ===")
for name, (latitude, longitude) in SITES.items():
    request = PointToPointRequest(start=BASECAMP, destination={"latitude":latitude,"longitude":longitude})
    try:
        result = plan_point_to_point(request)
        assert len(result["route"]["coordinates"]) >= 2
        assert result["mission"]["distance_km"] > 0
        assert result["mission"]["required_energy_kwh"] > 0
        print(f"PASS {name}: {result['mission']['distance_km']:.3f} km, "
              f"{result['mission']['travel_hours']:.2f} hours, "
              f"{result['mission']['required_energy_kwh']:.2f} kWh")
    except Exception as error:
        print(f"FAIL {name}: {error}")
        raise
print("PASS: all three documented rover sites can be routed from Basecamp.")
