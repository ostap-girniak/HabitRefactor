"""
Catalyst Forge — Journal Transcription via Local Whisper & Gemini
Uses faster-whisper locally for speech-to-text, bypassing media limits.
Uses Gemini for lightweight text-based emotion analysis.
"""
import os
import json
import httpx
import tempfile
import asyncio
from typing import Optional
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from pydantic import BaseModel
from supabase import AsyncClient

from app.config import Settings
from app.notifications.push import send_web_push, save_notification_to_history
from app.notifications import templates as nt

# --- Lazy initialization and ffmpeg hooking ---
_WHISPER_MODEL = None

def get_whisper_model():
    """Lazy load the Whisper model so it doesn't block server startup."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        print("[AI] Injecting embedded ffmpeg path...")
        try:
            import imageio_ffmpeg
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            os.environ["PATH"] += os.pathsep + os.path.dirname(ffmpeg_exe)
            print(f"[AI] Embedded ffmpeg registered: {ffmpeg_exe}")
        except ImportError:
            print("[AI] Warning: imageio-ffmpeg not found. Assuming ffmpeg is in PATH.")

        print("[AI] Loading local Whisper base model...")
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise RuntimeError(
                "Voice/video journals require the `faster-whisper` package, which is "
                "disabled by default to keep low-memory hosts (Render free tier) viable. "
                "To enable: uncomment `faster-whisper` and `imageio-ffmpeg` in "
                "backend/requirements.txt and redeploy. Text journals work without it."
            ) from e
        # Load CPU version optimized with int8
        _WHISPER_MODEL = WhisperModel("base", device="cpu", compute_type="int8")
        print("[AI] Whisper model loaded successfully.")
    return _WHISPER_MODEL


class TranscriptResult(BaseModel):
    title: str = ""
    transcript: str
    language: str = "uk"
    detected_emotions: dict[str, float] = {}
    emotional_intensity: int = 5
    key_themes: list[str] = []
    summary: str = ""
    notable_quotes: list[str] = []

# Gemini-friendly JSON Schema (No 'additionalProperties' fields)
GEMINI_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "transcript": {"type": "STRING"},
        "language": {"type": "STRING"},
        "detected_emotions": {
            "type": "OBJECT",
            "properties": {
                "joy": {"type": "NUMBER"},
                "anger": {"type": "NUMBER"},
                "sadness": {"type": "NUMBER"},
                "shame": {"type": "NUMBER"},
                "relief": {"type": "NUMBER"}
            }
        },
        "emotional_intensity": {"type": "INTEGER"},
        "key_themes": {"type": "ARRAY", "items": {"type": "STRING"}},
        "summary": {"type": "STRING"},
        "notable_quotes": {"type": "ARRAY", "items": {"type": "STRING"}}
    },
    "required": ["title", "transcript", "detected_emotions", "emotional_intensity", "key_themes", "summary"]
}


async def transcribe_with_gemini(
    settings: Settings,
    db_client: AsyncClient,
    entry_id: str,
    media_url: Optional[str],
    media_type: str,
    raw_text: Optional[str] = None,
) -> TranscriptResult:
    """
    Hybrid Execution:
    1. (Optional) Download media and run local Whisper.
    2. Feed resulting or provided transcript to Gemini for JSON structuring.
    """
    print(f"[AI] Starting analysis for entry {entry_id} (Type: {media_type})...")
    
    # 1. Update status to processing (if not already completed as text)
    if media_type != "text":
        await (
            db_client.table("journal_entries")
            .update({"transcription_status": "processing"})
            .eq("id", entry_id)
            .execute()
        )

    temp_media_path = None
    try:
        # Use provided text or transcribe from media
        current_transcript = raw_text
        
        if not current_transcript and media_url:
            # 2. Extract storage path from URL to create a signed URL
            storage_path = media_url.split("/journal-media/")[-1]
            print(f"[AI] Generating signed URL for: {storage_path}")
            
            signed_url_res = await db_client.storage.from_("journal-media").create_signed_url(storage_path, 60)
            download_url = signed_url_res.get("signedURL") or media_url

            # 3. Download media to temp file
            print(f"[AI] Downloading media for entry {entry_id}...")
            async with httpx.AsyncClient(timeout=60.0) as http:
                response = await http.get(download_url)
                response.raise_for_status()
                media_bytes = response.content
            
            suffix = ".webm"
            if "mp4" in storage_path.lower():
                suffix = ".mp4"
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_media:
                temp_media.write(media_bytes)
                temp_media_path = temp_media.name
                
            print(f"[AI] Downloaded {len(media_bytes)} bytes. Executing local Whisper...")

            # 4. Local Transcription using Whisper (Execution in background thread)
            def run_whisper(path: str) -> str:
                model = get_whisper_model()
                segments, info = model.transcribe(path, beam_size=5)
                # Join segments into single transcript
                full_text = " ".join([segment.text for segment in segments])
                return full_text.strip()
                
            loop = asyncio.get_running_loop()
            current_transcript = await loop.run_in_executor(None, run_whisper, temp_media_path)
            
            print(f"[AI] Whisper transcription done. Output length: {len(current_transcript)}")

            if not current_transcript:
                empty_result = TranscriptResult(transcript="[No intelligible audio detected]", summary="Nothing was said.")
                await finish_db_update(db_client, entry_id, empty_result)
                return empty_result

            # --- Stage 1: Immediate Save of Raw Transcript ---
            print(f"[AI] Saving raw transcript (Stage 1) for {entry_id}...")
            await (
                db_client.table("journal_entries")
                .update({
                    "transcript": current_transcript,
                    "transcription_status": "transcribed"
                })
                .eq("id", entry_id)
                .execute()
            )
        
        # 5. Stage 2: Semantic Analysis using Gemini (Text only)
        # We wrap this in another try/except so Gemini failure doesn't lose the transcript
        try:
            if not current_transcript:
                raise ValueError("No transcript available for analysis")

            # Define the prompt for semantic extraction
            prompt = f"""
