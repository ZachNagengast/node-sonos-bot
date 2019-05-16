import urllibsync from 'urllib-sync';
import urlencode from 'urlencode';
import log from './logger';
import config from '../config';

const adminChannel = config.ADMIN_CHANNEL;
const skipLimit = config.SKIP_LIMIT;
const voteLimit = config.VOTE_LIMIT;
const maxVolume = config.MAX_VOLUME;
const market = config.MARKET;
const searchLimit = 4;
const queueReportLimit = 5;


let commandCallback;
let sonos;

let trackHistory = [];

let skipCounter = 0;
let skipScore = [];
let skipBanned = false;
let skipTrack = ''; // What track was a skip called on
const skipLimitPerUser = 1;

let voteCounter = 0;
let voteScore = [];
const voteLimitPerUser = 1;

export const setCommandCallback = (callback) => {
  commandCallback = callback;
};

export const slackMessage = (message) => {
  commandCallback(message);
};

export const setSonos = (Sonos) => {
  sonos = Sonos;
};

export const getVolume = (callback) => {
  sonos.getVolume().then((vol) => {
    if (callback) {
      callback(vol);
      return;
    }

    log('The volume is: ', vol);
    slackMessage(`Volume is ${vol}`);
  }).catch(err => log('Error occurred: ', err));
};

export const setVolume = (input, userName) => {
  let vol = input[1];

  if (vol === undefined) {
    getVolume();
    return true;
  }

  if (isNaN(vol) || vol.indexOf('-') >= 0) {
    getVolume((volume) => {
      let setVol = Number(volume);
      switch (vol) {
        case 'up':
          setVol += 5;
          break;
        case 'down':
          setVol -= 5;
          break;

        default:
          break;
      }

      if (setVol > maxVolume) {
        setVol = maxVolume;
        slackMessage(`That's a bit extreme, ${userName}...`);
      }

      sonos.setVolume(setVol).then((currVol) => {
        log('The volume is: ', setVol);
        slackMessage(`Volume is ${setVol}`);
      }).catch((err) => {
        log('Error occurred %j', err);
      });
    });
  } else {
    vol = Number(vol);


    log(vol);
    if (vol > maxVolume) {
      vol = maxVolume;
      slackMessage(`That's a bit extreme, ${userName}...`);
    }

    sonos.setVolume(vol).then((currVol) => {
      log('The volume is: ', currVol);
    }).catch((err) => {
      log('Error occurred %j', err);
    });
    getVolume();
  }
};

export const previous = () => {
  sonos.previous((err, prev) => {
    log(err, prev);
  });
};

export const play = () => {
  sonos.play().then((result) => {
    status();
    log('Started playing - ', result);
  }).catch((err) => {
    log('Error occurred: ', err);
  });
};

export const playInternal = () => {
  sonos.play().then((result) => {
    log('playInternal, started playing', result);
  }).catch((err) => {
    log('Error occurred: ', err);
  });
};

export const stop = () => {
  sonos.stop().then((result) => {
    status();
    log('Stoped playing - ', result);
  }).catch((err) => {
    log('Error occurred: ', err);
  });
};

export const pause = () => {
  sonos.pause().then((result) => {
    status();
    log('Pause playing - ', result);
  }).catch((err) => {
    log('Error occurred: ', err);
  });
};

export const resume = () => {
  sonos.play().then((result) => {
    setTimeout(() => status(), 500);
    log('Resume playing - ', result);
  }).catch((err) => {
    log('Error occurred: ', err);
  });
};

export const flush = () => {
  sonos.flush().then((result) => {
    log('Flushed queue: ', JSON.stringify(result, null, 2));
    slackMessage('Sonos queue is clear.');
  }).catch((err) => {
    log('Error flushing queue: ', err);
  });
};

export const flushInt = () => {
  sonos.flush().then((result) => {
    log('Flushed queue: ', JSON.stringify(result, null, 2));
  }).catch((err) => {
    log('Error flushing queue: ', err);
  });
};


export const getQueue = () => {
  let res = null;
  sonos.getQueue((err, result) => {
    if (err) {
      log(err);
    }
    res = result;
  });
  return (res);
};

export const countQueue = (channel, cb) => {
  sonos.getQueue((err, result) => {
    if (err) {
      if (cb) {
        return (err, null);
      }
      log(err);
      slackMessage('Error getting queue length');
    } else {
      if (cb) {
        return cb(null);
      }
      slackMessage(result.total);
    }
    return cb(null);
  });
};

