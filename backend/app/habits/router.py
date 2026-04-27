"""
Catalyst Forge — Habits Router
"""
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.dependencies import get_current_user, get_authenticated_client
from app.habits.schemas import (
    HabitCreate,
    HabitUpdate,
    HabitResponse,
    HabitListResponse,
)
from app.habits.service import HabitsService

router = APIRouter()


def get_habits_service(
    client: Annotated[AsyncClient, Depends(get_authenticated_client)]
) -> HabitsService:
    return HabitsService(client)


@router.get("/", response_model=HabitListResponse)
async def list_habits(
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """List all active habits for the current user."""
    habits = await service.list_habits(str(user.id))
    return HabitListResponse(habits=habits, total=len(habits))


@router.post("/", response_model=HabitResponse, status_code=status.HTTP_201_CREATED)
async def create_habit(
    data: HabitCreate,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Create a new harmful habit to track."""
    habit = await service.create_habit(
        str(user.id),
        data.model_dump(exclude_none=True),
    )
    return habit


@router.get("/{habit_id}", response_model=HabitResponse)
async def get_habit(
    habit_id: UUID,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Get a specific habit with details."""
    habit = await service.get_habit(str(habit_id), str(user.id))
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )
    return habit


@router.put("/{habit_id}", response_model=HabitResponse)
async def update_habit(
    habit_id: UUID,
    data: HabitUpdate,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Update an existing habit."""
    habit = await service.update_habit(
        str(habit_id),
        str(user.id),
        data.model_dump(exclude_none=True),
    )
    if not habit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )
    return habit


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_habit(
    habit_id: UUID,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Archive (soft-delete) a habit."""
    success = await service.archive_habit(str(habit_id), str(user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )


@router.post("/{habit_id}/reset-streak")
async def reset_streak(
    habit_id: UUID,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Reset the sobriety streak (after relapse confirmation)."""
    result = await service.reset_streak(str(habit_id), str(user.id))
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )
    return {"message": "Streak reset. Pain is information. Use it. 🔥", "habit": result}


@router.get("/{habit_id}/stats")
async def get_habit_stats(
    habit_id: UUID,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Get detailed statistics for a habit."""
    stats = await service.get_habit_stats(str(habit_id), str(user.id))
    return stats


@router.get("/{habit_id}/savings")
async def get_savings(
    habit_id: UUID,
    user=Depends(get_current_user),
    service: HabitsService = Depends(get_habits_service),
):
    """Get money/time/calories saved by fighting this habit."""
    savings = await service.get_savings(str(habit_id), str(user.id))
    return savings
