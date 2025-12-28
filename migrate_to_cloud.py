#!/usr/bin/env python3
"""
XNuuP Data Warehouse Migration Script
Exports from local PostgreSQL and imports to Neon/Supabase

Usage:
  python migrate_to_cloud.py export   # Export to SQL file
  python migrate_to_cloud.py import   # Import to cloud DB
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
LOCAL_DB = os.environ.get('LOCAL_DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/xnuup_dw')
CLOUD_DB = os.environ.get('CLOUD_DATABASE_URL', '')
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
        # Check if table exists
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
    print(f"Connecting to local database...")
    conn = get_connection(LOCAL_DB)
    cursor = conn.cursor()
    
    print(f"Exporting to {OUTPUT_FILE}...")
    total_rows = 0
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        # Export schema
        print("Exporting schema...")
        export_schema(cursor, f)
        
        # Export data
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


def import_from_file():
    """Import SQL file to cloud database."""
    if not CLOUD_DB:
        print("ERROR: Set CLOUD_DATABASE_URL environment variable")
        print("Example: export CLOUD_DATABASE_URL='postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require'")
        sys.exit(1)
    
    if not os.path.exists(OUTPUT_FILE):
        print(f"ERROR: {OUTPUT_FILE} not found. Run 'export' first.")
        sys.exit(1)
    
    print(f"Connecting to cloud database...")
    conn = get_connection(CLOUD_DB)
    conn.autocommit = True  # Each statement commits immediately
    cursor = conn.cursor()
    
    # Create schema first
    print("Creating schema...")
    try:
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
        print(f"  Schema '{SCHEMA}' ready")
    except Exception as e:
        print(f"  Schema error (may already exist): {e}")
    
    print(f"Importing from {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Split into statements
    statements = sql_content.split(';\n')
    total = len([s for s in statements if s.strip() and not s.strip().startswith('--')])
    
    success = 0
    errors = 0
    
    for i, stmt in enumerate(statements):
        stmt = stmt.strip()
        if not stmt or stmt.startswith('--'):
            continue
        
        # Skip CREATE SCHEMA (already done)
        if 'CREATE SCHEMA' in stmt.upper():
            continue
        
        try:
            cursor.execute(stmt)
            success += 1
            if success % 1000 == 0:
                print(f"  Progress: {success}/{total} statements...")
        except Exception as e:
            errors += 1
            error_msg = str(e)
            # Only show unique/important errors
            if errors <= 10 and 'already exists' not in error_msg:
                print(f"  Error ({errors}): {error_msg[:80]}")
    
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
        print("\n" + "="*50 + "\n")
        import_from_file()
    else:
        print(f"Unknown command: {command}")
        print("Use: export, import, or both")
        sys.exit(1)


if __name__ == '__main__':
    main()
