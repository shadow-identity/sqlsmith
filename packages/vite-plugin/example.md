# Example Usage

## Project Structure
```
my-app/
├── src/
│   ├── schemas/
│   │   ├── users.sql
│   │   ├── posts.sql
│   │   └── comments.sql
│   ├── schema.sql          # Generated file
│   └── main.ts
├── vite.config.ts
└── package.json
```

## Vite Configuration
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { sqlsmith } from '@sqlsmith/vite-plugin'

export default defineConfig({
  plugins: [
    sqlsmith({
      input: './src/schemas',
      output: './src/schema.sql',
      dialect: 'postgresql'
    })
  ]
})
```

## SQL Files
```sql
-- src/schemas/users.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE
);
```

```sql
-- src/schemas/posts.sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Generated Output
The plugin will automatically generate `src/schema.sql`:

```sql
-- SQLsmith Output
-- Generated: 2025-06-10T18:00:00.000Z
-- Files processed: 2
-- Statements merged: 2
-- Order: table:users → table:posts

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Edit SQL files**: Changes to `src/schemas/*.sql` trigger automatic regeneration
3. **Use generated schema**: Import or reference `src/schema.sql` in your app
4. **Build for production**: `npm run build` validates schema during build 