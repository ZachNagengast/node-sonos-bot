import { RtmClient, RTM_EVENTS, MemoryDataStore } from '@slack/client';
import { messageHandler, setup } from './sonosbot';
import log from './sonosbot/logger';
import config from './config';

const start = () => {
  try {
    log('Config: ', config)
    const slack = new RtmClient(config.SLACK_TOKEN, {
      logLevel: 'error',
      dataStore: new MemoryDataStore(),
      autoReconnect: true,
      autoMark: true,
    });

    slack.on('open', () => {
      setup();
      log('Online!');
    });

    slack.on(RTM_EVENTS.MESSAGE, (message) => {
      const channel = slack.dataStore.getChannelGroupOrDMById(message.channel);
      const user = slack.dataStore.getUserById(message.user);
      messageHandler(message, channel, user, (response) => {
        slack.sendMessage(response, channel.id);
      });
    });

    slack.on('error', (error) => {
      log(`Error: ${error}`);
    });

    slack.login();
  } catch (error) {
    log('Error: ', error);
  }
};

start();
