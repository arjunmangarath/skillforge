"""AlloyDB pgvector semantic memory tool."""
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import PathItem, Note
from ..db.connection import settings


async def embed_text(content: str) -> list[float]:
    """Generate embeddings using Vertex AI text-embedding-004 (non-blocking)."""
    import asyncio
    import vertexai
    from vertexai.language_models import TextEmbeddingModel

    def _embed():
        vertexai.init(project=settings.google_project_id, location=settings.google_location)
        model = TextEmbeddingModel.from_pretrained("text-embedding-004")
        return model.get_embeddings([content])[0].values

    loop = asyncio.get_running_loop()
    return await asyncio.wait_for(
        loop.run_in_executor(None, _embed),
        timeout=15.0,
    )


async def semantic_search_resources(
    db: AsyncSession,
    query: str,
    user_id: str,
    limit: int = 5,
) -> list[dict]:
    """
    Semantic search over path_items using pgvector cosine similarity.
    Returns most relevant resources for the query.
    """
    query_embedding = await embed_text(query)
    embedding_str = f"[{','.join(map(str, query_embedding))}]"

    result = await db.execute(
        text(f"""
            SELECT pi.id, pi.title, pi.resource_url, pi.resource_type,
                   1 - (pi.embedding <=> '{embedding_str}'::vector) AS similarity
            FROM path_items pi
            JOIN learning_paths lp ON pi.path_id = lp.id
            JOIN goals g ON lp.goal_id = g.id
            WHERE g.user_id = :user_id
              AND pi.embedding IS NOT NULL
            ORDER BY pi.embedding <=> '{embedding_str}'::vector
            LIMIT :limit
        """),
        {"user_id": user_id, "limit": limit},
    )
    rows = result.fetchall()
    return [
        {
            "id": r.id,
            "title": r.title,
            "url": r.resource_url,
            "type": r.resource_type,
            "similarity": round(r.similarity, 3),
        }
        for r in rows
    ]


async def semantic_search_notes(
    db: AsyncSession,
    query: str,
    user_id: str,
    limit: int = 5,
) -> list[dict]:
    """Semantic search over user notes."""
    query_embedding = await embed_text(query)
    embedding_str = f"[{','.join(map(str, query_embedding))}]"

    result = await db.execute(
        text(f"""
            SELECT id, title, content, source_url,
                   1 - (embedding <=> '{embedding_str}'::vector) AS similarity
            FROM notes
            WHERE user_id = :user_id
              AND embedding IS NOT NULL
            ORDER BY embedding <=> '{embedding_str}'::vector
            LIMIT :limit
        """),
        {"user_id": user_id, "limit": limit},
    )
    rows = result.fetchall()
    return [
        {
            "id": r.id,
            "title": r.title,
            "content": r.content[:500],
            "url": r.source_url,
            "similarity": round(r.similarity, 3),
        }
        for r in rows
    ]


MEMORY_TOOL_SPEC = {
    "name": "memory_tool",
    "description": "Semantic search over the user's learning resources and notes using vector similarity",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["search_resources", "search_notes"],
            },
            "query": {"type": "string"},
            "limit": {"type": "integer", "default": 5},
        },
        "required": ["action", "query"],
    },
}
