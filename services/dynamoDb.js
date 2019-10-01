"use strict";

const AWS = require("aws-sdk");
const R = require("ramda");
const {
  listToQuotedStrings,
  pluralize,
  prompt,
  sortByName,
  thread
} = require("../utils");

const dynamo = () => new AWS.DynamoDB();

const deleteTable = TableName =>
  dynamo()
    .deleteTable({ TableName })
    .promise();

const getTableNames = async () => {
  let response = { LastEvaluatedTableName: null };
  let names = [];
  do {
    response = await dynamo()
      .listTables({ ExclusiveStartTableName: response.LastEvaluatedTableName })
      .promise();
    names = names.concat(response.TableNames);
  } while (response.LastEvaluatedTableName);

  return names;
};

const listTables = async () => {
  const filter = await prompt({ message: "Search filter" });

  const names = await getTableNames();

  console.log();
  thread(names, R.filter(R.includes(filter)), R.join("\n"), console.log);
};

const deleteTables = async () => {
  const filter = await prompt({ message: "Search filter" });

  const allTableNames = await getTableNames();
  const matchingTableNames = R.filter(R.includes(filter), allTableNames);

  const tableNames = await prompt({
    type: "checkbox",
    message: "Tables to delete",
    choices: R.sortBy(R.identity, matchingTableNames)
  });

  if (tableNames.length === 0) return;

  const confirmationMessage = `Really delete ${pluralize(
    tableNames.length,
    "table"
  )} ${listToQuotedStrings(tableNames)}?`;

  const reallyDelete = await prompt({
    type: "confirm",
    message: confirmationMessage,
    default: false
  });

  if (!reallyDelete) return;

  await Promise.all(tableNames.map(deleteTable));

  for (const TableName of tableNames) {
    console.log(`Waiting for table "${TableName}" to be deleted ...`);
    await dynamo()
      .waitFor("tableNotExists", { TableName })
      .promise();
  }
};

module.exports = async () => {
  const choices = [
    { name: "List tables", value: listTables },
    { name: "Delete tables", value: deleteTables }
  ];

  const fn = await prompt({
    message: "Command",
    type: "list",
    choices: R.append(
      { name: "Back to services menu", value: () => Promise.resolve() },
      sortByName(choices)
    )
  });

  await fn.call();
};
