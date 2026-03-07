# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | Yes                |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public issue.**

Instead, please use one of the following methods:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/bamr87/vs-sonic-pi/security/advisories/new)
2. **Email**: Open a private security advisory on the repository

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (if applicable)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix or mitigation**: Dependent on severity, targeting 30 days for critical issues

## Security Considerations

This extension communicates with a local Sonic Pi instance over UDP/OSC on `127.0.0.1`. It does not make external network connections. The primary security surface is:

- **OSC port binding**: The extension listens on a local UDP port for server responses
- **File system access**: Reading `.spi` files and writing WAV recordings to user-specified paths
- **Process spawning**: Optional daemon spawner for starting Sonic Pi components

## Scope

This policy covers the VS Code extension code in this repository. For vulnerabilities in Sonic Pi itself, please report to the [Sonic Pi project](https://github.com/sonic-pi-net/sonic-pi).
