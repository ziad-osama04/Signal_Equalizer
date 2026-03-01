from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes_audio import router as audio_router
from api.routes_modes import router as modes_router
from api.routes_basis import router as basis_router
from api.routes_edge import router as edge_router
from api.routes_ai import router as ai_router

app = FastAPI(title="Signal Equalizer API")

# Enable CORS for the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect App Routers
app.include_router(audio_router)
app.include_router(modes_router)
app.include_router(basis_router)
app.include_router(edge_router)
app.include_router(ai_router)
