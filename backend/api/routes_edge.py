from fastapi import APIRouter

router = APIRouter(prefix="/api/edge", tags=["edge"])

@router.post("/deploy")
def deploy_to_edge():
    return {"status": "Not implemented"}