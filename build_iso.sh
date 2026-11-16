#!/usr/bin/env bash
# ==============================================================================
# CorePure64 Dual-Arch (x86 + x86_64) Hybrid OS Builder
# Builds a BIOS (ISOLINUX) + UEFI (BOOTX64/BOOTIA32) bootable ISO with:
# - Kernel-integrated Wine 10+ WoW64 (ntsync + binfmt_misc MZ) & Android (binderfs)
# - KDE Plasma Lite + Openbox/Tint2 GUI with guaranteed Xorg startup
# ==============================================================================
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${WORK_DIR:-${SCRIPT_DIR}/build_work}"
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/dist}"
UI_CONFIGS_DIR="${SCRIPT_DIR}/ui_configs"
KERNEL_CONFIG_FRAG="${SCRIPT_DIR}/kernel_configs/corepure64-android-wine.config"
COMPAT_SCRIPT="${SCRIPT_DIR}/setup_compat_layers.sh"

TC_VERSION="15.x"
TARGET_ARCH="dual-x86-x86_64"
TC_MIRROR_64="${TC_MIRROR_64:-http://tinycorelinux.net/${TC_VERSION}/x86_64}"
TC_MIRROR_32="${TC_MIRROR_32:-http://tinycorelinux.net/${TC_VERSION}/x86}"
KERNEL_VERSION="${KERNEL_VERSION:-6.14.6}"
BUILD_KERNEL="${BUILD_KERNEL:-false}"

OUTPUT_ISO="custom-tinycore.iso"
VOLUME_ID="COREPURE64_OS"
HOSTNAME_CFG="corepure64"
PERSIST_LABEL="TC_PERSIST"
DESKTOP_ENV="dual-plasma-openbox"
WINE_CHANNEL="winehq-stable"
ANDROID_RUNTIME="waydroid-cage"
KERNEL_INTEGRATION="true"
EMBED_COMPAT_IN_CORE="true"
INCLUDE_WINE="true"
WINE_ONDEMAND="false"
INCLUDE_WIFI="true"
INCLUDE_PLASMA="true"
INCLUDE_OPENBOX="true"

ISO_ROOT="${WORK_DIR}/iso_root"
INITRD_DIR_64="${WORK_DIR}/initrd_64"
INITRD_DIR_32="${WORK_DIR}/initrd_32"
OVERLAY_DIR="${WORK_DIR}/custom_ui_overlay"
PLASMA_DIR="${WORK_DIR}/plasma_lite_root"
WINE10_DIR="${WORK_DIR}/wine10_wow64_root"
KERNEL_WORK="${WORK_DIR}/kernel_build"
CACHE_DIR="${WORK_DIR}/tcz_cache"
EFI_WORK="${WORK_DIR}/efi_build"

ISOLINUX_BIN=""
ISOHDPFX_BIN=""
LDLINUX_C32=""
MENU_C32=""
LIBUTIL_C32=""
IFCPU64_C32=""
TC_KERNEL_VER_64=""
TC_KERNEL_VER_32=""

log_info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
log_warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*" >&2; }
log_error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; }

cleanup() {
  local rc=$?
  if mountpoint -q "${EFI_WORK}/mnt" 2>/dev/null; then
    umount "${EFI_WORK}/mnt" || true
  fi
  if [[ $rc -ne 0 ]]; then
    log_error "Build failed with exit code ${rc}. Inspect ${WORK_DIR} for details."
  fi
}
trap cleanup EXIT INT TERM

locate_syslinux_file() {
  local filename="$1"
  shift
  for candidate in "$@"; do
    if [[ -f "${candidate}/${filename}" ]]; then
      printf '%s' "${candidate}/${filename}"
      return 0
    fi
  done
  return 1
}

check_host_deps() {
  log_info "Checking host build dependencies..."
  local required_cmds=(
    curl xorriso mksquashfs grub-mkstandalone mkfs.msdos mmd mcopy cpio gzip sha256sum md5sum
  )
  local missing=()
  for cmd in "${required_cmds[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log_error "Missing required host commands: $(printf '%s ' "${missing[@]}")"
    log_error "On Debian/Ubuntu install: sudo apt-get install -y curl xorriso squashfs-tools grub-efi-amd64-bin grub-efi-ia32-bin grub-pc-bin dosfstools mtools isolinux syslinux-common cpio gzip mmdebstrap"
    exit 1
  fi

  local bios_dirs=(
    "/usr/lib/ISOLINUX"
    "/usr/lib/syslinux/modules/bios"
    "/usr/lib/syslinux/bios"
    "/usr/share/syslinux"
  )

  ISOLINUX_BIN="$(locate_syslinux_file "isolinux.bin" "${bios_dirs[@]}" || true)"
  ISOHDPFX_BIN="$(locate_syslinux_file "isohdpfx.bin" "${bios_dirs[@]}" || true)"
  LDLINUX_C32="$(locate_syslinux_file "ldlinux.c32" "${bios_dirs[@]}" || true)"
  MENU_C32="$(locate_syslinux_file "menu.c32" "${bios_dirs[@]}" || true)"
  LIBUTIL_C32="$(locate_syslinux_file "libutil.c32" "${bios_dirs[@]}" || true)"
  IFCPU64_C32="$(locate_syslinux_file "ifcpu64.c32" "${bios_dirs[@]}" || true)"

  for bin_var in ISOLINUX_BIN ISOHDPFX_BIN LDLINUX_C32 MENU_C32 LIBUTIL_C32; do
    if [[ -z "${!bin_var}" ]]; then
      log_error "Could not locate Syslinux file for ${bin_var}. Ensure isolinux and syslinux-common are installed."
      exit 1
    fi
  done
}

prepare_workspace() {
  log_info "Preparing workspace directories in ${WORK_DIR} (target: ${TARGET_ARCH})..."
  rm -rf "${ISO_ROOT}" "${INITRD_DIR_64}" "${INITRD_DIR_32}" "${OVERLAY_DIR}" "${PLASMA_DIR}" "${WINE10_DIR}" "${EFI_WORK}"
  mkdir -p     "${ISO_ROOT}/boot/isolinux"     "${ISO_ROOT}/boot/grub"     "${ISO_ROOT}/cde/optional"     "${ISO_ROOT}/cde/ondemand"     "${ISO_ROOT}/cde32/optional"     "${ISO_ROOT}/cde32/ondemand"     "${INITRD_DIR_64}"     "${INITRD_DIR_32}"     "${OVERLAY_DIR}"     "${PLASMA_DIR}"     "${WINE10_DIR}"     "${KERNEL_WORK}"     "${CACHE_DIR}/x86_64"     "${CACHE_DIR}/x86"     "${EFI_WORK}"     "${OUTPUT_DIR}"
}

