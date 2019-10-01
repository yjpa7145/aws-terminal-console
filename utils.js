'use strict';

const R = require('ramda');
const inquirer = require('inquirer');

const listToQuotedStrings = items => {
	if (items.length === 1) {
		return `"${items[0]}"`;
	}

	if (items.length === 2) {
		return `"${items[0]}" and "${items[1]}"`;
	}

	const firstItems = items.slice(0, items.length - 1);
	const lastItem = items[items.length - 1];
	return `${firstItems.map(n => `"${n}"`).join(', ')}, and "${lastItem}"`;
};

const pluralize = (count, singular, plural = null) => {
	if (count === 1) {
		return singular;
	}

	return plural || `${singular}s`;
};

const prompt = async (hash = {}) => {
	const response = await inquirer.prompt([
		{
			suffix: ':',
			...hash,
			name: 'default'
		}
	]);

	return response.default;
};

module.exports = {
	listToQuotedStrings,
	pluralize,
	prompt,
	thread: (data, ...fns) => R.pipe.apply(null, fns)(data),
	sortByName: R.sortBy(R.prop('name'))
};
