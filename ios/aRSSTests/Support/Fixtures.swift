import Foundation

/// JSON fixtures shaped exactly like the API's serializers (apps/api/src/services/serializers.ts).
nonisolated enum Fixtures {
    static let fullEntry = """
    {
      "id": "65f000000000000000000001",
      "sourceId": "65f000000000000000000010",
      "sourceTitle": "The Verge",
      "categoryId": "65f000000000000000000020",
      "url": "https://example.com/a",
      "title": "Apple posts record quarter",
      "publishedAt": "2026-09-06T13:45:12.345Z",
      "description": "Teaser text",
      "summary": {
        "intro": "Apple had a big quarter.",
        "bullets": ["Revenue up", "Services grew", "Guidance raised"],
        "model": "claude-haiku-4-5-20251001",
        "generatedAt": "2026-09-06T14:00:00.000Z"
      },
      "image": { "url": "https://cdn.example.com/a.jpg", "source": "og" },
      "processingState": "summarized",
      "isRead": false,
      "error": null
    }
    """

    static let minimalEntry = """
    {
      "id": "65f000000000000000000002",
      "sourceId": "65f000000000000000000010",
      "sourceTitle": "Unknown",
      "categoryId": null,
      "url": "https://example.com/b",
      "title": "Pending story",
      "publishedAt": "2026-09-06T13:45:12Z",
      "description": null,
      "summary": null,
      "image": null,
      "processingState": "pending",
      "isRead": true,
      "error": "fetch_failed: ladder:timeout"
    }
    """

    static let unknownStateEntry = minimalEntry.replacingOccurrences(of: "\"pending\"", with: "\"archived\"")

    static let feedResponse = """
    { "entries": [\(fullEntry), \(minimalEntry)], "nextCursor": "MjAyNi0wOS0wNlQxMzo0NToxMi4wMDBafDY1ZjAwMA", "unreadCount": 42 }
    """

    static let lastPage = """
    { "entries": [\(fullEntry)], "nextCursor": null, "unreadCount": 1 }
    """

    static let llm = """
    { "provider": "openai", "providers": [
      { "id": "anthropic", "label": "Anthropic (Claude)", "shortLabel": "Claude", "protocol": "anthropic", "configured": false,
        "model": null, "defaultModel": "claude-haiku-4-5", "baseUrl": null, "defaultBaseUrl": null,
        "keyPlaceholder": "sk-ant-…", "consoleUrl": "https://console.anthropic.com/settings/keys", "requiresKey": true },
      { "id": "openai", "label": "OpenAI (ChatGPT)", "shortLabel": "OpenAI", "protocol": "openai-compatible", "configured": true,
        "model": "gpt-4.1", "defaultModel": "gpt-4.1-mini", "baseUrl": null, "defaultBaseUrl": "https://api.openai.com/v1",
        "keyPlaceholder": "sk-…", "consoleUrl": "https://platform.openai.com/api-keys", "requiresKey": true },
      { "id": "mystery", "label": "Mystery", "shortLabel": "Mystery", "protocol": "quantum", "configured": false,
        "model": null, "defaultModel": null, "baseUrl": null, "defaultBaseUrl": null,
        "keyPlaceholder": null, "consoleUrl": null, "requiresKey": true }
    ] }
    """

    static let me = """
    { "id": "65f0000000000000000000aa", "email": "a@b.com", "displayName": null,
      "authMethods": ["password", "apple", "passkey", "magic"], "llm": \(llm) }
    """

    static let tokens = """
    { "accessToken": "new-token", "expiresIn": 900 }
    """

    static let categoryWithoutColor = """
    { "id": "65f000000000000000000020", "name": "Tech" }
    """

    static let source = """
    { "id": "65f000000000000000000010", "feedUrl": "https://example.com/feed.xml", "siteUrl": null,
      "title": "The Verge", "categoryId": null, "pollIntervalMs": 1800000, "bypassStrategy": "archive_ph",
      "lastPolledAt": "2026-09-06T12:00:00.000Z" }
    """

    static let entryDetail = fullEntry.replacingOccurrences(
        of: "\"error\": null",
        with: "\"error\": null, \"articleText\": \"Body text.\\n\\nSecond paragraph.\", \"byline\": \"By Someone\""
    )

    static let validationError = """
    { "error": "validation_error", "details": { "formErrors": [], "fieldErrors": { "email": ["Invalid email"] } }, "retryable": false }
    """

    static let invalidCredentials = """
    { "error": "invalid_credentials", "message": "Email or password is incorrect", "retryable": false }
    """

    static let invalidToken = """
    { "error": "invalid_token", "message": "Access token is invalid or expired", "retryable": false }
    """

    static let failures = """
    { "items": [ { "id": "65f000000000000000000003", "sourceId": "65f000000000000000000010", "sourceTitle": "Unknown",
      "url": "https://example.com/c", "title": "Broken", "publishedAt": "2026-09-05T10:00:00.000Z",
      "updatedAt": "2026-09-06T10:00:00.000Z", "error": "fetch_failed: googlebot:403" } ] }
    """
}