build_custom_kernel_if_enabled() {
  if [[ "${BUILD_KERNEL}" != "true" ]] || [[ "${KERNEL_INTEGRATION}" != "true" ]]; then
    return 0
  fi

  log_info "Compiling custom Linux ${KERNEL_VERSION} kernel with built-in BinderFS, NTSync (Wine 10), binfmt_misc & IA32_EMULATION..."
  local ktar="${CACHE_DIR}/linux-${KERNEL_VERSION}.tar.xz"
  local ksrc="${KERNEL_WORK}/linux-${KERNEL_VERSION}"
  local major_ver="${KERNEL_VERSION%%.*}"

  if [[ ! -s "${ktar}" ]]; then
    curl -fSL --retry 3 "https://cdn.kernel.org/pub/linux/kernel/v${major_ver}.x/linux-${KERNEL_VERSION}.tar.xz" -o "${ktar}"
  fi
  if [[ ! -d "${ksrc}" ]]; then
    tar -xf "${ktar}" -C "${KERNEL_WORK}"
  fi

  if [[ "${TARGET_ARCH}" != "x86" ]]; then
    (
      cd "${ksrc}"
      make ARCH=x86_64 x86_64_defconfig
      ./scripts/kconfig/merge_config.sh -m .config "${KERNEL_CONFIG_FRAG}"
      make ARCH=x86_64 olddefconfig
      make -j"$(nproc)" ARCH=x86_64 bzImage
      cp arch/x86/boot/bzImage "${ISO_ROOT}/boot/vmlinuz64"
    )
  fi

  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    (
      cd "${ksrc}"
      make ARCH=i386 i386_defconfig
      ./scripts/kconfig/merge_config.sh -m .config "${KERNEL_CONFIG_FRAG}"
      make ARCH=i386 olddefconfig
      make -j"$(nproc)" ARCH=i386 bzImage
      cp arch/x86/boot/bzImage "${ISO_ROOT}/boot/vmlinuz"
    )
  fi
}

download_base_files() {
  if [[ "${TARGET_ARCH}" != "x86" ]]; then
    local url64="${TC_MIRROR_64}/release/distribution_files"
    log_info "Fetching CorePure64 ${TC_VERSION} (x86_64) kernel & initrd..."
    for file in vmlinuz64 corepure64.gz; do
      if [[ ! -s "${CACHE_DIR}/x86_64/${file}" ]]; then
        curl -fSL --retry 3 --retry-delay 2 "${url64}/${file}" -o "${CACHE_DIR}/x86_64/${file}"
      fi
    done
    [[ ! -s "${ISO_ROOT}/boot/vmlinuz64" ]] && cp "${CACHE_DIR}/x86_64/vmlinuz64" "${ISO_ROOT}/boot/vmlinuz64"
    TC_KERNEL_VER_64="$(curl -fsSL "${TC_MIRROR_64}/tcz/" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+-tinycore64' | head -n1 || echo '6.6.8-tinycore64')"
  fi

  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    local url32="${TC_MIRROR_32}/release/distribution_files"
    log_info "Fetching TinyCore ${TC_VERSION} (32-bit x86) kernel & initrd..."
    for file in vmlinuz core.gz; do
      if [[ ! -s "${CACHE_DIR}/x86/${file}" ]]; then
        curl -fSL --retry 3 --retry-delay 2 "${url32}/${file}" -o "${CACHE_DIR}/x86/${file}"
      fi
    done
    [[ ! -s "${ISO_ROOT}/boot/vmlinuz" ]] && cp "${CACHE_DIR}/x86/vmlinuz" "${ISO_ROOT}/boot/vmlinuz"
    TC_KERNEL_VER_32="$(curl -fsSL "${TC_MIRROR_32}/tcz/" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+-tinycore' | head -n1 || echo '6.6.8-tinycore')"
  fi
}

declare -A DOWNLOADED_TCZ=()

fetch_tcz_recursive() {
  local arch_tag="$1"
  local raw_pkg="$2"
  local optional_flag="${3:-required}"

  local mirror_base="${TC_MIRROR_64}"
  local kver="${TC_KERNEL_VER_64}"
  local dest_cde="${ISO_ROOT}/cde/optional"
  local cache_sub="${CACHE_DIR}/x86_64"

  if [[ "${arch_tag}" == "x86" ]]; then
    mirror_base="${TC_MIRROR_32}"
    kver="${TC_KERNEL_VER_32}"
    dest_cde="${ISO_ROOT}/cde32/optional"
    cache_sub="${CACHE_DIR}/x86"
  fi

  local pkg="${raw_pkg//KERNEL/${kver}}"
  pkg="${pkg%%[[:space:]]*}"
  [[ -z "${pkg}" ]] && return 0

  local key="${arch_tag}:${pkg}"
  if [[ -n "${DOWNLOADED_TCZ[${key}]:-}" ]]; then
    return 0
  fi
  DOWNLOADED_TCZ["${key}"]=1

  local tcz_url="${mirror_base}/tcz/${pkg}"
  local dest_tcz="${cache_sub}/${pkg}"

  if [[ ! -s "${dest_tcz}" ]]; then
    if ! curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 "${tcz_url}" -o "${dest_tcz}"; then
      if [[ "${optional_flag}" == "optional" ]]; then
        log_warn "[${arch_tag}] Optional extension ${pkg} not found on mirror; skipping."
        rm -f "${dest_tcz}"
        return 0
      else
        log_error "[${arch_tag}] Mandatory GUI/core extension ${pkg} failed to download from ${tcz_url}"
        return 1
      fi
    fi
  fi

  if [[ ! -s "${dest_tcz}.md5.txt" ]]; then
    curl -fsSL --connect-timeout 15 --max-time 30 "${tcz_url}.md5.txt" -o "${dest_tcz}.md5.txt" 2>/dev/null || rm -f "${dest_tcz}.md5.txt"
  fi
  if [[ -s "${dest_tcz}.md5.txt" ]]; then
    (cd "${cache_sub}" && md5sum -c "${pkg}.md5.txt" >/dev/null 2>&1) || curl -fsSL --retry 2 --connect-timeout 15 --max-time 120 "${tcz_url}" -o "${dest_tcz}"
    cp "${dest_tcz}.md5.txt" "${dest_cde}/"
  fi

  cp "${dest_tcz}" "${dest_cde}/"

  if [[ ! -f "${dest_tcz}.dep" ]] && [[ ! -f "${dest_tcz}.nodep" ]]; then
    if ! curl -fsSL --connect-timeout 15 --max-time 30 "${tcz_url}.dep" -o "${dest_tcz}.dep" 2>/dev/null; then
      rm -f "${dest_tcz}.dep"
      : > "${dest_tcz}.nodep"
    fi
  fi

  if [[ -s "${dest_tcz}.dep" ]]; then
    cp "${dest_tcz}.dep" "${dest_cde}/"
    while IFS= read -r dep || [[ -n "${dep}" ]]; do
      dep="${dep%%#*}"
      dep="${dep//$'\r'/}"
      [[ -z "${dep}" ]] && continue
      fetch_tcz_recursive "${arch_tag}" "${dep}" "${optional_flag}"
    done < "${dest_tcz}.dep"
  fi
}

