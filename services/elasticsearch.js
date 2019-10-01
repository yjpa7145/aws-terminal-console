'use strict';

const AWS = require('aws-sdk');
const pWaitFor = require('p-wait-for');
const R = require('ramda');
const { prompt, sortByName, thread } = require('../utils');

const es = () => new AWS.ES();

const getDomainNames = () =>
  es().listDomainNames().promise()
    .then(R.prop('DomainNames'))
    .then(R.map(R.prop('DomainName')));

const domainStatus = async (DomainName) => {
  try {
    const { DomainStatus } = await es().describeElasticsearchDomain({ DomainName }).promise();

    if (DomainStatus.Created === false && DomainStatus.Deleted === false) return 'CREATING';
    if (DomainStatus.Created === true && DomainStatus.Deleted === false) return 'CREATED';
    if (DomainStatus.Created === true && DomainStatus.Deleted === true) return 'DELETING';
  }
  catch (err) {
    if (err.code === 'ResourceNotFoundException') return 'DOES_NOT_EXIST';
    else throw err;
  }
};

const deleteDomain = async () => {
  const filter = await prompt({ message: 'Search filter'});

  const allDomainNames = await getDomainNames();
  const matchingDomainNames = R.filter(R.includes(filter), allDomainNames);

  if (matchingDomainNames.length === 0) {
    console.log('No matching domains');
    return;
  }

  const domainsToDelete = await prompt({
    type: 'checkbox',
    message: 'Domains to delete',
    choices: R.sortBy(R.identity, matchingDomainNames)
  });

  if (domainsToDelete.length === 0) return;

  const confirmationMessage = `Really delete Elasticsearch ${pluralize(domainsToDelete.length, 'domain')} ${listToQuotedStrings(domainsToDelete)}?`;

  const reallyDelete = await prompt({
    type: 'confirm',
    message: confirmationMessage,
    default: false
  });

  if (!reallyDelete) return;

  await Promise.all(domainsToDelete.map(deleteDomain));

  const waitForDeletion = await prompt({
    type: 'confirm',
    message: 'Wait for domain to be deleted?',
    default: true
  });

  if (!waitForDeletion) return;

  for (const domainName of domainsToDelete) {
    await pWaitFor(
      async () => {
        process.stdout.write('.');
        return domainStatus(domainName).then((s) => s === 'DOES_NOT_EXIST')
      },
      { interval: 5000 }
    );
    console.log();
  }
};

const listDomains = async () => {
  const filter = await prompt({ message: 'Filter' });

  const domainNames = await getDomainNames();

  console.log();

  thread(
    domainNames,
    R.filter(R.includes(filter)),
    R.sortBy(R.identity),
    R.join('\n'),
    console.log
  );
};

const getDomainStatus = async () => {
  const domainName = await prompt({ message: 'Domain name' });
  console.log();
  console.log(await domainStatus(domainName));
};

module.exports = async () => {
  const choices = [
    { name: 'Delete domains', value: deleteDomain },
    { name: 'Get domain status', value: getDomainStatus },
    { name: 'List domains', value: listDomains }
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
