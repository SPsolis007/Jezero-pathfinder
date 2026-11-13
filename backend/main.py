from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Mars Pathfinder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "project": "Mars Pathfinder",
        "status": "online",
        "message": "Mission control is operational"
    }

@app.get("/api/health")
def health():
    return {"status": "ok"}
