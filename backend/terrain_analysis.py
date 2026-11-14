
# =====================================================
# MARS PATHFINDER | PHASE 8A
# ROUTE-BASED TERRAIN ANALYSIS
# =====================================================

from pathlib import Path
from math import hypot, isfinite, ceil

import numpy as np
import rasterio
from pyproj import CRS, Transformer


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed"

HAZARD_FILE = DATA / "jezero_hazard_classes.tif"
SLOPE_FILE = DATA / "jezero_slope_deg.tif"
TRI_FILE = DATA / "jezero_tri.tif"

SAMPLE_SPACING_M = 10.0
MAX_SAMPLES = 100_000


class TerrainAnalysisError(Exception):
    pass


def analyse_route_terrain(coordinates):
    """
    Analyse terrain along an A* route.

    Input:
        [[latitude, longitude], ...]

    Coordinates are Mars geographic coordinates,
    not Earth EPSG:4326 coordinates.

    The model samples the complete displayed
    route geometry at approximately 10 m spacing.

    Outputs include distance-weighted slope and
    ruggedness statistics and coverage information.
    """

    if len(coordinates) < 2:
        raise TerrainAnalysisError(
            "At least two route points are required."
        )

    for path in (HAZARD_FILE, SLOPE_FILE, TRI_FILE):
        if not path.exists():
            raise TerrainAnalysisError(
                f"Missing raster: {path.name}"
            )

    with (
        rasterio.open(HAZARD_FILE) as hazard,
        rasterio.open(SLOPE_FILE) as slope,
        rasterio.open(TRI_FILE) as tri
    ):
        # Ensure all rasters share the same grid.
        for dataset in (slope, tri):
            if (
                dataset.crs != hazard.crs
                or dataset.transform != hazard.transform
                or dataset.shape != hazard.shape
            ):
                raise TerrainAnalysisError(
                    "Terrain raster grids do not match."
                )

        mars_geographic = CRS.from_wkt(
            hazard.crs.to_wkt()
        ).geodetic_crs

        if mars_geographic is None:
            raise TerrainAnalysisError(
                "Mars geographic CRS unavailable."
            )

        transformer = Transformer.from_crs(
            mars_geographic,
            hazard.crs,
            always_xy=True
        )

        longitudes = []
        latitudes = []

        for latitude, longitude in coordinates:
            if not (
                isfinite(latitude)
                and isfinite(longitude)
                and -90 <= latitude <= 90
                and 0 <= longitude <= 360
            ):
                raise TerrainAnalysisError(
                    "Invalid Mars route coordinates."
                )

            latitudes.append(latitude)
            longitudes.append(longitude)

        xs, ys = transformer.transform(
            longitudes,
            latitudes
        )

        # Each sample represents a segment of
        # distance along the actual route geometry.
        sample_x = []
        sample_y = []
        sample_weights = []

        total_distance_m = 0.0

        for i in range(len(xs) - 1):
            x0, y0 = xs[i], ys[i]
            x1, y1 = xs[i + 1], ys[i + 1]

            distance = hypot(
                x1 - x0,
                y1 - y0
            )

            if distance <= 0:
                continue

            total_distance_m += distance

            count = max(
                1,
                ceil(distance / SAMPLE_SPACING_M)
            )

            if len(sample_x) + count > MAX_SAMPLES:
                raise TerrainAnalysisError(
                    "Route exceeds terrain sampling limit."
                )

            weight = distance / count

            for j in range(count):
                # Midpoint sampling avoids double
                # counting route vertices.
                fraction = (j + 0.5) / count

                sample_x.append(
                    x0 + fraction * (x1 - x0)
                )

                sample_y.append(
                    y0 + fraction * (y1 - y0)
                )

                sample_weights.append(weight)

        if not sample_x:
            raise TerrainAnalysisError(
                "Route has zero measurable distance."
            )

        points = list(zip(sample_x, sample_y))

        hazard_values = np.ma.array(
            list(hazard.sample(points, masked=True))
        )[:, 0]

        slope_values = np.ma.array(
            list(slope.sample(points, masked=True))
        )[:, 0]

        tri_values = np.ma.array(
            list(tri.sample(points, masked=True))
        )[:, 0]

        weights = np.asarray(
            sample_weights,
            dtype=float
        )

        h = np.asarray(hazard_values.data)
        s = np.asarray(slope_values.data)
        t = np.asarray(tri_values.data)

        hazard_valid = (
            ~np.ma.getmaskarray(hazard_values)
            & np.isfinite(h)
            & np.isin(h, [1, 2, 3])
        )

        slope_valid = (
            ~np.ma.getmaskarray(slope_values)
            & np.isfinite(s)
            & (s >= 0)
            & (s <= 90)
        )

        tri_valid = (
            ~np.ma.getmaskarray(tri_values)
            & np.isfinite(t)
            & (t >= 0)
        )

        valid = (
            hazard_valid
            & slope_valid
            & tri_valid
        )

        valid_distance = float(
            weights[valid].sum()
        )

        coverage = (
            valid_distance / total_distance_m
            if total_distance_m > 0 else 0.0
        )

        if valid_distance <= 0:
            raise TerrainAnalysisError(
                "No valid terrain samples along route."
            )

        valid_slope = s[valid]
        valid_tri = t[valid]
        valid_weights = weights[valid]

        mean_slope = float(
            np.average(
                valid_slope,
                weights=valid_weights
            )
        )

        mean_tri = float(
            np.average(
                valid_tri,
                weights=valid_weights
            )
        )

        class_distances = {}

        for terrain_class in (1, 2, 3):
            class_distances[str(terrain_class)] = round(
                float(
                    weights[
                        valid & (h == terrain_class)
                    ].sum()
                ) / 1000,
                4
            )

        return {
            "status": "success",
            "method": "Distance-weighted route sampling",
            "sample_spacing_m": SAMPLE_SPACING_M,
            "sample_count": len(points),
            "route_distance_km": round(
                total_distance_m / 1000, 4
            ),
            "valid_terrain_coverage_fraction": round(
                coverage, 4
            ),
            "mean_slope_deg": round(
                mean_slope, 3
            ),
            "max_sampled_slope_deg": round(
                float(valid_slope.max()), 3
            ),
            "mean_tri": round(
                mean_tri, 3
            ),
            "max_sampled_tri": round(
                float(valid_tri.max()), 3
            ),
            "hazard_class_distance_km": class_distances,
            "limitations": [
                "Statistics use the supplied route geometry.",
                "Simplified route geometry may omit small turns.",
                "TRI units depend on raster derivation.",
                "Samples are not independent measurements.",
                "No rover energy model is applied yet."
            ]
        }
