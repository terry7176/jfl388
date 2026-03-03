# Speed Skate Quiz — Multiplayer Classroom Game

A real-time multiplayer speed skating quiz game. Players join via browser, answer True/False questions about Korea, and race along a track. Correct answers move forward; wrong answers move backward. First to 30 steps or highest when time runs out wins!

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend:** Node.js + Express + Socket.io
- **Deployment:** Netlify (frontend) + Render.com (backend)

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```
   Or with auto-reload: `npm run dev`

3. Serve the frontend: Open `client/index.html` in a browser, or use a simple static server:
   ```bash
   npx serve client
   ```

4. In `client/client.js`, ensure `SERVER_URL` points to your server:
   - Local: `http://localhost:3001`
   - Production: Your Render.com URL

## Project Structure

```
/
├── client/
│   ├── index.html
│   ├── style.css
│   └── client.js
├── server/
│   └── server.js
├── package.json
└── README.md
```

## Deployment Instructions

### Render.com (Backend)

1. Push your project to GitHub.
2. In [Render](https://render.com), create a new **Web Service**.
3. Connect your GitHub repository.
4. Configure:
   - **Build command:** `npm install`
   - **Start command:** `node server/server.js`
5. Add environment variable: `NODE_ENV=production`
6. Deploy and copy the Render URL (e.g. `https://speedskate-server.onrender.com`).
7. Update `client/client.js`: set `SERVER_URL` to your Render URL.

### Netlify (Frontend)

1. In [Netlify](https://netlify.com), create a new site from GitHub.
2. Connect your repository.
3. Configure:
   - **Base directory:** `client`
   - **Publish directory:** `client`
   - **Build command:** (leave empty — static site)
4. Deploy.

### CORS

The server uses `cors: { origin: '*' }` for development. For production, you can restrict `origin` to your Netlify domain (e.g. `https://your-app.netlify.app`) in `server/server.js`.

## How to Play

1. Enter a username and click **Join Game**.
2. Wait for others (or start alone) and click **START GAME**.
3. Answer True/False questions — correct moves forward, wrong moves backward.
4. Race to 30 steps before the 3:30 timer ends.
5. Top 3 finishers appear on the podium. Click **Play Again** to reset.

## License

MIT
