import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_OS_CONFIG, OsBuildConfig } from './types';
import {
  buildXorissoCommand,
  calculateResourceEstimate,
  generateAllArtifacts,
  getPackageManifest,
  validateBuildConfig,
} from './generator';
import { crc32, createZipArchive } from './zipBuilder';

test('validateBuildConfig accepts default configuration', () => {
  const issues = validateBuildConfig(DEFAULT_OS_CONFIG);
  assert.equal(issues.length, 0);
});

test('validateBuildConfig rejects invalid volumeId, isoName, and hostname', () => {
  const bad: OsBuildConfig = {
    ...DEFAULT_OS_CONFIG,
    volumeId: 'lowercase-invalid',
    isoName: 'missing-extension.img',
    hostname: 'Invalid_Host!',
  };
  const issues = validateBuildConfig(bad);
  assert.equal(issues.length, 3);
  assert.deepEqual(
    issues.map((i) => i.field),
    ['volumeId', 'isoName', 'hostname']
  );
});

test('calculateResourceEstimate reflects Wine toggle and Android runtime choice', () => {
  const withWine = calculateResourceEstimate(DEFAULT_OS_CONFIG);
  const withoutWine = calculateResourceEstimate({
    ...DEFAULT_OS_CONFIG,
    includeWine: false,
  });

  assert.ok(withWine.wineSquashfsMb > 100);
  assert.equal(withoutWine.wineSquashfsMb, 0);
  assert.ok(withWine.totalIsoMb > withoutWine.totalIsoMb);
  assert.equal(withoutWine.wineActiveRamMb, withoutWine.idleRamMb);
});

test('buildXorissoCommand includes mandatory BIOS and UEFI hybrid boot flags', () => {
  const cmd = buildXorissoCommand(DEFAULT_OS_CONFIG);
  const requiredFlags = [
    '-isohybrid-mbr',
    '-c boot/isolinux/boot.cat',
    '-b boot/isolinux/isolinux.bin',
    '-no-emul-boot',
    '-boot-load-size 4',
    '-boot-info-table',
    '-eltorito-alt-boot',
    '-e boot/grub/efi.img',
    '-isohybrid-gpt-basdat',
    'custom-tinycore.iso',
  ];
  for (const flag of requiredFlags) {
    assert.ok(cmd.includes(flag), `Missing xorriso flag: ${flag}`);
  }
});

test('generateAllArtifacts emits all 19 deliverables including kernel config, dual-arch ISO, Wine 10+ & Arabic keyboard layout', () => {
  const customConfig: OsBuildConfig = {
    ...DEFAULT_OS_CONFIG,
    targetArch: 'dual-x86-x86_64',
    desktopEnvironment: 'dual-plasma-openbox',
    browser: 'firefox-esr',
    desktopTheme: 'paper-light',
    panelPosition: 'top',
    keyboardLayout: 'us-ara',
    keyboardToggle: 'grp:alt_shift_toggle',
    volumeId: 'MY_CUSTOM_TC',
  };
  const artifacts = generateAllArtifacts(customConfig);
  assert.equal(artifacts.length, 19);

  const byPath = new Map(artifacts.map((a) => [a.path, a.content]));
  assert.ok(byPath.has('architecture_overview.md'));
  assert.ok(byPath.has('build_iso.sh'));
  assert.ok(byPath.has('setup_compat_layers.sh'));
  assert.ok(byPath.has('BUILD_AND_TEST.md'));
  assert.ok(byPath.has('kernel_configs/corepure64-android-wine.config'));
  assert.ok(byPath.has('ui_configs/kde-plasma/kdeglobals'));
  assert.ok(byPath.has('ui_configs/kde-plasma/kwinrc'));
  assert.ok(byPath.has('ui_configs/kde-plasma/baloofilerc'));
  assert.ok(byPath.has('ui_configs/kde-plasma/kxkbrc'));
  assert.ok(byPath.has('ui_configs/openbox/rc.xml'));
  assert.ok(byPath.has('ui_configs/openbox/autostart'));
  assert.ok(byPath.has('ui_configs/tint2/tint2rc'));
  assert.ok(byPath.has('ui_configs/rofi/config.rasi'));
  assert.ok(byPath.has('ui_configs/mimeapps.list'));

  const buildScript = byPath.get('build_iso.sh')!;
  assert.ok(buildScript.includes('firefox_ESR.tcz'));
  assert.ok(buildScript.includes('VOLUME_ID="MY_CUSTOM_TC"'));
  assert.ok(buildScript.includes('TARGET_ARCH="dual-x86-x86_64"'));
  assert.ok(buildScript.includes('bash.tcz'));
  assert.ok(buildScript.includes('dbus.tcz'));
  assert.ok(buildScript.includes('Xprogs.tcz'));
  assert.ok(buildScript.includes('setxkbmap.tcz'));
  assert.ok(buildScript.includes('xkeyboard-config.tcz'));
  assert.ok(buildScript.includes('00-keyboard.conf'));
  assert.ok(buildScript.includes('Option "XkbLayout" "us,ara"'));
  assert.ok(buildScript.includes('kde-plasma-lite.tcz'));
  assert.ok(buildScript.includes('wine10-wow64.tcz'));
  assert.ok(buildScript.includes('BOOTIA32.EFI'));
  assert.ok(buildScript.includes('cpuid -l'));
  assert.ok(buildScript.includes('ifcpu64.c32'));
  assert.ok(buildScript.includes('cde32'));
  assert.ok(buildScript.includes('/dev/binderfs'));
  assert.ok(buildScript.includes('DOSWin'));
  assert.ok(buildScript.includes('AndroidAPK'));
  assert.ok(buildScript.includes('/home/tc'));
  assert.ok(buildScript.includes('.x11_attempted'));

  assert.equal(DEFAULT_OS_CONFIG.keyboardLayout, 'us-ara');
  assert.equal(DEFAULT_OS_CONFIG.keyboardToggle, 'grp:alt_shift_toggle');

  const kxkbrc = byPath.get('ui_configs/kde-plasma/kxkbrc')!;
  assert.ok(kxkbrc.includes('LayoutList=us,ara'));
  assert.ok(kxkbrc.includes('VariantList=,'));
  assert.ok(kxkbrc.includes('DisplayNames=EN,AR'));
  assert.ok(kxkbrc.includes('Options=grp:alt_shift_toggle'));

  const obAutostart = byPath.get('ui_configs/openbox/autostart')!;
  assert.ok(obAutostart.includes('setxkbmap -model pc105 -layout "us,ara" -variant "," -option "" -option "grp:alt_shift_toggle"'));

  const kernelCfg = byPath.get('kernel_configs/corepure64-android-wine.config')!;
  assert.ok(kernelCfg.includes('CONFIG_NTSYNC=y'));
  assert.ok(kernelCfg.includes('CONFIG_ANDROID_BINDER_IPC=y'));
  assert.ok(kernelCfg.includes('CONFIG_ANDROID_BINDERFS=y'));
  assert.ok(kernelCfg.includes('CONFIG_BINFMT_MISC=y'));
  assert.ok(kernelCfg.includes('CONFIG_IA32_EMULATION=y'));

  assert.ok(byPath.get('ui_configs/kde-plasma/kdeglobals')!.includes('BreezeLight'));
  assert.ok(byPath.get('ui_configs/tint2/tint2rc')!.includes('panel_position = top center horizontal'));
  assert.ok(byPath.get('ui_configs/tint2/tint2rc')!.includes('#f8fafc 95'));
  assert.ok(byPath.get('ui_configs/openbox/rc.xml')!.includes('<top>40</top>'));
});

