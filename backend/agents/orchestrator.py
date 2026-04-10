"""OrchestratorAgent — primary agent that routes all user input to sub-agents."""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import Goal, GoalStatus, AgentSession
from ..db.connection import settings
from .path_agent import generate_learning_path
from .progress_agent import get_dashboard_stats, generate_progress_insight
from .recall_agent import get_due_cards
from .team_agent import get_team_summary
from ..tools.memory_tool import semantic_search_resources, semantic_search_notes
from google.genai import types
from ..db.connection import get_genai_client, retry_on_rate_limit


SYSTEM_PROMPT = """You are the SKILLFORGE Orchestrator — a personal learning coach and AI tutor.

You coordinate a team of specialized agents:
- PathAgent: Creates personalized learning curricula
- ProgressAgent: Tracks and analyzes learning progress
- RecallAgent: Manages spaced repetition and memory
- TeamAgent: Analyzes team skill gaps

Your role:
1. Understand user intent from natural language
2. Delegate to the right sub-agent(s)
3. Synthesize results into a clear, helpful response
4. Maintain conversation context
5. Be encouraging, specific, and action-oriented

PRACTICE MODE: When the user's learning topics are provided in the context,
you can act as an interactive tutor. You can:
- Quiz them with MCQs or short answer questions on their specific topics
- Explain concepts from their curriculum in simple terms
- Give worked examples relevant to their subject
- Correct their answers and provide feedback
- Adapt difficulty based on their responses

Keep responses conversational but informative. When quizzing, wait for the user's answer before revealing the correct one."""


