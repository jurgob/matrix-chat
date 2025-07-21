import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.string(),
  MATRIX_HOMESERVER: z.string(),
  MATRIX_BASE_URL: z.url(),
  APP_BASE_URL: z.url(),
});

export type Config = z.infer<typeof configSchema>;

function getConfig(): Config {
  return configSchema.parse(process.env);
}

export const config = getConfig();