test('openbox-tint2 mode reduces idle RAM and omits kde-plasma-lite.tcz from manifest', () => {
  const plasmaEst = calculateResourceEstimate({
    ...DEFAULT_OS_CONFIG,
    desktopEnvironment: 'dual-plasma-openbox',
  });
  const openboxEst = calculateResourceEstimate({
    ...DEFAULT_OS_CONFIG,
    desktopEnvironment: 'openbox-tint2',
  });
  assert.ok(plasmaEst.idleRamMb > openboxEst.idleRamMb);

  const openboxManifest = getPackageManifest({
    ...DEFAULT_OS_CONFIG,
    desktopEnvironment: 'openbox-tint2',
  });
  assert.equal(openboxManifest.some((p) => p.name === 'kde-plasma-lite.tcz'), false);
});

test('getPackageManifest switches wine10-wow64 loadMode to ondemand when embedCompatInCore is false and wineOnDemand is true', () => {
  const onDemandManifest = getPackageManifest({
    ...DEFAULT_OS_CONFIG,
    embedCompatInCore: false,
    wineOnDemand: true,
  });
  const winePkg = onDemandManifest.find((p) => p.name === 'wine10-wow64.tcz');
  assert.ok(winePkg);
  assert.equal(winePkg.loadMode, 'ondemand');
});

test('x86-only architecture sets CONFIG_64BIT=n in kernel config and reduces base initrd size', () => {
  const x86Cfg: OsBuildConfig = { ...DEFAULT_OS_CONFIG, targetArch: 'x86' };
  const dualEst = calculateResourceEstimate(DEFAULT_OS_CONFIG);
  const x86Est = calculateResourceEstimate(x86Cfg);
  assert.ok(dualEst.baseInitrdMb > x86Est.baseInitrdMb);

  const artifacts = generateAllArtifacts(x86Cfg);
  const kernelCfg = artifacts.find((a) => a.path === 'kernel_configs/corepure64-android-wine.config')!.content;
  assert.ok(kernelCfg.includes('CONFIG_64BIT=n'));
});

test('createZipArchive writes valid PKZIP local and EOCD signatures', () => {
  const testBytes = new TextEncoder().encode('hello');
  assert.equal(crc32(testBytes), 0x3610a686);

  const zip = createZipArchive([
    { path: 'build_iso.sh', content: '#!/usr/bin/env bash\necho ok\n', executable: true },
    { path: 'ui_configs/mimeapps.list', content: '[Default Applications]\n' },
  ]);

  const view = new DataView(zip.buffer);
  // First 4 bytes: PK\x03\x04 (little endian 0x04034b50)
  assert.equal(view.getUint32(0, true), 0x04034b50);
  // Last 22 bytes: EOCD signature 0x06054b50 and entry count = 2
  const eocdOffset = zip.length - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);
});
