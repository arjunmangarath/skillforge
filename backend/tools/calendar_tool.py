"""Google Calendar MCP tool for scheduling learning sessions."""
from datetime import datetime, timedelta
from typing import Optional
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


def get_calendar_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("calendar", "v3", credentials=creds)


async def schedule_learning_session(
    access_token: str,
    title: str,
    description: str,
    start_time: datetime,
    duration_hours: float = 1.0,
    resource_url: Optional[str] = None,
) -> dict:
    """Schedule a learning session block in Google Calendar."""
    service = get_calendar_service(access_token)
    end_time = start_time + timedelta(hours=duration_hours)

    body = {
        "summary": f"📚 {title}",
        "description": f"{description}\n\nResource: {resource_url or 'N/A'}",
        "start": {"dateTime": start_time.isoformat(), "timeZone": "UTC"},
        "end": {"dateTime": end_time.isoformat(), "timeZone": "UTC"},
        "colorId": "2",  # green — growth theme
        "reminders": {
            "useDefault": False,
            "overrides": [{"method": "popup", "minutes": 15}],
        },
    }

    event = service.events().insert(calendarId="primary", body=body).execute()
    return {"google_event_id": event["id"], "html_link": event.get("htmlLink")}


async def get_today_events(access_token: str) -> list[dict]:
    """Fetch today's learning events from Google Calendar."""
    service = get_calendar_service(access_token)
    now = datetime.utcnow()
    day_start = now.replace(hour=0, minute=0, second=0).isoformat() + "Z"
    day_end = now.replace(hour=23, minute=59, second=59).isoformat() + "Z"

    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=day_start,
            timeMax=day_end,
            singleEvents=True,
            orderBy="startTime",
            q="📚",
        )
        .execute()
    )
    return result.get("items", [])


async def delete_event(access_token: str, event_id: str) -> bool:
    """Remove a scheduled learning session."""
    try:
        service = get_calendar_service(access_token)
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return True
    except Exception:
        return False


# ADK tool definition
CALENDAR_TOOL_SPEC = {
    "name": "calendar_tool",
    "description": "Schedule, retrieve, and manage learning sessions in Google Calendar",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["schedule", "get_today", "delete"],
                "description": "Action to perform",
            },
            "title": {"type": "string", "description": "Session title"},
            "description": {"type": "string", "description": "Session description"},
            "start_time": {"type": "string", "description": "ISO 8601 datetime"},
            "duration_hours": {"type": "number", "description": "Duration in hours"},
            "resource_url": {"type": "string", "description": "Learning resource URL"},
            "event_id": {"type": "string", "description": "Google event ID for delete"},
        },
        "required": ["action"],
    },
}
