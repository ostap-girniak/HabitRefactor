"""
Catalyst Forge — RAG Pipeline
Embedding generation and retrieval using Gemini + pgvector.
Gracefully degrades if the Gemini API quota is exhausted.
"""
from google import genai
from supabase import AsyncClient

from app.config import Settings


class RAGPipeline:
    """Handles embedding generation and similarity search for the RAG system."""

    def __init__(self, settings: Settings, db_client: AsyncClient):
        self.settings = settings
        self.db = db_client
        self.client = genai.Client(api_key=settings.gemini_api_key)

    async def generate_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector for a text string using Gemini."""
        result = self.client.models.embed_content(
            model=self.settings.gemini_embedding_model,
            contents=text,
            config={
                "output_dimensionality": self.settings.gemini_embedding_dimensions,
            },
        )
        return result.embeddings[0].values

    async def embed_and_store_user_document(
        self,
        user_id: str,
        source_type: str,
        source_id: str,
        content: str,
    ) -> None:
        """Generate embedding for user content and store in user_documents."""
        if not content or len(content.strip()) < 10:
            return

        try:
            embedding = await self.generate_embedding(content)
            await (
                self.db.table("user_documents")
                .insert({
                    "user_id": user_id,
                    "source_type": source_type,
                    "source_id": source_id,
                    "content": content,
                    "embedding": embedding,
                })
                .execute()
            )
        except Exception as e:
            print(f"[RAG] Skipping embedding storage (non-critical): {e}")

    async def search_knowledge_base(
        self,
        query: str,
        match_count: int = 5,
        match_threshold: float = 0.5,
    ) -> list[dict]:
        """Search the knowledge base using semantic similarity."""
        try:
            query_embedding = await self.generate_embedding(query)

            response = await self.db.rpc(
                "search_knowledge_base",
                {
                    "query_embedding": query_embedding,
                    "match_count": match_count,
                    "match_threshold": match_threshold,
                },
            ).execute()

            return response.data or []
        except Exception as e:
            print(f"[RAG] Knowledge base search failed (non-critical): {e}")
            return []

    async def search_user_documents(
        self,
        user_id: str,
        query: str,
        match_count: int = 10,
    ) -> list[dict]:
        """Search the user's own documents using semantic similarity."""
        try:
            query_embedding = await self.generate_embedding(query)

            response = await self.db.rpc(
                "search_user_documents",
                {
                    "p_user_id": user_id,
                    "query_embedding": query_embedding,
                    "match_count": match_count,
                },
            ).execute()

            return response.data or []
        except Exception as e:
            print(f"[RAG] User document search failed (non-critical): {e}")
            return []

    async def build_context(
        self,
        user_id: str,
        query: str,
        habit_category: str | None = None,
        match_count: int = 5,
    ) -> dict:
        """
        Build a complete RAG context by retrieving from both
        the knowledge base and user's personal documents.
        Gracefully degrades if embedding API is unavailable.
        """
        knowledge_results = await self.search_knowledge_base(
            query=query,
            match_count=match_count,
        )

        personal_results = await self.search_user_documents(
            user_id=user_id,
            query=query,
            match_count=10,
        )

        # Format for prompt inclusion
        def _format_knowledge_item(r: dict) -> str:
            meta = r.get("metadata") or {}
            url = meta.get("url")
            book = meta.get("book")
            author = meta.get("author") or r.get("source_author")
            source_type = meta.get("type", r.get("source_type", ""))
            lines = [f"**{r.get('source_title', 'Knowledge')}** [{source_type}] — {r.get('title', '')}"]
            if author:
                lines.append(f"Author: {author}")
            if book:
                lines.append(f"From: {book}")
            if url:
                lines.append(f"URL: {url}")
            lines.append(r.get("content", ""))
            return "\n".join(lines)

        knowledge_context = "\n\n".join([
            _format_knowledge_item(r) for r in knowledge_results
        ]) if knowledge_results else "No relevant knowledge found."

        # Structured list of sources for resource recommendations
        knowledge_sources_list = "\n".join([
            "- [{source_type}] {source_title} — {title}{url_part}".format(
                source_type=(r.get("metadata") or {}).get("type", r.get("source_type", "unknown")),
                source_title=r.get("source_title", ""),
                title=r.get("title", ""),
                url_part=f" | URL: {(r.get('metadata') or {}).get('url')}" if (r.get("metadata") or {}).get("url") else "",
            )
            for r in knowledge_results
        ]) if knowledge_results else "No sources available."

        personal_context = "\n\n".join([
            f"[{r.get('source_type', 'entry')} — {r.get('created_at', '')}]\n{r.get('content', '')}"
            for r in personal_results
        ]) if personal_results else "No previous personal entries found."

        return {
            "knowledge_context": knowledge_context,
            "knowledge_sources_list": knowledge_sources_list,
            "personal_context": personal_context,
            "knowledge_sources": knowledge_results,
            "personal_sources": personal_results,
        }

