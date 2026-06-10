interface AppConfig {
  apiBaseUrl: string;
  appName: string;
  version: string;
  environment: string;
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_URL || '/api',
  appName: import.meta.env.VITE_APP_NAME || 'ProjectManager',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  environment: import.meta.env.MODE || 'development',
};

export default config;
