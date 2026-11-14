
from pathlib import Path
import json

import numpy as np
import rasterio
from rasterio.warp import (
    calculate_default_transform,
    reproject,
    Resampling,
    transform_bounds
)
from rasterio.crs import CRS
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "data/processed/jezero_hazard_classes.tif"
OUTPUT = ROOT / "frontend/assets"
OUTPUT.mkdir(parents=True, exist_ok=True)

PNG_FILE = OUTPUT / "jezero_hazards.png"
JSON_FILE = OUTPUT / "jezero_hazards.json"
GEOTIFF_FILE = OUTPUT / "jezero_hazards_geographic.tif"

# A browser-friendly display grid.
# The original 20 m raster remains the routing source.
MAX_DISPLAY_WIDTH = 1800

COLORS = {
    1: (50, 168, 109, 115),
    2: (232, 179, 74, 155),
    3: (217, 87, 87, 195)
}


def main():
    if not SOURCE.exists():
        raise FileNotFoundError(
            f"Hazard raster not found: {SOURCE}"
        )

    with rasterio.open(SOURCE) as src:
        if src.crs is None:
            raise ValueError("Source raster has no CRS")

        source_crs = CRS.from_wkt(src.crs.to_wkt())

        # Derive geographic Mars coordinates from the
        # actual planetary datum embedded in the source.
        geographic_wkt = (
            src.crs.to_wkt()
        )

        from pyproj import CRS as PyCRS

        planetary_crs = PyCRS.from_wkt(
            geographic_wkt
        ).geodetic_crs

        if planetary_crs is None:
            raise ValueError(
                "Could not derive the Mars geographic CRS"
            )

        target_crs = CRS.from_wkt(
            planetary_crs.to_wkt()
        )

        print("Source CRS:", source_crs)
        print("Target CRS:", target_crs)

        transform, width, height = (
            calculate_default_transform(
                src.crs,
                target_crs,
                src.width,
                src.height,
                *src.bounds
            )
        )

        if width > MAX_DISPLAY_WIDTH:
            scale = width / MAX_DISPLAY_WIDTH

            from affine import Affine

            transform = transform * Affine.scale(
                scale, scale
            )

            width = MAX_DISPLAY_WIDTH
            height = max(
                1,
                int(round(height / scale))
            )

        destination = np.full(
            (height, width),
            255,
            dtype=np.uint8
        )

        reproject(
            source=rasterio.band(src, 1),
            destination=destination,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=transform,
            dst_crs=target_crs,
            dst_nodata=255,
            resampling=Resampling.nearest,
            init_dest_nodata=True
        )

        valid = np.isin(
            destination, [1, 2, 3]
        )

        rgba = np.zeros(
            (height, width, 4),
            dtype=np.uint8
        )

        for category, color in COLORS.items():
            rgba[destination == category] = color

        Image.fromarray(
            rgba,
            "RGBA"
        ).save(PNG_FILE, optimize=True)

        with rasterio.open(
            GEOTIFF_FILE,
            "w",
            driver="GTiff",
            height=height,
            width=width,
            count=1,
            dtype="uint8",
            crs=target_crs,
            transform=transform,
            nodata=255,
            compress="deflate"
        ) as dst:
            dst.write(destination, 1)

        left = transform.c
        top = transform.f

        right = (
            transform.c +
            width * transform.a
        )

        bottom = (
            transform.f +
            height * transform.e
        )

        west = min(left, right)
        east = max(left, right)
        south = min(bottom, top)
        north = max(bottom, top)

        if not (
            15 < south < north < 21
            and 75 < west < east < 80
        ):
            raise ValueError(
                "Reprojected bounds outside Jezero. "
                "Check Mars CRS."
            )

        metadata = {
            "image": "assets/jezero_hazards.png",
            "bounds": [
                [south, west],
                [north, east]
            ],
            "source": (
                "M20 Jezero CTX DEM, 20 m"
            ),
            "classification": (
                "Prototype terrain-screening model"
            ),
            "reprojection": (
                "Mars projected CRS to Mars geographic CRS"
            ),
            "resampling": "nearest",
            "display_width": width,
            "display_height": height,
            "original_resolution_m": 20,
            "unknown_is_safe": False,
            "classes": {
                "1": "Lower terrain concern",
                "2": "Elevated terrain concern",
                "3": "Restricted by model"
            },
            "valid_pixel_count": int(valid.sum())
        }

        JSON_FILE.write_text(
            json.dumps(metadata, indent=2)
        )

        print("\nREPROJECTION COMPLETE")
        print("Output dimensions:", width, height)
        print("Geographic bounds:", metadata["bounds"])
        print("Valid pixels:", int(valid.sum()))
        print("PNG:", PNG_FILE)
        print("GeoTIFF:", GEOTIFF_FILE)
        print("JSON:", JSON_FILE)


if __name__ == "__main__":
    main()