export const showQueue = (channel) => {
  sonos.getQueue().then((result) => {
    log('Current queue: ', JSON.stringify(result, null, 2))

    status(channel, (state) => {
      log(`DEBUG: showQueue, got state = ${state}`);
    });

    currentTrack(channel, (err, track) => {
      if (!result) {
        log(result);
        slackMessage('Seems like the queue is empty... Have you tried adding a song?!', channel.id)
      }
      if (err) {
        log(err);
      }

      let message = `Total tracks in queue: ${result.total}\n====================`;
      let foundCurrent = false;
      let queueCount = 0;
      result.items.map((item, i) => {
        if (queueCount < 6) {
          if (foundCurrent) {
            queueCount += 1;
            message += '\n';
            message += `>_#${i}_ *Title:* ${item.title}`;
            message += ` *Artist:* ${item.artist}`;
            if (queueCount > queueReportLimit) {
              message += '\n';
              message += '> ... and more.';
            }
          }

          if (item.title === track.title) {
            queueCount += 1;
            message += `\n:notes: _#${i}_ *Title:* ${item.title}`;
            message += ` *Artist:* ${item.artist}`;
            foundCurrent = true;
          }
        }
      });
      slackMessage(message);
    });
  }).catch((err) => {
    log('Error fetch queue:', err);
  });
};

export const skip = (channel, userName) => {
  log('skip...');
  currentTrackTitle((err, track) => {
    if (err) {
      log(err);
    }
    log(`_skip > track: ${track}`);

    // NOTE: The skipTrack is checked in _currentTrackTitle() so we
    // need to let that go through before checking if skip is banned.
    if (skipBanned) {
      slackMessage(`Sorry ${userName}, the people have voted and this track cannot be skipped...`);
      return;
    }

    // Need a delay before calling the rest
    if (!(userName in skipScore)) {
      skipScore[userName] = 0;
    }

    if (skipScore[userName] < skipLimitPerUser) {
      if (userName in voteScore) {
        slackMessage(`Having regrets, ${userName}? We're glad you came to your senses...`);
      }

      skipScore[userName] += 1;
      skipCounter += 1;
      slackMessage(`This is skip vote ${skipCounter}/${skipLimit} for ${track}`);
      if (skipCounter >= skipLimit) {
        nextTrack(channel, true);
        skipCounter = 0;
        skipScore = {};
      }
    }
  });
};

export const vote = (channel, userName) => {
  log('_vote...');
  currentTrackTitle((err, track) => {
    if (err) {
      log(err);
    }
    log('_vote > track: ' + track);

    if (!(userName in voteScore)) {
      voteScore[userName] = 0;
    }

    if (voteScore[userName] < voteLimitPerUser) {
      if (userName in skipScore) {
        slackMessage(`Changed your mind, ${userName}? Well, ok then...`);
      }

      voteScore[userName] += 1;
      voteCounter += 1;
      slackMessage(`This is keep vote ${voteCounter}/${voteLimit} for ${track}`);
      if (voteCounter >= voteLimit) {
        slackMessage('This track is now immune to skipping! (just this once)');
        voteCounter = 0;
        voteScore = {};
        skipBanned = true;
      }
    }
  });
};

export const votecheck = () => {
  log('_votecheck...');

  currentTrackTitle((err, track) => {
    log(`votecheck > track: ${track}`);

    slackMessage(`Keep vote is currently ${voteCounter}/${voteLimit} for ${track}`);
    const voters = Object.keys(voteScore);
    if (voters.length > 0) {
      slackMessage(`Voted by ${voters.join(',')}`);
    }
    if (err) {
      log(err);
    }
  });
};

export const skipcheck = () => {
  log('_skipcheck...');

  currentTrackTitle((err, track) => {
    if (err) {
      log(err);
    }
    log(`skipcheck > track: ${track}`);

    slackMessage(`Skip vote is currently ${skipCounter}/${skipLimit} for ${track}`);
    const skipers = Object.keys(skipScore);
    if (skipers.length > 0) {
      slackMessage(`Skipped by ${skipers.join(',')}`);
    }
  });
};

