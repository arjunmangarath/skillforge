"""Google Tasks MCP tool for learning task management."""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


def get_tasks_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("tasks", "v1", credentials=creds)


async def create_learning_task(
    access_token: str,
    title: str,
    notes: str,
    due: str,  # RFC 3339 timestamp
    tasklist_id: str = "@default",
) -> dict:
    """Create a learning task in Google Tasks."""
    service = get_tasks_service(access_token)
    body = {"title": title, "notes": notes, "due": due, "status": "needsAction"}
    task = service.tasks().insert(tasklist=tasklist_id, body=body).execute()
    return {"google_task_id": task["id"], "title": task["title"]}


async def complete_task(
    access_token: str,
    task_id: str,
    tasklist_id: str = "@default",
) -> bool:
    """Mark a learning task as completed."""
    try:
        service = get_tasks_service(access_token)
        service.tasks().patch(
            tasklist=tasklist_id,
            task=task_id,
            body={"status": "completed"},
        ).execute()
        return True
    except Exception:
        return False


async def get_pending_tasks(
    access_token: str,
    tasklist_id: str = "@default",
) -> list[dict]:
    """Retrieve all pending learning tasks."""
    service = get_tasks_service(access_token)
    result = (
        service.tasks()
        .list(tasklist=tasklist_id, showCompleted=False, maxResults=50)
        .execute()
    )
    return result.get("items", [])


TASKS_TOOL_SPEC = {
    "name": "tasks_tool",
    "description": "Create and manage learning tasks in Google Tasks",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "complete", "get_pending"],
            },
            "title": {"type": "string"},
            "notes": {"type": "string"},
            "due": {"type": "string", "description": "RFC 3339 timestamp"},
            "task_id": {"type": "string"},
        },
        "required": ["action"],
    },
}
