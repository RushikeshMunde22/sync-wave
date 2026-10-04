import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  DATA_DIR: z.string().default('./data'),
  
  ADMIN_EMAIL: z.string().email(),
  ADMIN_INITIAL_PASSWORD: z.string().min(10, 'ADMIN_INITIAL_PASSWORD must be at least 10 characters'),
  
  JAMENDO_CLIENT_ID: z.string().optional(),
  
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  SIGNUPS_DISABLED: z.string().transform(v => v === 'true').default('false'),
  MAX_GROUP_MEMBERS: z.coerce.number().min(2).max(200).default(50),
  
  DMCA_CONTACT: z.string().optional(),
  ANNOUNCEMENT_BANNER: z.string().optional(),
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
