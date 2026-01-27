import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'aRSS API',
    description: 'API for aRSS - Another RSS Software Solution. A modern RSS reader focused on UI/UX excellence.',
    version: '1.0.0',
    contact: {
      name: 'aRSS Support',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Feeds', description: 'Feed subscription management' },
    { name: 'Categories', description: 'Category management' },
    { name: 'Articles', description: 'Article management' },
    { name: 'Search', description: 'Search functionality' },
    { name: 'Preferences', description: 'User preferences' },
  ],
  paths: {
    // Auth endpoints
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse',
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse',
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AuthResponse',
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessResponse',
                },
              },
            },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user data',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/User' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    // Feeds endpoints
    '/feeds': {
      get: {
        tags: ['Feeds'],
        summary: 'Get all subscribed feeds',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of subscribed feeds',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Subscription' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Feeds'],
        summary: 'Subscribe to a new feed',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url'],
                properties: {
                  url: { type: 'string', format: 'uri' },
                  categoryId: { type: 'string', format: 'uuid' },
                  customTitle: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Feed subscribed successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Subscription' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/feeds/{id}': {
      patch: {
        tags: ['Feeds'],
        summary: 'Update feed subscription',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  categoryId: { type: 'string', format: 'uuid', nullable: true },
                  customTitle: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Feed updated successfully',
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Feeds'],
        summary: 'Unsubscribe from feed',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Unsubscribed successfully',
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // Articles endpoints
    '/articles': {
      get: {
        tags: ['Articles'],
        summary: 'Get articles',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'feedId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'isRead', in: 'query', schema: { type: 'boolean' } },
          { name: 'isSaved', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['publishedAt', 'createdAt', 'relevance'] } },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          '200': {
            description: 'Paginated list of articles',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaginatedArticles',
                },
              },
            },
          },
        },
      },
    },
    '/articles/{id}': {
      get: {
        tags: ['Articles'],
        summary: 'Get article by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Article details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Article' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Articles'],
        summary: 'Update article state (read/saved)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  isRead: { type: 'boolean' },
                  isSaved: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Article updated successfully',
          },
        },
      },
    },
    '/articles/mark-read': {
      post: {
        tags: ['Articles'],
        summary: 'Mark multiple articles as read',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  articleIds: {
                    type: 'array',
                    items: { type: 'string', format: 'uuid' },
                  },
                  feedId: { type: 'string', format: 'uuid' },
                  categoryId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Articles marked as read',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            count: { type: 'integer' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // Search endpoints
    '/search': {
      get: {
        tags: ['Search'],
        summary: 'Search articles',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaginatedArticles',
                },
              },
            },
          },
        },
      },
    },
    '/search/suggestions': {
      get: {
        tags: ['Search'],
        summary: 'Get search suggestions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
        ],
        responses: {
          '200': {
            description: 'Search suggestions',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              title: { type: 'string' },
                              type: { type: 'string', enum: ['article'] },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // Categories endpoints
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Get all categories',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of categories',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Category' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Create a category',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  color: { type: 'string' },
                  parentId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Category created successfully',
          },
        },
      },
    },

    // Preferences endpoints
    '/preferences': {
      get: {
        tags: ['Preferences'],
        summary: 'Get user preferences',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'User preferences',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/SuccessResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/Preferences' },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Preferences'],
        summary: 'Update user preferences',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Preferences',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Preferences updated successfully',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          name: { type: 'string', minLength: 1 },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Feed: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          title: { type: 'string' },
          description: { type: 'string' },
          siteUrl: { type: 'string', format: 'uri' },
          iconUrl: { type: 'string', format: 'uri' },
          lastFetchedAt: { type: 'string', format: 'date-time' },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          feedId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          customTitle: { type: 'string', nullable: true },
          feed: { $ref: '#/components/schemas/Feed' },
        },
      },
      Article: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          feedId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          content: { type: 'string' },
          author: { type: 'string' },
          imageUrl: { type: 'string', format: 'uri' },
          publishedAt: { type: 'string', format: 'date-time' },
          isRead: { type: 'boolean' },
          isSaved: { type: 'boolean' },
          feed: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              iconUrl: { type: 'string' },
            },
          },
        },
      },
      PaginatedArticles: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Article' },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          color: { type: 'string' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
          order: { type: 'integer' },
        },
      },
      Preferences: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'system'] },
          accentColor: { type: 'string' },
          layout: { type: 'string', enum: ['compact', 'list', 'cards', 'magazine'] },
          articleView: { type: 'string', enum: ['split-horizontal', 'split-vertical', 'overlay', 'full'] },
          fontSize: { type: 'string', enum: ['small', 'medium', 'large'] },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Conflict: {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
};
