# SQL

Query and manage SQLite databases using the sqlite3 command-line tool.

## Schema Inspection

```bash
sqlite3 data.db ".tables"
sqlite3 data.db ".schema users"
sqlite3 data.db "PRAGMA table_info(users);"
```

## Querying Data

```bash
# Formatted output with headers
sqlite3 -header -column data.db "SELECT * FROM users LIMIT 10;"

# Filter and sort
sqlite3 -header -column data.db "
  SELECT name, email, created_at FROM users
  WHERE active = 1 ORDER BY created_at DESC LIMIT 20;
"
```

## JOINs

```bash
sqlite3 -header -column data.db "
  SELECT u.name, COUNT(o.id) AS orders, SUM(o.total) AS spent
  FROM users u LEFT JOIN orders o ON u.id = o.user_id
  GROUP BY u.id ORDER BY spent DESC LIMIT 10;
"
```

## Aggregation

```bash
sqlite3 -header -column data.db "
  SELECT category, COUNT(*) AS count,
    ROUND(AVG(price), 2) AS avg_price,
    SUM(price) AS total
  FROM products GROUP BY category
  HAVING count > 5 ORDER BY total DESC;
"

# Date-based
sqlite3 -header -column data.db "
  SELECT DATE(created_at) AS day, COUNT(*) AS signups
  FROM users GROUP BY day ORDER BY day DESC LIMIT 30;
"
```

## Modifying Data

```bash
sqlite3 data.db "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');"
sqlite3 data.db "UPDATE users SET active = 0 WHERE last_login < '2024-01-01';"
sqlite3 data.db "DELETE FROM users WHERE active = 0;"
```

## Indexes

```bash
sqlite3 data.db "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);"
sqlite3 data.db "EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'alice@example.com';"
```

## Exporting

```bash
# CSV
sqlite3 -header -csv data.db "SELECT * FROM users;" > users.csv

# JSON (SQLite 3.38+)
sqlite3 -json data.db "SELECT * FROM users LIMIT 10;"

# SQL dump
sqlite3 data.db ".dump users" > users_backup.sql
```

## Tips
- Use `-header -column` for readable output during exploration
- Use `EXPLAIN QUERY PLAN` to verify index usage
- Wrap bulk operations in transactions: `BEGIN; ...; COMMIT;`
- Back up before destructive ops: `sqlite3 data.db ".backup backup.db"`
- Use `.mode markdown` for markdown-formatted table output
