'use strict';

const AWS = require('aws-sdk');
const R = require('ramda');
const { prompt, sortByName, thread } = require('../utils');

const lambda = () => new AWS.Lambda();

const listFunctions = async () => {
  const filter = await prompt({ message: 'Filter' });

  let response = { NextMarker: null };
  let names = [];
  do {
    response = await lambda().listFunctions({ Marker: response.NextMarker }).promise();
    names = names.concat(response.Functions.map(R.prop('FunctionName')));
  } while (response.NextMarker);

  console.log();
  thread(
    names,
    R.flatten,
    R.filter(R.includes(filter)),
    R.join('\n'),
    console.log
  );
};

const deleteFunction = async () => {
  const FunctionName = await prompt({ message: 'Function name' });

  const confirmation = await prompt({
    type: 'confirm',
    message: `Really delete function "${FunctionName}"?`,
    default: false
  });

  if (confirmation) {
    await lambda().deleteFunction({ FunctionName }).promise();
  }
};

module.exports = async () => {
  const choices = [
    { name: 'List functions', value: listFunctions },
    { name: 'Delete function', value: deleteFunction }
  ];

  const fn = await prompt({
    message: 'Command',
    type: 'list',
    choices: R.append(
      { name: 'Back to services menu', value: () => Promise.resolve() },
      sortByName(choices)
    )
  });

  await fn.call();
};
