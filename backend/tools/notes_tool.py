"""Google Docs / Keep notes MCP tool."""
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


def get_docs_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("docs", "v1", credentials=creds)


def get_drive_service(access_token: str):
    creds = Credentials(token=access_token)
    return build("drive", "v3", credentials=creds)


async def create_note_doc(
    access_token: str,
    title: str,
    content: str,
    folder_id: str | None = None,
) -> dict:
    """Create a Google Doc as a learning note."""
    drive = get_drive_service(access_token)
    docs = get_docs_service(access_token)

    # Create the doc
    file_meta = {
        "name": f"📝 {title}",
        "mimeType": "application/vnd.google-apps.document",
    }
    if folder_id:
        file_meta["parents"] = [folder_id]

    doc_file = drive.files().create(body=file_meta).execute()
    doc_id = doc_file["id"]

    # Insert content
    docs.documents().batchUpdate(
        documentId=doc_id,
        body={
            "requests": [
                {
                    "insertText": {
                        "location": {"index": 1},
                        "text": content,
                    }
                }
            ]
        },
    ).execute()

    return {
        "doc_id": doc_id,
        "url": f"https://docs.google.com/document/d/{doc_id}",
        "title": title,
    }


async def get_note_content(access_token: str, doc_id: str) -> str:
    """Retrieve text content from a Google Doc."""
    docs = get_docs_service(access_token)
    doc = docs.documents().get(documentId=doc_id).execute()

    text_parts = []
    for element in doc.get("body", {}).get("content", []):
        if "paragraph" in element:
            for pe in element["paragraph"].get("elements", []):
                if "textRun" in pe:
                    text_parts.append(pe["textRun"]["content"])
    return "".join(text_parts)


NOTES_TOOL_SPEC = {
    "name": "notes_tool",
    "description": "Create and retrieve learning notes via Google Docs",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["create", "get"],
            },
            "title": {"type": "string"},
            "content": {"type": "string"},
            "doc_id": {"type": "string"},
        },
        "required": ["action"],
    },
}
