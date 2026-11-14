
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
