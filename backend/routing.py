
from pathlib import Path
from heapq import heappush, heappop
from math import hypot, inf, isfinite
import itertools

import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform as transform_coords


ROOT = Path(__file__).resolve().parents[1]
HAZARD_FILE = (
    ROOT / "data" / "processed" /
    "jezero_hazard_classes.tif"
)

# Prototype routing configuration
BLOCKED_CLASSES = {3}
ALLOWED_CLASSES = {1, 2}

MAX_SEARCH_CELLS = 2_000_000
SEARCH_MARGIN = 200

# Maximum A* expansions to prevent excessive requests
MAX_EXPANSIONS = 750_000

MOVES = [
    (-1, 0, 1.0),
    (1, 0, 1.0),
    (0, -1, 1.0),
    (0, 1, 1.0),
    (-1, -1, 2 ** 0.5),
    (-1, 1, 2 ** 0.5),
    (1, -1, 2 ** 0.5),
    (1, 1, 2 ** 0.5),
]


class RoutingError(Exception):
    def __init__(self, message, status_code=422):
        super().__init__(message)
        self.status_code = status_code


def geographic_to_pixel(dataset, latitude, longitude):
    if not (
        isfinite(latitude) and isfinite(longitude)
        and -90 <= latitude <= 90
        and 0 <= longitude <= 360
    ):
        raise RoutingError("Invalid Mars coordinates.")

    # Mars geographic CRS, not Earth's EPSG:4326
    mars_geographic = dataset.crs.to_wkt()

    from pyproj import CRS
    geodetic = CRS.from_wkt(
        mars_geographic
    ).geodetic_crs

    if geodetic is None:
        raise RoutingError(
            "Cannot determine the Mars geographic CRS.",
            500
        )

    xs, ys = transform_coords(
        geodetic.to_wkt(),
        dataset.crs,
        [longitude],
        [latitude]
    )

    row, col = dataset.index(xs[0], ys[0])

    if not (
        0 <= row < dataset.height
        and 0 <= col < dataset.width
    ):
        raise RoutingError(
            "Selected point is outside the hazard raster."
        )

    return row, col


def pixel_to_geographic(dataset, row, col):
    x, y = dataset.xy(row, col)

    from pyproj import CRS
    geodetic = CRS.from_wkt(
        dataset.crs.to_wkt()
    ).geodetic_crs

    lon, lat = transform_coords(
        dataset.crs,
        geodetic.to_wkt(),
        [x],
        [y]
    )

    return [
        round(lat[0], 7),
        round(lon[0], 7)
    ]


def traversable(value):
    return np.isfinite(value) and value in ALLOWED_CLASSES


def terrain_multiplier(value, mode):
    if mode == "shortest":
        return 1.0

    if value == 1:
        return 1.0

    if value == 2:
        return 5.0

    return inf


def heuristic(a, b):
    return hypot(
        a[0] - b[0],
        a[1] - b[1]
    )


def astar(grid, start, goal, mode):
    height, width = grid.shape

    counter = itertools.count()
    queue = []

    g_score = {start: 0.0}
    came_from = {}
    closed = set()

    heappush(
        queue,
        (
            heuristic(start, goal),
            next(counter),
            0.0,
            start
        )
    )

    expansions = 0

    while queue:
        _, _, current_cost, current = heappop(queue)

        if current in closed:
            continue

        if current_cost > g_score.get(current, inf):
            continue

        if current == goal:
            path = [current]

            while current in came_from:
                current = came_from[current]
                path.append(current)

            path.reverse()

            return path, expansions

        closed.add(current)
        expansions += 1

        if expansions > MAX_EXPANSIONS:
            raise RoutingError(
                "Search limit reached. Choose closer points "
                "or a smaller route area."
            )

        row, col = current

        for dr, dc, movement in MOVES:
            nr = row + dr
            nc = col + dc

            if not (
                0 <= nr < height
                and 0 <= nc < width
            ):
                continue

            terrain = grid[nr, nc]

            if not traversable(terrain):
                continue

            # Prevent diagonal movement through blocked corners
            if dr != 0 and dc != 0:
                if not (
                    traversable(grid[row + dr, col])
                    and traversable(grid[row, col + dc])
                ):
                    continue

            neighbour = (nr, nc)

            if neighbour in closed:
                continue

            multiplier = terrain_multiplier(
                terrain, mode
            )

            new_cost = (
                current_cost +
                movement * multiplier
            )

            if new_cost < g_score.get(neighbour, inf):
                g_score[neighbour] = new_cost
                came_from[neighbour] = current

                priority = (
                    new_cost +
                    heuristic(neighbour, goal)
                )

                heappush(
                    queue,
                    (
                        priority,
                        next(counter),
                        new_cost,
                        neighbour
                    )
                )

    raise RoutingError(
        "No traversable route found inside the search area."
    )


