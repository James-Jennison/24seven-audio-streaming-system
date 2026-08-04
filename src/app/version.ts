export interface ApplicationVersion {
  version: string;
  buildId: string;
}

export function applicationVersion(
  environment: NodeJS.ProcessEnv = process.env,
): ApplicationVersion {
  return {
    version: environment.APP_VERSION ?? "0.1.0",
    buildId: environment.BUILD_ID ?? "local-dev",
  };
}
