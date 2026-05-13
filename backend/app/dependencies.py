"""
Catalyst Forge — Shared Dependencies
Supabase client factory, auth, and AI client initialization.
"""
from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import AsyncClient, acreate_client

from app.config import Settings, get_settings

security = HTTPBearer()

# Singleton clients
_anon_client: Optional[AsyncClient] = None
_admin_client: Optional[AsyncClient] = None

async def get_supabase_client(
    settings: Annotated[Settings, Depends(get_settings)]
) -> AsyncClient:
    """Get or create singleton Supabase async client using the anon key."""
    global _anon_client
    if _anon_client is None:
        _anon_client = await acreate_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
    return _anon_client

async def get_supabase_admin(
    settings: Annotated[Settings, Depends(get_settings)] = None,
) -> AsyncClient:
    """Get or create singleton Supabase async client using the service role key.
    Can be called both as a FastAPI dependency and as a standalone function.
    """
    global _admin_client
    if _admin_client is None:
        if settings is None:
            settings = get_settings()
        _admin_client = await acreate_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _admin_client

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    """Verify JWT via Supabase Auth."""
    try:
        client = await get_supabase_client(settings)
        user_response = await client.auth.get_user(credentials.credentials)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return user_response.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )

async def get_authenticated_client(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncClient:
    """Get singleton client and set session for RLS scope."""
    client = await get_supabase_client(settings)
    try:
        await client.auth.set_session(credentials.credentials, "")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Session setup failed: {str(e)}",
        )
    return client
