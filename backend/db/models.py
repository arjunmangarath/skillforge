from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text, ForeignKey,
    Enum as SAEnum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from .connection import Base
import enum


class UserRole(str, enum.Enum):
    learner = "learner"
    manager = "manager"


class GoalStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    paused = "paused"


class ResourceType(str, enum.Enum):
    video = "video"
    article = "article"
    course = "course"
    book = "book"


class ProgressStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    google_id: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    avatar_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.learner)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    goals: Mapped[list["Goal"]] = relationship(back_populates="user")
    progress_logs: Mapped[list["ProgressLog"]] = relationship(back_populates="user")
    recall_cards: Mapped[list["RecallCard"]] = relationship(back_populates="user")
    notes: Mapped[list["Note"]] = relationship(back_populates="user")
    agent_sessions: Mapped[list["AgentSession"]] = relationship(back_populates="user")


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    members: Mapped[list["TeamMember"]] = relationship(back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    team: Mapped["Team"] = relationship(back_populates="members")


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(SAEnum(GoalStatus), default=GoalStatus.active)
    skill_area: Mapped[str] = mapped_column(String)
    difficulty_level: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="goals")
    learning_paths: Mapped[list["LearningPath"]] = relationship(back_populates="goal")


class LearningPath(Base):
    __tablename__ = "learning_paths"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    goal_id: Mapped[str] = mapped_column(ForeignKey("goals.id"))
    generated_by: Mapped[str] = mapped_column(String, default="ai")
    gemini_session_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    total_weeks: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    goal: Mapped["Goal"] = relationship(back_populates="learning_paths")
    items: Mapped[list["PathItem"]] = relationship(back_populates="path")


class PathItem(Base):
    __tablename__ = "path_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    path_id: Mapped[str] = mapped_column(ForeignKey("learning_paths.id"))
    week_number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String)
    resource_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    resource_type: Mapped[ResourceType] = mapped_column(SAEnum(ResourceType), default=ResourceType.article)
    estimated_hours: Mapped[float] = mapped_column(Float, default=1.0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[Optional[list]] = mapped_column(Vector(768), nullable=True)

    path: Mapped["LearningPath"] = relationship(back_populates="items")
    progress_logs: Mapped[list["ProgressLog"]] = relationship(back_populates="path_item")
    recall_cards: Mapped[list["RecallCard"]] = relationship(back_populates="path_item")


class ProgressLog(Base):
    __tablename__ = "progress_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    path_item_id: Mapped[str] = mapped_column(ForeignKey("path_items.id"))
    status: Mapped[ProgressStatus] = mapped_column(SAEnum(ProgressStatus), default=ProgressStatus.not_started)
    completion_pct: Mapped[float] = mapped_column(Float, default=0.0)
    time_spent_mins: Mapped[int] = mapped_column(Integer, default=0)
    notes_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="progress_logs")
    path_item: Mapped["PathItem"] = relationship(back_populates="progress_logs")


class RecallCard(Base):
    __tablename__ = "recall_cards"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    path_item_id: Mapped[str] = mapped_column(ForeignKey("path_items.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    next_review_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="recall_cards")
    path_item: Mapped["PathItem"] = relationship(back_populates="recall_cards")
    reviews: Mapped[list["RecallReview"]] = relationship(back_populates="card")


class RecallReview(Base):
    __tablename__ = "recall_reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey("recall_cards.id"))
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    quality_score: Mapped[int] = mapped_column(Integer)  # 0-5 SM-2 input
    new_interval_days: Mapped[int] = mapped_column(Integer)

    card: Mapped["RecallCard"] = relationship(back_populates="reviews")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    source_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    embedding: Mapped[Optional[list]] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="notes")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    google_event_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    path_item_id: Mapped[str] = mapped_column(ForeignKey("path_items.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime)
    sync_status: Mapped[str] = mapped_column(String, default="pending")
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class TaskSync(Base):
    __tablename__ = "tasks_sync"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    google_task_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    path_item_id: Mapped[str] = mapped_column(ForeignKey("path_items.id"))
    status: Mapped[str] = mapped_column(String, default="pending")
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    session_type: Mapped[str] = mapped_column(String)
    gemini_session_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    summary_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="agent_sessions")
