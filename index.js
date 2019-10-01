#!/usr/bin/env node

'use strict';

const R = require('ramda');

const cloudFormation = require('./services/cloudFormation');
const cloudWatchLogs = require('./services/cloudWatchLogs');
const dynamoDb = require('./services/dynamoDb');
const elasticsearch = require('./services/elasticsearch');
const lambda = require('./services/lambda');
const s3 = require('./services/s3');
const { prompt, sortByName } = require('./utils');

const main = async () => {
  const choices = [
    { name: 'CloudFormation', value: cloudFormation },
    { name: 'CloudWatch Logs', value: cloudWatchLogs },
    { name: 'DynamoDB', value: dynamoDb },
    { name: 'Elasticsearch', value: elasticsearch },
    { name: 'Lambda', value: lambda },
    { name: 'S3', value: s3 }
  ];

  let keepGoing = true;

  while (keepGoing) {
    const fn = await prompt({
      message: 'Service',
      type: 'list',
      choices: R.append(
        { name: 'Quit', value: async () => keepGoing = false },
        sortByName(choices)
      )
    });

    await fn.call();
    console.log();
  }
};

main();