bundle_extensions_for_arch() {
  local arch_tag="$1"
  local cde_dir="${ISO_ROOT}/cde"
  [[ "${arch_tag}" == "x86" ]] && cde_dir="${ISO_ROOT}/cde32"

  log_info "Resolving mandatory Xorg/D-Bus/Bash GUI stack for ${arch_tag}..."

  local mandatory_pkgs=(
    "bash.tcz"
    "dbus.tcz"
    "Xorg-7.7.tcz"
    "Xprogs.tcz"
    "Xlibs.tcz"
    "Xorg-7.7-bin.tcz"
    "Xorg-7.7-3d.tcz"
    "xf86-video-fbdev.tcz"
    "xf86-video-vesa.tcz"
    "xf86-input-libinput.tcz"
    "xkeyboard-config.tcz"
    "dejavu-fonts-ttf.tcz"
    "shared-mime-info.tcz"
    "desktop-file-utils.tcz"
  )

  if [[ "${INCLUDE_OPENBOX}" == "true" ]]; then
    mandatory_pkgs+=("openbox.tcz" "flwm_topside.tcz")
  fi

  local optional_pkgs=(
    "xf86-video-intel.tcz"
    "xf86-video-amdgpu.tcz"
    "xf86-video-vmware.tcz"
    "notosans-fonts-ttf.tcz"
    "wbar.tcz"
    "feh.tcz"
    "pulseaudio.tcz"
    "volumeicon.tcz"
    "adwaita-icon-theme.tcz"
    "lxde-icon-theme.tcz"
    "dolphin-lite.tcz"
    "konsole-lite.tcz"
    "leafpad.tcz"
    "htop.tcz"
    "p7zip.tcz"
    "tar.tcz"
    "zenity.tcz"
  )

  if [[ "${arch_tag}" == "x86_64" ]]; then
    optional_pkgs+=("falkon.tcz" "rofi.tcz" "unzip.tcz" "network-manager-applet.tcz")
  else
    optional_pkgs+=("firefox_getLatest.tcz" "tint2.tcz" "zip-unzip.tcz" "network_tray.tcz")
  fi

  if [[ "${INCLUDE_WIFI}" == "true" ]]; then
    optional_pkgs+=("wifi.tcz" "firmware-iwlwifi.tcz" "firmware-rtlwifi.tcz")
  fi

  : > "${cde_dir}/onboot.lst"

  for pkg in "${mandatory_pkgs[@]}"; do
    fetch_tcz_recursive "${arch_tag}" "${pkg}" "required"
    printf '%s\n' "${pkg}" >> "${cde_dir}/onboot.lst"
  done

  for pkg in "${optional_pkgs[@]}"; do
    if fetch_tcz_recursive "${arch_tag}" "${pkg}" "optional" && [[ -f "${cde_dir}/optional/${pkg}" ]]; then
      printf '%s\n' "${pkg}" >> "${cde_dir}/onboot.lst"
    fi
  done

  if [[ "${ANDROID_RUNTIME}" == "waydroid-cage" ]]; then
    for apkg in "cage.tcz" "lxc.tcz" "waydroid.tcz"; do
      if fetch_tcz_recursive "${arch_tag}" "${apkg}" "optional" && [[ -f "${cde_dir}/optional/${apkg}" ]]; then
        [[ "${apkg}" == "cage.tcz" || "${apkg}" == "lxc.tcz" ]] && printf '%s\n' "${apkg}" >> "${cde_dir}/onboot.lst"
      fi
    done
  else
    for apkg in "qemu.tcz" "qemu-kvm.tcz" "android-tools.tcz"; do
      fetch_tcz_recursive "${arch_tag}" "${apkg}" "optional" || true
    done
  fi
}

