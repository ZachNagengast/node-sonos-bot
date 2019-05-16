export default {
  ADMIN_CHANNEL: process.env.ADMIN_CHANNEL || 'sonos',
  STANDARD_CHANNEL: process.env.STANDARD_CHANNEL || 'sonos',
  SKIP_LIMIT: process.env.SKIP_LIMIT || 5,
  VOTE_LIMIT: process.env.VOTE_LIMIT || 5,
  REPEAT_LIMIT: process.env.REPEAT_LIMIT || 6,
  QUEUE_LIMIT: process.env.QUEUE_LIMIT || 6,
  MAX_VOLUME: process.env.MAX_VOLUME || 30,
  MARKET: process.env.MARKET || 'US',
  SONOS_IP: process.env.SONOS_IP,
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SPOTIFY_TOKEN: process.env.SPOTIFY_TOKEN,
  ADMIN_LIST: ['<@U9WA0QEMN>', '<@U9JQVH5NG>'],
};
