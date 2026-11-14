"""Two-point Mars mission planning. Estimates are hypothetical, not operational guidance."""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from backend.routing import calculate_route, RoutingError
from backend.terrain_analysis import analyse_route_terrain, TerrainAnalysisError
from backend.energy_model import calculate_terrain_energy, EnergyModelError

router = APIRouter(prefix="/api/mission", tags=["Point-to-point missions"])


class MarsPoint(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=0, le=360)


class PointToPointRequest(BaseModel):
    start: MarsPoint
    destination: MarsPoint
    mode: Literal["safest", "shortest"] = "safest"
    speed_kmh: float = Field(default=4.0, gt=0, le=20)
    energy_kwh_per_km: float = Field(default=1.5, gt=0, le=50)
    available_energy_kwh: float = Field(default=20.0, gt=0, le=1000)
    maximum_mission_hours: float = Field(default=8.0, gt=0, le=72)
    energy_reserve_fraction: float = Field(default=0.25, ge=0, lt=1)
    time_reserve_fraction: float = Field(default=0.20, ge=0, lt=1)

    @model_validator(mode="after")
    def distinct_points(self):
        if self.start == self.destination:
            raise ValueError("Start and destination must be different")
        return self


@router.post("/point-to-point")
def plan_point_to_point(request: PointToPointRequest):
    try:
        route = calculate_route(
            start=request.start.model_dump(),
            destination=request.destination.model_dump(),
            mode=request.mode,
        )
    except RoutingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    if len(route.get("coordinates", [])) < 2 or route.get("distance_km", 0) <= 0:
        raise HTTPException(status_code=422, detail="Route has no usable distance")

    try:
        terrain = analyse_route_terrain(route["coordinates"])
        energy = calculate_terrain_energy(
            terrain,
            baseline_kwh_per_km=request.energy_kwh_per_km,
        )
    except (TerrainAnalysisError, EnergyModelError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Terrain/energy assessment unavailable: {exc}") from exc

    distance = float(route["distance_km"])
    travel_hours = distance / request.speed_kmh
    required_kwh = float(energy["total_energy_kwh"])
    usable_kwh = request.available_energy_kwh * (1 - request.energy_reserve_fraction)
    usable_hours = request.maximum_mission_hours * (1 - request.time_reserve_fraction)
    energy_margin = usable_kwh - required_kwh
    time_margin = usable_hours - travel_hours
    within_budget = energy_margin >= 0 and time_margin >= 0
    return {
        "status": "success",
        "start": request.start.model_dump(),
        "destination": request.destination.model_dump(),
        "mode": request.mode,
        "route": route,
        "terrain": terrain,
        "energy": energy,
        "mission": {
            "distance_km": distance,
            "travel_hours": round(travel_hours, 3),
            "required_energy_kwh": round(required_kwh, 3),
            "usable_energy_kwh": round(usable_kwh, 3),
            "energy_margin_kwh": round(energy_margin, 3),
            "usable_travel_hours": round(usable_hours, 3),
            "time_margin_hours": round(time_margin, 3),
            "within_modelled_budget": within_budget,
            "assessment": "WITHIN MODELLED BUDGET" if within_budget else "EXCEEDS MODELLED BUDGET",
        },
        "limitations": [
            "One-way route only. Return trip is not included.",
            "Energy coefficients and vehicle speed are hypothetical.",
            "No weather, radiation, life support or astronaut exposure model.",
            "Not an operational or human safety certification.",
        ],
    }
