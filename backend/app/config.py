"""
Catalyst Forge — FastAPI Application Configuration
"""
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "HabitRefactor"
    app_version: str = "0.1.0"
    debug: bool = False
    api_prefix: str = "/api/v1"
    app_env: str = "development"

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000"
    
    @property
    def allowed_origins(self) -> list[str]:
        return [s.strip() for s in self.cors_origins.split(",") if s.strip()]

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # AI Provider (gemini or openai_compat)
    ai_provider: str = "gemini"

    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_embedding_dimensions: int = 768

    # OpenAI-compatible (Groq, DeepSeek, etc.)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.groq.com/openai/v1"
    openai_model: str = "llama-3.3-70b-versatile"

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_contact_email: str = Field(
        default="",
        validation_alias=AliasChoices("VAPID_CONTACT_EMAIL", "VAPID_EMAIL"),
    )

    # Relapse Interceptor (smart danger-zone push loop)
    enable_relapse_interceptor: bool = False
    relapse_interceptor_interval_minutes: int = 30
    relapse_interceptor_min_send_interval_minutes: int = 180
    relapse_interceptor_danger_zone_threshold: float = 70.0

    # Scheduled Reminders (time-based push reminders)
    enable_scheduled_reminders: bool = False
    scheduled_reminders_interval_minutes: int = 1

    # Pattern Interceptor (behavioral pattern analysis & pre-emptive alerts)
    enable_pattern_interceptor: bool = True
    pattern_interceptor_interval_minutes: int = 15

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
