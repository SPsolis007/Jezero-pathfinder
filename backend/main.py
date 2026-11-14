from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform as transform_coords
from pyproj import CRS
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
    "name": "Base Camp Alpha",
    "latitude": 18.4,
    "longitude": 77.5,
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
