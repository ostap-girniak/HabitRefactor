"""
Catalyst Forge — Auth Router
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from supabase import AsyncClient

from app.dependencies import get_current_user, get_authenticated_client, get_supabase_client

router = APIRouter()


class ProfileResponse(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None = None
    timezone: str
    locale: str
    onboarding_completed: bool
    hero_mode_enabled: bool
    current_identity_statement: str | None = None
    streak_best_ever: int
    total_victories: int


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    timezone: str | None = None
    locale: str | None = None
    hero_mode_enabled: bool | None = None
    current_identity_statement: str | None = None


class OnboardingData(BaseModel):
    display_name: str
    timezone: str = "Europe/Kyiv"
    first_habit_name: str | None = None
    first_habit_category: str | None = None


@router.get("/me", response_model=ProfileResponse)
async def get_profile(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get the current user's profile."""
    response = await (
        client.table("profiles")
        .select("*")
        .eq("id", str(user.id))
        .single()
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Safe fallback for drifted schema
    p_data = response.data
    p_data.setdefault("streak_best_ever", 0)
    p_data.setdefault("total_victories", 0)
    p_data.setdefault("hero_mode_enabled", False)
    p_data.setdefault("locale", p_data.get("preferred_language", "uk"))
    
    return p_data


@router.put("/me", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Update the current user's profile."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = await (
        client.table("profiles")
        .update(update_data)
        .eq("id", str(user.id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile update returned no data")
        
    p_data = response.data[0]
    p_data.setdefault("streak_best_ever", 0)
    p_data.setdefault("total_victories", 0)
    p_data.setdefault("hero_mode_enabled", False)
    p_data.setdefault("locale", p_data.get("preferred_language", "uk"))
    
    return p_data


@router.post("/onboarding", response_model=ProfileResponse)
async def complete_onboarding(
    data: OnboardingData,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Complete the onboarding flow."""
    # Update profile
    response = await (
        client.table("profiles")
        .update({
            "display_name": data.display_name,
            "timezone": data.timezone,
            "onboarding_completed": True,
        })
        .eq("id", str(user.id))
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=400, detail="Onboarding failed - no data returned")

    # Create first habit if provided
    if data.first_habit_name and data.first_habit_category:
        from datetime import datetime, timezone as tz
        await (
            client.table("habits")
            .insert({
                "user_id": str(user.id),
                "name": data.first_habit_name,
                "category": data.first_habit_category,
                "sobriety_start_date": datetime.now(tz.utc).isoformat(),
            })
            .execute()
        )

    p_data = response.data[0]
    p_data.setdefault("streak_best_ever", 0)
    p_data.setdefault("total_victories", 0)
    p_data.setdefault("hero_mode_enabled", False)
    p_data.setdefault("locale", p_data.get("preferred_language", "uk"))

    return p_data
