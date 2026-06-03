"""
Catalyst Forge — Identity Shift Lab Router
"""
from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from supabase import AsyncClient
from postgrest.exceptions import APIError

from app.dependencies import get_current_user, get_authenticated_client

router = APIRouter()

def _is_missing_column_error(error: Exception, column_name: str) -> bool:
    message = str(error).lower()
    return column_name.lower() in message and (
        "schema cache" in message or "could not find" in message
    )


class IdentityCreate(BaseModel):
    old_identity: str = Field(..., min_length=5, max_length=500)
    new_identity: str = Field(..., min_length=5, max_length=500)
    daily_affirmation: Optional[str] = Field(None, min_length=5, max_length=500)

    @field_validator("daily_affirmation", mode="before")
    @classmethod
    def blank_affirmation_is_optional(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


class IdentityUpdate(BaseModel):
    old_identity: Optional[str] = None
    new_identity: Optional[str] = None
    daily_affirmation: Optional[str] = None
    proof_points: Optional[list[str]] = None
    is_active: Optional[bool] = None
    belief_score: Optional[int] = Field(None, ge=1, le=100)


class IdentityResponse(BaseModel):
    id: UUID
    user_id: UUID
    old_identity: str
    new_identity: str
    daily_affirmation: str
    proof_points: Optional[list[str]]
    belief_score: int
    last_affirmed_at: Optional[datetime]
    affirmation_streak: int
    is_active: bool
    created_at: datetime


@router.get("/statements")
async def list_statements(
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Get active identity statements."""
    response = await (
        client.table("identity_statements")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return {"statements": response.data}


@router.post("/statements", status_code=status.HTTP_201_CREATED)
async def create_statement(
    data: IdentityCreate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Create a new identity statement."""
    daily_affirmation = data.daily_affirmation or f"I am {data.new_identity.strip()}"
    stmt_data = {
        **data.model_dump(exclude_none=True),
        "daily_affirmation": daily_affirmation,
        "user_id": str(user.id),
    }
    try:
        response = await client.table("identity_statements").insert(stmt_data).execute()
    except APIError as err:
        # Backward compatibility for databases that have not applied latest migration yet.
        if _is_missing_column_error(err, "daily_affirmation"):
            fallback_data = {k: v for k, v in stmt_data.items() if k != "daily_affirmation"}
            response = await client.table("identity_statements").insert(fallback_data).execute()
        else:
            raise
    # Keep current identity in profile for AI prompts and dashboard context
    try:
        await (
            client.table("profiles")
            .update({"current_identity_statement": data.new_identity})
            .eq("id", str(user.id))
            .execute()
        )
    except Exception as err:
        print(f"[WARN] Failed to sync profile identity after creating statement: {err}")
    return response.data[0]


@router.put("/statements/{statement_id}")
async def update_statement(
    statement_id: UUID,
    data: IdentityUpdate,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Update an identity statement."""
    update_data = data.model_dump(exclude_none=True)
    try:
        response = await (
            client.table("identity_statements")
            .update(update_data)
            .eq("id", str(statement_id))
            .eq("user_id", str(user.id))
            .execute()
        )
    except APIError as err:
        if _is_missing_column_error(err, "daily_affirmation") and "daily_affirmation" in update_data:
            fallback_update = {k: v for k, v in update_data.items() if k != "daily_affirmation"}
            response = await (
                client.table("identity_statements")
                .update(fallback_update)
                .eq("id", str(statement_id))
                .eq("user_id", str(user.id))
                .execute()
            )
        else:
            raise
    if not response.data:
        raise HTTPException(status_code=404, detail="Statement not found")
    # Keep profile identity in sync when the active statement text changes
    if "new_identity" in update_data and update_data.get("new_identity"):
        await (
            client.table("profiles")
            .update({"current_identity_statement": update_data["new_identity"]})
            .eq("id", str(user.id))
            .execute()
        )
    return response.data[0]


@router.post("/statements/{statement_id}/affirm")
async def affirm_statement(
    statement_id: UUID,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Record a daily affirmation. Builds streak and increases belief score."""
    # Get current statement
    stmt = await (
        client.table("identity_statements")
        .select("*")
        .eq("id", str(statement_id))
        .eq("user_id", str(user.id))
        .single()
        .execute()
    )

    if not stmt.data:
        raise HTTPException(status_code=404, detail="Statement not found")

    current = stmt.data
    last_affirmed_raw = current.get("last_affirmed_at")
    if last_affirmed_raw:
        last_affirmed = datetime.fromisoformat(last_affirmed_raw.replace("Z", "+00:00"))
        if last_affirmed.date() == datetime.utcnow().date():
            return {
                "message": "Already affirmed today. Come back tomorrow and keep the streak alive.",
                "streak": current["affirmation_streak"],
                "belief_score": current["belief_score"],
                "statement": current,
            }

    new_streak = current["affirmation_streak"] + 1
    # Belief grows slowly but surely — like real identity change
    new_belief = min(100, current["belief_score"] + max(1, new_streak // 7))

    response = await (
        client.table("identity_statements")
        .update({
            "affirmation_streak": new_streak,
            "belief_score": new_belief,
            "last_affirmed_at": datetime.utcnow().isoformat(),
        })
        .eq("id", str(statement_id))
        .execute()
    )

    return {
        "message": f"Day {new_streak}. Belief: {new_belief}%. You ARE becoming this person.",
        "streak": new_streak,
        "belief_score": new_belief,
        "statement": response.data[0],
    }


class AffirmationRequest(BaseModel):
    statement_id: Optional[UUID] = None


@router.post("/generate-affirmation")
async def generate_affirmation(
    payload: Optional[AffirmationRequest] = None,
    user=Depends(get_current_user),
    client: AsyncClient = Depends(get_authenticated_client),
):
    """Generate a practical daily affirmation based on identity and recent progress."""
    select_fields = "id, new_identity, daily_affirmation, belief_score, affirmation_streak, proof_points"
    try:
        statement_query = (
            client.table("identity_statements")
            .select(select_fields)
            .eq("user_id", str(user.id))
            .eq("is_active", True)
        )
        if payload and payload.statement_id:
            statement_query = statement_query.eq("id", str(payload.statement_id))
        else:
            statement_query = statement_query.order("created_at", desc=True).limit(1)
        statement_resp = await statement_query.execute()
    except APIError as err:
        if _is_missing_column_error(err, "daily_affirmation"):
            fallback_query = (
                client.table("identity_statements")
                .select("id, new_identity, belief_score, affirmation_streak, proof_points")
                .eq("user_id", str(user.id))
                .eq("is_active", True)
            )
            if payload and payload.statement_id:
                fallback_query = fallback_query.eq("id", str(payload.statement_id))
            else:
                fallback_query = fallback_query.order("created_at", desc=True).limit(1)
            statement_resp = await fallback_query.execute()
        else:
            raise
    if not statement_resp.data:
        raise HTTPException(status_code=404, detail="No active identity statement found")

    statement = statement_resp.data[0]
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
    week_checkins = await (
        client.table("checkins")
        .select("result")
        .eq("user_id", str(user.id))
        .gte("date", seven_days_ago)
        .execute()
    )
    successful_days = sum(1 for item in week_checkins.data if item.get("result") == "success")
    proof_points = statement.get("proof_points") or []
    first_proof = proof_points[0] if proof_points else "You are still here, still showing up."

    return {
        "affirmation": statement.get("daily_affirmation") or f"I am {statement['new_identity']}",
        "proof_reminder": (
            f"{first_proof} | {successful_days}/7 successful check-in days this week."
        ),
        "challenge": (
            f"Before your next trigger, say out loud: 'I am {statement['new_identity']}'. "
            "Then do one small replacement action immediately."
        ),
        "context": {
            "belief_score": statement.get("belief_score", 0),
            "affirmation_streak": statement.get("affirmation_streak", 0),
            "successful_days_last_7": successful_days,
        },
    }
