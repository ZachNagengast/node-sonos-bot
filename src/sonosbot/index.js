import {
  Sonos,
} from 'sonos';
import log from './logger';
import config from '../config';
import * as bot from './sonosbot';

export const help = () => {
  // STANDARD
  let message = 'Current commands:\n' +
    ' ===  ===  ===  ===  ===  ===  === \n' +
    '`;addd` _text_ : Add song to the end queue and start playing if idle. Will start with a fresh queue.\n' +
    '`;addnext` _text_ : Add song to play next in the queue.\n' +
    '`;search` _text_ : search for a track, does NOT add it to the queue\n' +
    '`;skip` : The current track is bad! ' + `${config.SKIP_LIMIT} votes will skip the track\n` +
    '`;keep` : The current track is great!' + `${config.VOTE_LIMIT} votes will prevent the track from being skipped\n` +
    '`;current` : list current track\n' +
    '`;skipcheck` : How many skip votes there are currently, as well as who has voted.\n' +
    '`;keepcheck` : How many keep votes there are currently, as well as who has voted.\n' +
    '`;volume` _number_ : sets volume\n' +
    ' ===  ===  ===  ===  ===  ===  === \n' +
    '`;bestof` : _text_ : Add top 10 tracks by the artist\n' +
    '`;addalbum` _text_ : Add an album to the queue and start playing if idle. Will start with a fresh queue.\n' +
    '`;searchalbum` _text_ : search for an album, does NOT add it to the queue\n' +
    '`;queue` : list current queue\n'

  // ADMIN
  message += ' ===  ===  ===  ===  ===  ===  === \n' +
    // '`;flush` : flush the current queue\n' +
    // '`;volume` _number_ : sets volume\n' +
    // '`;play` : start playing\n' +
    // '`;stop` : stop playing\n' +
    // '`;next` : play next track\n' +
    // '`;previous` : play previous track\n' +
    // '`;shuffle` : shuffle playlist\n'
    // '`;blacklist` : show users on blacklist\n' +
    // '`;blacklist add @username` : add `@username` to the blacklist\n' +
    // '`;blacklist del @username` : remove `@username` from the blacklist\n'
    '`;pause` : pause current track\n' +
    '`;resume` : resume after pause\n';
  message += ' ===  ===  ===  ===  ===  ===  === \n'
  bot.slackMessage(message);
};

export const sendCommand = (text, channel, userName, displayName, sendMessage) => {
  bot.setCommandCallback(sendMessage);

  const input = text.split(' ');
  let term = input[0].toLowerCase();
  term = term.indexOf(';') >= 0 ? term.replace(';', '').trim() : 'ignoring input';
  let matched = true;
  log('term', term);

  switch (term) {
    case 'help':
      help();
      break;
    case 'add':
      bot.addtrack(input, channel, userName);
      break;
    case 'addnext':
      bot.addnext(input, channel, userName);
      break;
    case ':aaaaaaaaaaaahhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh:':
      bot.addnext("Kirin J Callinan Big Enough".split(' '), channel, userName);
      break;
    case ':yeehaw:':
      bot.addnext("Old Town Road".split(' '), channel, userName);
      break;
    case 'cry':
      bot.slackMessage(':cry:')
    case 'ip':
      // Quickly find the current local ip address if it gets reassigned
      bot.slackMessage('Current IP: ' + require("ip").address());
      break;
    case 'bestof':
      bot.bestof(input, channel, userName);
      break;
    case 'addalbum':
      bot.addalbum(input, channel, userName);
      break;
    case 'searchalbum':
      bot.searchalbum(input, channel);
      break;
    case 'search':
      bot.search(input, channel, userName);
      break;
    case 'current':
    case 'wtf':
      bot.currentTrack(channel);
      break;
    case 'skip':
    case ':skip:':
      bot.skip(channel, userName);
      break;
    case 'skipcheck':
      bot.skipcheck(channel, userName);
      break;
    case 'lit':
    case 'keep':
    case 'vote':
    case ':litfam:':
      bot.vote(channel, userName);
      break;
    case 'keepcheck':
    case 'votecheck':
      bot.votecheck(channel, userName);
      break;
    case 'queue':
    case 'list':
    case 'ls':
    case 'playlist':
      bot.showQueue(channel);
      break;
    case 'sl':
    case 'train':
      bot.sl(channel, userName);
      break;
    case 'elvis':
    case 'theking':
      bot.theking(channel, userName);
      break;
    case 'count':
      bot.countQueue(channel);
      break;
    case 'status':
      bot.status(channel);
      break;
    case 'start':
      bot.play(input, channel);
      break;
    case 'pause':
      bot.pause(input, channel);
      break;
    case 'playpause':
    case 'resume':
      bot.resume(input, channel);
      break;
    case 'getvolume':
      bot.getVolume();
      break;
    case 'volume':
    case 'setvolume':
      bot.setVolume(input, userName);
      break;
    default:
      matched = false;
      break;
  }

  if (!matched) {
    if (config.ADMIN_LIST.indexOf(userName) === -1) {
      log(`User ${userName} is not admin`);
      // sendMessage(`Nice try ${userName}.`);
      return false;
    }
    log(`Admin term: ${term}`);
    switch (term) {
      case 'next':
        bot.nextTrack(channel);
        break;
      case 'previous':
        bot.previous(input, channel);
        break;
      case 'flush':
        bot.flush(input, channel);
        break;
      case 'releaseparty':
        bot.releaseparty(input, channel, userName);
        break;
        // case 'stop':
        //   _stop(input, channel)
        //   break
        // case 'shuffle':
        //   _shuffle(input, channel)
        //   break
        // case 'blacklist':
        //   _blacklist(input, channel)
        //   break
        // case 'test':
        //   _addToSpotifyPlaylist(input, channel)
        //   break
      case 'restart':
        bot.undefinedMethod();
        break;
      default:
        break;
    }
  }
  return true;
};

export const messageHandler = (message, channel, user, sendMessage) => {
  const {
    type,
    ts,
    text,
  } = message;

  let channelName = (channel != null ? channel.is_channel : undefined) ? '#' : '';
  channelName += (channel ? channel.name : 'UNKNOWN_CHANNEL');
  const userName = `<@${message.user}>`;
  log(`Received: ${type} ${channelName} ${userName} ${ts} "${text}"`);

  const displayName = (user != null ? user.display_name : undefined) != null ? `@${user.name}` : 'UNKNOWN_USER';

  if (type !== 'message' || (text == null) || (channel == null)) {
    const typeError = type !== 'message' ? `unexpected type ${type}.` : null;
    const textError = text == null ? 'text was undefined.' : null;
    const channelError = channel == null ? 'channel was undefined.' : null;
    const errors = [typeError, textError, channelError].filter(element => element !== null).join(' ');

    return log(`Could not respond. ${errors}`);
  }

  return sendCommand(text, channel, userName, displayName, sendMessage);
};

export const setup = () => {
  bot.setSonos(new Sonos(config.SONOS_IP));
};