export const releaseparty = (input, channel, userName) => {
  const data = searchSpotify('Who let the dogs out'.split(' '), channel, userName, 1);
  if (!data) {
    return;
  }

  const {
    uri
  } = data.tracks.items[0];
  const albumImg = data.tracks.items[0].album.images[2].url;
  const trackName = `${data.tracks.items[0].artists[0].name} - ${data.tracks.items[0].name}`;

  log('Adding track:', trackName, 'with UID:', uri);

  sonos.getCurrentState().then((state) => {
    log('Got current state: ', state);
    sonos.currentTrack().then((track) => {
      log('State:', state, ' - flushing');
      sonos.queue(uri, track.queuePosition + 1).then((result) => {
        log('Queued the following: ', result);
        slackMessage(':party_otter_dance: :cool-doge: :party_otter_dance: :cool-doge: :party_otter_dance: :cool-doge: :party_otter_dance: *RELEASE PARTY* :party_otter_dance: :cool-doge: :party_otter_dance: :cool-doge: :party_otter_dance: :cool-doge: :party_otter_dance:');

        sonos.next().then(success => success).catch((err) => {
          log('Error occurred %j', err);
        });
      }).catch((err) => {
        slackMessage('Error! No spotify account?');
        log('Error occurred: ', err);
      });
    });
  }).catch((err) => {
    log('Error occurred %j', err);
  });
};

