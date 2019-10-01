'use strict';

const AWS = require('aws-sdk');
const pMap = require('p-map');
const R = require('ramda');
const { prompt, sortByName, thread } = require('../utils');

const s3 = () => new AWS.S3();

const createBucket = async () => {
  const Bucket = await prompt({ message: 'Bucket name' });

  await s3().createBucket({ Bucket }).promise();
};

const deleteS3Files = (s3Objs) => pMap(
  s3Objs,
  (s3Obj) => s3().deleteObject(s3Obj).promise(),
  { concurrency: 3 }
);

const deleteBucket = async () => {
  const Bucket = await prompt({ message: 'Bucket name' });

  const confirmation = await prompt({
    type: 'confirm',
    message: `Really delete bucket "${Bucket}"?`,
    default: false
  });

  if (confirmation) {
    const response = await s3().listObjects({ Bucket }).promise();
    const s3Objects = response.Contents.map((o) => ({
      Bucket,
      Key: o.Key
    }));

    await deleteS3Files(s3Objects);
    await s3().deleteBucket({ Bucket }).promise();
  }
};

const listBuckets = async () => {
  const filter = await prompt({ message: 'Filter' });

  const { Buckets } = await s3().listBuckets().promise();

  console.log();
  thread(
    Buckets,
    R.map(R.prop('Name')),
    R.filter(R.includes(filter)),
    R.join('\n'),
    console.log
  );
};

module.exports = async () => {
  const choices = [
    { name: 'Create bucket', value: createBucket },
    { name: 'List buckets', value: listBuckets },
    { name: 'Delete bucket', value: deleteBucket }
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
