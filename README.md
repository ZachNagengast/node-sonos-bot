# Node Sonos Bot
**Slack / Sonos / Spotify / Node.js - Control Sonos through #Slack**

Forked from https://github.com/htilly/zenmusic

Refactored with ❤️

**Configuration**

Enter all required info into the `example.env` and rename `docker-compose-example.yml` to `docker-compose.yml`

With Docker and docker-compose installed, simply run:

```
yarn install
docker-compose up -d
```

This will mount the local volume as the node server source, and uses `nodemon` to restart the server when local changes are detected.