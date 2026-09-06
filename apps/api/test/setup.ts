// Provide minimum env so config/env.ts validation passes during tests.
process.env.NODE_ENV ??= 'test';
process.env.MONGO_URL ??= 'mongodb://localhost:27017/arss-test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret';
process.env.USER_SECRETS_KEY ??= 'test-user-secrets-key-test-user-secrets-key';
process.env.PAYWALL_STRATEGIES ??= 'ladder,googlebot,wayback,archive_ph';
