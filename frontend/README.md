# AI Lab — Frontend

Angular 21 application for the AI Lab interface.

## Tech Stack

- Angular 21 (standalone components, signals)
- Tailwind CSS + daisyUI
- RxJS for HTTP communication
- Vitest for testing

## Development

From the project root:

```bash
npm run dev
```

This starts both backend and frontend. The frontend runs at [http://localhost:4200](http://localhost:4200).

To run only the frontend:

```bash
cd frontend
npm start
```

## Structure

```
src/app/
├── components/
│   ├── chat-panel/       # Main interaction area (provider/model selection, input, output)
│   └── metrics-panel/    # Token usage, cost estimate, latency display
├── services/
│   └── api.service.ts    # HTTP client for backend API
└── types/
    └── api.types.ts      # Request/response type definitions
```

## Styling

Primary: Tailwind CSS utility classes + daisyUI component classes.
Fallback: Angular Material — only when Tailwind/daisyUI cannot achieve the required functionality.
