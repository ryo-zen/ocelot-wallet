#!/bin/bash
# SPDX-FileCopyrightText: 2025-2026 Ryo Zen (https://github.com/ryo-zen)
# SPDX-License-Identifier: GPL-3.0-only

# Install Ocelot Wallet locally on Arch Linux
set -e

APPIMAGE=$(ls src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -1)

if [ -z "$APPIMAGE" ]; then
  echo "No AppImage found. Run: NO_STRIP=1 bun tauri build --bundles appimage"
  exit 1
fi

echo "Installing from: $APPIMAGE"

# Copy AppImage
cp "$APPIMAGE" ~/.local/bin/
chmod +x ~/.local/bin/"$(basename "$APPIMAGE")"

# Symlink without spaces
ln -sf ~/.local/bin/"$(basename "$APPIMAGE")" ~/.local/bin/ocelot-wallet

# Icon
mkdir -p ~/.local/share/icons/hicolor/128x128/apps
cp src-tauri/icons/128x128.png ~/.local/share/icons/hicolor/128x128/apps/ocelot-wallet.png
gtk-update-icon-cache ~/.local/share/icons/hicolor/ -f -t

# Desktop entry
cat > ~/.local/share/applications/ocelot-wallet.desktop << 'EOF'
[Desktop Entry]
Name=Ocelot Wallet
Exec=/home/max/.local/bin/ocelot-wallet
Icon=ocelot-wallet
Type=Application
Categories=Finance;
StartupNotify=true
StartupWMClass=ocelot-wallet
EOF

echo "Done. Restarting quickshell..."
systemctl --user restart quickshell
echo "Installed successfully."
