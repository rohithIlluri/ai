# Deploying to Render

Follow these steps to deploy your Battle Royale game to Render.com for free:

1. Create a Render account at https://render.com/

2. Connect your GitHub account to Render
   - Push this repository to GitHub first
   - In Render dashboard, click "New +" and select "Web Service"
   - Choose "Connect your GitHub account"
   - Select your repository

3. Configure your web service
   - Name: battle-royale (or any name you prefer)
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

4. Set environment variables (optional)
   - PORT: 10000 (Render will automatically set this, but you can specify if needed)
   - NODE_ENV: production

5. Click "Create Web Service"

6. Wait for deployment to complete
   - Render will automatically build and deploy your application
   - You'll get a URL like `https://battle-royale.onrender.com`

7. Share the URL with friends to play together!

## Local Development

When running locally, the server will use port 3000 by default. If port 3000 is already in use, the server will automatically try port 3001.

If you need to specify a different port, you can set the PORT environment variable:

```
PORT=8080 npm start
```

Or on Windows:

```
set PORT=8080 && npm start
```

## Alternative Free Hosting Options

### Railway.app
1. Create an account at https://railway.app/
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`
4. Initialize project: `railway init`
5. Deploy: `railway up`

### Fly.io
1. Create an account at https://fly.io/
2. Install Flyctl: `curl -L https://fly.io/install.sh | sh`
3. Login: `flyctl auth login`
4. Create app: `flyctl launch`
5. Deploy: `flyctl deploy`

### Glitch.com
1. Create an account at https://glitch.com/
2. Create a new project
3. Import from GitHub or upload files
4. Glitch will automatically deploy your app 