
# =====================================================
# MARS PATHFINDER | PHASE 8B
# TERRAIN-ADJUSTED ENERGY MODEL
# =====================================================

from math import isfinite


class EnergyModelError(ValueError):
    pass


def calculate_terrain_energy(
    terrain,
    baseline_kwh_per_km=1.5,
    slope_coefficient=0.30,
    ruggedness_coefficient=0.15
):
    """
    Prototype energy model using distance-weighted
    terrain statistics.

    Coefficients are hypothetical and not calibrated
    against actual Mars rover telemetry.
    """

    if not isinstance(terrain, dict):
        raise EnergyModelError(
            "Terrain analysis must be a dictionary."
        )

    parameters = {
        "baseline_kwh_per_km": baseline_kwh_per_km,
        "slope_coefficient": slope_coefficient,
        "ruggedness_coefficient": ruggedness_coefficient
    }

    for name, value in parameters.items():
        if not (
            isinstance(value, (int, float))
            and isfinite(value)
            and value >= 0
        ):
            raise EnergyModelError(
                f"Invalid parameter: {name}"
            )

    if baseline_kwh_per_km <= 0:
        raise EnergyModelError(
            "Baseline energy must be greater than zero."
        )

    distance = float(
        terrain["route_distance_km"]
    )

    slope = float(
        terrain["mean_slope_deg"]
    )

    ruggedness = float(
        terrain["mean_tri"]
    )

    coverage = float(
        terrain["valid_terrain_coverage_fraction"]
    )

    if not all(
        isfinite(v)
        for v in (distance, slope, ruggedness, coverage)
    ):
        raise EnergyModelError(
            "Terrain metrics contain invalid values."
        )

    if (
        distance <= 0
        or not 0 <= slope <= 90
        or ruggedness < 0
        or not 0 <= coverage <= 1
    ):
        raise EnergyModelError(
            "Terrain metrics are outside valid ranges."
        )

    # Do not extrapolate from missing terrain samples.
    if coverage < 0.999:
        raise EnergyModelError(
            "Insufficient terrain coverage for energy estimate."
        )

    baseline_energy = (
        distance * baseline_kwh_per_km
    )

    slope_energy = (
        baseline_energy
        * slope_coefficient
        * (slope / 10.0)
    )

    ruggedness_energy = (
        baseline_energy
        * ruggedness_coefficient
        * (ruggedness / 10.0)
    )

    total_energy = (
        baseline_energy
        + slope_energy
        + ruggedness_energy
    )

    return {
        "status": "success",
        "model": "terrain_adjusted_prototype",
        "route_distance_km": round(distance, 4),
        "baseline_energy_kwh": round(
            baseline_energy, 4
        ),
        "slope_penalty_kwh": round(
            slope_energy, 4
        ),
        "ruggedness_penalty_kwh": round(
            ruggedness_energy, 4
        ),
        "total_energy_kwh": round(
            total_energy, 4
        ),
        "energy_per_km_kwh": round(
            total_energy / distance, 4
        ),
        "assumptions": {
            "baseline_kwh_per_km":
                baseline_kwh_per_km,
            "slope_coefficient":
                slope_coefficient,
            "ruggedness_coefficient":
                ruggedness_coefficient
        },
        "limitations": [
            "Coefficients are hypothetical.",
            "Uses distance-weighted mean terrain metrics.",
            "Slope direction is not modelled.",
            "No regenerative braking is modelled.",
            "No idle, science equipment, or life-support energy.",
            "Not validated for real Mars operations."
        ]
    }
