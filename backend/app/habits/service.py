"""
Catalyst Forge — Habits Service (Business Logic)
"""
from uuid import UUID
from datetime import datetime, timezone
from supabase import AsyncClient


class HabitsService:
    def __init__(self, client: AsyncClient):
        self.client = client

    async def list_habits(self, user_id: str) -> list[dict]:
        """Get all active habits for a user."""
        response = await (
            self.client.table("habits")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    async def get_habit(self, habit_id: str, user_id: str) -> dict | None:
        """Get a single habit by ID."""
        response = await (
            self.client.table("habits")
            .select("*")
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        return response.data

    async def create_habit(self, user_id: str, data: dict) -> dict:
        """Create a new habit."""
        habit_data = {
            **data,
            "user_id": user_id,
            "sobriety_start_date": datetime.now(timezone.utc).isoformat(),
        }
        response = await (
            self.client.table("habits")
            .insert(habit_data)
            .execute()
        )
        return response.data[0]

    async def update_habit(self, habit_id: str, user_id: str, data: dict) -> dict:
        """Update an existing habit."""
        # Filter out None values
        update_data = {k: v for k, v in data.items() if v is not None}
        response = await (
            self.client.table("habits")
            .update(update_data)
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .execute()
        )
        return response.data[0] if response.data else None

    async def archive_habit(self, habit_id: str, user_id: str) -> bool:
        """Soft-delete a habit by archiving it."""
        response = await (
            self.client.table("habits")
            .update({"is_active": False})
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(response.data) > 0

    async def reset_streak(self, habit_id: str, user_id: str) -> dict:
        """Reset the sobriety counter after a relapse."""
        response = await (
            self.client.table("habits")
            .update({
                "current_streak_days": 0,
                "sobriety_start_date": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", habit_id)
            .eq("user_id", user_id)
            .execute()
        )
        return response.data[0] if response.data else None

    async def get_habit_stats(self, habit_id: str, user_id: str) -> dict:
        """Get comprehensive statistics for a habit via RPC."""
        response = await self.client.rpc(
            "get_habit_stats",
            {"p_habit_id": habit_id, "p_user_id": user_id}
        ).execute()
        return response.data

    async def get_savings(self, habit_id: str, user_id: str) -> dict:
        """Calculate savings (money, time, calories) for a habit."""
        response = await self.client.rpc(
            "calculate_savings",
            {"p_habit_id": habit_id, "p_user_id": user_id}
        ).execute()
        return response.data
