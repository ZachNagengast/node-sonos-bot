# Node Sonos Bot
**Slack / Sonos / Spotify / Node.js - Control Sonos through #Slack**

Forked from https://github.com/htilly/zenmusic

Refactored with ❤️

**Configuration**

Enter all required info into the `.env-example` and rename to `.env`

With docker installed, simply run:

```
docker-compose up -d
```

This will mount the local volume as the node server source, and uses `nodemon` to restart the server when local changes are detected.