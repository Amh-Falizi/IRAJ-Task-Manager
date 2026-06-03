# DevTeam Task Manager

A comprehensive full-stack task management and progress tracking application designed for software development teams, featuring Git branch generation and role-based permissions.

## Features

- **Project Management**: Track and manage issues, tasks, and features using a dynamic Kanban board.
- **Milestone Planning**: Define roadmaps, track active sprints, and visualize goals with Planning Mode and Timeline views.
- **Task Graph Visualization**: Interactively view blockers, sub-tasks, and complex task dependencies.
- **Product Documentation**: Write, edit, and safely store project PRDs, meeting notes, and architecture decisions with rich Markdown support.
- **Git Branch Generation**: Automatically generate git branch names based on task contexts and project keys, allowing smooth development sync.
- **Calendar & Workload**: View important deadlines and monitor team workload distributed out by month or week.
- **Team Access Control**: Establish secure team domains, custom roles (Admin, Manager, Member), and strict project visibility permissions.

## Tech Stack

- **Frontend**: React (v19) + Vite, TypeScript, Tailwind CSS, Lucide React (for UI design)
- **Visuals & Charts**: React Flow (`@xyflow/react`), Dagre, Recharts
- **Backend Application**: Node.js + Express.js API
- **Database Architecture**: SQLite (local schema storage)
- **AI Tooling**: Google Gemini (`@google/genai`) for intelligent string and branch generation features

## Development Requirements 

To get up and running, ensure you have the following installed:
- Node.js (v20+ recommended)

## Installation Guide

1. **Install Packages**  
   Download all dependencies defined in `package.json`:
   ```bash
   npm install
   ```

2. **Setup your Environment**  
   Create a `.env` file using the parameters in `.env.example` (if present) for authentication keys and the Gemini API key.

3. **Start the Development Server**
   Start both the Vite SPA and Express backend server smoothly using `tsx`:
   ```bash
   npm run dev
   ```
   *The server operates safely behind port 3000.*

4. **Build for Production**
   Compiles code via ESbuild for backend routing and Vite build for bundled static assets:
   ```bash
   npm run build
   ```
   Once built, start the robust production build:
   ```bash
   npm start
   ```

## License

This software is provided under the MIT License.
