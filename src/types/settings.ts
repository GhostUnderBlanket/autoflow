export interface AppSettings {
  restBaseUrl:   string;
  restToken:     string;
  defaultShell:  'cmd' | 'powershell' | 'bash';
  nodeTimeout:   number;
  stopOnError:   boolean;
  closeToTray:   boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  restBaseUrl:   'https://asia-southeast1-pm-tools-758d0.cloudfunctions.net',
  restToken:     '',
  defaultShell:  'powershell',
  nodeTimeout:   30,
  stopOnError:   true,
  closeToTray:   true,
};