Analyze the following verbatim transcript from a personal journal recording. 
The person is speaking about their personal struggles, habits, emotions, or daily reflections.

TRANSCRIPT:
"{current_transcript}"

Return a JSON object with strictly these keys:
1. "title": A short, catchy, and descriptive title (3-5 words max).
2. "detected_emotions": An object containing EXACTLY these keys: joy, anger, sadness, shame, relief. Each value must be a score from 0.0 to 1.0.
3. "emotional_intensity": A single integer from 0 to 10.
4. "key_themes": An array of 3-5 strings.
5. "summary": A brief 1-sentence summary.
6. "notable_quotes": An array of 1-3 short impactful strings from the text.
"""

            # AI Analysis Execution
            raw_ai_text = ""
            
            if settings.ai_provider == "gemini":
                print(f"[AI] Running Gemini Semantic Extraction (Stage 2)...")
                client = genai.Client(api_key=settings.gemini_api_key)
                
                # Gemini Retry Logic (Exponential Backoff)
                max_retries = 3
                backoff_factor = 2
                
                result = None
                last_error = None
                
                for attempt in range(max_retries):
                    try:
                        result = client.models.generate_content(
                            model=settings.gemini_model,
                            contents=[prompt],
                            config=types.GenerateContentConfig(
                                temperature=0.1,  
                                response_mime_type="application/json",
                                response_schema=GEMINI_RESPONSE_SCHEMA,
                            ),
                        )
                        break 
                    except Exception as e:
                        last_error = e
                        err_str = str(e).upper()
                        if any(x in err_str for x in ["503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED"]):
                            wait_time = backoff_factor ** (attempt + 1)
                            print(f"[AI] Gemini Busy ({err_str[:20]})... Retrying in {wait_time}s (Attempt {attempt+1}/{max_retries})")
                            await asyncio.sleep(wait_time)
                        else:
                            raise e
                
                if not result:
                    if last_error: raise last_error
                    raise ValueError("AI Analysis failed to return a result after retries")
                raw_ai_text = result.text

            else:
                # OpenAI-compatible providers (Groq, DeepSeek, etc.)
                print(f"[AI] Running OpenAI-compat ({settings.openai_model}) Semantic Extraction (Stage 2)...")
                client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
                
                response = await client.chat.completions.create(
                    model=settings.openai_model,
                    messages=[
                        {"role": "system", "content": "You are a specialized semantic extraction agent. You MUST return valid JSON matching the requested keys exactly."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
                raw_ai_text = response.choices[0].message.content

            print(f"[AI] AI raw output for {entry_id}: {raw_ai_text[:200]}...")
            transcript_data = json.loads(raw_ai_text)
            
            # --- Normalize keys for Cross-Provider Robustness ---
            # Some models (like Llama) might use 'emotional_payload' or similar despite prompting
            if "emotional_payload" in transcript_data and "detected_emotions" not in transcript_data:
                transcript_data["detected_emotions"] = transcript_data.pop("emotional_payload")
            
            # Ensure the transcript overrides whatever the AI tried to auto-format
            transcript_data["transcript"] = current_transcript
            
            transcript_result = TranscriptResult(**transcript_data)
            print(f"[AI] Semantic Extraction successful. Emotions: {list(transcript_result.detected_emotions.keys())}")
            
            # 6. Final DB Update (AI results)
            await finish_db_update(db_client, entry_id, transcript_result)
            await notify_journal_analysis_complete(settings, db_client, entry_id, transcript_result)
            return transcript_result

        except Exception as ai_err:
            print(f"[AI] Semantic Extraction FAILED (but transcript is saved): {str(ai_err)}")
            # Even if AI fails, we mark the entry as completed since we have the transcript
            await (
                db_client.table("journal_entries")
                .update({
                    "transcription_status": "completed",
                    "analysis_status": "failed" # Mark analysis specifically as failed
                })
                .eq("id", entry_id)
                .execute()
            )
            return TranscriptResult(transcript=current_transcript or "")

    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e)
        if len(err_msg) > 500:
            err_msg = err_msg[:500]
        
        print(f"[AI] ERROR in transcription for {entry_id}: {err_msg}")
        # Mark as failed with a string-only message (avoid binary leak)
        await (
            db_client.table("journal_entries")
            .update({"transcription_status": f"FAILED: {err_msg}"})
            .eq("id", entry_id)
            .execute()
        )
        raise
    finally:
        # 7. Cleanup temp file
        if temp_media_path and os.path.exists(temp_media_path):
            try:
                os.remove(temp_media_path)
            except Exception:
                pass


async def finish_db_update(db_client, entry_id, transcript_result: TranscriptResult):
    await (
        db_client.table("journal_entries")
        .update({
            "title": transcript_result.title,
            "transcript": transcript_result.transcript,
            "detected_emotions": transcript_result.detected_emotions,
            "emotional_intensity": transcript_result.emotional_intensity,
            "key_themes": transcript_result.key_themes,
            "transcription_status": "completed",
            "analysis_status": "completed",
            "transcript_confidence": 0.95,
        })
        .eq("id", entry_id)
        .execute()
    )
    print(f"[AI] Database updated for entry {entry_id} with completed transcript.")


async def notify_journal_analysis_complete(
    settings: Settings,
    db_client,
    entry_id: str,
    transcript_result: TranscriptResult,
) -> None:
    """Save/send a journal-analysis notification after semantic extraction completes."""
    try:
        entry_resp = await (
            db_client.table("journal_entries")
            .select("user_id, mood_rating")
            .eq("id", entry_id)
            .single()
            .execute()
        )
        entry = entry_resp.data or {}
        user_id = entry.get("user_id")
        if not user_id:
            return

        user_lang = await nt.get_user_lang(db_client, str(user_id))
        themes = transcript_result.key_themes or []
        mood = entry.get("mood_rating")
        intense = (transcript_result.emotional_intensity or 0) >= 8
        danger_emotions = transcript_result.detected_emotions or {}
        is_danger = bool(
            (mood is not None and mood <= 3)
            or intense
            or danger_emotions.get("shame", 0) >= 0.55
            or danger_emotions.get("sadness", 0) >= 0.65
            or danger_emotions.get("anger", 0) >= 0.65
        )

        if is_danger:
            snippet = (transcript_result.summary or transcript_result.transcript or "")[:90]
            title, body = nt.pick_journal_danger(user_lang, snippet=snippet)
            notification_type = "journal_analysis_warning"
            tag = "journal-analysis-warning"
        else:
            title, body = nt.pick_journal_motivation(user_lang, themes=themes)
            notification_type = "journal_analysis"
            tag = "journal-analysis"

        url = "/journal/notifications"
        metadata = {
            "journal_entry_id": entry_id,
            "key_themes": themes,
            "summary": transcript_result.summary,
            "emotional_intensity": transcript_result.emotional_intensity,
            "detected_emotions": transcript_result.detected_emotions,
            "is_danger": is_danger,
        }

        await save_notification_to_history(
            client=db_client,
            user_id=str(user_id),
            title=title,
            body=body,
            notification_type=notification_type,
            url=url,
            metadata=metadata,
        )

        subs_resp = await (
            db_client.table("push_subscriptions")
            .select("endpoint, p256dh_key, auth_key, keys, is_active")
            .eq("user_id", str(user_id))
            .limit(20)
            .execute()
        )
        for sub in subs_resp.data or []:
            if sub.get("is_active") is False:
                continue
            err = await send_web_push(
                settings=settings,
                subscription=sub,
                title=title,
                body=body,
                url=url,
                tag=tag,
            )
            if err == "subscription_gone":
                await (
                    db_client.table("push_subscriptions")
                    .update({"is_active": False})
                    .eq("endpoint", sub.get("endpoint"))
                    .execute()
                )
    except Exception as e:
        print(f"[WARN] Failed to notify journal analysis completion: {e}")