class OrchestratorAgent:
    def __init__(self, db: AsyncSession, user_id: str, access_token: str):
        self.db = db
        self.user_id = user_id
        self.access_token = access_token
        self.client = get_genai_client()
        # Sync chat — called via run_in_executor so it doesn't block the event loop
        self.chat = self.client.chats.create(
            model=settings.gemini_model,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )

    async def process(self, user_message: str, history: list[dict] | None = None) -> dict:
        """
        Main entry point. Routes user message to appropriate sub-agents
        and returns synthesized response.
        """
        session_id = str(uuid.uuid4())
        intent = await self._classify_intent(user_message)

        response_data = {
            "session_id": session_id,
            "intent": intent,
            "agents_invoked": [],
            "message": "",
            "data": {},
        }

        if intent == "new_goal":
            result = await self._handle_new_goal(user_message)
        elif intent == "daily_checkin":
            result = await self._handle_daily_checkin()
        elif intent == "team_analysis":
            result = await self._handle_team_analysis(_message=user_message)
        elif intent == "recall_session":
            result = await self._handle_recall_session()
        elif intent == "progress_query":
            result = await self._handle_progress_query()
        else:
            result = await self._handle_general_query(user_message, history=history or [])

        response_data.update(result)
        await self._log_session(session_id, intent, response_data.get("message", ""))
        return response_data

    async def _classify_intent(self, message: str) -> str:
        """Classify user intent with keyword matching (no Gemini call)."""
        msg = message.lower()

        # Practice/explain phrases take priority — don't misclassify as new_goal
        practice_keywords = ["explain", "what is", "how does", "how do", "why is", "why does",
                             "quiz me", "test me", "give me a question", "ask me", "practice",
                             "tell me about", "describe", "define", "example of", "show me how"]
        if any(k in msg for k in practice_keywords):
            return "general"

        learn_keywords = [
            "i want to learn", "i want learn", "i want to study", "i want study",
            "i'd like to learn", "i'd like to study", "help me learn",
            "want to learn", "want learn", "wanna learn", "wanna study",
            "create a path", "build a path", "make a plan", "start learning",
            "get into", "become a", "prepare for", "i need to learn",
            "teach me how to", "teach me ", "i wanna learn", "i wanna study",
            "train me", "make me learn", "help me study",
            "within ", "in \d", "in 1", "in 2", "in 3", "in 4", "in 5", "in 6", "in 7", "in 8",
        ]
        goal_keywords = ["new goal", "new path", "new course", "new skill",
                         "week curriculum", "month curriculum", "day curriculum",
                         "learning plan", "study plan", "roadmap for"]
        if any(k in msg for k in learn_keywords) or any(k in msg for k in goal_keywords):
            return "new_goal"

        if any(k in msg for k in ["today", "daily", "what should i", "what to do", "morning", "checkin", "check in", "this week"]):
            return "daily_checkin"

        if any(k in msg for k in ["team", "colleague", "coworker", "org", "group", "department"]):
            return "team_analysis"

        if any(k in msg for k in ["review my cards", "recall session", "flashcard", "spaced repetition", "due cards", "cards due"]):
            return "recall_session"

        if any(k in msg for k in ["progress", "completion", "stat", "how am i doing", "streak", "done", "finished", "percent"]):
            return "progress_query"

        return "general"

    async def _handle_new_goal(self, message: str) -> dict:
        """Extract goal details, create goal, generate learning path (2 Gemini calls total)."""
        import json, re
        from datetime import timedelta

        # Parse duration from the message locally (don't let Gemini override this)
        import re as _re
        msg = message.lower()
        user_weeks: int | None = None
        # Match patterns like "4 weeks", "3 months" (×4), "10 days" (//7), "in 4"
        week_match = _re.search(r'(\d+)\s*week', msg)
        month_match = _re.search(r'(\d+)\s*month', msg)
        day_match = _re.search(r'(\d+)\s*day', msg)
        if week_match:
            user_weeks = int(week_match.group(1))
        elif month_match:
            user_weeks = int(month_match.group(1)) * 4
        elif day_match:
            days = int(day_match.group(1))
            user_weeks = max(1, days // 7)
        else:
            # fallback: grab first standalone number in range
            for word in msg.split():
                if word.isdigit():
                    n = int(word)
                    if 1 <= n <= 52:
                        user_weeks = n
                        break
        weeks = user_weeks if user_weeks else 8

        # Single Gemini call: extract title + skill area only (weeks fixed above)
        extract_prompt = f"""
        Extract learning goal details from: "{message}"
        Return JSON only: {{"title": "...", "skill_area": "...", "difficulty": 3}}
        difficulty 1-5. Return only JSON, no other text.
        """
        response = await retry_on_rate_limit(
            self.client.models.generate_content,
            model=settings.gemini_flash_model,
            contents=extract_prompt,
            max_retries=1,
            call_timeout=45.0,
        )
        goal_data = {}
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            try:
                goal_data = json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # weeks already locked from user input — do NOT use goal_data.get("weeks")
        target_date = datetime.utcnow() + timedelta(weeks=weeks)
        goal = Goal(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            title=goal_data.get("title", "New Learning Goal"),
            skill_area=goal_data.get("skill_area", "General"),
            difficulty_level=goal_data.get("difficulty", 3),
            target_date=target_date,
            status=GoalStatus.active,
        )
        self.db.add(goal)
        await self.db.commit()
        await self.db.refresh(goal)

        # Second Gemini call: generate the learning path
        path = await generate_learning_path(self.db, goal, self.access_token)

        return {
            "agents_invoked": ["PathAgent"],
            "message": (
                f"I've created your **{weeks}-week learning path** for '{goal.title}'! "
                f"Your path is ready on the dashboard with resources for each week. "
                f"Start with week 1 and check your daily items to begin your journey!"
            ),
            "data": {"goal_id": goal.id, "path_id": path.id},
        }

    async def _handle_daily_checkin(self) -> dict:
        """Parallel: RecallAgent (due cards) + ProgressAgent (stats)."""
        stats, due_cards = await asyncio.gather(
            get_dashboard_stats(self.db, self.user_id),
            get_due_cards(self.db, self.user_id, limit=5),
        )
        insight = await generate_progress_insight(self.db, self.user_id, stats)

        return {
            "agents_invoked": ["ProgressAgent", "RecallAgent"],
            "message": insight,
            "data": {
                "stats": stats,
                "due_cards_count": len(due_cards),
                "todays_items": stats.get("todays_items", []),
            },
        }

    async def _handle_team_analysis(self, _message: str) -> dict:
        """Delegate to TeamAgent for gap analysis."""
        from sqlalchemy import select
        from ..db.models import TeamMember
        result = await self.db.execute(
            select(TeamMember.team_id).where(TeamMember.user_id == self.user_id).limit(1)
        )
        team_row = result.first()
        if not team_row:
            return {
                "agents_invoked": ["TeamAgent"],
                "message": "You don't appear to be part of a team yet. Create a team first to enable team analysis.",
                "data": {},
            }

        team_data = await get_team_summary(self.db, team_row[0])
        return {
            "agents_invoked": ["TeamAgent"],
            "message": team_data.get("remediation_plan", "Team analysis complete."),
            "data": team_data,
        }

    async def _handle_recall_session(self) -> dict:
        """Get due recall cards for a review session."""
        cards = await get_due_cards(self.db, self.user_id, limit=20)
        if not cards:
            return {
                "agents_invoked": ["RecallAgent"],
                "message": "No cards due for review today. Great job staying on top of your reviews! Check back tomorrow.",
                "data": {"cards": []},
            }

        cards_data = [
            {"id": c.id, "question": c.question, "answer": c.answer}
            for c in cards
        ]
        return {
            "agents_invoked": ["RecallAgent"],
            "message": f"You have {len(cards)} cards to review today. Let's go!",
            "data": {"cards": cards_data},
        }

    async def _handle_progress_query(self) -> dict:
        """Get progress stats and generate insight."""
        stats = await get_dashboard_stats(self.db, self.user_id)
        insight = await generate_progress_insight(self.db, self.user_id, stats)
        return {
            "agents_invoked": ["ProgressAgent"],
            "message": insight,
            "data": {"stats": stats},
        }

    async def _get_active_topics_context(self) -> str:
        """Fetch the user's most recent active goal and its path topics for practice context."""
        from sqlalchemy import select
        from ..db.models import Goal, GoalStatus, LearningPath, PathItem

        goal_result = await self.db.execute(
            select(Goal)
            .where(Goal.user_id == self.user_id, Goal.status == GoalStatus.active)
            .order_by(Goal.created_at.desc())
            .limit(1)
        )
        goal = goal_result.scalar_one_or_none()
        if not goal:
            return ""

        path_result = await self.db.execute(
            select(LearningPath).where(LearningPath.goal_id == goal.id).limit(1)
        )
        path = path_result.scalar_one_or_none()
        if not path:
            return ""

        items_result = await self.db.execute(
            select(PathItem)
            .where(PathItem.path_id == path.id)
            .order_by(PathItem.week_number, PathItem.order_index)
        )
        items = items_result.scalars().all()
        if not items:
            return ""

        topics_by_week: dict[int, list[str]] = {}
        for item in items:
            topics_by_week.setdefault(item.week_number, []).append(item.title)

        lines = [f"\n--- LEARNER'S CURRENT CURRICULUM: '{goal.title}' ---"]
        for week, titles in sorted(topics_by_week.items()):
            lines.append(f"Week {week}: {', '.join(titles)}")
        lines.append("--- Use these topics when the user asks to be quizzed, tested, or wants an explanation. ---\n")
        return "\n".join(lines)

    async def _handle_general_query(self, message: str, history: list[dict] | None = None) -> dict:
        """Handle general queries with curriculum-grounded Gemini response."""
        # Semantic search can fail if embedding API is slow — graceful fallback
        try:
            resources, notes, topics_context = await asyncio.gather(
                semantic_search_resources(self.db, message, self.user_id, limit=3),
                semantic_search_notes(self.db, message, self.user_id, limit=2),
                self._get_active_topics_context(),
            )
        except Exception:
            resources, notes = [], []
            topics_context = await self._get_active_topics_context()

        context = topics_context
        if resources:
            context += f"\nRelevant resources: {[r['title'] for r in resources]}"
        if notes:
            context += f"\nRelevant notes: {[n['title'] for n in notes]}"

        # Build conversation history block (last 6 turns to keep tokens low)
        history_block = ""
        if history:
            recent = history[-6:]
            lines = []
            for h in recent:
                role = "Student" if h["role"] == "user" else "Tutor"
                lines.append(f"{role}: {h['content'][:300]}")
            history_block = "\n--- CONVERSATION SO FAR ---\n" + "\n".join(lines) + "\n--- END ---\n\n"

        # Build a focused prompt — keep context short to avoid timeouts
        if context.strip():
            prompt = f"{context}{history_block}Student says: {message}\n\nRespond as an AI tutor. Do NOT ask clarifying questions — give a direct, helpful answer."
        else:
            prompt = f"{history_block}Student says: {message}\n\nImportant: Give a direct answer. Do not ask clarifying questions."

        response = await retry_on_rate_limit(
            self.client.models.generate_content,
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
        return {
            "agents_invoked": ["PracticeAgent"],
            "message": response.text,
            "data": {"resources": resources, "notes": notes},
        }

    async def _log_session(self, session_id: str, intent: str, summary: str):
        session = AgentSession(
            id=session_id,
            user_id=self.user_id,
            session_type=intent,
            ended_at=datetime.utcnow(),
            summary_text=summary[:500] if summary else None,
        )
        self.db.add(session)
        await self.db.commit()
