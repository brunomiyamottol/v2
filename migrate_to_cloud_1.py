#!/usr/bin/env python3
"""
XNuuP Data Warehouse Migration Script
Exports from local PostgreSQL and imports to Neon/Supabase

Usage:
  python migrate_to_cloud.py export   # Export to SQL file
  python migrate_to_cloud.py import   # Import to cloud DB (truncates first)
  python migrate_to_cloud.py both     # Export then import

Requirements:
  pip install psycopg2-binary

Environment Variables:
  LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/xnuup_dw
  CLOUD_DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
"""

import os
import sys
from datetime import datetime

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("Installing psycopg2-binary...")
    os.system("pip install psycopg2-binary")
    import psycopg2
    from psycopg2 import sql

# Configuration
LOCAL_DB = os.environ.get('LOCAL_DATABASE_URL', 'postgresql://admin:password@localhost:5432/xnuup_dw')
CLOUD_DB = os.environ.get('CLOUD_DATABASE_URL', 'postgresql://neondb_owner:npg_4kegYn2UMPGz@ep-weathered-dew-ae6vfab9-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
SCHEMA = 'dw'
OUTPUT_FILE = 'xnuup_dw_export.sql'

# Tables in dependency order (dimensions first, then facts)
TABLES = [
    'dim_date',
    'dim_insurer',
    'dim_claim_type',
    'dim_assessment_type',
    'dim_status',
    'dim_part_type',
    'dim_part_brand',
    'dim_part',
    'dim_vehicle',
    'dim_workshop',
    'dim_supplier',
    'dim_shipping_company',
    'dim_warehouse',
    'dim_user',
    'dim_claim',
    'fact_part_order',
]


def get_connection(conn_string):
    """Create database connection."""
    return psycopg2.connect(conn_string)


def get_table_columns(cursor, table_name):
    """Get column names for a table."""
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
    """, (SCHEMA, table_name))
    return [row[0] for row in cursor.fetchall()]


def export_table(cursor, table_name, file):
    """Export a single table to SQL INSERT statements."""
    columns = get_table_columns(cursor, table_name)
    if not columns:
        print(f"  Skipping {table_name} (no columns or doesn't exist)")
        return 0

    col_list = ', '.join(columns)
    cursor.execute(f"SELECT {col_list} FROM {SCHEMA}.{table_name}")
    rows = cursor.fetchall()

    if not rows:
        print(f"  {table_name}: 0 rows")
        return 0

    # Write INSERT statements
    for row in rows:
        values = []
        for val in row:
            if val is None:
                values.append('NULL')
            elif isinstance(val, bool):
                values.append('TRUE' if val else 'FALSE')
            elif isinstance(val, (int, float)):
                values.append(str(val))
            elif isinstance(val, datetime):
                values.append(f"'{val.isoformat()}'")
            else:
                # Escape single quotes
                escaped = str(val).replace("'", "''")
                values.append(f"'{escaped}'")

        file.write(f"INSERT INTO {SCHEMA}.{table_name} ({col_list}) VALUES ({', '.join(values)});\n")

    print(f"  {table_name}: {len(rows)} rows")
    return len(rows)


def export_schema(cursor, file):
    """Export schema DDL for required tables only."""
    file.write(f"-- XNuuP Data Warehouse Export\n")
    file.write(f"-- Generated: {datetime.now().isoformat()}\n\n")
    file.write(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA};\n\n")

    for table in TABLES:
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length,
                   numeric_precision, numeric_scale, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (SCHEMA, table))

        columns = cursor.fetchall()
        if not columns:
            continue

        col_defs = []
        for col in columns:
            col_name, data_type, char_len, num_prec, num_scale, nullable = col

            type_str = data_type
            if char_len:
                type_str = f"{data_type}({char_len})"
            elif num_prec and data_type == 'numeric':
                type_str = f"numeric({num_prec},{num_scale or 0})"

            null_str = "" if nullable == 'YES' else " NOT NULL"
            col_defs.append(f"  {col_name} {type_str}{null_str}")

        file.write(f"CREATE TABLE IF NOT EXISTS {SCHEMA}.{table} (\n")
        file.write(",\n".join(col_defs))
        file.write("\n);\n\n")


def export_to_file():
    """Export entire schema and data to SQL file."""
    print("Connecting to local database...")
    conn = get_connection(LOCAL_DB)
    cursor = conn.cursor()

    print(f"Exporting to {OUTPUT_FILE}...")
    total_rows = 0

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        print("Exporting schema...")
        export_schema(cursor, f)

        print("Exporting data...")
        f.write("\n-- DATA\n\n")

        for table in TABLES:
            rows = export_table(cursor, table, f)
            total_rows += rows

    cursor.close()
    conn.close()

    print(f"\nExport complete: {total_rows} total rows")
    print(f"File: {OUTPUT_FILE}")
    return OUTPUT_FILE


def truncate_tables(cursor):
    """Truncate all tables in reverse dependency order."""
    print("Truncating existing data...")
    
    # Truncate in reverse order (facts first, then dimensions)
    reversed_tables = list(reversed(TABLES))
    
    for table in reversed_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE {SCHEMA}.{table} CASCADE")
            print(f"  Truncated {table}")
        except psycopg2.Error as e:
            error_msg = str(e)
            if 'does not exist' in error_msg:
                print(f"  Skip {table} (not exists)")
            else:
                print(f"  Skip {table}: {error_msg[:60]}")


def import_from_file():
    """Import SQL file to cloud database."""
    if not CLOUD_DB:
        print("ERROR: Set CLOUD_DATABASE_URL environment variable")
        print("Example: export CLOUD_DATABASE_URL='postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'")
        sys.exit(1)

    if not os.path.exists(OUTPUT_FILE):
        print(f"ERROR: {OUTPUT_FILE} not found. Run 'export' first.")
        sys.exit(1)

    print("Connecting to cloud database...")
    conn = get_connection(CLOUD_DB)
    conn.autocommit = True
    cursor = conn.cursor()

    # Create schema
    print("Creating schema...")
    try:
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
        print(f"  Schema '{SCHEMA}' ready")
    except psycopg2.Error as e:
        print(f"  Schema note: {e}")

    # Read SQL file
    print(f"Reading {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # Execute CREATE TABLE statements first
    print("Creating tables...")
    statements = sql_content.split(';\n')
    
    for stmt in statements:
        stmt = stmt.strip()
        if not stmt or stmt.startswith('--'):
            continue
        if 'CREATE TABLE' in stmt.upper():
            try:
                cursor.execute(stmt)
            except psycopg2.Error as e:
                if 'already exists' not in str(e):
                    print(f"  Table error: {str(e)[:60]}")

    # Truncate existing data
    truncate_tables(cursor)

    # Import data
    print(f"Importing data from {OUTPUT_FILE}...")
    
    insert_statements = [s.strip() for s in statements 
                         if s.strip() and s.strip().upper().startswith('INSERT')]
    
    total = len(insert_statements)
    success = 0
    errors = 0

    for stmt in insert_statements:
        try:
            cursor.execute(stmt)
            success += 1
            if success % 1000 == 0:
                print(f"  Progress: {success}/{total} rows...")
        except psycopg2.Error as e:
            errors += 1
            if errors <= 5:
                print(f"  Insert error: {str(e)[:80]}")

    cursor.close()
    conn.close()

    print(f"\nImport complete: {success} successful, {errors} errors")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == 'export':
        export_to_file()
    elif command == 'import':
        import_from_file()
    elif command == 'both':
        export_to_file()
        print("\n" + "=" * 50 + "\n")
        import_from_file()
    else:
        print(f"Unknown command: {command}")
        print("Use: export, import, or both")
        sys.exit(1)


if __name__ == '__main__':
    main()