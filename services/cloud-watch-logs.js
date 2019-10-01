'use strict';

const AWS = require('aws-sdk');
const R = require('ramda');

const {prompt, sortByName, thread} = require('../utils');

const logs = () => new AWS.CloudWatchLogs();

const deleteLogGroup = async () => {
	const logGroupName = await prompt({message: 'Log group name'});

	const confirmation = await prompt({
		type: 'confirm',
		message: `Really delete log group "${logGroupName}"?`,
		default: false
	});

	if (confirmation) {
		await logs()
			.deleteLogGroup({logGroupName})
			.promise();
	}
};

const listLogGroups = async () => {
	const filter = await prompt({message: 'Search filter'});

	let response = {nextToken: null};
	let names = [];
	do {
		// eslint-disable-next-line no-await-in-loop
		response = await logs()
			.describeLogGroups({nextToken: response.nextToken})
			.promise();
		names = names.concat(response.logGroups.map(R.prop('logGroupName')));
	} while (response.nextToken);

	thread(
		names,
		R.flatten,
		R.filter(R.includes(filter)),
		R.join('\n'),
		console.log
	);
};

module.exports = async () => {
	const choices = [
		{name: 'Delete log group', value: deleteLogGroup},
		{name: 'List log groups', value: listLogGroups}
	];

	const fn = await prompt({
		message: 'Command',
		type: 'list',
		choices: R.append(
			{name: 'Back to services menu', value: () => Promise.resolve()},
			sortByName(choices)
		)
	});

	await fn.call();
};
