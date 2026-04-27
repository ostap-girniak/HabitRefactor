"""
Catalyst Forge — Triggers Router
"""
from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import AsyncClient
from enum import Enum

from app.dependencies import get_current_user, get_authenticated_client

router = APIRouter()


class TriggerType(str, Enum):
    time_of_day = "time_of_day"
    location = "location"
    person = "person"
    emotion = "emotion"
    thought = "thought"
    situation = "situation"
    physical_state = "physical_state"
    other = "other"


class TriggerCreate(BaseModel):
    habit_id: UUID
    trigger_type: TriggerType
    description: str = Field(..., min_length=1, max_length=500)
    intensity: Optional[int] = Field(None, ge=1, le=10)


class TriggerUpdate(BaseModel):
    trigger_type: Optional[TriggerType] = None
    description: Optional[str] = None
    intensity: Optional[int] = Field(None, ge=1, le=10)


class TriggerResponse(BaseModel):
    id: UUID
    habit_id: UUID
    user_id: UUID
    trigger_type: TriggerType
    description: str
    intensity: Optional[int]
    frequency_score: int
    created_at: datetime


@router.get("/habit/{habit_id}")
async def list_triggers(
    habit_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """List all triggers for a habit."""
    response = await (
        client.table("triggers")
        .select("*")
        .eq("habit_id", str(habit_id))
        .eq("user_id", str(user.id))
        .order("frequency_score", desc=True)
        .execute()
    )
    return {"triggers": response.data}


@router.post("/", response_model=TriggerResponse, status_code=status.HTTP_201_CREATED)
async def create_trigger(
    data: TriggerCreate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Add a new trigger."""
    trigger_data = {
        **data.model_dump(exclude_none=True),
        "user_id": str(user.id),
        "habit_id": str(data.habit_id),
    }
    response = await client.table("triggers").insert(trigger_data).execute()
    return response.data[0]


@router.put("/{trigger_id}", response_model=TriggerResponse)
async def update_trigger(
    trigger_id: UUID,
    data: TriggerUpdate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Update a trigger."""
    update_data = data.model_dump(exclude_none=True)
    response = await (
        client.table("triggers")
        .update(update_data)
        .eq("id", str(trigger_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return response.data[0]


@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(
    trigger_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Delete a trigger."""
    await (
        client.table("triggers")
        .delete()
        .eq("id", str(trigger_id))
        .eq("user_id", str(user.id))
        .execute()
    )
