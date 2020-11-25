# pm2-gelf-json

pm2 module for logging to Graylog with JSON support.

Inspired by [pm2-gelf-pro](https://github.com/sethblack/pm2-gelf-pro)

## Installation

```sh
pm2 install pm2-gelf-json
```

## Configuration

Basic gelf-pro settings.

```sh
$> pm2 set pm2-gelf-json:graylogHost graylog.myserver.org
$> pm2 set pm2-gelf-json:graylogPort 12201
$> pm2 set pm2-gelf-json:graylogFields '{"tag": "pm2"}'
```
