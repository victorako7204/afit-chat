# Vercel Deployment Guide

## Configuration Files Updated

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/server.js"
    },
    {
      "src": "/socket.io/(.*)",
      "dest": "server/server.js"
    }
  ]
}
```

### server/server.js
- Exports `module.exports = app` for Vercel serverless functions
- Uses `process.env.PORT || 3000`
- Conditionally enables Socket.io only in development

---

## Environment Variables to Add in Vercel Dashboard

Go to your Vercel project → Settings → Environment Variables and add:

### Required

| Variable | Value | Description |
|----------|-------|-------------|
| `MONGO_URI` | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/afit-chat` | MongoDB Atlas connection string |
| `JWT_SECRET` | `your-super-secret-jwt-key` | Secret for JWT tokens (min 32 chars) |

### Optional

| Variable | Value | Description |
|----------|-------|-------------|
| `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | `your-api-key` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `your-api-secret` | Cloudinary API secret |
| `CLIENT_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |
| `NODE_ENV` | `production` | Set to production |

---

## Important Notes

### Real-time Features (Socket.io)

**Vercel serverless functions don't support WebSockets natively.**

Options for real-time chat:
1. **Use Socket.io with a separate WebSocket server** (e.g., deploy backend to Render/Railway)
2. **Use polling fallback** (messages still work, just not instant)
3. **Use a real-time service** like:
   - Pusher (recommended)
   - Ably
   - Socket.io with a dedicated WebSocket hosting

### Recommended Deployment Strategy

For full functionality, deploy:
- **Frontend**: Vercel (React)
- **Backend**: Render or Railway (Node.js with WebSocket support)

### After Adding Environment Variables

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable from the table above
5. Redeploy (Deployments → Redeploy latest)

### Alternative: Deploy Everything to Render

If you want WebSocket support, deploy to [Render](https://render.com) instead:

1. Create Web Service for backend (with `npm start`)
2. Connect to MongoDB Atlas
3. Update client `.env` with Render URL
4. Deploy frontend to Vercel

---

## Testing Locally

1. Backend:
```bash
cd server
npm install
npm run dev
```

2. Frontend:
```bash
cd client
npm install
npm start
```

3. Create `.env` files with your values
