export interface RemoteEnvironment {
  isCodespace: boolean;
  isRemoteContainer: boolean;
  codespaceName?: string;
  sonicPiHome?: string;
  audioStreamPort: number;
}

export function detectEnvironment(): RemoteEnvironment {
  const isCodespace =
    !!process.env.CODESPACES || !!process.env.CODESPACE_NAME;
  const isRemoteContainer =
    isCodespace || !!process.env.REMOTE_CONTAINERS || !!process.env.VSCODE_REMOTE_CONTAINERS_SESSION;

  return {
    isCodespace,
    isRemoteContainer,
    codespaceName: process.env.CODESPACE_NAME,
    sonicPiHome: process.env.SONIC_PI_HOME,
    audioStreamPort: parseInt(process.env.AUDIO_STREAM_PORT || "8080", 10),
  };
}
