#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

DB_NAME="neural_forge.db"
MIGRATIONS_DIR="migrations"

echo "Database Setup: $DB_NAME"
echo "--------------------------------------"

# Check if sqlite3 CLI is installed
if ! command -v sqlite3 &> /dev/null; then
    echo "Error: sqlite3 is not installed. Please install it first."
    exit 1
fi

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory '$MIGRATIONS_DIR' not found."
    exit 1
fi

# Ensure the database file exists (touches it if it doesn't)
touch "$DB_NAME"

# Apply migrations in sorted order
# Find all .sql files, sort them naturally, and apply them
for file in $(ls -v "$MIGRATIONS_DIR"/*.sql 2>/dev/null); do
    echo "Applying migration: $(basename "$file")..."
    
    # Execute the SQL file against the SQLite DB
    # Using '|| exit 1' ensures we stop if a specific migration fails
    sqlite3 "$DB_NAME" < "$file" || {
        echo "Error applying $file. Aborting."
        exit 1
    }
done

echo "--------------------------------------"
echo "All migrations applied successfully! ✅"