build_wine10_wow64_tcz() {
  if [[ "${INCLUDE_WINE}" != "true" ]] || [[ "${TARGET_ARCH}" == "x86" ]]; then
    return 0
  fi

  local cached_wine10="${CACHE_DIR}/x86_64/wine10-wow64.tcz"
  if [[ -s "${cached_wine10}" ]]; then
    log_info "Using cached wine10-wow64.tcz (Wine 10+ WoW64)..."
    cp "${cached_wine10}" "${ISO_ROOT}/cde/optional/"
    (cd "${ISO_ROOT}/cde/optional" && md5sum wine10-wow64.tcz > wine10-wow64.tcz.md5.txt)
    printf 'wine10-wow64.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"
    return 0
  fi

  if command -v mmdebstrap >/dev/null 2>&1; then
    log_info "Assembling Wine 10+ WoW64 (${WINE_CHANNEL}) from WineHQ Debian repository..."
    local stage="${WINE10_DIR}/rootfs"
    mkdir -p "${stage}"

    # Pull WineHQ 10+ WoW64 (supports both 32-bit x86 and 64-bit x86_64 Windows PE binaries)
    if mmdebstrap --variant=minbase \
      --architectures=amd64,i386 \
      --include="ca-certificates,curl,${WINE_CHANNEL},winetricks" \
      --aptopt='APT::Install-Recommends "false"' \
      --dpkgopt='path-exclude=/usr/share/doc/*' \
      --dpkgopt='path-exclude=/usr/share/man/*' \
      --setup-hook='mkdir -p "$1/etc/apt/keyrings" "$1/etc/apt/sources.list.d" && curl -fsSL https://dl.winehq.org/wine-builds/winehq.key -o "$1/etc/apt/keyrings/winehq-archive.asc" && printf "deb [signed-by=/etc/apt/keyrings/winehq-archive.asc] https://dl.winehq.org/wine-builds/debian/ bookworm main\n" > "$1/etc/apt/sources.list.d/winehq.list"' \
      bookworm "${stage}" http://deb.debian.org/debian; then

      local wver
      wver="$("${stage}/opt/wine-stable/bin/wine" --version 2>/dev/null || "${stage}/opt/wine-staging/bin/wine" --version 2>/dev/null || echo 'wine-10.0')"
      log_info "Packaged Wine version: ${wver}"

      mkdir -p "${WINE10_DIR}/tcz/usr/local/wine10/extralibs" "${WINE10_DIR}/tcz/usr/local/bin"
      cp -a "${stage}/opt/wine-"* "${WINE10_DIR}/tcz/usr/local/wine10/" 2>/dev/null || cp -a "${stage}/usr/"* "${WINE10_DIR}/tcz/usr/local/wine10/"
      for libdir in "${stage}/usr/lib/x86_64-linux-gnu" "${stage}/usr/lib/i386-linux-gnu"; do
        if [[ -d "${libdir}" ]]; then
          cp -a "${libdir}" "${WINE10_DIR}/tcz/usr/local/wine10/extralibs/" 2>/dev/null || true
          rm -f "${WINE10_DIR}/tcz/usr/local/wine10/extralibs/$(basename "${libdir}")/libc.so"*                 "${WINE10_DIR}/tcz/usr/local/wine10/extralibs/$(basename "${libdir}")/ld-linux"* 2>/dev/null || true
        fi
      done
      [[ -x "${stage}/usr/bin/winetricks" ]] && cp -a "${stage}/usr/bin/winetricks" "${WINE10_DIR}/tcz/usr/local/bin/" || true

      cat > "${WINE10_DIR}/tcz/usr/local/bin/wine" <<'EOF'
#!/usr/bin/env bash
WINE_ROOT="$(find /usr/local/wine10 -maxdepth 3 -type f -name wine | head -n1)"
WINE_BASE="$(dirname "$(dirname "$WINE_ROOT")")"
export PATH="${WINE_BASE}/bin:${PATH}"
export LD_LIBRARY_PATH="${WINE_BASE}/lib:${WINE_BASE}/lib64:/usr/local/wine10/extralibs/x86_64-linux-gnu:/usr/local/wine10/extralibs/i386-linux-gnu:${LD_LIBRARY_PATH:-}"
export WINENTSYNC=1
exec "${WINE_ROOT}" "$@"
EOF
      chmod +x "${WINE10_DIR}/tcz/usr/local/bin/wine"
      ln -sf /usr/local/bin/wine "${WINE10_DIR}/tcz/usr/local/bin/wine64"

      mksquashfs "${WINE10_DIR}/tcz" "${cached_wine10}" -comp xz -b 256K -noappend >/dev/null
      cp "${cached_wine10}" "${ISO_ROOT}/cde/optional/"
      (cd "${ISO_ROOT}/cde/optional" && md5sum wine10-wow64.tcz > wine10-wow64.tcz.md5.txt)
      if [[ "${WINE_ONDEMAND}" == "true" ]] && [[ "${EMBED_COMPAT_IN_CORE}" != "true" ]]; then
        printf '#!/usr/bin/env bash\ntce-load -i wine10-wow64.tcz >/dev/null 2>&1 || true\nexec wine "$@"\n' > "${ISO_ROOT}/cde/ondemand/wine"
        chmod +x "${ISO_ROOT}/cde/ondemand/wine"
      else
        printf 'wine10-wow64.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"
      fi
      return 0
    fi
  fi

  log_warn "WineHQ 10 mmdebstrap unavailable; falling back to Tiny Core mirror wine.tcz"
  if fetch_tcz_recursive "x86_64" "wine.tcz" "optional" && [[ -f "${ISO_ROOT}/cde/optional/wine.tcz" ]]; then
    printf 'wine.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"
  fi
}

build_kde_plasma_lite_tcz() {
  if [[ "${INCLUDE_PLASMA}" != "true" ]] || [[ "${TARGET_ARCH}" == "x86" ]]; then
    return 0
  fi

  local cached_plasma="${CACHE_DIR}/x86_64/kde-plasma-lite.tcz"
  if [[ -s "${cached_plasma}" ]]; then
    log_info "Using cached kde-plasma-lite.tcz..."
    cp "${cached_plasma}" "${ISO_ROOT}/cde/optional/"
    (cd "${ISO_ROOT}/cde/optional" && md5sum kde-plasma-lite.tcz > kde-plasma-lite.tcz.md5.txt)
    printf 'kde-plasma-lite.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"
    return 0
  fi

  if command -v mmdebstrap >/dev/null 2>&1; then
    log_info "Assembling stripped KDE Plasma Lite SquashFS (kwin-x11, plasma-desktop, dolphin, konsole, breeze)..."
    local stage="${PLASMA_DIR}/rootfs"
    mkdir -p "${stage}"

    mmdebstrap --variant=minbase --include="plasma-desktop,kwin-x11,plasma-workspace,dolphin,konsole,breeze,breeze-icon-theme,dbus-x11,xinit,fonts-noto-core" \
      --aptopt='APT::Install-Recommends "false"' \
      --dpkgopt='path-exclude=/usr/share/doc/*' \
      --dpkgopt='path-exclude=/usr/share/man/*' \
      --dpkgopt='path-exclude=/usr/share/locale/*' \
      bookworm "${stage}" http://deb.debian.org/debian || {
        log_warn "mmdebstrap failed; falling back to Openbox+Tint2 GUI session."
        return 0
      }

    mkdir -p "${PLASMA_DIR}/tcz_pkg/usr/local/kde-lite" "${PLASMA_DIR}/tcz_pkg/usr/local/bin" "${PLASMA_DIR}/tcz_pkg/etc/ld.so.conf.d"
    mv "${stage}/usr/"* "${PLASMA_DIR}/tcz_pkg/usr/local/kde-lite/" || true
    printf '/usr/local/kde-lite/lib/x86_64-linux-gnu\n/usr/local/kde-lite/lib\n' > "${PLASMA_DIR}/tcz_pkg/etc/ld.so.conf.d/kde-lite.conf"

    cat > "${PLASMA_DIR}/tcz_pkg/usr/local/bin/startplasma-lite" <<'EOF'
