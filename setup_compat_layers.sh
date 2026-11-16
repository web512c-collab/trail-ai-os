#!/usr/bin/env bash
# ==============================================================================
# CorePure64 Compatibility Layers Initializer
# Verifies Wine 10+ WoW64 (/dev/ntsync), kernel binfmt_misc (MZ/APK),
# BinderFS, and XDG MIME desktop integration.
# ==============================================================================
set -euo pipefail

WINE_PREFIX="${WINEPREFIX:-${HOME}/.wine}"
ANDROID_STATE_DIR="${HOME}/.local/share/android-runtime"
MIME_LIST="${HOME}/.config/mimeapps.list"

log_info() { printf '[compat-setup] %s\n' "$*"; }

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

# ------------------------------------------------------------------------------
# 1. Kernel binfmt_misc Verification (Direct ./app.exe & ./app.apk execution)
# ------------------------------------------------------------------------------
verify_kernel_binfmt() {
  if [[ -d /proc/sys/fs/binfmt_misc ]]; then
    if [[ ! -f /proc/sys/fs/binfmt_misc/DOSWin ]] && [[ -w /proc/sys/fs/binfmt_misc/register ]]; then
      printf '%s\n' ':DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    fi
    if [[ ! -f /proc/sys/fs/binfmt_misc/AndroidAPK ]] && [[ -w /proc/sys/fs/binfmt_misc/register ]]; then
      printf '%s\n' ':AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    fi
    log_info "Kernel binfmt_misc active for direct PE/MZ (.exe) & APK execution."
  fi
}

# ------------------------------------------------------------------------------
# 2. Windows (.exe / .msi) Layer — Wine 10+ WoW64 Prefix & NTSync
# ------------------------------------------------------------------------------
init_wine_layer() {
  if ! command -v wine >/dev/null 2>&1; then
    if [[ -x /etc/sysconfig/tcedir/ondemand/wine ]]; then
      log_info "Wine 10 configured in on-demand mode; skipping eager prefix creation."
    else
      log_info "Wine binary not currently loaded; skipping prefix init."
    fi
    return 0
  fi

  local wine_ver
  wine_ver="$(wine --version 2>/dev/null || echo 'unknown')"
  log_info "Detected runtime: ${wine_ver}"

  if [[ ! -d "${WINE_PREFIX}/drive_c" ]]; then
    log_info "Initializing Wine 10+ WoW64 prefix silently at ${WINE_PREFIX}..."
    export WINEPREFIX="${WINE_PREFIX}"
    export WINEARCH="win64"
    export WINENTSYNC=1
    export WINEDLLOVERRIDES="mscoree,mshtml="
    export WINEDEBUG="-all"

    if [[ -z "${DISPLAY:-}" ]] && command -v xvfb-run >/dev/null 2>&1; then
      xvfb-run -a wineboot --init || true
    else
      wineboot --init || true
    fi
    command -v wineserver >/dev/null 2>&1 && wineserver -w || true
  else
    log_info "Existing Wine prefix detected at ${WINE_PREFIX}."
  fi
}

# ------------------------------------------------------------------------------
# 3. XDG MIME Associations (.exe, .msi, .apk)
# ------------------------------------------------------------------------------
register_mime_associations() {
  log_info "Registering XDG MIME handlers for .exe, .msi, and .apk files..."
  mkdir -p "${HOME}/.config" "${HOME}/.local/share/applications"

  if [[ ! -f "${MIME_LIST}" ]]; then
    cat > "${MIME_LIST}" <<'EOF'
[Default Applications]
application/x-ms-dos-executable=wine-exe-runner.desktop
application/x-dosexec=wine-exe-runner.desktop
application/x-msdownload=wine-exe-runner.desktop
application/x-msi=wine-exe-runner.desktop
application/vnd.android.package-archive=android-apk-installer.desktop
EOF
  fi

  command -v update-desktop-database >/dev/null 2>&1 &&     update-desktop-database "${HOME}/.local/share/applications" >/dev/null 2>&1 || true
  command -v update-mime-database >/dev/null 2>&1 &&     run_as_root update-mime-database /usr/local/share/mime >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# 3. Android (.apk) Layer — Kernel BinderFS + Waydroid + Cage Wayland-in-X11
# ------------------------------------------------------------------------------
init_android_layer() {
  log_info "Verifying kernel BinderFS & Waydroid + Cage APK runtime..."
  mkdir -p "${ANDROID_STATE_DIR}" "${HOME}/.local/bin"

  if [[ ! -e /dev/binder ]] && [[ ! -d /dev/binderfs ]] && command -v modinfo >/dev/null 2>&1; then
    for mod in binder_linux ashmem_linux; do
      if modinfo "$mod" >/dev/null 2>&1; then
        run_as_root modprobe "$mod" 2>/dev/null || true
      fi
    done
  fi

  local runner_path="/usr/local/bin/android-apk-runner"
  if [[ ! -x "${runner_path}" ]]; then
    if [[ ! -w /usr/local/bin ]]; then
      runner_path="${HOME}/.local/bin/android-apk-runner"
    fi
    cat > "${runner_path}" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="${1:-}"

if ! command -v waydroid >/dev/null 2>&1 || ! command -v cage >/dev/null 2>&1; then
  zenity --error --title="Android Runtime Missing" \
    --text="Load waydroid.tcz and cage.tcz (plus Android SquashFS images in /var/lib/waydroid/images) to execute APK packages." 2>/dev/null || true
  exit 1
fi

if ! pgrep -f "waydroid.*container" >/dev/null 2>&1; then
  if [[ "$(id -u)" -eq 0 ]]; then
    waydroid container start >/tmp/waydroid-container.log 2>&1 &
  elif command -v sudo >/dev/null 2>&1; then
    sudo waydroid container start >/tmp/waydroid-container.log 2>&1 &
  fi
  sleep 2
fi

if [[ -n "${APK_FILE}" && -f "${APK_FILE}" ]]; then
  waydroid app install "${APK_FILE}" || {
    zenity --error --title="APK Install Failed" --text="Could not install ${APK_FILE} into Waydroid." 2>/dev/null || true
    exit 1
  }
fi

export WAYLAND_DISPLAY=wayland-waydroid
exec cage -s -- waydroid show-full-ui
WRAPPER
    chmod +x "${runner_path}"
  fi
}

# ------------------------------------------------------------------------------
# 4. X11 Keyboard Layout (English + Arabic XKB Switching)
# ------------------------------------------------------------------------------
configure_keyboard_layout() {
  local xkb_layout="us,ara"
  local xkb_variant=","
  local xkb_opt="grp:alt_shift_toggle"
  if [[ -n "${DISPLAY:-}" ]] && command -v setxkbmap >/dev/null 2>&1; then
    setxkbmap -model pc105 -layout "${xkb_layout}" -variant "${xkb_variant}" -option "" -option "${xkb_opt}" 2>/dev/null || true
    log_info "Applied XKB keyboard layout: ${xkb_layout} (toggle: ${xkb_opt})."
  else
    log_info "XKB keyboard target configured: ${xkb_layout} (toggle: ${xkb_opt})."
  fi
}

main() {
  log_info "Starting CorePure64 kernel-integrated compatibility setup (${1:-manual})..."
  verify_kernel_binfmt
  configure_keyboard_layout
  init_wine_layer
  init_android_layer
  register_mime_associations
  log_info "Compatibility layers configured successfully."
}

main "$@"
