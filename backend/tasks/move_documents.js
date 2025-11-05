// usage: node move_documents.js sourceCollection targetCollection batchSize

const mongoose = require('mongoose');
const dbConnection = require('../build/src/config/dbConnection.js');
// NOTE: This file will need to be manually uploaded to the pod running this script
const documentIds = require('./documentIds.json');

// Implementation for moveDocuments/insertBatch/deleteBatch copied and modified from
// https://stackoverflow.com/questions/27039083/mongodb-move-documents-from-one-collection-to-another-collection

const insertBatch = async (collection, documents) => {
  const bulkInsert = collection.initializeUnorderedBulkOp();

  let insertedIds = [];
  let id;
  documents.forEach(function(doc) {
    id = doc._id;
    // Insert without raising an error for duplicates
    bulkInsert.find({_id: id}).upsert().replaceOne(doc);
    insertedIds.push(id);
  });

  await bulkInsert.execute();
  return insertedIds;
}

const deleteBatch = async (collection, documents) => {
  const bulkRemove = collection.initializeUnorderedBulkOp();

  documents.forEach(function(doc) {
    bulkRemove.find({_id: doc._id}).deleteOne();
  });

  await bulkRemove.execute();
}

const moveDocuments = async (sourceCollectionName, targetCollectionName, batchSize) => {
  await dbConnection.connectDB();
  const db = mongoose.connection.db;

  const sourceCollection = db.collection(sourceCollectionName);
  const targetCollection = db.collection(targetCollectionName);

  const ids = documentIds.map(id => new mongoose.Types.ObjectId(id));
  filter = { _id: { $in: ids } };

  let count = await sourceCollection.find(filter).count();
  console.log("Moving " + count + " documents from " + sourceCollectionName + " to " + targetCollectionName);
  while ((count = await sourceCollection.find(filter).count()) > 0) {
    console.log(count + " documents remaining");
    sourceDocs = await sourceCollection.find(filter).limit(batchSize).toArray();
    idsOfCopiedDocs = await insertBatch(targetCollection, sourceDocs);

    targetDocs = await targetCollection.find({_id: { $in: idsOfCopiedDocs }}).toArray();
    await deleteBatch(sourceCollection, targetDocs);
  }
  console.log("Done!");

  return;
}

const main = async () => {
  let [_, __, sourceCollection, targetCollection, batchSize] = process.argv;
  batchSize = parseInt(batchSize);

  if ([sourceCollection, targetCollection, batchSize].includes(undefined)) {
    console.log("Error: Incorrect number of args.");
    console.log("Usage: node move_documents.js sourceCollection targetCollection batchSize");

    return;
  }

  if (isNaN(batchSize)) {
    console.log("Error: batchSize must be a Number. (Note: decimal values will be truncated to an integer.)");

    return;
  }

  await moveDocuments(sourceCollection, targetCollection, batchSize);

  return;
}

main().then((_) => {
  process.exit(0);
}, (error) => {
  console.log(`An error occurred: ${error.message}`);

  process.exit(1);
});
