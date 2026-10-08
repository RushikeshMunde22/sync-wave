import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading .env from cwd or parent directories (monorepo root)
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

// Fallbacks for testing environment
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'b5bc31f6d180ce398f508d6a01ca08e26eadabb7c9b8b69b3f70d1218dc67debf638f839c3e2171f4d60b911aafded54';
  }
  if (!process.env.ADMIN_EMAIL) {
    process.env.ADMIN_EMAIL = 'admin@syncwave.local';
  }
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    process.env.ADMIN_INITIAL_PASSWORD = 'supersecurepassword123';
  }
  if (!process.env.BASE_URL) {
    process.env.BASE_URL = 'http://localhost:3000';
  }
}

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BASE_URL: z.string().optional().transform(v => (!v || !v.startsWith('http')) ? 'http://localhost:3000' : v),
  DATA_DIR: z.string().default('./data'),
  
  ADMIN_EMAIL: z.string().email().default('admin@syncwave.local'),
  ADMIN_INITIAL_PASSWORD: z.string().min(10, 'ADMIN_INITIAL_PASSWORD must be at least 10 characters').default('supersecurepassword123'),
  
  JAMENDO_CLIENT_ID: z.string().optional(),
  
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  SIGNUPS_DISABLED: z.string().transform(v => v === 'true').default('false'),
  MAX_GROUP_MEMBERS: z.coerce.number().min(2).max(200).default(50),
  
  DMCA_CONTACT: z.string().optional(),
  ANNOUNCEMENT_BANNER: z.string().optional(),
  
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional().transform(v => v === 'true' || v === '1'),
  EMAIL_FROM: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('\n❌ Configuration error:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nPlease check your .env file. See .env.example for reference.\n');
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
