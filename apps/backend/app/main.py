import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_verifier import router as verifier_router

app = FastAPI(title="Hearvana Speech Verifier API")

cors_origins = [
    origin.strip()
    for origin in os.getenv("SPEECH_VERIFIER_CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(verifier_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
