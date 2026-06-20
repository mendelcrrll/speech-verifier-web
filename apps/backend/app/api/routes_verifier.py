from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.verifier_session_service import (
    create_session,
    finish_session,
    get_session_state,
    save_review,
    session_file_path,
)

router = APIRouter(prefix="/api/verifier", tags=["verifier"])


class CreateVerifierSessionRequest(BaseModel):
    key: str


class SaveReviewRequest(BaseModel):
    sample_id: str
    status: str | None = None
    edited_transcript: str | None = None


@router.post("/sessions")
def create(request: CreateVerifierSessionRequest):
    try:
        return create_session(request.key)
    except KeyError as exc:
        raise HTTPException(status_code=403, detail="Invalid verification key") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sessions/{session_id}")
def read(session_id: str):
    try:
        return get_session_state(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.post("/sessions/{session_id}/reviews")
def save(session_id: str, request: SaveReviewRequest):
    try:
        return save_review(
            session_id=session_id,
            sample_id=request.sample_id,
            status=request.status,
            edited_transcript=request.edited_transcript,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/finish")
def finish(session_id: str):
    try:
        return finish_session(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/files/{relative_path:path}")
def file(session_id: str, relative_path: str):
    try:
        return FileResponse(session_file_path(session_id, relative_path))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
