from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform as transform_coords
from pyproj import CRS
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.terrain_analysis import (
    analyse_route_terrain,
    TerrainAnalysisError
)
from backend.energy_model import (
    calculate_terrain_energy,
    EnergyModelError
)

try:
    from backend.routing import calculate_route, RoutingError
except ModuleNotFoundError:
    from routing import calculate_route, RoutingError


app = FastAPI(
    title="Mars Pathfinder API",
    version="0.7.0",
    description="Mars terrain-aware mission planning prototype"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MarsCoordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=0, le=360)


class RouteRequest(BaseModel):
    start: MarsCoordinate
    destination: MarsCoordinate
    mode: str = "safest"


@app.get("/")
def home():
    return {
        "project": "Mars Pathfinder",
        "status": "online",
        "message": "Mission control is operational",
        "phase": "7A",
        "routing": "A* terrain-aware navigation"
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/route")
def route(request: RouteRequest):
    try:
        return calculate_route(
            start=request.start.model_dump(),
            destination=request.destination.model_dump(),
            mode=request.mode
        )

    except RoutingError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=str(error)
        )


# =====================================================
# PHASE 7C: HYPOTHETICAL BASE CAMP SCREENING
# =====================================================

HAZARD_RASTER = (
    Path(__file__).resolve().parents[1]
    / "data/processed/jezero_hazard_classes.tif"
)

BASE_CAMP = {
    "name": "Basecamp",
    "latitude": 18.42871,
    "longitude": 77.41327,
    "designation": "HYPOTHETICAL",
}


@app.get("/api/basecamp")
def assess_basecamp():
    if not HAZARD_RASTER.exists():
        raise HTTPException(
            status_code=500,
            detail="Hazard raster unavailable"
        )

    with rasterio.open(HAZARD_RASTER) as src:
        if src.crs is None:
            raise HTTPException(
                status_code=500,
                detail="Hazard raster CRS unavailable"
            )

        geographic = CRS.from_wkt(
            src.crs.to_wkt()
        ).geodetic_crs

        if geographic is None:
            raise HTTPException(
                status_code=500,
                detail="Mars geographic CRS unavailable"
            )

        x, y = transform_coords(
            geographic.to_wkt(),
            src.crs,
            [BASE_CAMP["longitude"]],
            [BASE_CAMP["latitude"]]
        )

        row, col = src.index(x[0], y[0])

        if not (
            0 <= row < src.height
            and 0 <= col < src.width
        ):
            raise HTTPException(
                status_code=422,
                detail="Base camp outside hazard raster"
            )

        # Screen an approximately 100 m radius.
        pixel_size = min(
            abs(src.res[0]),
            abs(src.res[1])
        )

        radius_m = 100.0
        radius_pixels = max(
            1,
            int(np.ceil(radius_m / pixel_size))
        )

        row0 = max(0, row - radius_pixels)
        row1 = min(src.height, row + radius_pixels + 1)
        col0 = max(0, col - radius_pixels)
        col1 = min(src.width, col + radius_pixels + 1)

        window = Window(
            col0, row0,
            col1 - col0,
            row1 - row0
        )

        grid = src.read(
            1,
            window=window,
            masked=True
        )

        rows, cols = np.indices(grid.shape)

        distances = np.hypot(
            (rows + row0 - row) * abs(src.res[1]),
            (cols + col0 - col) * abs(src.res[0])
        )

        inside = distances <= radius_m
        values = grid.data[inside]
        masks = np.ma.getmaskarray(grid)[inside]

        valid = (
            ~masks
            & np.isfinite(values)
            & np.isin(values, [1, 2, 3])
        )

        classes = {
            str(i): int(
                np.count_nonzero(
                    valid & (values == i)
                )
            )
            for i in (1, 2, 3)
        }

        unknown = int(
            np.count_nonzero(~valid)
        )

        total = int(np.count_nonzero(inside))

        center = src.read(
            1,
            window=Window(col, row, 1, 1),
            masked=True
        )

        center_value = center[0, 0]

        center_class = (
            int(center_value)
            if not np.ma.is_masked(center_value)
            and np.isfinite(center_value)
            and center_value in (1, 2, 3)
            else None
        )

        lower_fraction = (
            classes["1"] / total
            if total else 0.0
        )

        if center_class != 1:
            assessment = "NOT RECOMMENDED BY TERRAIN MODEL"
        elif classes["3"] > 0 or unknown > 0:
            assessment = "REQUIRES FURTHER REVIEW"
        elif lower_fraction >= 0.95:
            assessment = "LOWER TERRAIN CONCERN"
        else:
            assessment = "ELEVATED TERRAIN CONCERN"

        return {
            "basecamp": BASE_CAMP,
            "assessment": assessment,
            "center_hazard_class": center_class,
            "screening_radius_m": radius_m,
            "total_cells": total,
            "class_counts": classes,
            "unknown_cells": unknown,
            "lower_concern_fraction": round(
                lower_fraction, 4
            ),
            "human_survivability": "NOT ASSESSED",
            "landing_certification": False,
            "limitations": (
                "Prototype terrain-only screening. "
                "Does not evaluate landing dynamics, "
                "radiation, water, power, atmosphere, "
                "communications, or life support."
            )
        }

