export type TinyCoreVersion = '15.x' | '16.x';
export type TargetArchitecture = 'dual-x86-x86_64' | 'x86_64' | 'x86';
export type DesktopEnvironmentChoice = 'dual-plasma-openbox' | 'kde-plasma-lite' | 'openbox-tint2';
export type DesktopTheme = 'slate-dark' | 'paper-light';
export type PanelPosition = 'bottom' | 'top';
export type BrowserChoice = 'falkon' | 'firefox-esr' | 'midori';
export type TerminalChoice = 'lxterminal' | 'alacritty' | 'konsole';
export type FileManagerChoice = 'pcmanfm' | 'thunar' | 'dolphin';
export type WineVersionChoice = 'wine-10-wow64' | 'wine-10-staging';
export type AndroidRuntimeChoice = 'waydroid-cage' | 'qemu-android-microvm';
export type KeyboardLayoutChoice = 'us-ara' | 'ara-us' | 'us';
export type KeyboardToggleChoice = 'grp:alt_shift_toggle' | 'grp:ctrl_shift_toggle' | 'grp:win_space_toggle';

export interface OsBuildConfig {
  tcVersion: TinyCoreVersion;
  targetArch: TargetArchitecture;
  isoName: string;
  volumeId: string;
  hostname: string;
  desktopEnvironment: DesktopEnvironmentChoice;
  desktopTheme: DesktopTheme;
  panelPosition: PanelPosition;
  keyboardLayout: KeyboardLayoutChoice;
  keyboardToggle: KeyboardToggleChoice;
  browser: BrowserChoice;
  terminal: TerminalChoice;
  fileManager: FileManagerChoice;
  wineVersion: WineVersionChoice;
  androidRuntime: AndroidRuntimeChoice;
  kernelIntegration: boolean;
  embedCompatInCore: boolean;
  includeWifiFirmware: boolean;
  includeWine: boolean;
  wineOnDemand: boolean;
  persistenceLabel: string;
}

export interface ResourceEstimate {
  baseInitrdMb: number;
  xorgUiMb: number;
  utilitiesMb: number;
  wineSquashfsMb: number;
  androidImageMb: number;
  totalIsoMb: number;
  idleRamMb: number;
  wineActiveRamMb: number;
  androidActiveRamMb: number;
  extensionCount: number;
}

export interface ValidationIssue {
  field: keyof OsBuildConfig;
  message: string;
}

export interface GeneratedArtifact {
  path: string;
  category: 'docs' | 'scripts' | 'kernel' | 'ui_configs' | 'desktop';
  language: 'markdown' | 'bash' | 'xml' | 'ini' | 'css';
  summary: string;
  content: string;
}

export interface TczPackageSpec {
  name: string;
  layer: 'kernel-core' | 'base-ui' | 'graphics' | 'utilities' | 'network' | 'compat-wine' | 'compat-android';
  loadMode: 'kernel-builtin' | 'initrd-core' | 'onboot' | 'ondemand' | 'optional-sfs';
  sizeMb: number;
  purpose: string;
}

export const DEFAULT_OS_CONFIG: OsBuildConfig = {
  tcVersion: '15.x',
  targetArch: 'dual-x86-x86_64',
  isoName: 'custom-tinycore.iso',
  volumeId: 'COREPURE64_OS',
  hostname: 'corepure64',
  desktopEnvironment: 'dual-plasma-openbox',
  desktopTheme: 'slate-dark',
  panelPosition: 'bottom',
  keyboardLayout: 'us-ara',
  keyboardToggle: 'grp:alt_shift_toggle',
  browser: 'falkon',
  terminal: 'konsole',
  fileManager: 'dolphin',
  wineVersion: 'wine-10-wow64',
  androidRuntime: 'waydroid-cage',
  kernelIntegration: true,
  embedCompatInCore: true,
  includeWifiFirmware: true,
  includeWine: true,
  wineOnDemand: false,
  persistenceLabel: 'TC_PERSIST',
};