def calculate_route(start, destination, mode="safest"):
    if mode not in ("safest", "shortest"):
        raise RoutingError(
            "Mode must be 'safest' or 'shortest'."
        )

    if not HAZARD_FILE.exists():
        raise RoutingError(
            "Hazard GeoTIFF is missing.",
            500
        )

    with rasterio.open(HAZARD_FILE) as dataset:
        if dataset.crs is None:
            raise RoutingError(
                "Hazard raster has no CRS.",
                500
            )

        start_row, start_col = geographic_to_pixel(
            dataset,
            start["latitude"],
            start["longitude"]
        )

        goal_row, goal_col = geographic_to_pixel(
            dataset,
            destination["latitude"],
            destination["longitude"]
        )

        row_min = max(
            0,
            min(start_row, goal_row) - SEARCH_MARGIN
        )
        row_max = min(
            dataset.height,
            max(start_row, goal_row) + SEARCH_MARGIN + 1
        )

        col_min = max(
            0,
            min(start_col, goal_col) - SEARCH_MARGIN
        )
        col_max = min(
            dataset.width,
            max(start_col, goal_col) + SEARCH_MARGIN + 1
        )

        height = row_max - row_min
        width = col_max - col_min

        if height * width > MAX_SEARCH_CELLS:
            raise RoutingError(
                "Route search area exceeds the prototype limit. "
                "Choose closer points."
            )

        window = Window(
            col_min,
            row_min,
            width,
            height
        )

        grid = dataset.read(
            1,
            window=window,
            masked=True
        ).filled(np.nan)

        local_start = (
            start_row - row_min,
            start_col - col_min
        )

        local_goal = (
            goal_row - row_min,
            goal_col - col_min
        )

        if not traversable(grid[local_start]):
            raise RoutingError(
                "Starting point is restricted or has unknown terrain."
            )

        if not traversable(grid[local_goal]):
            raise RoutingError(
                "Destination is restricted or has unknown terrain."
            )

        path, expansions = astar(
            grid,
            local_start,
            local_goal,
            mode
        )

        # Convert local window pixels to source raster pixels
        global_path = [
            (r + row_min, c + col_min)
            for r, c in path
        ]

        # Distance uses source raster's projected metre units.
        # This is planar DEM distance, not surface/3D distance.
        affine = dataset.transform

        distance_m = 0.0
        class_2_distance_m = 0.0

        for i in range(1, len(global_path)):
            previous = global_path[i - 1]
            current = global_path[i]

            dr = current[0] - previous[0]
            dc = current[1] - previous[1]

            dx = affine.a * dc + affine.b * dr
            dy = affine.d * dc + affine.e * dr

            segment_m = hypot(dx, dy)
            distance_m += segment_m

            local_row = path[i][0]
            local_col = path[i][1]

            if grid[local_row, local_col] == 2:
                class_2_distance_m += segment_m

        # Simplify coordinates for browser rendering.
        # The full-resolution path is retained for metrics.
        stride = max(1, len(global_path) // 1200)

        display_path = global_path[::stride]

        if display_path[-1] != global_path[-1]:
            display_path.append(global_path[-1])

        coordinates = [
            pixel_to_geographic(dataset, r, c)
            for r, c in display_path
        ]

        return {
            "status": "success",
            "mode": mode,
            "coordinates": coordinates,
            "distance_m": round(distance_m, 2),
            "distance_km": round(distance_m / 1000, 3),
            "class_2_distance_m": round(
                class_2_distance_m, 2
            ),
            "class_2_fraction": (
                round(class_2_distance_m / distance_m, 4)
                if distance_m > 0 else 0.0
            ),
            "path_cells": len(global_path),
            "expanded_nodes": expansions,
            "resolution_m": abs(affine.a),
            "model": "Prototype hazard-class routing",
            "warning": (
                "Route is not validated for rover operations. "
                "Unknown terrain and Class 3 are excluded. "
                "Search is restricted to a bounded area."
            )
        }