export const nextTrack = (channel, byPassChannelValidation) => {
  sonos.next().then(success => {
    log('_nextTrack > Playing Next track.. ')
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const currentTrack = (channel, cb, err) => {
  sonos.currentTrack().then((track) => {
    log('Got current track: ', track)
    if (err) {
      log(err, track)
      if (cb) {
        return cb(err, null)
      }
    } else {
      if (cb) {
        return cb(null, track)
      }

      log(track)
      let fmin = '' + Math.floor(track.duration / 60)
      fmin = fmin.length === 2 ? fmin : '0' + fmin
      let fsec = '' + track.duration % 60
      fsec = fsec.length === 2 ? fsec : '0' + fsec

      let pmin = '' + Math.floor(track.position / 60)
      pmin = pmin.length === 2 ? pmin : '0' + pmin
      let psec = '' + track.position % 60
      psec = psec.length === 2 ? psec : '0' + psec

      const message = `We're rocking out to *${track.artist}* - *${track.title}* (${pmin}:${psec}/${fmin}:${fsec})`;
      slackMessage(message);
    }
  }).catch((err) => {
    log('Error occurred %j', err);
  });
};

export const currentTrackTitle = (cb) => {
  sonos.currentTrack().then((trackResult) => {
    log('Got current track %j', trackResult);

    let track = '';

    track = trackResult.title;
    log('_currentTrackTitle > title: ' + track);
    log('_currentTrackTitle > skipTrack: ' + skipTrack);

    if (skipTrack !== '') {
      if (skipTrack !== track) {
        log('_currentTrackTitle > different track, reset!');
        skipCounter = 0;
        skipScore = {};
        skipBanned = false;
        voteCounter = 0;
        voteScore = {};
        addnextCounter = 0;
        addnextScore = {};
      } else {
        log('_currentTrackTitle > skipTrack is equal to track');
      }
    } else {
      log('_currentTrackTitle > skipTrack is empty');
    }
    skipTrack = track;
    log('_currentTrackTitle > last step, got track as: ' + track);

    cb(null, track);
  }).catch((err) => {
    log('Error occurred: ', err);
  })
}

export const addtrack = (input, channel, userName) => {
  var data = searchSpotify(input, channel, userName, 1);
  if (!data) {
    return
  }

  var explicit = data.tracks.items[0].explicit;
  if (explicit) {
    slackMessage('Sorry ' + userName + ', that track is NSFW', channel.id)
    return;
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  log('Adding track:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)

    if (state === 'stopped') {
      log('State:', state, ' - flushing')
      flushInt(input, channel)
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
      log('Adding track:', trackName)
      setTimeout(() => playInternal('play', channel), 1000)
    } else if (state === 'playing') {
      log('State:', state, ' - playing...')
      // Add the track to playlist...
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
    } else if (state === 'paused') {
      log('State:', state, ' - telling them no...')
      addToSpotify(userName, uri, albumImg, trackName, channel, 999, function () {
        if (channel.name === adminChannel) {
          slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      log('State:', state, ' - no idea what to do')

      slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => {
    log('Error occurred %j', err)
  })
}


export const addnext = (input, channel, userName) => {
  var data = searchSpotify(input, channel, userName, 1)
  if (!data) {
    return
  }

  var explicit = data.tracks.items[0].explicit;
  if (explicit) {
    slackMessage('Sorry ' + userName + ', that track is NSFW', channel.id)
    return;
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  log('Adding track:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)
    sonos.currentTrack().then(track => {
      log('Adding to position: ', track.queuePosition)

      if (state === 'stopped') {
        log('State:', state, ' - flushing')
        flushInt(input, channel)
        addToSpotify(userName, uri, albumImg, trackName, channel, track.queuePosition + 1)
        log('Adding track:', trackName)
        setTimeout(() => playInternal('play', channel), 1000)
      } else if (state === 'playing') {
        log('State:', state, ' - playing...')
        // Add the track to playlist...
        addToSpotify(userName, uri, albumImg, trackName, channel, track.queuePosition + 1)
      } else if (state === 'paused') {
        log('State:', state, ' - telling them no...')
        addToSpotify(userName, uri, albumImg, trackName, channel, track.queuePosition + 1, function () {
          if (channel.name === adminChannel) {
            slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
          }
        })
      } else if (state === 'transitioning') {
        log('State:', state, ' - no idea what to do')

        slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
      } else if (state === 'no_media') {
        slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
      } else {
        slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
      }
    });
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const addalbum = (input, channel, userName) => {
  var data = searchSpotifyAlbum(input, channel, userName, 1)
  if (!data) {
    return
  }

  var uri = data.albums.items[0].uri
  var trackName = data.albums.items[0].artists[0].name + ' - ' + data.albums.items[0].name
  var albumImg = data.albums.items[0].images[2].url

  log('Adding album:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)

    if (state === 'stopped') {
      flushInt(input, channel)
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
      log('Adding album:', trackName)
      // Start playing the queue automatically.
      setTimeout(() => playInternal('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
    } else if (state === 'paused') {
      addToSpotify(userName, uri, albumImg, trackName, channel, 999, function () {
        if (channel.name === adminChannel) {
          slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const append = (input, channel, userName) => {
  var data = searchSpotify(input, channel, userName, 1)
  if (!data) {
    return
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  log('Adding track:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)

    if (state === 'stopped') {
      log('State:', state, ' - apending')
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
      log('Adding track:', trackName)
      setTimeout(() => playInternal('play', channel), 1000)
    } else if (state === 'playing') {
      log('State:', state, ' - adding...')
      // Add the track to playlist...
      addToSpotify(userName, uri, albumImg, trackName, channel, 999)
    } else if (state === 'paused') {
      log('State:', state, ' - telling them no...')
      addToSpotify(userName, uri, albumImg, trackName, channel, 999, function () {
        if (channel.name === adminChannel) {
          slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      log('State:', state, ' - no idea what to do')

      slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const search = (input, channel, userName) => {
  var data = searchSpotify(input, channel, userName, searchLimit)
  if (!data) {
    return
  }

  var trackNames = []
  for (var i = 1; i <= data.tracks.items.length; i++) {
    var explicit = data.tracks.items[i - 1].explicit;
    var trackName = 'Sorry ' + userName + ', this track is NSFW';
    if (!explicit)
      trackName = data.tracks.items[i - 1].artists[0].name + ' - ' + data.tracks.items[i - 1].name

    trackNames.push(trackName)
  }

  // Print the result...
  var message = userName +
    ', I found the following track(s):\n```\n' +
    trackNames.join('\n') +
    '\n```\nIf you want to play it, use the `;add` command.\n'

  slackMessage(message, channel.id)
}

export const addToSpotify = (userName, uri, albumImg, trackName, channel, position, cb) => {
  log('DEBUG addToSpotify', uri)

  sonos.queue(uri, position).then(result => {
    log('Queued the following: ', result)

    var message = ''
    log('DEBUG queue:')
    var queueLength = result.FirstTrackNumberEnqueued
    log('queueLength', queueLength)
    message = 'Sure ' +
      userName +
      ', Added ' +
      trackName +
      ' to the queue!\n' +
      albumImg +
      '\nPosition in queue is ' +
      queueLength

    slackMessage(message, channel.id)

    if (cb) {
      cb();
    }
  }).catch(err => {
    slackMessage('Error! No spotify account?', channel.id)
    log('Error occurred: ', err)
  })


}

export const addToSpotifyPlaylist = (userName, uri, trackName, channel, cb) => {
  log('TrackName:', trackName)
  log('URI:', uri)
  sonos.queue(uri, 999).then(result => {
    log('Queued the following: ', result)

    var message = ''
    var queueLength = result.FirstTrackNumberEnqueued
    message = 'Sure ' +
      userName +
      ', Added "' +
      trackName +
      '" to the queue!\n' +
      '\nPosition in queue is ' +
      queueLength

    slackMessage(message, channel.id)
  }).catch(err => {
    slackMessage('Error! No spotify account?', channel.id)
    log('Error occurred: ', err)
  })
}

export const addToSpotifyArtist = (userName, trackName, spid, channel) => {
  log('DEBUG addToSpotifyArtist spid:' + spid)
  log('DEBUG addToSpotifyArtist trackName:' + trackName)

  var uri = 'spotify:artistTopTracks:' + spid
  sonos.queue(uri, 999).then(result => {
    log('Queued the following: ', result)

    var message = ''
    var queueLength = result.FirstTrackNumberEnqueued
    log('queueLength', queueLength)
    message = 'Sure ' +
      userName +
      ' Added most popular tracks by "' +
      trackName +
      '" to the queue!\n' +
      '\nPosition in queue is ' +
      queueLength

    slackMessage(message, channel.id)
  }).catch(err => {
    slackMessage('Error! No spotify account?', channel.id)
    log('Error occurred: ', err)
  })
}

export const addplaylist = (input, channel, userName) => {
  var data = searchSpotifyPlaylist(input, channel, userName, 1)
  if (!data) {
    return
  }

  var trackNames = []
  for (var i = 1; i <= data.playlists.items.length; i++) {
    var uri = data.playlists.items[i - 1].uri
    var trackName = data.playlists.items[i - 1].name
    trackNames.push(trackName)
  }

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)

    if (state === 'stopped') {
      flushInt(input, channel)
      addToSpotifyPlaylist(userName, uri, trackName, channel)
      log('Adding playlist:', trackName)
      // Start playing the queue automatically.
      playInternal('play', channel)
    } else if (state === 'playing') {
      // Add the track to playlist...
      addToSpotifyPlaylist(userName, uri, trackName, channel)
    } else if (state === 'paused') {
      addToSpotifyPlaylist(userName, uri, trackName, channel, function () {
        if (channel.name === adminChannel) {
          slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const bestof = (input, channel, userName) => {
  var data = searchSpotifyArtist(input, channel, userName, 1)
  if (!data) {
    return
  }
  log('DEBUG Result in bestof: ', JSON.stringify(data, null, 2))
  var trackNames = []
  for (var i = 1; i <= data.artists.items.length; i++) {
    if (i < 2) {
      var spid = data.artists.items[0].id
      var trackName = data.artists.items[i - 1].name
      trackNames.push(trackName)
    }
  }
  log('DEBUG bestof spid:' + spid)
  log('DEBUG bestof trackName:' + trackName)

  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)

    if (state === 'stopped') {
      flushInt(input, channel)
      addToSpotifyArtist(userName, trackName, spid, channel)
      log('Adding artist:', trackName)
      setTimeout(() => playInternal('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      addToSpotifyArtist(userName, trackName, spid, channel)
    } else if (state === 'paused') {
      addToSpotifyArtist(userName, trackName, spid, channel, function () {
        if (channel.name === adminChannel) {
          slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const searchSpotify = (input, channel, userName, limit) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request(
    'https://api.spotify.com/v1/search?q=' +
    query +
    '&type=track&limit=' +
    limit +
    '&market=' +
    market +
    '&access_token=' +
    accessToken
  )

  var data = JSON.parse(getapi.data.toString())
  log(JSON.stringify(data))
  if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
    slackMessage('Sorry ' + userName + ', I could not find that track :(', channel.id)
    return
  }

  return data
}

export const searchSpotifyPlaylist = (input, channel, userName, limit) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request(
    'https://api.spotify.com/v1/search?q=' +
    query +
    '&type=playlist&limit=' +
    limit +
    '&market=' +
    market +
    '&access_token=' +
    accessToken
  )

  var data = JSON.parse(getapi.data.toString())
  log(data)
  if (!data.playlists || !data.playlists.items || data.playlists.items.length === 0) {
    slackMessage('Sorry ' + userName + ', I could not find that playlist :(', channel.id)
    return
  }

  return data
}

export const searchSpotifyAlbum = (input, channel, userName, limit) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request(
    'https://api.spotify.com/v1/search?q=' +
    query +
    '&type=album&limit=' +
    limit +
    '&market=' +
    market +
    '&access_token=' +
    accessToken
  )

  var data = JSON.parse(getapi.data.toString())
  log(data)
  if (!data.albums || !data.albums.items || data.albums.items.length === 0) {
    slackMessage('Sorry ' + userName + ', I could not find that album :(', channel.id)
    return
  }

  return data
}

export const searchSpotifyArtist = (input, channel, userName, limit) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request(
    'https://api.spotify.com/v1/search?q=' +
    query +
    '&type=artist&limit=' +
    limit +
    '&market=' +
    market +
    '&access_token=' +
    accessToken
  )

  var data = JSON.parse(getapi.data.toString())
  log(data)
  if (!data.artists || !data.artists.items || data.artists.items.length === 0) {
    slackMessage('Sorry ' + userName + ', I could not find that artist :(', channel.id)
    return
  }

  return data
}

export const status = () => {
  sonos.getCurrentState().then(state => {
    log('Got current state: ', state)
    slackMessage("Sonos state is '" + state + "'");
  }).catch(err => {
    log('Error occurred %j', err)
  })
}

export const sl = (channel, userName) => {
  var train = '      oooOOOOOOOOOOO"\n' +
    '     o   ____          :::::::::::::::::: :::::::::::::::::: __|-----|__\n' +
    '     Y_,_|[]| --++++++ |[][][][][][][][]| |[][][][][][][][]| |  [] []  |\n' +
    '    {|_|_|__|;|______|;|________________|;|________________|;|_________|;\n' +
    '     /oo--OO   oo  oo   oo oo      oo oo   oo oo      oo oo   oo     oo\n' +
    '+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+'
  slackMessage('Just for you, ' + userName + '\n```\n' + train + '\n```\n', channel.id)
}

export const theking = (channel, userName) => {
  var theking = '                           \n' +

    "                        _ `.`'.\n" +
    '           ,.---._      \\`\\|   \\\n' +
    "          ,'       `-.__.'     ;\n" +
    "          |                   .'\n" +
    "        ,.-\\.__________,,.--'`\n" +
    '       /    `.             \\                   _\n' +
    "       |     |,.----. _ ,---.                .' )\n" +
    "       ,-..__'.'´´´´.\\=|.'´´´\\\\            .' .'\n" +
    "      | ._\\._||      |=||    ||         .' .'\n" +
    "      \\  -'; ||     // .-.   ||._    _'  /_`)\n" +
    "    .' '._.| |\\\\__.'/     \\_//   '..'\\\\ __D)`)\n" +
    "   /_      | '\\`'-'` (    |-''.\\ /'   \\\\ \\;-')\n" +
    "   '-.`-.  |   `> _/  `'-',    |' _,_  \\\\-'-'\n" +
    "      `'.`.\\   /   `-.___.-'  /   >,\\   \\\\\n" +
    "         `.\\`-'.           _.'_        _.-;\n" +
    "       ,-'' `.  `'-.__,__)' /,\\\\   _.-:'.|||\n" +
    "      /       `-._  ,;,.: \\/  _.-'; || ||||\n" +
    "     /_,_ |     _,`'-.';;'/  `'.  |||;.||||\n" +
    "    / >,\\ \\     >,\\   '. ;   _,_\\ ||'.||';\n" +
    "   ;       `._       _,_`.   >,\\ | |'|'\n" +
    "   |     .'.' `\\     >,\\ |    _.-' `\n" +
    "   ;\\  .'.'  |`-'._____ .-.-'`   |\n" +
    "   |||</'\\\\\\ `.       (( o ))_.-'\n" +
    "   ;|'; \\ `-'._)`''----`'-'`    /\n" +
    "   '|||  `.                   .'\n" +
    "    |||    `'. _,_'-.____.-''`\n" +
    "     |'     /  >,\\   /    |mx\n" +
    '           /        ; _,_ ;\n' +
    "          .'        | >,\\  \\\n" +
    '          /  .  -  - \\  _  -\\__\n' +
    "         ; -_..--'''--'._.-'`   `'-.\n" +
    "         |.'             `._________)\n" +
    "          ''''''''''''''''` ´´ "

  slackMessage('King of Rock and Roll, just for you ' + userName + '\n```\n' + theking + '\n```\n', channel.id)
}

export const searchplaylist = (input, channel) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=playlist&limit=3&market=' + market + '&access_token=' + accessToken)
  var data = JSON.parse(getapi.data.toString())
  log(data)
  if (data.playlists && data.playlists.items && data.playlists.items.length > 0) {
    var trackNames = []

    for (var i = 1; i <= data.playlists.items.length; i++) {
      //  var spid = data.playlists.items[i - 1].id
      //  var uri = data.playlists.items[i - 1].uri
      //  var external_url = data.playlists.items[i - 1].external_urls.spotify
      var trackName = data.playlists.items[i - 1].name

      trackNames.push(trackName)
    }

    var message = 'I found the following playlist(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addplaylist` command..\n'
    slackMessage(message, channel.id)
  } else {
    slackMessage('Sorry could not find that playlist :(', channel.id)
  }
}

export const searchalbum = (input, channel) => {
  let accessToken = getAccessToken(channel.id)
  if (!accessToken) {
    return false
  }

  var query = ''
  for (var i = 1; i < input.length; i++) {
    query += urlencode(input[i])
    if (i < input.length - 1) {
      query += ' '
    }
  }

  var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=album&limit=3&market=' + market + '&access_token=' + accessToken)
  var data = JSON.parse(getapi.data.toString())
  log(data)
  if (data.albums && data.albums.items && data.albums.items.length > 0) {
    var trackNames = []

    for (var i = 1; i <= data.albums.items.length; i++) {
      //  var spid = data.albums.items[i - 1].id
      //  var uri = data.albums.items[i - 1].uri
      //  var external_url = data.albums.items[i - 1].external_urls.spotify
      //           var trackName = data.albums.items[i-1].name;
      var trackName = data.albums.items[i - 1].artists[0].name + ' - ' + data.albums.items[i - 1].name

      trackNames.push(trackName)
    }

    var message = 'I found the following album(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addalbum` command..\n'
    slackMessage(message)
  } else {
    slackMessage('Sorry could not find that album :(')
  }
}

// export const blacklist = (input, channel) => {
//   if (channel.name !== adminChannel) {
//     return
//   }

//   var action = ((input[1]) ? input[1] : '')
//   var slackUser = ((input[2]) ? slack.dataStore.getUserById(input[2].slice(2, -1)) : '')

//   if (input[2] !== '' && typeof slackUser !== 'undefined') {
//     var username = '@' + slackUser.name
//   } else if (input[2] !== '') {
//     var message = 'The user ' + (input[2]) + ' is not a valid Slack user.'
//   }

//   if (action === '') {
//     message = 'The following users are blacklisted:\n```\n' + blacklist.join('\n') + '\n```'
//   } else if (typeof username !== 'undefined') {
//     if (action === 'add') {
//       var i = blacklist.indexOf(username)
//       if (i === -1) {
//         blacklist.push(username)
//         message = 'The user ' + username + ' has been added to the blacklist.'
//       } else {
//         message = 'The user ' + username + ' is already on the blacklist.'
//       }
//     } else if (action === 'del') {
//       if (i !== -1) {
//         blacklist.splice(i, 1)
//         message = 'The user ' + username + ' has been removed from the blacklist.'
//       } else {
//         message = 'The user ' + username + ' is not on the blacklist.'
//       }
//     } else {
//       message = 'Usage: `blacklist add|del @username`'
//     }
//   }
//   slackMessage(message, channel.id)
// }

export const getAccessToken = (channelid) => {
  if (config.SPOTIFY_TOKEN === '') {
    slackMessage('You did not set up an API key. Naughty.', channelid)
    return false
  }

  let getToken = urllibsync.request('https://accounts.spotify.com/api/token', {
    method: 'POST',
    data: {
      'grant_type': 'client_credentials'
    },
    headers: {
      'Authorization': 'Basic ' + config.SPOTIFY_TOKEN
    }
  })
  let tokendata = JSON.parse(getToken.data.toString())
  return tokendata.access_token
}