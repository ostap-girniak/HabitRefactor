"""
Catalyst Forge — Habits Pydantic Schemas
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class HabitCategory(str, Enum):
    smoking = "smoking"
    alcohol = "alcohol"
    food = "food"
    social_media = "social_media"
    porn = "porn"
    swearing = "swearing"
    gambling = "gambling"
    drugs = "drugs"
    procrastination = "procrastination"
    other = "other"


class HabitFrequency(str, Enum):
    daily = "daily"
    weekdays = "weekdays"
    weekends = "weekends"
    weekly = "weekly"
    custom = "custom"


class ReductionMode(str, Enum):
    cold_turkey = "cold_turkey"
    gradual = "gradual"
    controlled = "controlled"


class HabitCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: HabitCategory
    description: Optional[str] = None
    frequency: HabitFrequency = HabitFrequency.daily
    custom_days: Optional[list[int]] = None
    reduction_mode: ReductionMode = ReductionMode.cold_turkey
    gradual_target_per_day: Optional[float] = None
    gradual_reduction_rate: Optional[float] = None
    unit_name: str = "times"
    cost_per_unit: int = 0
    calories_per_unit: int = 0
    time_per_unit_minutes: int = 0
    alternative_behavior: Optional[str] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[HabitFrequency] = None
    custom_days: Optional[list[int]] = None
    reduction_mode: Optional[ReductionMode] = None
    gradual_target_per_day: Optional[float] = None
    gradual_reduction_rate: Optional[float] = None
    unit_name: Optional[str] = None
    cost_per_unit: Optional[int] = None
    calories_per_unit: Optional[int] = None
    time_per_unit_minutes: Optional[int] = None
    alternative_behavior: Optional[str] = None
    is_active: Optional[bool] = None


class HabitResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    category: HabitCategory
    description: Optional[str] = None
    frequency: HabitFrequency
    custom_days: Optional[list[int]] = None
    reduction_mode: ReductionMode
    gradual_target_per_day: Optional[float] = None
    gradual_reduction_rate: Optional[float] = None
    unit_name: str
    cost_per_unit: int
    calories_per_unit: int
    time_per_unit_minutes: int
    alternative_behavior: Optional[str] = None
    sobriety_start_date: Optional[datetime] = None
    current_streak_days: int
    best_streak_days: int
    total_relapses: int
    is_active: bool
    is_archived: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HabitListResponse(BaseModel):
    habits: list[HabitResponse]
    total: int
