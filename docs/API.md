# aRSS API Documentation

Complete API reference for the aRSS backend. The API follows RESTful conventions and uses JSON for request/response bodies.

## Base URL

```
http://localhost:3000/api/v1
```

## Interactive Documentation

When the API server is running, interactive Swagger UI documentation is available at:
- **Swagger UI:** http://localhost:3000/api/docs
- **OpenAPI JSON:** http://localhost:3000/api/openapi.json

## Authentication

The API uses JWT (JSON Web Tokens) for authentication.

### Token Types

| Token | Expiry | Usage |
|-------|--------|-------|
| Access Token | 15 minutes | Include in `Authorization` header |
| Refresh Token | 7 days | Use to obtain new access token |

### Authentication Header

```
Authorization: Bearer <access_token>
```

### Token Refresh Flow

1. Access token expires
2. Client sends refresh token to `POST /auth/refresh`
3. Server returns new access and refresh tokens
4. Client updates stored tokens

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request / Validation Error |
| `401` | Unauthorized |
| `404` | Not Found |
| `409` | Conflict (e.g., duplicate resource) |
| `429` | Too Many Requests |
| `500` | Internal Server Error |

---

## Endpoints

### Authentication

#### Register

```http
POST /auth/register
```

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "minimum8chars",
  "name": "John Doe"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJI...",
      "refreshToken": "eyJhbGciOiJI..."
    }
  }
}
```

---

#### Login

```http
POST /auth/login
```

Authenticate with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response (200):** Same as register response.

---

#### Refresh Token

```http
POST /auth/refresh
```

Get new tokens using a refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJI..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGciOiJI...",
      "refreshToken": "eyJhbGciOiJI..."
    }
  }
}
```

---

#### Logout

```http
POST /auth/logout
```

Invalidate the refresh token.

**Auth Required:** Yes

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJI..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### Get Current User

```http
GET /auth/me
```

Get the authenticated user's profile.

**Auth Required:** Yes

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### Change Password

```http
POST /auth/change-password
```

Change the user's password.

**Auth Required:** Yes

**Request Body:**

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### Feeds

#### List Subscribed Feeds

```http
GET /feeds
```

Get all feeds the user is subscribed to.

**Auth Required:** Yes

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "subscription-uuid",
      "feedId": "feed-uuid",
      "categoryId": "category-uuid",
      "customTitle": "My Custom Title",
      "feed": {
        "id": "feed-uuid",
        "url": "https://example.com/feed.xml",
        "title": "Example Blog",
        "description": "A blog about examples",
        "siteUrl": "https://example.com",
        "iconUrl": "https://example.com/favicon.ico",
        "lastFetchedAt": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

---

#### Subscribe to Feed

```http
POST /feeds
```

Subscribe to a new RSS/Atom feed.

**Auth Required:** Yes

**Request Body:**

```json
{
  "url": "https://example.com/feed.xml",
  "categoryId": "category-uuid"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "subscription-uuid",
    "feedId": "feed-uuid",
    "categoryId": "category-uuid",
    "customTitle": null,
    "feed": { ... }
  }
}
```

---

#### Discover Feed

```http
POST /feeds/discover
```

Fetch feed information without subscribing.

**Auth Required:** Yes

**Request Body:**

```json
{
  "url": "https://example.com/feed.xml"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/feed.xml",
    "title": "Example Blog",
    "description": "A blog about examples",
    "siteUrl": "https://example.com",
    "iconUrl": "https://example.com/favicon.ico"
  }
}
```

---

#### Get Feed Details

```http
GET /feeds/{id}
```

Get details of a specific feed.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Feed ID |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "feed-uuid",
    "url": "https://example.com/feed.xml",
    "title": "Example Blog",
    "description": "A blog about examples",
    "siteUrl": "https://example.com",
    "iconUrl": "https://example.com/favicon.ico",
    "lastFetchedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

#### Update Subscription

```http
PATCH /feeds/{id}
```

Update feed subscription settings.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription ID |

**Request Body:**

```json
{
  "categoryId": "new-category-uuid",
  "customTitle": "My Custom Title",
  "order": 5
}
```

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Unsubscribe from Feed

```http
DELETE /feeds/{id}
```

Unsubscribe from a feed.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription ID |

**Response (200):**

```json
{
  "success": true,
  "message": "Unsubscribed from feed"
}
```

---

#### Refresh Feed

```http
POST /feeds/{id}/refresh
```

Manually trigger a feed refresh.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Feed ID |

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

### Articles

#### List Articles

```http
GET /articles
```

Get articles with filtering and pagination.

**Auth Required:** Yes

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max: 100) |
| `feedId` | UUID | - | Filter by feed |
| `categoryId` | UUID | - | Filter by category |
| `isRead` | boolean | - | Filter by read status |
| `isSaved` | boolean | - | Filter by saved status |
| `search` | string | - | Search query |
| `sortBy` | string | publishedAt | Sort field: `publishedAt`, `createdAt` |
| `sortOrder` | string | desc | Sort order: `asc`, `desc` |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "article-uuid",
      "feedId": "feed-uuid",
      "title": "Article Title",
      "url": "https://example.com/article",
      "summary": "Article summary...",
      "content": "Full article content...",
      "author": "John Doe",
      "imageUrl": "https://example.com/image.jpg",
      "publishedAt": "2024-01-15T10:30:00Z",
      "isRead": false,
      "isSaved": false,
      "feed": {
        "id": "feed-uuid",
        "title": "Example Blog",
        "iconUrl": "https://example.com/favicon.ico"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### Get Article

```http
GET /articles/{id}
```

Get a single article's details.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article ID |

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Update Article State

```http
PATCH /articles/{id}
```

Mark article as read/unread or save/unsave.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article ID |

**Request Body:**

```json
{
  "isRead": true,
  "isSaved": true
}
```

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Bulk Mark as Read

```http
POST /articles/mark-read
```

Mark multiple articles as read.

**Auth Required:** Yes

**Request Body:**

```json
{
  "articleIds": ["uuid1", "uuid2"],
  "feedId": "feed-uuid",
  "categoryId": "category-uuid"
}
```

At least one of `articleIds`, `feedId`, or `categoryId` must be provided.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "count": 25
  }
}
```

---

### Categories

#### List Categories

```http
GET /categories
```

Get all user categories.

**Auth Required:** Yes

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "category-uuid",
      "name": "Technology",
      "color": "#3b82f6",
      "parentId": null,
      "order": 0
    }
  ]
}
```

