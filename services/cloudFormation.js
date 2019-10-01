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

const cf = () => new AWS.CloudFormation();

const deleteStack = StackName =>
  cf()
    .deleteStack({ StackName })
    .promise();

const getStackNames = (nameFilter = null) =>
  cf()
    .listStacks({
      StackStatusFilter: [
        "CREATE_COMPLETE",
        "CREATE_FAILED",
        "CREATE_IN_PROGRESS",
        "DELETE_FAILED",
        "DELETE_IN_PROGRESS",
        "REVIEW_IN_PROGRESS",
        "ROLLBACK_COMPLETE",
        "ROLLBACK_FAILED",
        "ROLLBACK_IN_PROGRESS",
        "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
        "UPDATE_COMPLETE",
        "UPDATE_IN_PROGRESS",
        "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
        "UPDATE_ROLLBACK_COMPLETE",
        "UPDATE_ROLLBACK_FAILED",
        "UPDATE_ROLLBACK_IN_PROGRESS"
      ]
    })
    .promise()
    .then(R.prop("StackSummaries"))
    .then(R.map(R.prop("StackName")))
    .then(R.filter(R.includes(nameFilter)));

const isStackDoesNotExistError = err =>
  err.code === "ValidationError" &&
  err.message.startsWith("Stack with id ") &&
  err.message.endsWith(" does not exist");

const stackStatus = async StackName => {
  try {
    const response = await cf()
      .describeStacks({
        StackName
      })
      .promise();

    return response.Stacks[0].StackStatus;
  } catch (err) {
    if (isStackDoesNotExistError(err)) return "DOES_NOT_EXIST";
    else throw err;
  }
};

const deleteStacks = async () => {
  const nameFilter = await prompt({ message: "Search filter" });

  const stackNames = await getStackNames(nameFilter);

  const stacksToDelete = await prompt({
    type: "checkbox",
    message: "Stacks to delete",
    choices: R.sortBy(R.identity, stackNames)
  });

  if (stacksToDelete.length === 0) return;

  const reallyDelete = await prompt({
    type: "confirm",
    message: `Really delete ${pluralize(
      stacksToDelete.length,
      "stack"
    )} ${listToQuotedStrings(stacksToDelete)}?`,
    default: false
  });

  if (!reallyDelete) return;

  await Promise.all(stacksToDelete.map(deleteStack));

  for (const StackName of stacksToDelete) {
    console.log(`Waiting for stack "${StackName}" to be deleted ...`);
    await cf()
      .waitFor("stackDeleteComplete", { StackName })
      .promise();
  }
};

const listStacks = async () => {
  const nameFilter = await prompt({ message: "Search filter" });

  console.log();
  thread(
    await getStackNames(nameFilter),
    R.sortBy(R.identity),
    R.join("\n"),
    console.log
  );
};

const listStackResources = async () => {
  const StackName = await prompt({ message: "Stack name" });

  // TODO Handle NextToken
  const response = await cf()
    .listStackResources({ StackName })
    .promise();

  const resourceToLine = r => {
    const logicalResourceId = isNil(r.LogicalResourceId)
      ? ""
      : ` - ${r.LogicalResourceId}`;
    const physicalResourceId = isNil(r.PhysicalResourceId)
      ? ""
      : ` - ${r.PhysicalResourceId}`;
    const status =
      r.ResourceStatus === "CREATE_COMPLETE" ? "" : ` - ${r.ResourceStatus}`;

    return `${r.ResourceType}${logicalResourceId}${physicalResourceId}${status}`;
  };

  console.log();
  R.pipe(
    R.prop("StackResourceSummaries"),
    R.map(resourceToLine),
    R.sortBy(R.identity),
    R.join("\n"),
    console.log
  )(response);
};

const getStackStatus = async () => {
  const stackName = await prompt({ message: "Stack name" });

  console.log();
  console.log(await stackStatus(stackName));
};

const getStackEvents = async () => {
  const StackName = await getStackName();

  let response = { NextToken: null };
  let events = [];
  do {
    response = await cf()
      .describeStackEvents({
        StackName,
        NextToken: response.NextToken
      })
      .promise();
    events = events.concat(response.StackEvents);
  } while (response.NextToken);

  const eventToLine = event => {
    const physicalResourceId = R.isEmpty(event.PhysicalResourceId)
      ? ""
      : ` (${event.PhysicalResourceId})`;
    const reason = R.isNil(event.ResourceStatusReason)
      ? ""
      : `: ${event.ResourceStatusReason}`;

    return `${event.Timestamp.toISOString()} ${
      event.LogicalResourceId
    }${physicalResourceId} ${event.ResourceStatus}${reason}`;
  };

  thread(
    events,
    R.map(eventToLine),
    R.sortBy(R.identity),
    R.join("\n"),
    console.log
  );
};

module.exports = async () => {
  const choices = [
    { name: "Delete stacks", value: deleteStacks },
    { name: "Get stack events", value: getStackEvents },
    { name: "Get stack status", value: getStackStatus },
    { name: "List stacks", value: listStacks },
    { name: "List stack resources", value: listStackResources }
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
