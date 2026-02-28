import uuid
import mimetypes
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ..models import User
from ..auth import get_current_admin, get_current_authenticated_user
from ..db_wrapper import get_labour
from ..config import DOCUMENTS_DIR

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _labour_dir(labour_id: str) -> Path:
    d = DOCUMENTS_DIR / labour_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _doc_meta_path(labour_id: str) -> Path:
    return _labour_dir(labour_id) / "meta.csv"


def _load_meta(labour_id: str) -> list[dict]:
    p = _doc_meta_path(labour_id)
    if not p.exists():
        return []
    docs = []
    with open(p, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    if not lines:
        return []
    headers = lines[0].split(",")
    for line in lines[1:]:
        if line.strip():
            values = line.split(",", maxsplit=len(headers) - 1)
            docs.append(dict(zip(headers, values)))
    return docs


def _save_meta(labour_id: str, docs: list[dict]) -> None:
    p = _doc_meta_path(labour_id)
    if not docs:
        p.write_text("id,filename,original_name,doc_type,uploaded_by,uploaded_at\n", encoding="utf-8")
        return
    headers = list(docs[0].keys())
    with open(p, "w", encoding="utf-8") as f:
        f.write(",".join(headers) + "\n")
        for doc in docs:
            f.write(",".join(str(doc.get(h, "")) for h in headers) + "\n")


@router.get("/{labour_id}")
async def list_documents(
    labour_id: str,
    current_user: User = Depends(get_current_authenticated_user)
):
    """List all documents for a labour"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Labour not found")
    return {"labour_id": labour_id, "documents": _load_meta(labour_id)}


@router.post("/{labour_id}")
async def upload_document(
    labour_id: str,
    doc_type: str = Form("other"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin)
):
    """Upload a document for a labour (Admin only)"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Labour not found")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 10 MB limit"
        )

    doc_id = str(uuid.uuid4())
    stored_name = f"{doc_id}{ext}"
    dest = _labour_dir(labour_id) / stored_name
    dest.write_bytes(contents)

    docs = _load_meta(labour_id)
    docs.append({
        "id": doc_id,
        "filename": stored_name,
        "original_name": file.filename,
        "doc_type": doc_type,
        "uploaded_by": current_user.username,
        "uploaded_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
    })
    _save_meta(labour_id, docs)

    return {"message": "Document uploaded", "doc_id": doc_id, "original_name": file.filename}


@router.get("/{labour_id}/{doc_id}/download")
async def download_document(
    labour_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Download / view a document"""
    docs = _load_meta(labour_id)
    doc = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = _labour_dir(labour_id) / doc["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    media_type = mimetypes.guess_type(doc["filename"])[0] or "application/octet-stream"
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=doc["original_name"],
    )


@router.delete("/{labour_id}/{doc_id}")
async def delete_document(
    labour_id: str,
    doc_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Delete a document (Admin only)"""
    docs = _load_meta(labour_id)
    doc = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = _labour_dir(labour_id) / doc["filename"]
    if file_path.exists():
        file_path.unlink()

    _save_meta(labour_id, [d for d in docs if d["id"] != doc_id])
    return {"message": "Document deleted"}
