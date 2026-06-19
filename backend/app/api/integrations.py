from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.crypto import encrypt_json
from app.db import get_db
from app.models import Integration, User
from app.schemas.integration import IntegrationOut, NotionConnectIn, NotionTargetOut
from app.services import github_app, notion as notion_svc
from app.services.credentials import get_integration_credentials, get_notion_token
from app.services.notion import NotionClient

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


async def _upsert_integration(
    db: AsyncSession, user_id, kind: str, credentials: dict, meta: dict
) -> Integration:
    row = await db.scalar(
        select(Integration).where(
            Integration.user_id == user_id, Integration.kind == kind
        )
    )
    if row is None:
        row = Integration(user_id=user_id, kind=kind)
        db.add(row)
    row.encrypted_credentials = encrypt_json(credentials)
    row.meta = meta
    await db.commit()
    await db.refresh(row)
    return row


@router.get("", response_model=list[IntegrationOut])
async def list_integrations(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = await db.scalars(select(Integration).where(Integration.user_id == user.id))
    return list(rows)


# ---------- GitHub ----------


@router.get("/github/install-url")
async def github_install_url(user: User = Depends(get_current_user)):
    if not settings.github_app_slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GITHUB_APP_SLUG not configured")
    # state carries the user id so the callback can attribute the installation.
    return {
        "url": f"https://github.com/apps/{settings.github_app_slug}/installations/new"
        f"?state={user.id}"
    }


@router.get("/github/callback")
async def github_callback(
    code: str | None = None,
    installation_id: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """GitHub redirects here after install/authorize. `state` is the user id."""
    if not state:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing state")
    import uuid as _uuid

    try:
        user_id = _uuid.UUID(state)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad state")

    credentials: dict = {}
    meta: dict = {}
    if code:
        token_data = await github_app.exchange_oauth_code(code)
        credentials["user_token"] = token_data.get("access_token")
    if installation_id:
        meta["installation_id"] = installation_id

    await _upsert_integration(db, user_id, "github", credentials, meta)
    return RedirectResponse(f"{settings.frontend_base_url}/integrations?github=connected")


@router.get("/github/repos")
async def github_repos(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    creds = await get_integration_credentials(db, user.id, "github")
    integ = await db.scalar(
        select(Integration).where(
            Integration.user_id == user.id, Integration.kind == "github"
        )
    )
    if not integ:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "GitHub not connected")

    installation_ids: list[str] = []
    if integ.meta.get("installation_id"):
        installation_ids.append(str(integ.meta["installation_id"]))
    elif creds and creds.get("user_token"):
        installs = await github_app.list_installations(creds["user_token"])
        installation_ids = [str(i["id"]) for i in installs]

    repos = []
    for iid in installation_ids:
        for r in await github_app.list_installation_repos(iid):
            repos.append(
                {
                    "full_name": r["full_name"],
                    "default_branch": r.get("default_branch", "main"),
                    "private": r.get("private", False),
                    "installation_id": iid,
                }
            )
    return repos


@router.get("/github/branches")
async def github_branches(
    full_name: str,
    installation_id: str,
    user: User = Depends(get_current_user),
):
    try:
        return await github_app.list_branches(installation_id, full_name)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not list branches")


# ---------- Notion (OAuth) ----------


@router.get("/notion/oauth/url")
async def notion_oauth_url(user: User = Depends(get_current_user)):
    if not settings.notion_client_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Notion OAuth not configured")
    return {"url": notion_svc.oauth_url(state=str(user.id))}


@router.get("/notion/callback")
async def notion_oauth_callback(
    code: str, state: str, db: AsyncSession = Depends(get_db)
):
    import uuid as _uuid

    try:
        user_id = _uuid.UUID(state)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad state")

    token_data = await notion_svc.oauth_exchange_code(code)
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Notion OAuth failed")
    meta = {
        "workspace_name": token_data.get("workspace_name"),
        "workspace_id": token_data.get("workspace_id"),
        "workspace_icon": token_data.get("workspace_icon"),
        "bot_id": token_data.get("bot_id"),
    }
    await _upsert_integration(db, user_id, "notion", {"token": access_token}, meta)
    return RedirectResponse(f"{settings.frontend_base_url}/integrations?notion=connected")


# ---------- Notion (internal-token fallback, local dev) ----------


@router.post("/notion", response_model=IntegrationOut)
async def connect_notion(
    body: NotionConnectIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate the token before storing it.
    try:
        await NotionClient(body.token).search_targets()
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid Notion token")
    row = await _upsert_integration(db, user.id, "notion", {"token": body.token}, {})
    return row


@router.get("/notion/targets", response_model=list[NotionTargetOut])
async def notion_targets(
    q: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = await get_notion_token(db, user.id)
    if not token:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Notion not connected")
    return await NotionClient(token).search_targets(q)
