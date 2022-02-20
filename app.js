const pm2 = require('pm2');
const pmx = require('pmx');
const gelf = require('gelf-pro');
const os = require('os');

const conf = pmx.initModule();

const PM2_MODULE_NAME = 'pm2-gelf-json'

const logger = function (...args) {
  console.log(`${PM2_MODULE_NAME}:`, ...args)
}

gelf.setConfig({
  adapterName: conf.gelfAdapterName,
  adapterOptions: {
    host: conf.graylogHost,
    port: conf.graylogPort,
  },
});

if (conf.graylogFields) {
  try {
    const fields = JSON.parse(conf.graylogFields);
    gelf.setConfig({ fields });
  } catch (ex) {
    logger(`Could not parse JSON ${ex}`);
  }
}

const levelMapping = {};
const gelfLogLevelsMapping = conf.gelfLogLevelsMapping || "0:7,10:7,20:7,30:6,40:4,50:3,60:0";
gelfLogLevelsMapping.split(",")
  .filter(Boolean)
  .map(x => x.split(":"))
  .map(x => [Number(x[0]), Number(x[1])])
  .forEach(x => {
    levelMapping[x[0]] = x[1]
  })

// https://github.com/kkamkou/node-gelf-pro/blob/master/README.md  
const LEVELS = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7
}

const logMethods = {}
Object.keys(LEVELS).forEach(name => {
  logMethods[LEVELS[name]] = gelf[name] || gelf.info
});

function toJSONSafe(data) {
  try {
    return JSON.parse(data)
  } catch (e) {
    if (conf.graylogLogParseErrors) {
      logger('Error (toJSONSafe)', data, e);
    }
    return null
  }
}

function logDataItem(data, explicitLevel) {
  let level = explicitLevel || LEVELS.info
  let logData = [data];

  if (data && (typeof data === 'string')) {
    const parsed = toJSONSafe(data)
    if (parsed) {
      if (parsed.level !== undefined) {
        level = levelMapping[Number(parsed.level)] || level
        delete parsed.level
      }
      let msg = ''
      if (parsed.msg) {
        msg = parsed.msg
        delete parsed.msg
      }
      logData = [msg, parsed]
    }
  }
  (logMethods[level] || logMethods[LEVELS.info]).apply(gelf, logData)
}

function splitLines(data) {
  if (data && typeof data === 'string') {
    return data.split(os.EOL).filter(x => x.trim());
  }
  return [];
}

function logData(data, explicitLevel) {
  try {
    if (conf.graylogSplitLines) {
      splitLines(data).forEach(s => logDataItem(s, explicitLevel))
    } else {
      logDataItem(data, explicitLevel)
    }
  } catch(e) {
    logger('Error (logData)', data, e);
  }
}


pm2.Client.launchBus((err, bus) => {
  if (err) return logger(`Error: ${err.message}`, err);

  logger(`Connected. Sending logs to ${conf.graylogHost}:${conf.graylogPort}.`);

  bus.on('log:out', (log) => {
    if (log.process.name === PM2_MODULE_NAME) return;
    logData(log.data)
  });

  bus.on('log:err', (log) => {
    if (log.process.name === PM2_MODULE_NAME) return;
    logData(log.data, LEVELS.error);    
  });

  bus.on('reconnect attempt', () => {
    logger('Reconnecting...');
  });

  bus.on('close', () => {
    pm2.disconnectBus();
    logger('Closed')
  });
});

