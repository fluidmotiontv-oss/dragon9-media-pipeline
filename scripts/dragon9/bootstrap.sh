#!/bin/bash

# Dragon 9 Pipeline Bootstrap Script
# For Termux Environment (Device: 9COMB-DRAGON9-PHONE-01)

echo "--- Dragon 9 Media Pipeline Bootstrap ---"

# 1. Environment & Package Audit
echo "[1/4] Checking Termux storage..."
if [ ! -d "~/storage/shared" ]; then
    echo "(!) Storage not found. Running termux-setup-storage..."
    termux-setup-storage
else
    echo "(+) Storage verified."
fi

echo "[2/4] Verifying core packages..."
CORE_PKGS=(nodejs ffmpeg git python build-essential termux-api)
for pkg in "${CORE_PKGS[@]}"; do
    if ! command -v $pkg &> /dev/null; then
        echo "(!) Missing $pkg. Installing..."
        pkg install -y $pkg
    fi
done
echo "(+) Packages verified."

# 2. Workspace & Directory Structure
echo "[3/4] Setting up workspace..."
mkdir -p ~/dragon9
mkdir -p ~/storage/shared/FluidmotionTV/renders

# Copying scripts (assuming they are downloaded/pushed to ~/dragon9)
# If running for the first time, user should copy the generated node files here.

echo "[4/4] ADB Bridge Instructions"
echo "On your connected PC, run:"
echo "  adb reverse tcp:3000 tcp:3000"
echo ""
echo "--- Pipeline Ready ---"
echo "To start orchestrator: cd ~/dragon9 && node orchestrator.js"
echo "To verify output: ls ~/storage/shared/FluidmotionTV/renders"
echo "To play render: termux-open ~/storage/shared/FluidmotionTV/renders/<filename>.mp4"
