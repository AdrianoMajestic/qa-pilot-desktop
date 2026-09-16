# QA Pilot Desktop

Automated QA Desktop Platform powered by **Electron**, **React**, **TypeScript**, **Tailwind CSS**, and **electron-vite**, managed with **pnpm**.

---

## Architecture Overview

The codebase is organized with clear separation of concerns across Electron processes:

```
src/
├── main/               # Electron Main process
│   ├── index.ts        # App lifecycle & browser window management
│   └── ipc/            # IPC handler registry (Playwright worker hooks, system info)
│       └── handlers.ts
├── preload/            # Context Isolation bridge
│   ├── index.ts        # Secure contextBridge exposing typed APIs
│   └── index.d.ts      # TypeScript interfaces for window.electron & window.api
└── renderer/           # React Frontend Application
    └── src/
        ├── components/ # Modular UI components (Topbar, Sidebar, Dashboard, ConsoleLogs)
        ├── hooks/      # React hooks (useSystemStatus, IPC subscribers)
        ├── services/   # Electron IPC client adapters
        ├── types/      # Shared models & interfaces
        ├── assets/     # Tailwind CSS & static assets
        ├── App.tsx     # Root dark-themed shell container
        └── main.tsx    # React 19 entrypoint
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Installation

```bash
pnpm install
```

### Development

Starts Vite HMR and Electron in development mode:

```bash
pnpm dev
```

### Type Checking

Runs strict TypeScript type checking across both Node (main/preload) and Web (renderer) contexts:

```bash
pnpm run typecheck
```

### Production Build

Compiles all processes with `electron-vite`:

```bash
pnpm run build
```

Package executable installers:

```bash
# Windows
pnpm run build:win

# macOS
pnpm run build:mac

# Linux
pnpm run build:linux
```
