import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from pydantic_settings import BaseSettings
from google import genai as _genai


async def retry_on_rate_limit(fn, *args, max_retries: int = 2, base_delay: float = 5.0, call_timeout: float = 30.0, **kwargs):
    """
    Run a SYNC Gemini callable in a thread executor with a hard timeout.
    asyncio.wait_for can cancel the Future returned by run_in_executor,
    which reliably stops waiting even when the underlying TCP socket hangs.
    """
    loop = asyncio.get_running_loop()
    for attempt in range(max_retries):
        try:
            result = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: fn(*args, **kwargs)),
                timeout=call_timeout,
            )
            return result
        except asyncio.TimeoutError:
            if attempt < max_retries - 1:
                await asyncio.sleep(base_delay)
            else:
                raise TimeoutError(f"Gemini call timed out after {call_timeout}s")
        except Exception as e:
            if ("429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)) and attempt < max_retries - 1:
                await asyncio.sleep(base_delay * (2 ** attempt))
            else:
                raise


def get_genai_client() -> _genai.Client:
    """
    Return a Vertex AI Gemini client using Application Default Credentials.
    Reads GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
    from environment — same pattern as aria-disaster-response.
    """
    import os
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "1")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.google_project_id or "skillforge-492703")
    os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.google_location)
    return _genai.Client()


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "extra": "ignore"}

    alloydb_url: str = "postgresql+asyncpg://user:password@localhost:5432/skillforge"
    google_project_id: str = ""
    google_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"
    gemini_flash_model: str = "gemini-2.5-flash"
    google_client_id: str = ""
    google_client_secret: str = ""
    pubsub_topic: str = "skillforge-jobs"
    dev_mode: bool = False
    dev_user_id: str = "dev-user-001"


settings = Settings()

engine = create_async_engine(
    settings.alloydb_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
