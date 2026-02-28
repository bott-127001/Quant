#!/usr/bin/env bash
# Exit on any logic error
set -e

echo "======================"
echo "Building Frontend..."
echo "======================"
cd frontend
npm install
npm run build
cd ..

echo "======================"
echo "Preparing Backend Static Files..."
echo "======================"
rm -rf backend/static/*
cp -r frontend/dist/* backend/static/

echo "======================"
echo "Installing Backend Requirements..."
echo "======================"
cd backend
pip install -r requirements.txt

echo "======================"
echo "Build Completed!"
echo "======================"
# Render Selenium/Chrome Dependencies Fix (if deploying natively to Render)
# Download Linux Chrome binary into cache
STORAGE_DIR=$XDG_CACHE_HOME/chrome
if [[ ! -d $STORAGE_DIR ]]; then
  mkdir -p $STORAGE_DIR
  wget -P $STORAGE_DIR https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  dpkg -x $STORAGE_DIR/google-chrome-stable_current_amd64.deb $STORAGE_DIR/chrome
fi
export PATH="$STORAGE_DIR/chrome/opt/google/chrome:$PATH"
