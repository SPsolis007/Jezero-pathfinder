#!/usr/bin/env python3
"""Report raster coverage/hazard class at each published science sample point.
Does not alter any raster or infer human-safe terrain.
"""
from pathlib import Path
import sys

SITES = {
    "Basecamp": (18.4, 77.5),
    "Rochette": (18.43074, 77.44437),
    "Brac": (18.43397, 77.44301),
    "Roubion": (18.42769, 77.45165),
    "Wildcat Ridge (Hazeltop)": (18.45863707, 77.40588851),
    "Cheyava Falls (Sapphire Canyon)": (18.49747434, 77.30514915),
    "Amalik (Shuyak)": (18.45068954, 77.40143171),
}

path = Path('data/processed/jezero_hazard_classes.tif')
if not path.is_file():
    sys.exit(f'Missing {path}; run from the project root.')
try:
    import rasterio
    from pyproj import CRS, Transformer
    import math
except ImportError as e:
    sys.exit(f'Missing raster dependency: {e}. Activate your existing project venv.')

mars_geographic = CRS.from_proj4('+proj=longlat +a=3396190 +b=3396190 +no_defs +type=crs')
with rasterio.open(path) as ds:
    transformer = Transformer.from_crs(mars_geographic, ds.crs, always_xy=True)
    print('Source:', path)
    print('CRS:', ds.crs)
    print('Value legend: 1=lower concern, 2=elevated concern, 3=restricted')
    print('NOTE: Point classification does not establish a complete viable route.')
    for name, (lat, lon) in SITES.items():
        x, y = transformer.transform(lon, lat)
        if not (ds.bounds.left <= x < ds.bounds.right and ds.bounds.bottom <= y < ds.bounds.top):
            result = 'OUTSIDE raster bounds'
        else:
            value = float(next(ds.sample([(x, y)], masked=True))[0])
            nodata = ds.nodata
            if not math.isfinite(value) or (nodata is not None and math.isclose(value, nodata, rel_tol=0, abs_tol=abs(nodata)*1e-6)):
                result = 'NO DATA'
            elif abs(value-3) < 0.01:
                result = 'CLASS 3 RESTRICTED; published coordinate is not a feasible route target'
            elif abs(value-2) < 0.01:
                result = 'CLASS 2 ELEVATED CONCERN; test A* route'
            elif abs(value-1) < 0.01:
                result = 'CLASS 1 LOWER CONCERN; test A* route'
            else:
                result = f'UNEXPECTED CLASS {value}; check raster legend'
        print(f'{name:35} {lat:.8f} N {lon:.8f} E   {result}')
