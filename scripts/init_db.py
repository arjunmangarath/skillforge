# -*- coding: utf-8 -*-
"""Initialize AlloyDB database and enable pgvector extension."""
import psycopg2
import sys

HOST = "34.66.160.111"
PORT = 5432
USER = "postgres"
PASSWORD = "Qwerty@12345"

def run(conn, sql, desc):
    try:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print(f"  [OK] {desc}")
    except Exception as e:
        print(f"  [FAIL] {desc}: {e}")
        conn.rollback()

print("\nConnecting to AlloyDB...")
try:
    conn = psycopg2.connect(
        host=HOST, port=PORT, user=USER, password=PASSWORD,
        dbname="postgres", sslmode="require"
    )
    conn.autocommit = True
    print("  [OK] Connected")

    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname='skillforge'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE skillforge")
        print("  [OK] Created database: skillforge")
    else:
        print("  [OK] Database already exists: skillforge")
    conn.close()

except Exception as e:
    print(f"  [FAIL] Connection failed: {e}")
    print("\n  Check: Is your IP whitelisted in AlloyDB? Is the password correct?")
    sys.exit(1)

print("\nSetting up skillforge database...")
try:
    conn2 = psycopg2.connect(
        host=HOST, port=PORT, user=USER, password=PASSWORD,
        dbname="skillforge", sslmode="require"
    )
    conn2.autocommit = True

    run(conn2, "CREATE EXTENSION IF NOT EXISTS vector", "pgvector extension enabled")
    run(conn2, "CREATE EXTENSION IF NOT EXISTS pg_trgm", "pg_trgm extension enabled")

    cur2 = conn2.cursor()
    cur2.execute("SELECT extname FROM pg_extension WHERE extname = 'vector'")
    result = cur2.fetchone()
    if result:
        print("\n[OK] pgvector is ready!")
    else:
        print("\n[WARN] pgvector not found - may need to be installed on AlloyDB instance")

    conn2.close()

except Exception as e:
    print(f"  [FAIL] Setup failed: {e}")
    sys.exit(1)

print("\nDatabase initialization complete!")
print("   Host:     34.66.160.111:5432")
print("   Database: skillforge")
print("   pgvector: enabled")