---

#### Create Category

```http
POST /categories
```

Create a new category.

**Auth Required:** Yes

**Request Body:**

```json
{
  "name": "Technology",
  "color": "#3b82f6",
  "parentId": "parent-category-uuid"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Get Category

```http
GET /categories/{id}
```

Get category details.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Category ID |

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Update Category

```http
PATCH /categories/{id}
```

Update a category.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Category ID |

**Request Body:**

```json
{
  "name": "New Name",
  "color": "#ef4444",
  "parentId": null,
  "order": 2
}
```

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Delete Category

```http
DELETE /categories/{id}
```

Delete a category.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Category ID |

**Response (200):**

```json
{
  "success": true,
  "message": "Category deleted"
}
```

---

### Search

#### Search Articles

```http
GET /search
```

Full-text search across articles.

**Auth Required:** Yes

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `feedId` | UUID | No | Filter by feed |
| `categoryId` | UUID | No | Filter by category |
| `startDate` | ISO 8601 | No | Filter by start date |
| `endDate` | ISO 8601 | No | Filter by end date |

**Response (200):**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { ... }
}
```

---

#### Search Suggestions

```http
GET /search/suggestions
```

Get search suggestions.

**Auth Required:** Yes

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "title": "Suggested Article Title",
      "type": "article"
    }
  ]
}
```

---

### Preferences

#### Get Preferences

```http
GET /preferences
```

Get user preferences.

**Auth Required:** Yes

**Response (200):**

```json
{
  "success": true,
  "data": {
    "theme": "system",
    "accentColor": "#3b82f6",
    "layout": "list",
    "articleView": "split-vertical",
    "fontSize": "medium"
  }
}
```

---

#### Update Preferences

```http
PATCH /preferences
```

Update user preferences.

**Auth Required:** Yes

**Request Body:**

```json
{
  "theme": "dark",
  "accentColor": "#8b5cf6",
  "layout": "cards",
  "articleView": "overlay",
  "fontSize": "large"
}
```

**Allowed Values:**

| Field | Values |
|-------|--------|
| `theme` | `light`, `dark`, `system` |
| `layout` | `compact`, `list`, `cards`, `magazine` |
| `articleView` | `split-horizontal`, `split-vertical`, `overlay`, `full` |
| `fontSize` | `small`, `medium`, `large` |

**Response (200):**

```json
{
  "success": true,
  "data": { ... }
}
```

---

#### Import OPML

```http
POST /preferences/import
```

Import feeds from OPML file.

**Auth Required:** Yes

**Request Body:**

```json
{
  "opml": "<?xml version=\"1.0\"?>..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "imported": 15,
    "failed": 2,
    "errors": [...]
  }
}
```

---

#### Export OPML

```http
GET /preferences/export
```

Export feeds as OPML file.

**Auth Required:** Yes

**Response:** XML file

**Headers:**

```
Content-Type: application/xml
Content-Disposition: attachment; filename="arss-subscriptions.opml"
```

---

### Health Check

#### Health

```http
GET /health
```

Check API health status.

**Auth Required:** No

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Rate Limiting

| Endpoint Type | Limit (Production) | Limit (Development) |
|---------------|-------------------|---------------------|
| General API | 500 req/15 min | 10,000 req/15 min |
| Authentication | 20 req/15 min | 1,000 req/15 min |
| Feed Operations | 60 req/min | 1,000 req/min |
| Password Reset | 5 req/hour | 100 req/hour |

When rate limited, the API returns `429 Too Many Requests`.

---

## Error Handling

### Validation Errors

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Authentication Errors

```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

### Not Found Errors

```json
{
  "success": false,
  "error": "Article not found"
}
```