#!/usr/bin/env bash
export KDE_LITE_PREFIX="/usr/local/kde-lite"
export PATH="${KDE_LITE_PREFIX}/bin:${PATH}"
export LD_LIBRARY_PATH="${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu:${KDE_LITE_PREFIX}/lib:${LD_LIBRARY_PATH:-}"
export XDG_DATA_DIRS="${KDE_LITE_PREFIX}/share:/usr/local/share:/usr/share"
export QT_PLUGIN_PATH="${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu/qt5/plugins"
export QML2_IMPORT_PATH="${KDE_LITE_PREFIX}/lib/x86_64-linux-gnu/qt5/qml"
exec "${KDE_LITE_PREFIX}/bin/startplasma-x11"
EOF
    chmod +x "${PLASMA_DIR}/tcz_pkg/usr/local/bin/startplasma-lite"

    mksquashfs "${PLASMA_DIR}/tcz_pkg" "${cached_plasma}" -comp xz -b 256K -noappend >/dev/null
    cp "${cached_plasma}" "${ISO_ROOT}/cde/optional/"
    (cd "${ISO_ROOT}/cde/optional" && md5sum kde-plasma-lite.tcz > kde-plasma-lite.tcz.md5.txt)
    printf 'kde-plasma-lite.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"
  else
    log_warn "mmdebstrap not installed on host; skipping local KDE Plasma Lite assembly (Openbox+Tint2 GUI remains active)."
  fi
}

populate_core_compat_files() {
  local target_root="$1"
  mkdir -p     "${target_root}/etc/X11/xorg.conf.d"     "${target_root}/etc/binfmt.d"     "${target_root}/etc/udev/rules.d"     "${target_root}/usr/local/share/applications"     "${target_root}/usr/local/bin"

  cp "${UI_CONFIGS_DIR}/applications/"*.desktop "${target_root}/usr/local/share/applications/"

  cat > "${target_root}/etc/X11/xorg.conf.d/10-modesetting.conf" <<'EOF'
Section "Device"
    Identifier "DefaultGPU"
    Driver "modesetting"
EndSection
EOF

  # System-wide Xorg XKB Keyboard Layout (English primary + Arabic secondary)
  cat > "${target_root}/etc/X11/xorg.conf.d/00-keyboard.conf" <<'EOF'
Section "InputClass"
    Identifier "system-keyboard"
    MatchIsKeyboard "on"
    Option "XkbModel" "pc105"
    Option "XkbLayout" "us,ara"
    Option "XkbVariant" ","
    Option "XkbOptions" "grp:alt_shift_toggle"
EndSection
EOF

  # Kernel binfmt_misc direct execve() rules for MZ (.exe) and .apk
  cat > "${target_root}/etc/binfmt.d/wine10.conf" <<'EOF'
:DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:
EOF
  cat > "${target_root}/etc/binfmt.d/android-apk.conf" <<'EOF'
:AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:
EOF

  # Grant user 'tc' (staff) direct access to Wine 10 /dev/ntsync & Android /dev/binderfs
  cat > "${target_root}/etc/udev/rules.d/99-ntsync-binder.rules" <<'EOF'
KERNEL=="ntsync", MODE="0666"
SUBSYSTEM=="binder", MODE="0666"
EOF

  cat > "${target_root}/usr/local/bin/wine-exe-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-}"
if ! command -v wine >/dev/null 2>&1; then
  for ext in wine10-wow64.tcz wine.tcz; do
    if [ -f "/etc/sysconfig/tcedir/optional/${ext}" ]; then
      tce-load -i "/etc/sysconfig/tcedir/optional/${ext}" >/dev/null 2>&1 || true
      break
    fi
  done
fi
if ! command -v wine >/dev/null 2>&1; then
  zenity --error --title="Wine 10 Missing" --text="wine10-wow64.tcz is not loaded." 2>/dev/null || true
  exit 1
fi
export WINEPREFIX="${WINEPREFIX:-${HOME}/.wine}"
export WINENTSYNC=1
export WINEDEBUG="-all"
case "${TARGET,,}" in
  *.msi) exec wine msiexec /i "${TARGET}" ;;
  *.exe) exec wine "${TARGET}" ;;
  *)     exec wine explorer ;;
esac
EOF
  chmod +x "${target_root}/usr/local/bin/wine-exe-runner"

  if [[ "${ANDROID_RUNTIME}" == "waydroid-cage" ]]; then
    cat > "${target_root}/usr/local/bin/android-apk-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="${1:-}"
if ! command -v waydroid >/dev/null 2>&1 || ! command -v cage >/dev/null 2>&1; then
  zenity --error --title="Android Runtime Missing" --text="Load waydroid.tcz and cage.tcz." 2>/dev/null || true
  exit 1
fi
if ! pgrep -f "waydroid.*container" >/dev/null 2>&1; then
  sudo waydroid container start >/tmp/waydroid-container.log 2>&1 &
  sleep 2
fi
if [[ -n "${APK_FILE}" && -f "${APK_FILE}" ]]; then
  waydroid app install "${APK_FILE}"
fi
export WAYLAND_DISPLAY=wayland-waydroid
exec cage -s -- waydroid show-full-ui
EOF
  else
    cat > "${target_root}/usr/local/bin/android-apk-runner" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APK_FILE="${1:-}"
WORK_IMG="${HOME}/.local/share/android-vm/android-overlay.qcow2"
if ! command -v qemu-system-x86_64 >/dev/null 2>&1; then
  zenity --error --title="QEMU-KVM Missing" --text="Load qemu-kvm.tcz." 2>/dev/null || true
  exit 1
fi
if ! pgrep -f "qemu-system-x86_64.*android" >/dev/null 2>&1; then
  mkdir -p "$(dirname "${WORK_IMG}")"
  qemu-system-x86_64 -enable-kvm -m 1024 -smp 2 -vga virtio -display gtk,gl=on     -netdev user,id=net0,hostfwd=tcp::5555-:5555 -device virtio-net-pci,netdev=net0     -drive file="${WORK_IMG}",if=virtio,format=qcow2 -name "Android Runtime" >/tmp/android-vm.log 2>&1 &
  sleep 4
