#!/bin/sh

echo "🔄 Starting application with migration..."

# Run migrations first
echo "🔄 Running database migrations..."
node run-migrations.js

# Check if migrations succeeded
if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
    echo "🚀 Starting the application..."
    exec node dist/src/main.js
else
    echo "❌ Migrations failed, exiting..."
    exit 1
fi