import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || '';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

export const turso = (url)
  ? createClient({
      url,
      authToken,
    })
  : null;

export const isTursoConfigured = (): boolean => {
  return !!turso;
};
