# Jezero Pathfinder science-site coordinates (Phase 13)

The visible markers identify **NASA-documented sampling locations** within
named outcrops, not outcrop centroids, terrain-approved approach points, or
astronaut-safe destinations. All coordinates are latitude north, longitude east
in decimal degrees as published in Mars 2020 sample documentation.

| Site label | Reference sample | Sol | Latitude N | Longitude E | Source |
|---|---|---:|---:|---:|---|
| Rochette | Montdenier / Montagnac | 190 / 196 | 18.43074 | 77.44437 | Previously tested Phase 9A dataset; see DOI below |
| Brac | Salette / Coulettes | 262 / 271 | 18.43397 | 77.44301 | Previously tested Phase 9A dataset; see DOI below |
| Roubion | Roubion attempt | 164 | 18.42769 | 77.45165 | Previously tested Phase 9A dataset; see DOI below |
| Wildcat Ridge | Hazeltop | 509 | 18.45863707 | 77.40588851 | Mars 2020 Initial Reports Vol. 2, M2020-509-14 |
| Cheyava Falls | Sapphire Canyon | 1215 | 18.49747434 | 77.30514915 | Mars 2020 Initial Reports Vol. 4, M2020-1215-28 |
| Amalik | Shuyak | 575 | 18.45068954 | 77.40143171 | Mars 2020 Initial Reports Vol. 2, M2020-575-16 |

Sources:

- Mars 2020 Initial Reports, Volume 2 (Hazeltop, Shuyak):
  https://pds-geosciences.wustl.edu/missions/mars2020/Mars%202020%20Initial%20Reports%20Volume%202%20Release%202.pdf
- Mars 2020 Sample Dossier Initial Reports, Volume 4 (Sapphire Canyon):
  https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_sample_dossier/initial_reports/initial_reports_volume4.pdf#page=120
- NASA Mars Rock Samples (target-to-sample cross-references):
  https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/
- Simon et al. (2023), crater-floor samples:
  https://doi.org/10.1029/2022JE007474

**Important:** Geographic inclusion in the CTX imagery footprint and the 20 m
terrain raster does not guarantee a viable A* route. Hazards, NoData cells,
route-search limits and the vehicle/energy model are checked separately at
runtime. Class 3 is restricted by the current routing policy. If a site lies on
restricted terrain, do not shift its NASA-published coordinate to make the
route work; use a clearly labelled alternate approach point only after
separate verification.
