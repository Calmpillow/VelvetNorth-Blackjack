# Velvet North — Blackjack + Multiplayer (Combined Package)

This package keeps the original browser game and adds a separate Node.js WebSocket room-directory service. The game remains a static website; the multiplayer service is deployed separately as a backend service.

## Folder layout
- `index.html`, `style.css`, `game.js`: browser game and UI
- `config.js`: multiplayer service URL configuration
- `server/`: independent Node.js room directory/relay service

## Quick start (local)
1. Install Node.js 20+.
2. Open a terminal in `server/`, run `npm install`, then `npm start`.
3. Edit `config.js` and set `websocketUrl` to `ws://localhost:8787/ws`, and `httpUrl` to `http://localhost:8787`.
4. Serve the game folder from a local web server (do not open the HTML as a `file://` URL).

## Public hosting
Deploy the `server/` folder as a Node web service (the included root-level `render.yaml` is a Render Blueprint example). Set the game `config.js` to your deployed `wss://.../ws` and `https://...` endpoints. Host the static game separately on GitHub Pages or another static host. GitHub Pages cannot run the Node WebSocket process itself.

## Multiplayer features
- Up to 30 active rooms per backend process.
- Up to 12 players per blackjack table (matching the original game's seating design).
- Public room browser with refresh and 15-second refresh interval.
- Private rooms are hidden from the directory and require a room code and password. Passwords are stored as salted scrypt hashes.
- WebSocket heartbeat and dead-connection detection.
- Daily stale-room sweep and `/health` endpoint.

## Compatibility
The frontend uses browser-native WebSockets and responsive CSS, avoiding the PeerJS client dependency. Use `wss://` for public deployment and test on current Android Chrome/Samsung Internet and iOS Safari. A real-world test on physical phones still needs to be performed after the backend is deployed.

## Security and reliability notes
This is a casual-game room directory/relay, not an account system. The existing blackjack engine remains host-authoritative in the host's browser, so this is suitable for friendly virtual-chip play, not competitive or real-money play. Room data is in memory and rooms close when the host or backend goes offline. The daily task removes stale room records; it cannot promise zero downtime or self-repair a hosting provider. For production persistence, add a shared database, authenticated player identities, server-side blackjack logic, rate limits per IP/account, and provider monitoring.

## Original project changes
- Removed the hard-coded PeerJS signaling dependency.
- Added configurable WebSocket backend connection.
- Added public-room directory, private-room toggle/password and room join by code.
- Preserved existing character customization and blackjack UI.
- Added responsive directory styling and mobile-first room controls.
- Expanded every accessory category to 100 selectable shape/color combinations for both character presentations.
