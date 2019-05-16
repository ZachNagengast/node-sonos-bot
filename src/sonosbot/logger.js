import 'console-timestamp';

const log = (...args) => {
  console.log('MM-DD hh:mm:ss:iii  '.timestamp, ...args);
};

export default log;