# =====================================================
# PHASE 7D: ROUND-TRIP MISSION FEASIBILITY
# =====================================================

from typing import Literal


class MissionRequest(BaseModel):
    destination: MarsCoordinate
    mode: Literal["safest", "shortest"] = "safest"

    # Hypothetical crewed-rover scenario parameters
    speed_kmh: float = Field(default=4.0, gt=0, le=20)
    energy_kwh_per_km: float = Field(
        default=1.5, gt=0, le=50
    )
    available_energy_kwh: float = Field(
        default=20.0, gt=0, le=1000
    )
    maximum_mission_hours: float = Field(
        default=8.0, gt=0, le=72
    )
    science_activity_hours: float = Field(
        default=1.0, ge=0, le=24
    )
    energy_reserve_fraction: float = Field(
        default=0.25, ge=0, lt=1
    )
    time_reserve_fraction: float = Field(
        default=0.20, ge=0, lt=1
    )


@app.post("/api/mission/roundtrip")
def calculate_roundtrip(request: MissionRequest):
    try:
        outbound = calculate_route(
            start={
                "latitude": BASE_CAMP["latitude"],
                "longitude": BASE_CAMP["longitude"],
            },
            destination=request.destination.model_dump(),
            mode=request.mode,
        )
    except RoutingError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=str(error),
        )

    try:
        terrain = analyse_route_terrain(
            outbound["coordinates"]
        )
        energy = calculate_terrain_energy(
            terrain,
            baseline_kwh_per_km=request.energy_kwh_per_km,
        )
    except (
        TerrainAnalysisError,
        EnergyModelError,
        ValueError,
        KeyError,
    ) as error:
        raise HTTPException(
            status_code=422,
            detail=f"Terrain energy analysis failed: {error}",
        )

    outbound_km = outbound["distance_km"]
    return_km = outbound_km
    total_km = outbound_km + return_km

    return_coordinates = list(
        reversed(outbound["coordinates"])
    )

    outbound_energy = energy["total_energy_kwh"]
    return_energy = outbound_energy
    travel_energy = outbound_energy + return_energy

    baseline_energy = (
        total_km * request.energy_kwh_per_km
    )

    travel_hours = total_km / request.speed_kmh
    total_hours = (
        travel_hours + request.science_activity_hours
    )

    energy_limit = (
        request.available_energy_kwh
        * (1 - request.energy_reserve_fraction)
    )
    time_limit = (
        request.maximum_mission_hours
        * (1 - request.time_reserve_fraction)
    )

    energy_margin = energy_limit - travel_energy
    time_margin = time_limit - total_hours

    energy_pass = energy_margin >= 0
    time_pass = time_margin >= 0
    feasible = energy_pass and time_pass

    assessment = (
        "WITHIN MODELLED BUDGET"
        if feasible
        else "EXCEEDS MODELLED BUDGET"
    )

    return {
        "status": "success",
        "mode": request.mode,
        "basecamp": BASE_CAMP,
        "destination": request.destination.model_dump(),
        "outbound": {
            "distance_km": outbound_km,
            "coordinates": outbound["coordinates"],
            "class_2_fraction": outbound["class_2_fraction"],
            "terrain_energy_kwh": round(outbound_energy, 4),
        },
        "return": {
            "distance_km": return_km,
            "coordinates": return_coordinates,
            "method": "Reverse of outbound route",
            "terrain_energy_kwh": round(return_energy, 4),
        },
        "terrain": terrain,
        "energy_analysis": {
            "model": "terrain_adjusted_prototype",
            "baseline_roundtrip_energy_kwh": round(
                baseline_energy, 4
            ),
            "terrain_penalty_kwh": round(
                travel_energy - baseline_energy, 4
            ),
            "outbound_energy_kwh": round(
                outbound_energy, 4
            ),
            "return_energy_kwh": round(
                return_energy, 4
            ),
            "total_travel_energy_kwh": round(
                travel_energy, 4
            ),
            "outbound_breakdown": energy,
            "return_assumption": (
                "Same energy penalties in both directions; "
                "uphill/downhill effects not modelled."
            ),
        },
        "mission": {
            "roundtrip_distance_km": round(total_km, 3),
            "travel_hours": round(travel_hours, 2),
            "science_hours": request.science_activity_hours,
            "total_hours": round(total_hours, 2),
            "travel_energy_kwh": round(travel_energy, 2),
            "usable_energy_kwh": round(energy_limit, 2),
            "usable_time_hours": round(time_limit, 2),
            "energy_margin_kwh": round(energy_margin, 2),
            "time_margin_hours": round(time_margin, 2),
            "energy_pass": energy_pass,
            "time_pass": time_pass,
            "within_modelled_budget": feasible,
            "assessment": assessment,
        },
        "limitations": [
            "Hypothetical energy coefficients",
            "Terrain sampled along route geometry",
            "Return reverses outbound route",
            "Uphill/downhill effects not modelled",
            "No weather, radiation, or life-support model",
            "Not an operational safety certification",
        ],
    }
