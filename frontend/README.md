# JanSamadhan — Frontend

React + Vite frontend for the JanSamadhan civic issue-reporting platform.

## Stack

- **React 19** with [Vite](https://vitejs.dev/) and HMR
- **Tailwind CSS** for styling
- **React Leaflet** for the interactive issue map
- **Recharts** for analytics dashboards
- **Oxlint** for linting

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment

Copy `../backend/.env.example` for reference. The frontend reads one env variable:

```
VITE_API_URL=http://localhost:5000/api
```

## Lint

```bash
npm run lint
```