fi
if [[ -n "${APK_FILE}" && -f "${APK_FILE}" ]] && command -v adb >/dev/null 2>&1; then
  adb connect 127.0.0.1:5555 >/dev/null 2>&1 || true
  adb install -r "${APK_FILE}"
fi
EOF
  fi
  chmod +x "${target_root}/usr/local/bin/android-apk-runner"

  if [[ -f "${COMPAT_SCRIPT}" ]]; then
    cp "${COMPAT_SCRIPT}" "${target_root}/usr/local/bin/setup_compat_layers.sh"
    chmod +x "${target_root}/usr/local/bin/setup_compat_layers.sh"
  fi
}

build_custom_ui_overlay_tcz() {
  log_info "Building custom-ui-overlay.tcz SquashFS layer..."
  local skel="${OVERLAY_DIR}/etc/skel"
  mkdir -p "${skel}/.config/openbox" "${skel}/.config/tint2" "${skel}/.config/rofi" "${skel}/.config/gtk-3.0"

  cp "${UI_CONFIGS_DIR}/openbox/rc.xml"      "${skel}/.config/openbox/rc.xml"
  cp "${UI_CONFIGS_DIR}/openbox/autostart"   "${skel}/.config/openbox/autostart"
  cp "${UI_CONFIGS_DIR}/openbox/menu.xml"    "${skel}/.config/openbox/menu.xml"
  cp "${UI_CONFIGS_DIR}/tint2/tint2rc"      "${skel}/.config/tint2/tint2rc"
  cp "${UI_CONFIGS_DIR}/rofi/config.rasi"   "${skel}/.config/rofi/config.rasi"
  cp "${UI_CONFIGS_DIR}/gtk-3.0/settings.ini" "${skel}/.config/gtk-3.0/settings.ini"
  cp "${UI_CONFIGS_DIR}/mimeapps.list"      "${skel}/.config/mimeapps.list"
  chmod +x "${skel}/.config/openbox/autostart"

  if [[ -d "${UI_CONFIGS_DIR}/kde-plasma" ]]; then
    cp "${UI_CONFIGS_DIR}/kde-plasma/kdeglobals"  "${skel}/.config/kdeglobals"
    cp "${UI_CONFIGS_DIR}/kde-plasma/kwinrc"      "${skel}/.config/kwinrc"
    cp "${UI_CONFIGS_DIR}/kde-plasma/baloofilerc" "${skel}/.config/baloofilerc"
    cp "${UI_CONFIGS_DIR}/kde-plasma/kxkbrc"      "${skel}/.config/kxkbrc"
  fi

  # Bundle Arabic Noto fonts into overlay if available on build host
  if [[ -d /usr/share/fonts/truetype/noto ]]; then
    mkdir -p "${OVERLAY_DIR}/usr/local/share/fonts/arabic"
    cp /usr/share/fonts/truetype/noto/Noto*Arabic*.ttf "${OVERLAY_DIR}/usr/local/share/fonts/arabic/" 2>/dev/null || true
  fi

  populate_core_compat_files "${OVERLAY_DIR}"

  cat > "${skel}/.xsession" <<'EOF'
#!/bin/sh
export LANG="C.UTF-8"
export LC_ALL="C.UTF-8"
export XDG_CONFIG_HOME="$HOME/.config"
export GTK_THEME="Adwaita:dark"
export WINENTSYNC=1
command -v setxkbmap >/dev/null 2>&1 && setxkbmap -model pc105 -layout "us,ara" -variant "," -option "" -option "grp:alt_shift_toggle" || true

launch_session() {
  if [ "dual-plasma-openbox" != "openbox-tint2" ] && command -v startplasma-lite >/dev/null 2>&1; then
    export XDG_CURRENT_DESKTOP=KDE
    exec startplasma-lite
  elif [ "dual-plasma-openbox" != "openbox-tint2" ] && command -v startplasma-x11 >/dev/null 2>&1; then
    export XDG_CURRENT_DESKTOP=KDE
    exec startplasma-x11
  else
    export XDG_CURRENT_DESKTOP=Openbox
    exec openbox-session
  fi
}

if command -v dbus-launch >/dev/null 2>&1 && [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
  exec dbus-launch --exit-with-session sh -c "$(declare -f launch_session); launch_session"
else
  launch_session
fi
EOF
  chmod +x "${skel}/.xsession"

  mksquashfs "${OVERLAY_DIR}" "${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz" -comp xz -b 256K -noappend >/dev/null
  (cd "${ISO_ROOT}/cde/optional" && md5sum custom-ui-overlay.tcz > custom-ui-overlay.tcz.md5.txt)
  printf 'custom-ui-overlay.tcz\n' >> "${ISO_ROOT}/cde/onboot.lst"

  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    cp "${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz" "${ISO_ROOT}/cde32/optional/"
    cp "${ISO_ROOT}/cde/optional/custom-ui-overlay.tcz.md5.txt" "${ISO_ROOT}/cde32/optional/"
    printf 'custom-ui-overlay.tcz\n' >> "${ISO_ROOT}/cde32/onboot.lst"
  fi
}

remaster_single_initrd() {
  local src_gz="$1"
  local dest_gz="$2"
  local work_dir="$3"

  log_info "Remastering initrd $(basename "${dest_gz}") (baking kernel binfmt_misc, binderfs, /home/tc & compat layers)..."
  (cd "${work_dir}" && zcat "${src_gz}" | cpio -idm --quiet)
  printf '%s\n' "${HOSTNAME_CFG}" > "${work_dir}/etc/hostname"

  if [[ "${EMBED_COMPAT_IN_CORE}" == "true" ]]; then
    populate_core_compat_files "${work_dir}"
  fi

  for user_home in "${work_dir}/etc/skel" "${work_dir}/home/tc"; do
    mkdir -p "${user_home}/.config/openbox" "${user_home}/.config/tint2" "${user_home}/.config/rofi" "${user_home}/.config/gtk-3.0"
    cp "${UI_CONFIGS_DIR}/openbox/"* "${user_home}/.config/openbox/"
    cp "${UI_CONFIGS_DIR}/tint2/tint2rc" "${user_home}/.config/tint2/tint2rc"
    cp "${UI_CONFIGS_DIR}/rofi/config.rasi" "${user_home}/.config/rofi/config.rasi"
    cp "${UI_CONFIGS_DIR}/gtk-3.0/settings.ini" "${user_home}/.config/gtk-3.0/settings.ini"
    cp "${UI_CONFIGS_DIR}/mimeapps.list" "${user_home}/.config/mimeapps.list"
    if [[ -d "${UI_CONFIGS_DIR}/kde-plasma" ]]; then
      cp "${UI_CONFIGS_DIR}/kde-plasma/kdeglobals" "${user_home}/.config/kdeglobals"
      cp "${UI_CONFIGS_DIR}/kde-plasma/kwinrc" "${user_home}/.config/kwinrc"
      cp "${UI_CONFIGS_DIR}/kde-plasma/baloofilerc" "${user_home}/.config/baloofilerc"
      cp "${UI_CONFIGS_DIR}/kde-plasma/kxkbrc" "${user_home}/.config/kxkbrc"
    fi
    cp "${OVERLAY_DIR}/etc/skel/.xsession" "${user_home}/.xsession"
    chmod +x "${user_home}/.xsession" "${user_home}/.config/openbox/autostart"

    if ! grep -q ".x11_attempted" "${user_home}/.profile" 2>/dev/null; then
      cat >> "${user_home}/.profile" <<'EOF'

if [ -z "$DISPLAY" ] && [ "$(tty 2>/dev/null)" = "/dev/tty1" ] && [ ! -f /tmp/.x11_attempted ] && command -v startx >/dev/null 2>&1; then
  touch /tmp/.x11_attempted
  startx || echo "[CorePure64] X11 failed to start. Run 'xsetup' or inspect /var/log/Xorg.0.log."
fi
EOF
    fi
  done

  chown -R 1001:50 "${work_dir}/home/tc" 2>/dev/null || true

  mkdir -p "${work_dir}/opt"
  cat > "${work_dir}/opt/bootlocal.sh" <<'EOF'
#!/bin/sh
# 1. Refresh dynamic linker cache (KDE Lite / Wine 10)
[ -f /etc/ld.so.conf.d/kde-lite.conf ] && ldconfig >/dev/null 2>&1 || true

# 2. Kernel-level BinderFS mount for direct Android APK containers
if grep -qw binder /proc/filesystems 2>/dev/null; then
  mkdir -p /dev/binderfs
  mount -t binder binder /dev/binderfs 2>/dev/null || true
  for dev in binder hwbinder vndbinder; do
    [ -e "/dev/binderfs/$dev" ] && [ ! -e "/dev/$dev" ] && ln -sf "/dev/binderfs/$dev" "/dev/$dev"
  done
else
  modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null || true
fi

# 3. Kernel-level Wine 10 NTSync device permissions
[ -c /dev/ntsync ] && chmod 0666 /dev/ntsync 2>/dev/null || true

# 4. Kernel binfmt_misc registration for direct ./app.exe and ./app.apk execution
if [ -d /proc/sys/fs/binfmt_misc ] || modprobe binfmt_misc 2>/dev/null; then
  mount -t binfmt_misc none /proc/sys/fs/binfmt_misc 2>/dev/null || true
  if [ -w /proc/sys/fs/binfmt_misc/register ]; then
    [ ! -f /proc/sys/fs/binfmt_misc/DOSWin ] &&       printf '%s\n' ':DOSWin:M::MZ::/usr/local/bin/wine-exe-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
    [ ! -f /proc/sys/fs/binfmt_misc/AndroidAPK ] &&       printf '%s\n' ':AndroidAPK:E::apk::/usr/local/bin/android-apk-runner:' > /proc/sys/fs/binfmt_misc/register 2>/dev/null || true
  fi
fi

# 5. Start D-Bus and user-space compatibility layer initialization
[ -x /usr/local/etc/init.d/dbus ] && /usr/local/etc/init.d/dbus start >/dev/null 2>&1 || true
if [ -x /usr/local/bin/setup_compat_layers.sh ]; then
  su - tc -c "/usr/local/bin/setup_compat_layers.sh --boot-init" >/var/log/compat-init.log 2>&1 &
fi
EOF
  chmod +x "${work_dir}/opt/bootlocal.sh"

  (cd "${work_dir}" && find . | cpio -o -H newc --quiet | gzip -9 > "${dest_gz}")
}

remaster_all_initrds() {
  if [[ "${TARGET_ARCH}" != "x86" ]]; then
    remaster_single_initrd "${CACHE_DIR}/x86_64/corepure64.gz" "${ISO_ROOT}/boot/corepure64.gz" "${INITRD_DIR_64}"
  fi
  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    remaster_single_initrd "${CACHE_DIR}/x86/core.gz" "${ISO_ROOT}/boot/core.gz" "${INITRD_DIR_32}"
  fi
}

setup_bios_isolinux() {
  log_info "Configuring ISOLINUX (Dual x86 / x86_64 Legacy BIOS bootloader)..."
  cp "${ISOLINUX_BIN}" "${ISO_ROOT}/boot/isolinux/"
  cp "${LDLINUX_C32}"  "${ISO_ROOT}/boot/isolinux/"
  cp "${MENU_C32}"     "${ISO_ROOT}/boot/isolinux/"
  cp "${LIBUTIL_C32}"  "${ISO_ROOT}/boot/isolinux/"
  [[ -n "${IFCPU64_C32}" ]] && cp "${IFCPU64_C32}" "${ISO_ROOT}/boot/isolinux/"

  cat > "${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
UI menu.c32
PROMPT 0
TIMEOUT 50
DEFAULT auto

MENU TITLE CorePure64 15.x Dual-Arch (x86 + x86_64) Hybrid OS

EOF

  if [[ "${TARGET_ARCH}" == "dual-x86-x86_64" ]] && [[ -n "${IFCPU64_C32}" ]]; then
    cat >> "${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<'EOF'
LABEL auto
  MENU LABEL Auto-Detect CPU (x86_64 / x86) + Wine 10 + Android
  COM32 ifcpu64.c32
  APPEND live64 -- live32

EOF
  fi

  if [[ "${TARGET_ARCH}" != "x86" ]]; then
    cat >> "${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL live64
  MENU LABEL CorePure64 (x86_64) Desktop + Wine 10 WoW64 + Android APK
  KERNEL /boot/vmlinuz64
  INITRD /boot/corepure64.gz
  APPEND cde vga=791 quiet loglevel=3

LABEL persist64
  MENU LABEL CorePure64 (x86_64) Persistent Storage (LABEL=${PERSIST_LABEL})
  KERNEL /boot/vmlinuz64
  INITRD /boot/corepure64.gz
  APPEND tce=LABEL=${PERSIST_LABEL} opt=LABEL=${PERSIST_LABEL} home=LABEL=${PERSIST_LABEL} vga=791 quiet
EOF
  fi

  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    cat >> "${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL live32
  MENU LABEL TinyCore (x86 32-bit) Desktop + Android + Compatibility
  KERNEL /boot/vmlinuz
  INITRD /boot/core.gz
  APPEND cde=cde32 vga=791 quiet loglevel=3
EOF
  fi

  cat >> "${ISO_ROOT}/boot/isolinux/isolinux.cfg" <<EOF
LABEL safe
  MENU LABEL Safe Graphics (VESA / No KMS)
  KERNEL /boot/vmlinuz64
  INITRD /boot/corepure64.gz
  APPEND cde nomodeset xsetup
EOF
}

setup_uefi_grub() {
  log_info "Building GRUB2 Dual-UEFI image (boot/grub/efi.img: BOOTX64.EFI + BOOTIA32.EFI)..."

  cat > "${ISO_ROOT}/boot/grub/grub.cfg" <<EOF
set default=0
set timeout=5

insmod all_video
insmod gfxterm
terminal_output gfxterm

if cpuid -l; then
  menuentry "CorePure64 (x86_64) — KDE Plasma Lite + Wine 10 + Android APK" {
    linux /boot/vmlinuz64 cde quiet loglevel=3
    initrd /boot/corepure64.gz
  }
  menuentry "CorePure64 (x86_64) Persistent Storage (LABEL=${PERSIST_LABEL})" {
    linux /boot/vmlinuz64 tce=LABEL=${PERSIST_LABEL} opt=LABEL=${PERSIST_LABEL} home=LABEL=${PERSIST_LABEL} quiet
    initrd /boot/corepure64.gz
  }
else
  menuentry "TinyCore (x86 32-bit) — Desktop + Compatibility" {
    linux /boot/vmlinuz cde=cde32 quiet loglevel=3
    initrd /boot/core.gz
  }
fi

menuentry "Safe Graphics Mode (nomodeset)" {
  if cpuid -l; then
    linux /boot/vmlinuz64 cde nomodeset xsetup
    initrd /boot/corepure64.gz
  else
    linux /boot/vmlinuz cde=cde32 nomodeset xsetup
    initrd /boot/core.gz
  fi
}
EOF

  cat > "${EFI_WORK}/grub-embed.cfg" <<'EOF'
search --no-floppy --file --set=root /boot/grub/grub.cfg
set prefix=($root)/boot/grub
configfile ($root)/boot/grub/grub.cfg
EOF

  local grub_mods="part_gpt part_msdos iso9660 fat ext2 normal boot linux configfile search search_label search_fs_uuid all_video efi_gop efi_uga gfxterm cpuid"

  grub-mkstandalone \
    --format=x86_64-efi \
    --output="${EFI_WORK}/BOOTX64.EFI" \
    --locales="" \
    --fonts="" \
    --modules="${grub_mods}" \
    "boot/grub/grub.cfg=${EFI_WORK}/grub-embed.cfg"

  local efi_img="${ISO_ROOT}/boot/grub/efi.img"
  dd if=/dev/zero of="${efi_img}" bs=1M count=20 status=none
  mkfs.msdos -F 16 -n "EFIBOOT" "${efi_img}" >/dev/null
  mmd -i "${efi_img}" ::/EFI ::/EFI/BOOT
  mcopy -i "${efi_img}" "${EFI_WORK}/BOOTX64.EFI" ::/EFI/BOOT/BOOTX64.EFI

  # Also bundle 32-bit UEFI (BOOTIA32.EFI) when grub-efi-ia32-bin is installed on host
  if [[ -d /usr/lib/grub/i386-efi ]]; then
    grub-mkstandalone \
      --format=i386-efi \
      --output="${EFI_WORK}/BOOTIA32.EFI" \
      --locales="" \
      --fonts="" \
      --modules="${grub_mods}" \
      "boot/grub/grub.cfg=${EFI_WORK}/grub-embed.cfg"
    mcopy -i "${efi_img}" "${EFI_WORK}/BOOTIA32.EFI" ::/EFI/BOOT/BOOTIA32.EFI
  fi
}

package_hybrid_iso() {
  log_info "Packaging bootable BIOS+UEFI hybrid ISO via xorriso..."
  xorriso -as mkisofs \
    -iso-level 3 \
    -full-iso9660-filenames \
    -volid "COREPURE64_OS" \
    -c boot/isolinux/boot.cat \
    -b boot/isolinux/isolinux.bin \
    -no-emul-boot \
    -boot-load-size 4 \
    -boot-info-table \
    -isohybrid-mbr "${ISOHDPFX_BIN}" \
    -eltorito-alt-boot \
    -e boot/grub/efi.img \
    -no-emul-boot \
    -isohybrid-gpt-basdat \
    -output "${OUTPUT_DIR}/custom-tinycore.iso" \
    "${ISO_ROOT}"

  local iso_path="${OUTPUT_DIR}/${OUTPUT_ISO}"
  local iso_size
  iso_size="$(du -h "${iso_path}" | awk '{print $1}')"
  sha256sum "${iso_path}" > "${iso_path}.sha256"
  log_info "Success! Created ${iso_path} (${iso_size})"
  log_info "SHA-256 written to ${iso_path}.sha256"
}

main() {
  check_host_deps
  prepare_workspace
  build_custom_kernel_if_enabled
  download_base_files
  if [[ "${TARGET_ARCH}" != "x86" ]]; then
    bundle_extensions_for_arch "x86_64"
  fi
  if [[ "${TARGET_ARCH}" != "x86_64" ]]; then
    bundle_extensions_for_arch "x86"
  fi
  build_wine10_wow64_tcz
  build_kde_plasma_lite_tcz
  build_custom_ui_overlay_tcz
  remaster_all_initrds
  setup_bios_isolinux
  setup_uefi_grub
  package_hybrid_iso
}

main "$@"
